import { Layer } from 'ol/layer.js';
import { FrameState } from 'ol/Map';
import { State } from 'ol/source/Source';
import { ChoroplethLayerOptions, GeoJSONFeature, NestedGeometryStyle } from '../../types';
import { getCanvasAndCtx, mercatorProjector } from './canvasUtils';
import * as d3 from 'd3';
import { createWebMercatorProjection } from '../../utils/map';
import { selectionOpacity } from '../../utils/graphics';
import type { Extent } from 'ol/extent.js';
import { transformExtent } from 'ol/proj.js';

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

export class ChoroplethCanvasLayer extends Layer {
  public options: ChoroplethLayerOptions;
  private selectedIds: powerbi.extensibility.ISelectionId[] = [];
  private isActive = true;
  private valueLookup: { [key: string]: number | null | undefined } = {};
  private geojson: any;

  constructor(options: ChoroplethLayerOptions) {
    super({ ...options, zIndex: options.zIndex || 10 });
    this.options = options;
    this.geojson = options.geojson;
    const pCodes = options.categoryValues as string[];
  const vals = options.measureValues as Array<number | null | undefined>;
    pCodes.forEach((p, i) => { this.valueLookup[p] = vals[i]; });

    this.changed();
  }

  getSourceState(): State { return 'ready'; }
  setActive(active: boolean) { this.isActive = active; this.changed(); }

  render(frameState: FrameState) {

    if (!this.isActive) return;
    const width = frameState.size[0];
    const height = frameState.size[1];

    // Place choropleth canvas inside the map viewport so WebGL circles (map layer) can render above it
    const map: any = (this as any).getMap?.();
    const container: HTMLElement = map?.getViewport?.() || this.options.svgContainer;
    const { canvas, ctx, dpr } = getCanvasAndCtx(container, width, height, 'choropleth-canvas');

  // Keep polygons below circles; tests expect zIndex '10' on this canvas
  canvas.style.zIndex = '10';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    const project = mercatorProjector(frameState, width, height);

    // Get nested geometry style from options or use defaults
    const nestedStyle: NestedGeometryStyle = this.options.nestedGeometryStyle || DEFAULT_NESTED_STYLE;

    // Remove previous hit layer and create a new one
    this.options.svg.select('#choropleth-hitlayer').remove();
    const hitLayer = this.options.svg.append('g').attr('id', 'choropleth-hitlayer');
    hitLayer.style('pointer-events', 'all');
    const d3Projection = createWebMercatorProjection(frameState, width, height);
    const d3Path = d3.geoPath().projection(d3Projection as any);

    // Render all features with full geometry support (polygons, lines, points)
    for (const feature of this.geojson.features as GeoJSONFeature[]) {
      const pCode = feature.properties[this.options.dataKey];
      const value = this.valueLookup[pCode];
  const fill = (pCode === undefined || isNoDataValue(value)) ? NO_DATA_COLOR : this.options.colorScale(value);
      const dp = this.options.dataPoints?.find(d => d.pcode === pCode);
      const alpha = selectionOpacity(this.selectedIds, dp?.selectionId as any, this.options.fillOpacity);
      drawPolygon(ctx, feature, project, fill, this.options.strokeColor, this.options.strokeWidth, alpha, nestedStyle);

      // Invisible hit path mirrors the feature geometry for tooltip/selection
      const hit = hitLayer.append('path')
        .datum(feature as any)
        .attr('d', d3Path as any)
        .style('fill', 'transparent')
        .style('stroke', 'transparent')
        .style('cursor', 'pointer')
        .style('pointer-events', 'all')
        .datum(feature.properties?.selectionId || this.options.dataPoints?.find(d => d.pcode === pCode)?.selectionId);

      const dataPoint = dp;
      if (dataPoint?.tooltip) {
        this.options.tooltipServiceWrapper.addTooltip(
          hit as any,
          () => dataPoint.tooltip,
          () => dataPoint.selectionId,
          true
        );
      }
      hit.on('click', (event: MouseEvent) => {
        if (!dp?.selectionId) return;
        const nativeEvent = event;
        this.options.selectionManager.select(dp.selectionId as any, nativeEvent.ctrlKey || nativeEvent.metaKey)
          .then((selectedIds: powerbi.extensibility.ISelectionId[]) => { this.selectedIds = selectedIds; this.changed(); });
      });
    }

    return this.options.svgContainer;
  }

  setSelectedIds(selectionIds: powerbi.extensibility.ISelectionId[]) { this.selectedIds = selectionIds; }

  // Clean up DOM canvas element when layer is removed
  dispose() {
    // Try removing from map viewport first, then fallback to svgContainer
    try {
      const map: any = (this as any).getMap?.();
      const container: HTMLElement | undefined = map?.getViewport?.();
      const el1 = container?.querySelector('#choropleth-canvas');
      if (el1 && el1.parentElement) el1.parentElement.removeChild(el1);
    } catch { }
    try {
      const el2 = this.options.svgContainer.querySelector('#choropleth-canvas');
      if (el2 && el2.parentElement) el2.parentElement.removeChild(el2);
    } catch { }
    try { this.options.svg.select('#choropleth-hitlayer').remove(); } catch { }
  }

  // Provide spatial extent in map projection (EPSG:3857)
  getFeaturesExtent(): Extent | undefined {
    if (!this.geojson || !this.geojson.features?.length) return undefined;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const f of this.geojson.features as GeoJSONFeature[]) {
      for (const [x, y] of coordIter(f)) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return undefined;
    const extent4326: Extent = [minX, minY, maxX, maxY] as any;
    return transformExtent(extent4326, 'EPSG:4326', 'EPSG:3857');
  }
}

/**
 * Iterates over all coordinates in a geometry, including nested GeometryCollections.
 */
function* coordIter(f: GeoJSONFeature): Iterable<[number, number]> {
  yield* geometryCoordIter(f.geometry);
}

/**
 * Recursively iterates coordinates from any geometry type.
 */
function* geometryCoordIter(g: any): Iterable<[number, number]> {
  if (!g || !g.type) return;
  
  switch (g.type) {
    case 'Point':
      yield g.coordinates as [number, number];
      break;
    case 'MultiPoint':
      for (const c of g.coordinates as any[]) yield c as [number, number];
      break;
    case 'LineString':
      for (const c of g.coordinates as any[]) yield c as [number, number];
      break;
    case 'MultiLineString':
      for (const line of g.coordinates as any[]) {
        for (const c of line) yield c as [number, number];
      }
      break;
    case 'Polygon':
      for (const ring of g.coordinates as any[]) {
        for (const c of ring) yield c as [number, number];
      }
      break;
    case 'MultiPolygon':
      for (const poly of g.coordinates as any[]) {
        for (const ring of poly) {
          for (const c of ring) yield c as [number, number];
        }
      }
      break;
    case 'GeometryCollection':
      for (const geom of (g.geometries || [])) {
        yield* geometryCoordIter(geom);
      }
      break;
  }
}

/**
 * Draws a feature's geometry on canvas, handling all geometry types including GeometryCollections.
 * Renders in order: polygons first, then lines, then points on top.
 */
function drawFeature(
  ctx: CanvasRenderingContext2D,
  f: GeoJSONFeature,
  project: (lon: number, lat: number) => [number, number],
  fill: string,
  stroke: string,
  strokeWidth: number,
  opacity: number,
  nestedStyle: NestedGeometryStyle
) {
  // Collect geometries by type for proper rendering order
  const polygons: any[] = [];
  const lines: any[] = [];
  const points: any[] = [];
  
  collectGeometries(f.geometry, polygons, lines, points);
  
  // Pass 1: Draw polygons (base layer)
  for (const geom of polygons) {
    drawPolygonGeometry(ctx, geom, project, fill, stroke, strokeWidth, opacity);
  }
  
  // Pass 2: Draw lines on top of polygons
  if (nestedStyle.showLines && lines.length > 0) {
    for (const geom of lines) {
      drawLineGeometry(ctx, geom, project, nestedStyle.lineColor, nestedStyle.lineWidth, opacity);
    }
  }
  
  // Pass 3: Draw points on top of everything
  if (nestedStyle.showPoints && points.length > 0) {
    for (const geom of points) {
      drawPointGeometry(
        ctx, geom, project,
        nestedStyle.pointColor,
        nestedStyle.pointStrokeColor,
        nestedStyle.pointRadius,
        nestedStyle.pointStrokeWidth,
        opacity
      );
    }
  }
}

/**
 * Recursively collects geometries from a feature, sorting by type.
 */
function collectGeometries(
  geom: any,
  polygons: any[],
  lines: any[],
  points: any[]
) {
  if (!geom || !geom.type) return;
  
  switch (geom.type) {
    case 'Point':
    case 'MultiPoint':
      points.push(geom);
      break;
    case 'LineString':
    case 'MultiLineString':
      lines.push(geom);
      break;
    case 'Polygon':
    case 'MultiPolygon':
      polygons.push(geom);
      break;
    case 'GeometryCollection':
      for (const g of (geom.geometries || [])) {
        collectGeometries(g, polygons, lines, points);
      }
      break;
  }
}

/**
 * Draws polygon/multipolygon geometry on canvas.
 */
function drawPolygonGeometry(
  ctx: CanvasRenderingContext2D,
  geom: any,
  project: (lon: number, lat: number) => [number, number],
  fill: string,
  stroke: string,
  strokeWidth: number,
  opacity: number
) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.beginPath();
  
  const drawRing = (ring: any[]) => {
    for (let i = 0; i < ring.length; i++) {
      const [x, y] = project(ring[i][0], ring[i][1]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  };
  
  if (geom.type === 'Polygon') {
    for (const ring of geom.coordinates as any[]) { drawRing(ring); }
  } else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates as any[]) {
      for (const ring of poly) { drawRing(ring); }
    }
  }
  
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = stroke;
  // Align to half-pixel in CSS pixel space
  ctx.save();
  ctx.translate(0.5, 0.5);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

/**
 * Draws line/multiline geometry on canvas.
 */
function drawLineGeometry(
  ctx: CanvasRenderingContext2D,
  geom: any,
  project: (lon: number, lat: number) => [number, number],
  color: string,
  width: number,
  opacity: number
) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  const drawLine = (coords: any[]) => {
    ctx.beginPath();
    for (let i = 0; i < coords.length; i++) {
      const [x, y] = project(coords[i][0], coords[i][1]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  
  if (geom.type === 'LineString') {
    drawLine(geom.coordinates);
  } else if (geom.type === 'MultiLineString') {
    for (const line of geom.coordinates as any[]) {
      drawLine(line);
    }
  }
  
  ctx.restore();
}

/**
 * Draws point/multipoint geometry on canvas.
 */
function drawPointGeometry(
  ctx: CanvasRenderingContext2D,
  geom: any,
  project: (lon: number, lat: number) => [number, number],
  fillColor: string,
  strokeColor: string,
  radius: number,
  strokeWidth: number,
  opacity: number
) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  
  const drawPoint = (coord: [number, number]) => {
    const [x, y] = project(coord[0], coord[1]);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    if (strokeWidth > 0) {
      ctx.stroke();
    }
  };
  
  if (geom.type === 'Point') {
    drawPoint(geom.coordinates as [number, number]);
  } else if (geom.type === 'MultiPoint') {
    for (const coord of geom.coordinates as any[]) {
      drawPoint(coord as [number, number]);
    }
  }
  
  ctx.restore();
}

// Legacy function kept for backward compatibility - now delegates to drawFeature
function drawPolygon(
  ctx: CanvasRenderingContext2D,
  f: GeoJSONFeature,
  project: (lon: number, lat: number) => [number, number],
  fill: string,
  stroke: string,
  strokeWidth: number,
  opacity: number,
  nestedStyle: NestedGeometryStyle = DEFAULT_NESTED_STYLE
) {
  drawFeature(ctx, f, project, fill, stroke, strokeWidth, opacity, nestedStyle);
}
