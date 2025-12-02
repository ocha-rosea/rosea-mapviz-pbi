import { Layer } from 'ol/layer.js';
import { fromLonLat } from 'ol/proj.js';
import { State } from 'ol/source/Source';
import { ChoroplethLayerOptions, GeoJSONFeature, NestedGeometryStyle } from '../../types/index';
import { geoBounds, geoPath, geoMercator } from 'd3-geo';
import { Extent } from 'ol/extent.js';
import { FrameState } from 'ol/Map';
import { DomIds } from "../../constants/strings";
// TopoJSON imports removed - simplification now handled by GeometrySimplificationService in orchestrator
import ISelectionId = powerbi.visuals.ISelectionId;
import { createWebMercatorProjection } from "../../utils/map";
import { reorderForCirclesAboveChoropleth, selectionOpacity, setSvgSize } from "../../utils/graphics";

const NO_DATA_COLOR = "rgba(0,0,0,0)";
const isNoDataValue = (value: any): boolean => {
    if (value === null || value === undefined) return true;
    if (typeof value === "number") {
        return !Number.isFinite(value);
    }
    if (typeof value === "string") {
        return value.trim().length === 0;
    }
    return false;
};

// Default nested geometry style
const DEFAULT_NESTED_STYLE: NestedGeometryStyle = {
    showPoints: true,
    pointRadius: 4,
    pointColor: '#000000',
    pointStrokeColor: '#ffffff',
    pointStrokeWidth: 1,
    showLines: true,
    lineColor: '#333333',
    lineWidth: 2
};

/**
 * SVG-based choropleth layer for rendering filled polygon maps.
 * Uses D3.js for path generation and SVG rendering.
 * 
 * Note: Geometry simplification is now handled by GeometrySimplificationService
 * in the orchestrator layer (Phase 3 refactoring).
 */
export class ChoroplethSvgLayer extends Layer {

    private svg: any;
    private geojson: any;
    public options: ChoroplethLayerOptions;
    public valueLookup: { [key: string]: number | null | undefined };
    private d3Path: any;
    private selectedIds: powerbi.extensibility.ISelectionId[] = [];
    private isActive: boolean = true;
    // Internal TopoJSON LOD fields removed - simplification now handled by orchestrator
    // TODO (Phase 4): Revisit zoom-level simplification for all engines

    constructor(options: ChoroplethLayerOptions) {
        super({ ...options, zIndex: options.zIndex || 10 });

        this.svg = options.svg;
        this.options = options;
        this.geojson = options.geojson;
        // simplificationStrength no longer used - handled by orchestrator

        // Create a lookup table for measure values
        this.valueLookup = {};
        const pCodes = options.categoryValues as string[];
        const colorValues = options.measureValues as Array<number | null | undefined>;
        pCodes.forEach((pCode, index) => {
            this.valueLookup[pCode] = colorValues[index];
        });

        this.d3Path = null;
        // Geometry is pre-simplified by orchestrator via GeometrySimplificationService
        // No internal TopoJSON conversion or LOD caching needed

        this.changed();
    }

    getSourceState(): State {
        return 'ready';
    }

    setActive(active: boolean) {
        this.isActive = active;
        this.changed();
    }

    render(frameState: FrameState) {
        if (!this.isActive) return;

    const width = frameState.size[0];
    const height = frameState.size[1];
    const resolution = frameState.viewState.resolution;

        // Clear existing paths
    this.svg.select(`#${DomIds.ChoroplethGroup}`).remove();

        // Set SVG dimensions to match the map viewport
    setSvgSize(this.svg, width, height);

        // Calculate the correct scale factor for D3's geoMercator (Web Mercator)
    // Configure D3's projection to align with OpenLayers
    const d3Projection = createWebMercatorProjection(frameState, width, height);

        this.d3Path = geoPath().projection(d3Projection);

        // Create a group element for choropleth
    const choroplethGroup = this.svg.append('g').attr('id', DomIds.ChoroplethGroup);
    
    // Create sub-groups for proper z-order: polygons < lines < points
    const polygonGroup = choroplethGroup.append('g').attr('class', 'choropleth-polygons');
    const lineGroup = choroplethGroup.append('g').attr('class', 'choropleth-lines');
    const pointGroup = choroplethGroup.append('g').attr('class', 'choropleth-points');

        // Create a lookup for data points
        const dataPointsLookup = this.options.dataPoints?.reduce((acc, dpoint) => {
            acc[dpoint.pcode] = dpoint;
            return acc;
        }, {} as { [key: string]: any }) || {};

    // Simplify features dynamically based on zoom level with topology-preserving LODs
    const simplified = this.getSimplifiedGeoJsonForResolution(resolution);
    
    // Get nested geometry styling
    const nestedStyle: NestedGeometryStyle = this.options.nestedGeometryStyle || DEFAULT_NESTED_STYLE;

        // Render features - now with separate passes for polygon, line, and point geometries
    simplified.features.forEach((feature: GeoJSONFeature) => {
            const pCode = feature.properties[this.options.dataKey];
            const valueRaw = this.valueLookup[pCode];
            
            // In high contrast mode, use foreground color for all data regions
            // Otherwise, use the normal color scale
            let fillColor: string;
            let strokeColor: string;
            let strokeWidth: number;
            
            const dataPoint = dataPointsLookup[pCode];
            const isSelected = this.selectedIds.length > 0 && 
                this.selectedIds.some(s => dataPoint?.selectionId && 
                    (s as any).equals?.(dataPoint.selectionId) || s === dataPoint?.selectionId);
            
            if (this.options.isHighContrast && this.options.highContrastColors) {
                // High contrast mode: use system colors
                if (pCode === undefined || isNoDataValue(valueRaw)) {
                    fillColor = NO_DATA_COLOR;
                } else if (isSelected) {
                    // Use foregroundSelected for selected items
                    fillColor = this.options.highContrastColors.foregroundSelected;
                } else {
                    fillColor = this.options.highContrastColors.foreground;
                }
                strokeColor = this.options.highContrastColors.background;
                strokeWidth = Math.max(2, this.options.strokeWidth); // Minimum 2px stroke in HC mode
            } else {
                // Normal mode: use configured color scale
                fillColor = (pCode === undefined || isNoDataValue(valueRaw))
                    ? NO_DATA_COLOR
                    : this.options.colorScale(valueRaw);
                strokeColor = this.options.strokeColor;
                strokeWidth = this.options.strokeWidth;
            }
            
            const opacity = selectionOpacity(this.selectedIds, dataPoint?.selectionId, this.options.fillOpacity);

            // Extract and render different geometry types
            const geometries = this.extractGeometries(feature.geometry);
            
            // Render polygons (base layer)
            for (const geom of geometries.polygons) {
                const polyFeature = { type: 'Feature', geometry: geom, properties: feature.properties };
                const path = polygonGroup.append('path')
                    .datum(polyFeature)
                    .style('cursor', 'pointer')
                    .style('pointer-events', 'all')
                    .attr('d', this.d3Path)
                    .attr('stroke', strokeColor)
                    .attr('stroke-width', strokeWidth)
                    .attr('fill', fillColor)
                    .attr('fill-opacity', opacity);
                
                this.attachInteractions(path, dataPoint);
            }
            
            // Render lines (middle layer)
            if (nestedStyle.showLines) {
                for (const geom of geometries.lines) {
                    const lineFeature = { type: 'Feature', geometry: geom, properties: feature.properties };
                    const path = lineGroup.append('path')
                        .datum(lineFeature)
                        .style('cursor', 'pointer')
                        .style('pointer-events', 'all')
                        .attr('d', this.d3Path)
                        .attr('stroke', nestedStyle.lineColor)
                        .attr('stroke-width', nestedStyle.lineWidth)
                        .attr('fill', 'none')
                        .attr('stroke-linecap', 'round')
                        .attr('stroke-linejoin', 'round')
                        .attr('opacity', opacity);
                    
                    this.attachInteractions(path, dataPoint);
                }
            }
            
            // Render points (top layer)
            if (nestedStyle.showPoints) {
                for (const geom of geometries.points) {
                    const coords = geom.type === 'Point' 
                        ? [geom.coordinates] 
                        : geom.coordinates;
                    
                    for (const coord of coords) {
                        const projected = d3Projection(coord as [number, number]);
                        if (!projected) continue;
                        
                        const circle = pointGroup.append('circle')
                            .attr('cx', projected[0])
                            .attr('cy', projected[1])
                            .attr('r', nestedStyle.pointRadius)
                            .attr('fill', nestedStyle.pointColor)
                            .attr('stroke', nestedStyle.pointStrokeColor)
                            .attr('stroke-width', nestedStyle.pointStrokeWidth)
                            .attr('opacity', opacity)
                            .style('cursor', 'pointer')
                            .style('pointer-events', 'all');
                        
                        this.attachInteractions(circle, dataPoint);
                    }
                }
            }
            
            // If no polygons were rendered (e.g., original single polygon/multipolygon without GeometryCollection),
            // render the feature directly
            if (geometries.polygons.length === 0 && 
                (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')) {
                const path = polygonGroup.append('path')
                    .datum(feature)
                    .style('cursor', 'pointer')
                    .style('pointer-events', 'all')
                    .attr('d', this.d3Path)
                    .attr('stroke', strokeColor)
                    .attr('stroke-width', strokeWidth)
                    .attr('fill', fillColor)
                    .attr('fill-opacity', opacity);
                
                this.attachInteractions(path, dataPoint);
            }
        });

        // Re-order layers to ensure circles are on top
    reorderForCirclesAboveChoropleth(this.svg);

    // SVG is mounted once in visual.ts inside svgContainer

        return this.options.svgContainer;
    }
    
    /**
     * Attaches tooltip and click/contextmenu handlers to an SVG element.
     */
    private attachInteractions(element: any, dataPoint: any) {
        // Add tooltip
        if (dataPoint?.tooltip) {
            this.options.tooltipServiceWrapper.addTooltip(
                element,
                () => dataPoint.tooltip,
                () => dataPoint.selectionId,
                true
            );
        }

        // Add click handler for selection (only if interactions are allowed)
        if (this.options.allowInteractions !== false) {
            element.on('click', (event: MouseEvent) => {
                if (!dataPoint?.selectionId) return;

                const nativeEvent = event;
                this.options.selectionManager.select(dataPoint.selectionId, nativeEvent.ctrlKey || nativeEvent.metaKey)
                    .then((selectedIds: ISelectionId[]) => {
                        this.selectedIds = selectedIds;
                        this.changed();
                    });
            });

            // Add context menu handler for right-click
            element.on('contextmenu', (event: MouseEvent) => {
                event.preventDefault();
                const selectionId = dataPoint?.selectionId;
                this.options.selectionManager.showContextMenu(
                    selectionId ? selectionId : {},
                    { x: event.clientX, y: event.clientY }
                );
            });
        }
    }
    
    /**
     * Extracts and categorizes geometries from a feature, handling GeometryCollections.
     */
    private extractGeometries(geometry: any): { polygons: any[], lines: any[], points: any[] } {
        const result = { polygons: [] as any[], lines: [] as any[], points: [] as any[] };
        this.collectGeometries(geometry, result);
        return result;
    }
    
    /**
     * Recursively collects geometries by type.
     */
    private collectGeometries(geom: any, result: { polygons: any[], lines: any[], points: any[] }) {
        if (!geom || !geom.type) return;
        
        switch (geom.type) {
            case 'Point':
            case 'MultiPoint':
                result.points.push(geom);
                break;
            case 'LineString':
            case 'MultiLineString':
                result.lines.push(geom);
                break;
            case 'Polygon':
            case 'MultiPolygon':
                result.polygons.push(geom);
                break;
            case 'GeometryCollection':
                for (const g of (geom.geometries || [])) {
                    this.collectGeometries(g, result);
                }
                break;
        }
    }

    // Geometry is pre-simplified by orchestrator - just return the geojson directly
    // TODO (Phase 4): Revisit zoom-level simplification for all engines
    private getSimplifiedGeoJsonForResolution(_resolution: number) {
        return this.geojson;
    }

    getd3Path() {
        return this.d3Path;
    }

    getSvg() {
        return this.svg;
    }

    getFeaturesExtent(): Extent {
        const bounds = geoBounds(this.geojson);
        const minCoords = fromLonLat(bounds[0], 'EPSG:3857');
        const maxCoords = fromLonLat(bounds[1], 'EPSG:3857');
        const extent = [...minCoords, ...maxCoords];
        return extent;
    }

    setSelectedIds(selectionIds: powerbi.extensibility.ISelectionId[]) {
        this.selectedIds = selectionIds;
    }
}

// Re-export with legacy name for backward compatibility
export { ChoroplethSvgLayer as ChoroplethLayer };
