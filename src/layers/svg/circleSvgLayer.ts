import { Layer } from 'ol/layer.js';
import { FrameState } from 'ol/Map';
import { State } from 'ol/source/Source';
import { transformExtent } from 'ol/proj.js';
import { Extent } from 'ol/extent.js';
import { arc as d3Arc } from 'd3-shape';
import { CircleLayerOptions, GeoJSONFeature, CircleLabelOptions } from '../../types/index';
import { DomIds } from "../../constants/strings";
import { createWebMercatorProjection } from "../../utils/map";
import { reorderForCirclesAboveChoropleth, selectionOpacity, setSvgSize } from "../../utils/graphics";

/**
 * SVG-based circle layer for rendering proportional symbols and pie/donut charts.
 * Uses D3.js for circle generation and SVG rendering.
 */
export class CircleSvgLayer extends Layer {

    private svg: any;
    private features: GeoJSONFeature[];
    public options: CircleLayerOptions;
    private selectedIds: powerbi.extensibility.ISelectionId[] = [];
    private isActive: boolean = true;

    constructor(options: CircleLayerOptions) {
        super({ ...options, zIndex: options.zIndex || 10 });

        this.svg = options.svg;
        this.options = options;

        this.features = options.dataPoints?.map((d, index) => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [d.longitude, d.latitude],
            },
            properties: {
                tooltip: d.tooltip,
                selectionId: d.selectionId
            },
        })) || [];

        this.changed(); // Trigger re-render

    }

    getSourceState(): State {
        return 'ready';
    }

    setActive(active: boolean) {
        this.isActive = active;
        this.changed(); // Trigger re-render
    }

    render(frameState: FrameState) {
        if (!this.isActive) return;

    const width = frameState.size[0];
    const height = frameState.size[1];
    const resolution = frameState.viewState.resolution;

    this.svg.select(`#${DomIds.CirclesGroup1}`).remove();
    this.svg.select(`#${DomIds.CirclesGroup2}`).remove();
    this.svg.select(`#${DomIds.CircleLabelsGroup}`).remove();
    this.svg.select('#circles-blur-glow-defs').remove();
    setSvgSize(this.svg, width, height);

    const d3Projection = createWebMercatorProjection(frameState, width, height);

        const { combinedCircleSizeValues = [], circle1SizeValues = [], circle2SizeValues = [], circleOptions, minCircleSizeValue = 0, maxCircleSizeValue = 100, circleScale: scaleFactor = 1 } = this.options;
        let { minRadius, color1, color2, layer1Opacity, layer2Opacity, strokeColor, strokeWidth, chartType, enableBlur, blurRadius, enableGlow, glowColor, glowIntensity, hotspotIntensity, hotspotRadius } = circleOptions;

        // High contrast mode: override colors with system colors
        if (this.options.isHighContrast && this.options.highContrastColors) {
            const hcColors = this.options.highContrastColors;
            color1 = hcColors.foreground;
            color2 = hcColors.hyperlink; // Use hyperlink color for secondary color to differentiate
            strokeColor = hcColors.background;
            strokeWidth = Math.max(2, strokeWidth); // Minimum 2px stroke in HC mode
        }

        // Hotspot mode: auto-enable glow and use hotspot-specific settings
        const isHotspot = chartType === 'hotspot';
        if (isHotspot) {
            enableGlow = true;
            glowIntensity = (hotspotIntensity || 1) * 15; // Scale intensity for glow
            glowColor = glowColor || color1;
            strokeWidth = 0; // No stroke for hotspots
            layer1Opacity = Math.min(1, (hotspotIntensity || 1) * 0.7); // Adjust opacity based on intensity
        }

        // Create SVG filter definitions for blur and glow effects
        if (enableBlur || enableGlow) {
            const defs = this.svg.append('defs').attr('id', 'circles-blur-glow-defs');
            
            if (enableBlur) {
                const blurFilter = defs.append('filter')
                    .attr('id', 'circles-blur-filter')
                    .attr('x', '-50%')
                    .attr('y', '-50%')
                    .attr('width', '200%')
                    .attr('height', '200%');
                blurFilter.append('feGaussianBlur')
                    .attr('in', 'SourceGraphic')
                    .attr('stdDeviation', blurRadius || 5);
            }
            
            if (enableGlow) {
                const effectiveGlowColor = glowColor && glowColor.length > 0 ? glowColor : color1;
                const glowFilter = defs.append('filter')
                    .attr('id', 'circles-glow-filter')
                    .attr('x', '-100%')
                    .attr('y', '-100%')
                    .attr('width', '300%')
                    .attr('height', '300%');
                // Create blur for glow
                glowFilter.append('feGaussianBlur')
                    .attr('in', 'SourceAlpha')
                    .attr('stdDeviation', glowIntensity || 10)
                    .attr('result', 'blur');
                // Colorize the blur
                glowFilter.append('feFlood')
                    .attr('flood-color', effectiveGlowColor)
                    .attr('flood-opacity', '0.8')
                    .attr('result', 'color');
                glowFilter.append('feComposite')
                    .attr('in', 'color')
                    .attr('in2', 'blur')
                    .attr('operator', 'in')
                    .attr('result', 'glow');
                // Merge glow with original
                const merge = glowFilter.append('feMerge');
                merge.append('feMergeNode').attr('in', 'glow');
                merge.append('feMergeNode').attr('in', 'SourceGraphic');
            }
        }

        // For donut/pie charts, we need to include the totals in our scaling calculations
        const allRelevantValues = [...combinedCircleSizeValues];
        if (chartType === 'donut-chart' || chartType === 'pie-chart') {
            // Add the totals of both values for each data point to our scaling context
            for (let i = 0; i < Math.min(circle1SizeValues.length, circle2SizeValues.length); i++) {
                if (circle1SizeValues[i] !== undefined && circle2SizeValues[i] !== undefined) {
                    allRelevantValues.push(circle1SizeValues[i] + circle2SizeValues[i]);
                }
            }
        }

        const circleScale = (value: number) => {
            // Use adaptive scaling logic consistent with visual.ts, but with all relevant values
            return this.applyAdaptiveScaling(value, minCircleSizeValue, maxCircleSizeValue, scaleFactor, circleOptions, allRelevantValues);
        };

    const circles1Group = this.svg.append('g').attr('id', DomIds.CirclesGroup1);
    const circles2Group = this.svg.append('g').attr('id', DomIds.CirclesGroup2);
    const labelsGroup = this.svg.append('g').attr('id', DomIds.CircleLabelsGroup);

    // Apply blur/glow filters to circle groups
    const filterUrl = enableGlow ? 'url(#circles-glow-filter)' : enableBlur ? 'url(#circles-blur-filter)' : null;
    if (filterUrl) {
        circles1Group.attr('filter', filterUrl);
        circles2Group.attr('filter', filterUrl);
    }

    // Get label options and values
    const { labelOptions, labelValues = [] } = this.options;
    const showLabels = labelOptions?.showLabels && labelValues.length > 0;

    // Store circle positions for label rendering
    const circlePositions: Array<{ x: number; y: number; radius: number; label: string }> = [];

        this.features.forEach((feature: GeoJSONFeature, i: number) => {
            if (!feature.geometry || feature.geometry.type !== 'Point') return;

            const [lon, lat] = feature.geometry.coordinates;
            const projected = d3Projection([lon, lat]);

            if (projected) {
                const [x, y] = projected;
                // For hotspot, use hotspotRadius directly; otherwise use scaled radius
                const hotspotR = hotspotRadius || 20;
                const radius1 = isHotspot ? hotspotR : (circle1SizeValues[i] !== undefined ? circleScale(circle1SizeValues[i]) : minRadius);
                const radius2 = circle2SizeValues[i] !== undefined ? circleScale(circle2SizeValues[i]) : minRadius;

                // Store position for label rendering
                if (showLabels && labelValues[i] !== undefined && labelValues[i] !== null) {
                    const effectiveRadius = Math.max(radius1, radius2);
                    circlePositions.push({
                        x,
                        y,
                        radius: effectiveRadius,
                        label: String(labelValues[i])
                    });
                }

                // Hotspot rendering - glowing heat points
                if (isHotspot) {
                    const hotspot = circles1Group.append('circle')
                        .attr('cx', x)
                        .attr('cy', y)
                        .attr('r', radius1)
                        .attr('fill', color1)
                        .attr('stroke', 'none')
                        .datum(feature.properties.selectionId)
                        .style('cursor', 'pointer')
                        .style('pointer-events', 'all')
                        .attr('fill-opacity', (d: any) => selectionOpacity(this.selectedIds, d, layer1Opacity));

                    if (feature.properties.tooltip) {
                        this.options.tooltipServiceWrapper.addTooltip(
                            hotspot,
                            () => feature.properties.tooltip,
                            () => feature.properties.selectionId,
                            true
                        );
                    }

                    // Click handler for hotspot (only if interactions are allowed)
                    if (this.options.allowInteractions !== false) {
                        hotspot.on('click', (event: MouseEvent) => {
                            const selectionId = feature.properties.selectionId;
                            const nativeEvent = event;
                            this.options.selectionManager.select(selectionId, nativeEvent.ctrlKey || nativeEvent.metaKey)
                                .then((selectedIds: powerbi.extensibility.ISelectionId[]) => {
                                    this.selectedIds = selectedIds;
                                    this.changed();
                                });
                        });

                        hotspot.on('contextmenu', (event: MouseEvent) => {
                            event.preventDefault();
                            const selectionId = feature.properties.selectionId;
                            this.options.selectionManager.showContextMenu(
                                selectionId ? selectionId : {},
                                { x: event.clientX, y: event.clientY }
                            );
                        });
                    }
                }
                // Chart rendering options
                else if (chartType === 'donut-chart' && circle2SizeValues.length > 0 && circle1SizeValues[i] !== undefined && circle2SizeValues[i] !== undefined) {
                    // Draw donut chart at (x, y)
                    const value1 = circle1SizeValues[i];
                    const value2 = circle2SizeValues[i];
                    const total = value1 + value2;
                    // Use the total of both values to determine the outer radius
                    const outerRadius = circleScale(total);
                    const innerRadius = Math.max(outerRadius * 0.6, 1); // 60% of outer radius, min 1px
                    const arcGen = d3Arc();

                    // First arc (value1)
                    const arc1 = circles2Group.append('path')
                        .attr('d', arcGen({
                            innerRadius,
                            outerRadius,
                            startAngle: 0,
                            endAngle: (value1 / total) * 2 * Math.PI
                        }))
                        .attr('fill', color1)
                        .attr('stroke', strokeColor)
                        .attr('stroke-width', strokeWidth)
                        .attr('transform', `translate(${x},${y})`)
                        .datum(feature.properties.selectionId)
                        .style('cursor', 'pointer')
                        .style('pointer-events', 'all')
                        .attr('fill-opacity', (d: any) => selectionOpacity(this.selectedIds, d, layer1Opacity));

                    // Second arc (value2)
                    const arc2 = circles2Group.append('path')
                        .attr('d', arcGen({
                            innerRadius,
                            outerRadius,
                            startAngle: (value1 / total) * 2 * Math.PI,
                            endAngle: 2 * Math.PI
                        }))
                        .attr('fill', color2)
                        .attr('stroke', strokeColor)
                        .attr('stroke-width', strokeWidth)
                        .attr('transform', `translate(${x},${y})`)
                        .datum(feature.properties.selectionId)
                        .style('cursor', 'pointer')
                        .style('pointer-events', 'all')
                        .attr('fill-opacity', (d: any) => selectionOpacity(this.selectedIds, d, layer2Opacity));

                    // Tooltip for donut
                    if (feature.properties.tooltip) {
                        this.options.tooltipServiceWrapper.addTooltip(
                            arc1,
                            () => feature.properties.tooltip,
                            () => feature.properties.selectionId,
                            true
                        );
                        this.options.tooltipServiceWrapper.addTooltip(
                            arc2,
                            () => feature.properties.tooltip,
                            () => feature.properties.selectionId,
                            true
                        );
                    }

                    // Click for donut arcs (only if interactions are allowed)
                    if (this.options.allowInteractions !== false) {
                        [arc1, arc2].forEach(arcElem => {
                            arcElem.on('click', (event: MouseEvent) => {
                                const selectionId = feature.properties.selectionId;
                                const nativeEvent = event;
                                this.options.selectionManager.select(selectionId, nativeEvent.ctrlKey || nativeEvent.metaKey)
                                    .then((selectedIds: powerbi.extensibility.ISelectionId[]) => {
                                        this.selectedIds = selectedIds;
                                        // Selection updated; trigger re-render
                                        this.changed();
                                    });
                            });

                            // Context menu for donut arcs
                            arcElem.on('contextmenu', (event: MouseEvent) => {
                                event.preventDefault();
                                const selectionId = feature.properties.selectionId;
                                this.options.selectionManager.showContextMenu(
                                    selectionId ? selectionId : {},
                                    { x: event.clientX, y: event.clientY }
                                );
                            });
                        });
                    }
                } else if (chartType === 'pie-chart' && circle2SizeValues.length > 0 && circle1SizeValues[i] !== undefined && circle2SizeValues[i] !== undefined) {
                    // Draw pie chart at (x, y)
                    const value1 = circle1SizeValues[i];
                    const value2 = circle2SizeValues[i];
                    const total = value1 + value2;
                    // Use the total of both values to determine the outer radius
                    const outerRadius = circleScale(total);
                    const innerRadius = 0; // Pie chart is a full disk
                    const arcGen = d3Arc();

                    // First arc (value1)
                    const arc1 = circles2Group.append('path')
                        .attr('d', arcGen({
                            innerRadius,
                            outerRadius,
                            startAngle: 0,
                            endAngle: (value1 / total) * 2 * Math.PI
                        }))
                        .attr('fill', color1)
                        .attr('stroke', strokeColor)
                        .attr('stroke-width', strokeWidth)
                        .attr('transform', `translate(${x},${y})`)
                        .datum(feature.properties.selectionId)
                        .style('cursor', 'pointer')
                        .style('pointer-events', 'all')
                        .attr('fill-opacity', (d: any) => {
                            if (this.selectedIds.length === 0) {
                                return layer1Opacity;
                            } else {
                                return this.selectedIds.some(selectedId => selectedId === d) ? layer1Opacity : layer1Opacity / 2;
                            }
                        });

                    // Second arc (value2)
                    const arc2 = circles2Group.append('path')
                        .attr('d', arcGen({
                            innerRadius,
                            outerRadius,
                            startAngle: (value1 / total) * 2 * Math.PI,
                            endAngle: 2 * Math.PI
                        }))
                        .attr('fill', color2)
                        .attr('stroke', strokeColor)
                        .attr('stroke-width', strokeWidth)
                        .attr('transform', `translate(${x},${y})`)
                        .datum(feature.properties.selectionId)
                        .style('cursor', 'pointer')
                        .style('pointer-events', 'all')
                        .attr('fill-opacity', (d: any) => {
                            if (this.selectedIds.length === 0) {
                                return layer2Opacity;
                            } else {
                                return this.selectedIds.some(selectedId => selectedId === d) ? layer2Opacity : layer2Opacity / 2;
                            }
                        });

                    // Tooltip for pie
                    if (feature.properties.tooltip) {
                        this.options.tooltipServiceWrapper.addTooltip(
                            arc1,
                            () => feature.properties.tooltip,
                            () => feature.properties.selectionId,
                            true
                        );
                        this.options.tooltipServiceWrapper.addTooltip(
                            arc2,
                            () => feature.properties.tooltip,
                            () => feature.properties.selectionId,
                            true
                        );
                    }

                    // Click for pie arcs (only if interactions are allowed)
                    if (this.options.allowInteractions !== false) {
                        [arc1, arc2].forEach(arcElem => {
                            arcElem.on('click', (event: MouseEvent) => {
                                const selectionId = feature.properties.selectionId;
                                const nativeEvent = event;
                                this.options.selectionManager.select(selectionId, nativeEvent.ctrlKey || nativeEvent.metaKey)
                                    .then((selectedIds: powerbi.extensibility.ISelectionId[]) => {
                                        this.selectedIds = selectedIds;
                                        // Selection updated; trigger re-render
                                        this.changed();
                                    });
                            });

                            // Context menu for pie arcs
                            arcElem.on('contextmenu', (event: MouseEvent) => {
                                event.preventDefault();
                                const selectionId = feature.properties.selectionId;
                                this.options.selectionManager.showContextMenu(
                                    selectionId ? selectionId : {},
                                    { x: event.clientX, y: event.clientY }
                                );
                            });
                        });
                    }
                } else {                   
                    const circle1 = circles1Group.append('circle')
                        .attr('cx', x)
                        .attr('cy', y)
                        .attr('r', radius1)
                        .attr('fill', color1)
                        .attr('stroke', strokeColor)
                        .attr('stroke-width', strokeWidth)
                        .datum(feature.properties.selectionId)
                        .style('cursor', 'pointer')
                        .style('pointer-events', 'all')
                        .attr('fill-opacity', (d: any) => selectionOpacity(this.selectedIds, d, layer1Opacity));

                    if (feature.properties.tooltip) {
                        this.options.tooltipServiceWrapper.addTooltip(
                            circle1,
                            () => feature.properties.tooltip,
                            () => feature.properties.selectionId,
                            true
                        );
                    }

                    // Click handler for circle1 (only if interactions are allowed)
                    if (this.options.allowInteractions !== false) {
                        circle1.on('click', (event: MouseEvent) => {
                            const selectionId = feature.properties.selectionId;
                            const nativeEvent = event;
                            this.options.selectionManager.select(selectionId, nativeEvent.ctrlKey || nativeEvent.metaKey)
                                .then((selectedIds: powerbi.extensibility.ISelectionId[]) => {
                                    this.selectedIds = selectedIds; // Update selected IDs
                                    // Selection updated; trigger re-render
                                    this.changed(); // Trigger re-render to apply new opacity
                                });
                        });

                        // Context menu for circle1
                        circle1.on('contextmenu', (event: MouseEvent) => {
                            event.preventDefault();
                            const selectionId = feature.properties.selectionId;
                            this.options.selectionManager.showContextMenu(
                                selectionId ? selectionId : {},
                                { x: event.clientX, y: event.clientY }
                            );
                        });
                    }

                    if (circle2SizeValues.length > 0) {
                        const circle2 = circles2Group.append('circle')
                            .attr('cx', x)
                            .attr('cy', y)
                            .attr('r', radius2)
                            .attr('fill', color2)
                            .attr('stroke', strokeColor)
                            .attr('stroke-width', strokeWidth)
                            .datum(feature.properties.selectionId)
                            .style('cursor', 'pointer')
                            .style('pointer-events', 'all')
                            .attr('fill-opacity', (d: any) => selectionOpacity(this.selectedIds, d, layer2Opacity));

                        if (feature.properties.tooltip) {
                            this.options.tooltipServiceWrapper.addTooltip(
                                circle2,
                                () => feature.properties.tooltip,
                                () => feature.properties.selectionId,
                                true
                            );
                        }

                        // Click handler for circle2 (only if interactions are allowed)
                        if (this.options.allowInteractions !== false) {
                            circle2.on('click', (event: MouseEvent) => {
                                const selectionId = feature.properties.selectionId;
                                const nativeEvent = event;
                                this.options.selectionManager.select(selectionId, nativeEvent.ctrlKey || nativeEvent.metaKey)
                                    .then((selectedIds: powerbi.extensibility.ISelectionId[]) => {
                                        this.selectedIds = selectedIds; // Update selected IDs
                                        // Selection updated; trigger re-render
                                        this.changed(); // Trigger re-render to apply new opacity
                                    });
                            });

                            // Context menu for circle2
                            circle2.on('contextmenu', (event: MouseEvent) => {
                                event.preventDefault();
                                const selectionId = feature.properties.selectionId;
                                this.options.selectionManager.showContextMenu(
                                    selectionId ? selectionId : {},
                                    { x: event.clientX, y: event.clientY }
                                );
                            });
                        }
                    }
                }
            }
        });

        // Render labels on top of circles
        if (showLabels && labelOptions && circlePositions.length > 0) {
            this.renderLabels(labelsGroup, circlePositions, labelOptions);
        }

        // Reorder groups to ensure circles are above choropleth
    reorderForCirclesAboveChoropleth(this.svg);

    // SVG is mounted once in visual.ts inside svgContainer
        return this.options.svgContainer;
    }

    /**
     * Render labels for circles
     */
    private renderLabels(
        labelsGroup: any,
        positions: Array<{ x: number; y: number; radius: number; label: string }>,
        options: CircleLabelOptions
    ): void {
        const {
            fontSize = 12,
            fontColor = '#333333',
            fontFamily = 'sans-serif',
            position = 'center',
            showBackground = false,
            backgroundColor = '#ffffff',
            backgroundOpacity = 80,
            backgroundPadding = 4,
            backgroundBorderRadius = 0,
            showBorder = false,
            borderColor = '#cccccc',
            borderWidth = 1,
            showHalo = true,
            haloColor = '#ffffff',
            haloWidth = 2
        } = options;

        positions.forEach(({ x, y, radius, label }) => {
            // Calculate label position based on position option
            let labelX = x;
            let labelY = y;
            let textAnchor = 'middle';
            let dominantBaseline = 'central';

            switch (position) {
                case 'above':
                    labelY = y - radius - fontSize / 2 - 4;
                    dominantBaseline = 'auto';
                    break;
                case 'below':
                    labelY = y + radius + fontSize / 2 + 4;
                    dominantBaseline = 'hanging';
                    break;
                case 'left':
                    labelX = x - radius - 4;
                    textAnchor = 'end';
                    break;
                case 'right':
                    labelX = x + radius + 4;
                    textAnchor = 'start';
                    break;
                case 'center':
                default:
                    // Keep centered
                    break;
            }

            // Create a group for this label
            const labelG = labelsGroup.append('g')
                .attr('class', 'circle-label');

            // Create text element first to measure it accurately
            const textElement = labelG.append('text')
                .attr('x', labelX)
                .attr('y', labelY)
                .attr('text-anchor', textAnchor)
                .attr('dominant-baseline', dominantBaseline)
                .attr('font-size', `${fontSize}px`)
                .attr('font-family', fontFamily)
                .attr('fill', fontColor)
                .text(label)
                .style('pointer-events', 'none'); // Labels don't intercept clicks

            // Add background rectangle if enabled (insert before text so text is on top)
            if (showBackground) {
                // Measure the actual rendered text
                const bbox = textElement.node()?.getBBox() || { x: labelX, y: labelY, width: 0, height: 0 };

                const rectWidth = bbox.width + backgroundPadding * 2;
                const rectHeight = bbox.height + backgroundPadding * 2;
                const rectX = bbox.x - backgroundPadding;
                const rectY = bbox.y - backgroundPadding;

                // Insert rect before text element (so text is rendered on top)
                const bgRect = labelG.insert('rect', 'text')
                    .attr('x', rectX)
                    .attr('y', rectY)
                    .attr('width', rectWidth)
                    .attr('height', rectHeight)
                    .attr('fill', backgroundColor)
                    .attr('fill-opacity', backgroundOpacity / 100)
                    .attr('rx', backgroundBorderRadius)
                    .attr('ry', backgroundBorderRadius);

                if (showBorder) {
                    bgRect
                        .attr('stroke', borderColor)
                        .attr('stroke-width', borderWidth);
                }
            }

            // Add halo (text stroke) for readability
            if (showHalo && haloWidth > 0) {
                textElement
                    .attr('stroke', haloColor)
                    .attr('stroke-width', haloWidth)
                    .attr('paint-order', 'stroke fill');
            }
        });
    }

    // Expose SVG for external handlers
    getSvg() {
        return this.svg;
    }

    // Get the spatial extent of the features (circle or choropleth)
    getFeaturesExtent(): Extent {

        // Calculate extent for circle features
        const options = this.options as CircleLayerOptions;
        return this.calculateCirclesExtent(options.longitudes, options.latitudes);

    }

    // Calculate extent for circle features
    private calculateCirclesExtent(longitudes: number[], latitudes: number[]): Extent {
        // Return a zero-sized transformed extent if inputs are empty or mismatched
        if (!Array.isArray(longitudes) || !Array.isArray(latitudes) ||
            longitudes.length === 0 || latitudes.length === 0 ||
            longitudes.length !== latitudes.length) {
            return transformExtent([0, 0, 0, 0], 'EPSG:4326', 'EPSG:3857');
        }

        const minX = Math.min(...longitudes);
        const maxX = Math.max(...longitudes);
        const minY = Math.min(...latitudes);
        const maxY = Math.max(...latitudes);

        const extent = [minX, minY, maxX, maxY];
        return transformExtent(extent, 'EPSG:4326', 'EPSG:3857'); // Transform to map projection
    }

    setSelectedIds(selectionIds: powerbi.extensibility.ISelectionId[]) {
        this.selectedIds = selectionIds;
    }

    // Adaptive scaling method that matches the logic in visual.ts
    private applyAdaptiveScaling(value: number, minValue: number, maxValue: number, scaleFactor: number, circleOptions: any, allDataValues: number[]): number {
        // Handle adaptive scaling for outliers - same logic as visual.ts
        // When adaptive scaling is active, maxValue represents the 95th percentile
        // Values beyond this should get additional radius scaling
        
        if (value > maxValue && allDataValues && allDataValues.length > 0) {
            const actualMax = Math.max(...allDataValues);
            
            if (actualMax > maxValue) {
                // We're in adaptive scaling mode - apply outlier scaling for values beyond 95th percentile
                const outlierRange = actualMax - maxValue;
                
                if (outlierRange > 0) {
                    const outlierPosition = Math.min((value - maxValue) / outlierRange, 1); // 0-1 position in outlier range
                    
                    // Calculate radius at the 95th percentile (maxValue)
                    const minRadiusSquared = circleOptions.minRadius * circleOptions.minRadius;
                    const p95Radius = Math.sqrt(minRadiusSquared + (maxValue - minValue) * scaleFactor);
                    
                    // Apply compressed outlier scaling beyond 95th percentile
                    // Use 80% of remaining radius space for outliers (increased from 60%)
                    const remainingRadiusSpace = circleOptions.maxRadius - p95Radius;
                    const maxOutlierBonus = remainingRadiusSpace * 0.8;
                    const outlierRadiusBonus = maxOutlierBonus * outlierPosition;
                    
                    const finalRadius = Math.min(p95Radius + outlierRadiusBonus, circleOptions.maxRadius);
                    
                    // Debug logging for outlier scaling
                    // Outlier scaling applied
                    
                    return finalRadius;
                }
            }
        }
        
        // Standard scaling for values within normal range (5th percentile to 95th percentile)
        const clampedValue = Math.max(minValue, Math.min(value, maxValue));
        
        // Use square-root scaling (area scales linearly with data values)
        const minRadiusSquared = circleOptions.minRadius * circleOptions.minRadius;
        const scaledAreaSquared = minRadiusSquared + (clampedValue - minValue) * scaleFactor;
        return Math.sqrt(scaledAreaSquared);
    }

}

// Re-export with legacy name for backward compatibility
export { CircleSvgLayer as CircleLayer };
