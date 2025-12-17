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
import { aggregateToH3Hexbins, getHexbinColor, boundaryToLngLat, H3Hexbin, H3AggregationType, H3ColorRamp, H3ColorOptions, ScalingMethod, applyScaling } from "../../utils/h3Aggregation";

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
        let { minRadius, color1, color2, layer1Opacity, layer2Opacity, strokeColor, strokeWidth, chartType, enableBlur, blurRadius, enableGlow, glowColor, glowIntensity,
              hotspotIntensity, hotspotRadius, hotspotColor, hotspotGlowColor, hotspotBlurAmount, hotspotMinOpacity, hotspotMaxOpacity, hotspotScaleByValue, hotspotScalingMethod } = circleOptions;

        // High contrast mode: override colors with system colors
        if (this.options.isHighContrast && this.options.highContrastColors) {
            const hcColors = this.options.highContrastColors;
            color1 = hcColors.foreground;
            color2 = hcColors.hyperlink; // Use hyperlink color for secondary color to differentiate
            strokeColor = hcColors.background;
            strokeWidth = Math.max(2, strokeWidth); // Minimum 2px stroke in HC mode
        }

        // Hotspot mode: use hotspot-specific settings
        const isHotspot = chartType === 'hotspot';
        const isH3Hexbin = chartType === 'h3-hexbin';
        
        if (isHotspot) {
            enableGlow = true;
            enableBlur = true;
            // Use dedicated hotspot colors
            color1 = hotspotColor || color1;
            glowColor = hotspotGlowColor || hotspotColor || color1;
            glowIntensity = (hotspotIntensity || 1) * 15; // Scale intensity for glow
            blurRadius = hotspotBlurAmount || 15;
            strokeWidth = 0; // No stroke for hotspots
            // Calculate opacity based on min/max settings
            const minOp = (hotspotMinOpacity || 40) / 100;
            const maxOp = (hotspotMaxOpacity || 95) / 100;
            layer1Opacity = Math.min(maxOp, minOp + (hotspotIntensity || 1) * (maxOp - minOp) / 10);
        }

        // H3 Hexbin mode: aggregate points and render hexagons
        if (isH3Hexbin) {
            this.renderH3Hexbins(frameState, d3Projection, width, height);
            return this.options.svgContainer;
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
                
                // Calculate radius based on mode
                let radius1: number;
                if (isHotspot) {
                    const baseHotspotR = hotspotRadius || 20;
                    if (hotspotScaleByValue && circle1SizeValues[i] !== undefined && maxCircleSizeValue > minCircleSizeValue) {
                        // Apply scaling method for better distribution with outliers
                        const scalingMethod = (hotspotScalingMethod || 'logarithmic') as ScalingMethod;
                        const normalized = applyScaling(circle1SizeValues[i], minCircleSizeValue, maxCircleSizeValue, scalingMethod, circle1SizeValues);
                        // Scale hotspot size (between 0.3x and 1.5x base radius)
                        radius1 = baseHotspotR * (0.3 + normalized * 1.2);
                    } else {
                        radius1 = baseHotspotR;
                    }
                } else {
                    radius1 = circle1SizeValues[i] !== undefined ? circleScale(circle1SizeValues[i]) : minRadius;
                }
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
                    // Calculate opacity using scaling method
                    const minOp = (hotspotMinOpacity || 40) / 100;
                    const maxOp = (hotspotMaxOpacity || 95) / 100;
                    let pointOpacity = maxOp;
                    if (hotspotScaleByValue && circle1SizeValues[i] !== undefined && maxCircleSizeValue > minCircleSizeValue) {
                        const scalingMethod = (hotspotScalingMethod || 'logarithmic') as ScalingMethod;
                        const normalized = applyScaling(circle1SizeValues[i], minCircleSizeValue, maxCircleSizeValue, scalingMethod, circle1SizeValues);
                        pointOpacity = minOp + normalized * (maxOp - minOp);
                    }
                    
                    const hotspot = circles1Group.append('circle')
                        .attr('cx', x)
                        .attr('cy', y)
                        .attr('r', radius1)
                        .attr('fill', color1)
                        .attr('stroke', 'none')
                        .datum(feature.properties.selectionId)
                        .style('cursor', 'pointer')
                        .style('pointer-events', 'all')
                        .attr('fill-opacity', (d: any) => selectionOpacity(this.selectedIds, d, pointOpacity));

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
            labelOffset = 2,
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
                    labelY = y - radius - fontSize / 2 - labelOffset;
                    dominantBaseline = 'auto';
                    break;
                case 'below':
                    labelY = y + radius + fontSize / 2 + labelOffset;
                    dominantBaseline = 'hanging';
                    break;
                case 'left':
                    labelX = x - radius - labelOffset;
                    textAnchor = 'end';
                    break;
                case 'right':
                    labelX = x + radius + labelOffset;
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

    /**
     * Render H3 hexbin aggregated visualization
     */
    private renderH3Hexbins(
        frameState: FrameState,
        d3Projection: (coords: [number, number]) => [number, number] | null,
        width: number,
        height: number
    ): void {
        const { longitudes = [], latitudes = [], circle1SizeValues = [], circleOptions } = this.options;
        const { 
            h3Resolution = 4, 
            h3AggregationType = 'sum', 
            h3ColorRamp = 'viridis',
            h3FillColor = '#3182bd',
            h3StrokeColor = '#ffffff',
            h3StrokeWidth = 1,
            h3MinOpacity = 30,
            h3MaxOpacity = 90,
            h3ScalingMethod = 'logarithmic'
        } = circleOptions;

        // Remove existing hexbin group
        this.svg.select('#h3-hexbins-group').remove();
        const hexbinGroup = this.svg.append('g').attr('id', 'h3-hexbins-group');

        // Aggregate points to H3 hexbins
        const hexbins = aggregateToH3Hexbins(
            longitudes,
            latitudes,
            circle1SizeValues.length > 0 ? circle1SizeValues : undefined,
            {
                resolution: h3Resolution,
                aggregationType: h3AggregationType as H3AggregationType
            }
        );

        if (hexbins.length === 0) return;

        // Calculate min/max values for color scaling
        const values = hexbins.map(h => h.value);
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);

        // Prepare color options with scaling method
        const colorOptions: H3ColorOptions = {
            colorRamp: h3ColorRamp as H3ColorRamp,
            customColor: h3FillColor,
            minOpacity: h3MinOpacity,
            maxOpacity: h3MaxOpacity,
            scalingMethod: h3ScalingMethod as ScalingMethod,
            allValues: values // Pass all values for quantile calculation
        };

        // Render each hexbin as a polygon
        hexbins.forEach((hexbin: H3Hexbin) => {
            // Convert boundary from [lat, lng] to [lng, lat] and project
            const boundary = boundaryToLngLat(hexbin.boundary);
            const projectedBoundary = boundary.map(([lng, lat]) => d3Projection([lng, lat]));
            
            // Skip if any point fails projection
            if (projectedBoundary.some(p => p === null)) return;
            
            // Create SVG path data
            const pathData = projectedBoundary
                .map((p, i) => `${i === 0 ? 'M' : 'L'}${p![0]},${p![1]}`)
                .join(' ') + ' Z';

            // Get color based on value using color ramp
            const fillColor = getHexbinColor(hexbin.value, minValue, maxValue, colorOptions);

            // Create hexbin polygon
            const hexPath = hexbinGroup.append('path')
                .attr('d', pathData)
                .attr('fill', fillColor)
                .attr('stroke', h3StrokeColor)
                .attr('stroke-width', h3StrokeWidth)
                .style('cursor', 'pointer')
                .style('pointer-events', 'all');

            // Add tooltip showing aggregated value
            if (this.options.tooltipServiceWrapper) {
                const aggregationLabel = h3AggregationType.charAt(0).toUpperCase() + h3AggregationType.slice(1);
                const tooltipData: powerbi.extensibility.VisualTooltipDataItem[] = [
                    { displayName: aggregationLabel, value: hexbin.value.toLocaleString() },
                    { displayName: 'Point Count', value: hexbin.count.toString() }
                ];
                
                this.options.tooltipServiceWrapper.addTooltip(
                    hexPath,
                    () => tooltipData,
                    () => undefined, // No selection for aggregated hexbins
                    true
                );
            }

            // Click handler for selection (select all points in hexbin)
            if (this.options.allowInteractions !== false && hexbin.pointIndices.length > 0) {
                hexPath.on('click', (event: MouseEvent) => {
                    // Select first point in the hexbin as representative
                    const firstPointIndex = hexbin.pointIndices[0];
                    const selectionId = this.options.dataPoints?.[firstPointIndex]?.selectionId;
                    if (selectionId) {
                        const nativeEvent = event;
                        this.options.selectionManager.select(selectionId, nativeEvent.ctrlKey || nativeEvent.metaKey)
                            .then((selectedIds: powerbi.extensibility.ISelectionId[]) => {
                                this.selectedIds = selectedIds;
                                this.changed();
                            });
                    }
                });

                hexPath.on('contextmenu', (event: MouseEvent) => {
                    event.preventDefault();
                    const firstPointIndex = hexbin.pointIndices[0];
                    const selectionId = this.options.dataPoints?.[firstPointIndex]?.selectionId;
                    this.options.selectionManager.showContextMenu(
                        selectionId ? selectionId : {},
                        { x: event.clientX, y: event.clientY }
                    );
                });
            }
        });
    }

}

// Re-export with legacy name for backward compatibility
export { CircleSvgLayer as CircleLayer };
