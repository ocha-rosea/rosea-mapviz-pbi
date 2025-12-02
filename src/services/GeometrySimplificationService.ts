/**
 * GeometrySimplificationService
 * 
 * Centralized geometry simplification for consistent rendering across all engines (SVG, Canvas, WebGL).
 * 
 * Design Principles:
 * 1. Preserve 1-1 feature mapping with Power BI data rows
 * 2. Support ALL GeoJSON geometry types including GeometryCollections
 * 3. Skip simplification for TopoJSON sources (already optimized)
 * 4. Use evidence-based thresholds based on feature count and vertex density
 * 5. Apply simplification BEFORE rendering, same data for all engines
 * 6. PRESERVE TOPOLOGY: Shared edges between adjacent polygons remain coincident
 */

import type { FeatureCollection, Feature, Geometry, Position } from 'geojson';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface SimplificationOptions {
  /** Source data type - TopoJSON sources skip simplification */
  sourceType: 'topojson' | 'geojson';
  
  /** User-configured simplification strength (0-100, from settings) */
  strength: number;
  
  /** Enable auto-detection of optimal simplification level */
  autoDetect: boolean;
  
  /** Preserve topology (shared edges) between adjacent polygons. Default: true */
  preserveTopology?: boolean;
}

export interface SimplificationMetrics {
  /** Total number of features in the collection */
  featureCount: number;
  
  /** Total vertex count across all geometries */
  totalVertices: number;
  
  /** Average vertices per feature */
  avgVerticesPerFeature: number;
  
  /** Bounding box [minX, minY, maxX, maxY] in degrees */
  boundingBox: [number, number, number, number];
  
  /** Set of geometry types present in the data */
  geometryTypes: Set<string>;
  
  /** Breakdown of vertices by geometry type */
  vertexBreakdown: {
    points: number;
    lines: number;
    polygons: number;
  };
}

export interface SimplificationResult {
  /** Simplified GeoJSON (same structure as input) */
  geojson: FeatureCollection;
  
  /** Metrics about the dataset */
  metrics: SimplificationMetrics;
  
  /** Whether simplification was applied */
  wasSimplified: boolean;
  
  /** Simplification level used */
  level: SimplificationLevel;
  
  /** Tolerance value used (in degrees) */
  tolerance: number;
}

export type SimplificationLevel = 'none' | 'light' | 'moderate' | 'aggressive';

// ============================================================================
// Evidence-Based Thresholds
// ============================================================================

/**
 * Thresholds based on Power BI visual constraints and rendering performance.
 * 
 * Power BI Limits:
 * - Maximum rows: 30,000 (standard), 150,000 (with scrolling)
 * - Recommended for performance: < 10,000 data points
 * - Memory limit per visual: ~100MB
 */
const THRESHOLDS = {
  // Feature count thresholds
  FEATURE_COUNT_SKIP: 500,        // Below this, skip simplification
  FEATURE_COUNT_LIGHT: 2000,      // Below this, use light simplification
  FEATURE_COUNT_MODERATE: 10000,  // Below this, use moderate
  // Above this, use aggressive
  
  // Vertex count thresholds (total across all features)
  VERTEX_COUNT_SKIP: 50000,
  VERTEX_COUNT_LIGHT: 200000,
  VERTEX_COUNT_MODERATE: 1000000,
  
  // Average complexity threshold
  AVG_VERTICES_LIGHT: 100,        // Complex features trigger light simplification
};

/**
 * Tolerance values for each simplification level (in degrees).
 * At the equator, 1 degree ≈ 111 km.
 */
const TOLERANCES: Record<SimplificationLevel, number> = {
  none: 0,
  light: 0.0001,      // ~11 meters
  moderate: 0.001,    // ~111 meters
  aggressive: 0.01,   // ~1.1 km
};

// ============================================================================
// Main Service
// ============================================================================

export class GeometrySimplificationService {
  
  /**
   * Main entry point - analyzes data and applies appropriate simplification.
   * Maintains 1-1 feature relationship with source data.
   * 
   * @param geojson - Input FeatureCollection
   * @param options - Simplification options
   * @returns SimplificationResult with simplified data and metrics
   */
  static process(
    geojson: FeatureCollection,
    options: SimplificationOptions
  ): SimplificationResult {
    
    // Validate input
    if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
      return {
        geojson: geojson || { type: 'FeatureCollection', features: [] },
        metrics: this.createEmptyMetrics(),
        wasSimplified: false,
        level: 'none',
        tolerance: 0
      };
    }
    
    // 1. If source is TopoJSON, skip (already optimized)
    if (options.sourceType === 'topojson') {
      const metrics = this.computeMetrics(geojson);
      return {
        geojson,
        metrics,
        wasSimplified: false,
        level: 'none',
        tolerance: 0
      };
    }
    
    // 2. Compute metrics to determine simplification need
    const metrics = this.computeMetrics(geojson);
    
    // 3. User disabled simplification
    if (options.strength === 0) {
      return {
        geojson,
        metrics,
        wasSimplified: false,
        level: 'none',
        tolerance: 0
      };
    }
    
    // 4. Determine simplification level based on evidence
    const level = options.autoDetect 
      ? this.determineLevel(metrics, options)
      : this.levelFromStrength(options.strength);
    
    // 5. If no simplification needed, return as-is
    if (level === 'none') {
      return { 
        geojson, 
        metrics, 
        wasSimplified: false, 
        level,
        tolerance: 0
      };
    }
    
    // 6. Apply simplification while preserving structure and topology
    const tolerance = this.adjustTolerance(TOLERANCES[level], options.strength);
    const preserveTopology = options.preserveTopology !== false; // Default to true
    const simplified = preserveTopology && metrics.vertexBreakdown.polygons > 0
      ? this.simplifyWithTopologyPreservation(geojson, tolerance)
      : this.simplifyPreservingStructure(geojson, tolerance);
    
    // 7. Compute metrics for simplified result
    const simplifiedMetrics = this.computeMetrics(simplified);
    
    return {
      geojson: simplified,
      metrics: simplifiedMetrics,
      wasSimplified: true,
      level,
      tolerance
    };
  }
  
  // ==========================================================================
  // Metrics Computation
  // ==========================================================================
  
  /**
   * Computes comprehensive metrics about the dataset.
   */
  static computeMetrics(geojson: FeatureCollection): SimplificationMetrics {
    let totalVertices = 0;
    let pointVertices = 0;
    let lineVertices = 0;
    let polygonVertices = 0;
    
    const geometryTypes = new Set<string>();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const feature of geojson.features) {
      if (!feature.geometry) continue;
      
      const counts = this.countVerticesByType(feature.geometry);
      totalVertices += counts.total;
      pointVertices += counts.points;
      lineVertices += counts.lines;
      polygonVertices += counts.polygons;
      
      this.collectGeometryTypes(feature.geometry, geometryTypes);
      this.expandBbox(feature.geometry, { minX, minY, maxX, maxY });
      
      // Update bbox with actual values
      const bbox = this.getGeometryBbox(feature.geometry);
      if (bbox) {
        minX = Math.min(minX, bbox.minX);
        minY = Math.min(minY, bbox.minY);
        maxX = Math.max(maxX, bbox.maxX);
        maxY = Math.max(maxY, bbox.maxY);
      }
    }
    
    const featureCount = geojson.features.length;
    
    return {
      featureCount,
      totalVertices,
      avgVerticesPerFeature: featureCount > 0 ? totalVertices / featureCount : 0,
      boundingBox: [
        isFinite(minX) ? minX : 0,
        isFinite(minY) ? minY : 0,
        isFinite(maxX) ? maxX : 0,
        isFinite(maxY) ? maxY : 0
      ],
      geometryTypes,
      vertexBreakdown: {
        points: pointVertices,
        lines: lineVertices,
        polygons: polygonVertices
      }
    };
  }
  
  /**
   * Creates empty metrics for invalid input.
   */
  private static createEmptyMetrics(): SimplificationMetrics {
    return {
      featureCount: 0,
      totalVertices: 0,
      avgVerticesPerFeature: 0,
      boundingBox: [0, 0, 0, 0],
      geometryTypes: new Set(),
      vertexBreakdown: { points: 0, lines: 0, polygons: 0 }
    };
  }
  
  /**
   * Counts vertices by geometry type category.
   */
  private static countVerticesByType(geometry: Geometry): { 
    total: number; 
    points: number; 
    lines: number; 
    polygons: number 
  } {
    const result = { total: 0, points: 0, lines: 0, polygons: 0 };
    this.countVerticesRecursive(geometry, result);
    return result;
  }
  
  private static countVerticesRecursive(
    geometry: Geometry | null,
    counts: { total: number; points: number; lines: number; polygons: number }
  ): void {
    if (!geometry) return;
    
    switch (geometry.type) {
      case 'Point':
        counts.total += 1;
        counts.points += 1;
        break;
        
      case 'MultiPoint':
        const mp = geometry.coordinates.length;
        counts.total += mp;
        counts.points += mp;
        break;
        
      case 'LineString':
        const ls = geometry.coordinates.length;
        counts.total += ls;
        counts.lines += ls;
        break;
        
      case 'MultiLineString':
        for (const line of geometry.coordinates) {
          counts.total += line.length;
          counts.lines += line.length;
        }
        break;
        
      case 'Polygon':
        for (const ring of geometry.coordinates) {
          counts.total += ring.length;
          counts.polygons += ring.length;
        }
        break;
        
      case 'MultiPolygon':
        for (const polygon of geometry.coordinates) {
          for (const ring of polygon) {
            counts.total += ring.length;
            counts.polygons += ring.length;
          }
        }
        break;
        
      case 'GeometryCollection':
        for (const geom of geometry.geometries) {
          this.countVerticesRecursive(geom as Geometry, counts);
        }
        break;
    }
  }
  
  /**
   * Recursively collects all geometry types present.
   */
  static collectGeometryTypes(geometry: Geometry | null, types: Set<string>): void {
    if (!geometry || !geometry.type) return;
    
    types.add(geometry.type);
    
    if (geometry.type === 'GeometryCollection') {
      for (const geom of geometry.geometries) {
        this.collectGeometryTypes(geom as Geometry, types);
      }
    }
  }
  
  /**
   * Gets bounding box for a geometry.
   */
  private static getGeometryBbox(geometry: Geometry | null): {
    minX: number; minY: number; maxX: number; maxY: number;
  } | null {
    if (!geometry) return null;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    const processCoord = (coord: Position) => {
      const [x, y] = coord;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    };
    
    const processCoords = (coords: Position[]) => {
      for (const coord of coords) processCoord(coord);
    };
    
    switch (geometry.type) {
      case 'Point':
        processCoord(geometry.coordinates);
        break;
      case 'MultiPoint':
      case 'LineString':
        processCoords(geometry.coordinates);
        break;
      case 'MultiLineString':
      case 'Polygon':
        for (const ring of geometry.coordinates) {
          processCoords(ring);
        }
        break;
      case 'MultiPolygon':
        for (const polygon of geometry.coordinates) {
          for (const ring of polygon) {
            processCoords(ring);
          }
        }
        break;
      case 'GeometryCollection':
        for (const geom of geometry.geometries) {
          const bbox = this.getGeometryBbox(geom as Geometry);
          if (bbox) {
            if (bbox.minX < minX) minX = bbox.minX;
            if (bbox.minY < minY) minY = bbox.minY;
            if (bbox.maxX > maxX) maxX = bbox.maxX;
            if (bbox.maxY > maxY) maxY = bbox.maxY;
          }
        }
        break;
    }
    
    if (!isFinite(minX)) return null;
    return { minX, minY, maxX, maxY };
  }
  
  /**
   * Expands a bounding box with a geometry's coordinates.
   * @deprecated Use getGeometryBbox instead
   */
  static expandBbox(
    geometry: Geometry | null,
    bbox: { minX: number; minY: number; maxX: number; maxY: number }
  ): void {
    const geomBbox = this.getGeometryBbox(geometry);
    if (geomBbox) {
      bbox.minX = Math.min(bbox.minX, geomBbox.minX);
      bbox.minY = Math.min(bbox.minY, geomBbox.minY);
      bbox.maxX = Math.max(bbox.maxX, geomBbox.maxX);
      bbox.maxY = Math.max(bbox.maxY, geomBbox.maxY);
    }
  }
  
  // ==========================================================================
  // Level Determination
  // ==========================================================================
  
  /**
   * Determines simplification level based on evidence-based thresholds.
   */
  static determineLevel(
    metrics: SimplificationMetrics,
    options: SimplificationOptions
  ): SimplificationLevel {
    const { featureCount, totalVertices, avgVerticesPerFeature, vertexBreakdown } = metrics;
    
    // Only polygon and line vertices can be simplified
    // Points cannot be simplified at all
    const simplifiableVertices = vertexBreakdown.polygons + vertexBreakdown.lines;
    
    // If there's nothing to simplify (points-only), skip
    if (simplifiableVertices === 0) {
      return 'none';
    }
    
    // Small datasets with few simplifiable vertices don't need simplification
    if (featureCount <= THRESHOLDS.FEATURE_COUNT_SKIP && 
        simplifiableVertices <= THRESHOLDS.VERTEX_COUNT_SKIP) {
      return 'none';
    }
    
    // Very large datasets need aggressive simplification
    // Both feature count AND vertex count must be considered with simplifiable vertices
    if (simplifiableVertices > THRESHOLDS.VERTEX_COUNT_MODERATE) {
      return 'aggressive';
    }
    
    // High feature count with significant simplifiable content
    if (featureCount > THRESHOLDS.FEATURE_COUNT_MODERATE && 
        simplifiableVertices > THRESHOLDS.VERTEX_COUNT_SKIP) {
      return 'aggressive';
    }
    
    // Medium datasets - moderate
    if (simplifiableVertices > THRESHOLDS.VERTEX_COUNT_LIGHT) {
      return 'moderate';
    }
    
    if (featureCount > THRESHOLDS.FEATURE_COUNT_LIGHT && 
        simplifiableVertices > THRESHOLDS.VERTEX_COUNT_SKIP) {
      return 'moderate';
    }
    
    // Check average complexity (for simplifiable geometry types)
    const avgSimplifiablePerFeature = simplifiableVertices / Math.max(1, featureCount);
    if (avgSimplifiablePerFeature > THRESHOLDS.AVG_VERTICES_LIGHT) {
      return 'light';
    }
    
    // Check total simplifiable vertex count
    if (simplifiableVertices > THRESHOLDS.VERTEX_COUNT_SKIP) {
      return 'light';
    }
    
    return 'none';
  }
  
  /**
   * Maps user strength (0-100) to simplification level.
   */
  private static levelFromStrength(strength: number): SimplificationLevel {
    if (strength <= 0) return 'none';
    if (strength <= 25) return 'light';
    if (strength <= 60) return 'moderate';
    return 'aggressive';
  }
  
  /**
   * Adjusts base tolerance based on user strength setting.
   */
  private static adjustTolerance(baseTolerance: number, strength: number): number {
    // Scale tolerance by strength (0-100)
    // At strength=50, use base tolerance
    // At strength=100, use 2x base tolerance
    // At strength=25, use 0.5x base tolerance
    const factor = 0.5 + (strength / 100);
    return baseTolerance * factor;
  }
  
  // ==========================================================================
  // Simplification
  // ==========================================================================
  
  /**
   * Applies simplification while maintaining exact feature structure.
   * Each input feature maps to exactly one output feature.
   * 
   * NOTE: This method does NOT preserve topology - use simplifyWithTopologyPreservation
   * for choropleth maps with adjacent polygons.
   */
  static simplifyPreservingStructure(
    geojson: FeatureCollection,
    tolerance: number
  ): FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: geojson.features.map(feature => ({
        ...feature,
        geometry: feature.geometry 
          ? this.simplifyGeometry(feature.geometry, tolerance)
          : feature.geometry
      }))
    };
  }
  
  // ==========================================================================
  // Topology-Preserving Simplification
  // ==========================================================================
  
  /**
   * Applies simplification while preserving topology between adjacent polygons.
   * 
   * This method ensures that shared edges between polygons remain coincident
   * after simplification, preventing gaps and overlaps in choropleth maps.
   * 
   * Algorithm:
   * 1. Extract all unique edges (arcs) from polygon boundaries
   * 2. Build a lookup of edge -> polygons using the edge
   * 3. Simplify each unique edge once using Douglas-Peucker
   * 4. Reconstruct polygons using simplified edges
   * 
   * This is similar to how TopoJSON works, but operates purely on GeoJSON.
   */
  static simplifyWithTopologyPreservation(
    geojson: FeatureCollection,
    tolerance: number
  ): FeatureCollection {
    // 1. Extract edges and build topology
    const topology = this.buildTopology(geojson);
    
    // 2. Simplify each unique arc once
    const simplifiedArcs = new Map<string, Position[]>();
    for (const [arcKey, arc] of topology.arcs.entries()) {
      simplifiedArcs.set(arcKey, this.douglasPeucker(arc, tolerance));
    }
    
    // 3. Reconstruct features using simplified arcs
    return {
      type: 'FeatureCollection',
      features: geojson.features.map((feature, featureIndex) => ({
        ...feature,
        geometry: feature.geometry 
          ? this.reconstructGeometry(
              feature.geometry, 
              topology.featureArcs.get(featureIndex) || new Map(), 
              simplifiedArcs,
              tolerance
            )
          : feature.geometry
      }))
    };
  }
  
  /**
   * Builds a topology structure from a FeatureCollection.
   * Identifies shared edges between polygons.
   */
  private static buildTopology(geojson: FeatureCollection): {
    arcs: Map<string, Position[]>;
    featureArcs: Map<number, Map<string, { ringIndex: number; isReversed: boolean }[]>>;
  } {
    const arcs = new Map<string, Position[]>();
    const featureArcs = new Map<number, Map<string, { ringIndex: number; isReversed: boolean }[]>>();
    
    geojson.features.forEach((feature, featureIndex) => {
      if (!feature.geometry) return;
      
      const arcRefs = new Map<string, { ringIndex: number; isReversed: boolean }[]>();
      featureArcs.set(featureIndex, arcRefs);
      
      this.extractArcsFromGeometry(feature.geometry, arcs, arcRefs);
    });
    
    return { arcs, featureArcs };
  }
  
  /**
   * Recursively extracts arcs from a geometry.
   */
  private static extractArcsFromGeometry(
    geometry: Geometry,
    arcs: Map<string, Position[]>,
    arcRefs: Map<string, { ringIndex: number; isReversed: boolean }[]>,
    ringIndexOffset: number = 0
  ): void {
    switch (geometry.type) {
      case 'Polygon':
        geometry.coordinates.forEach((ring, ringIndex) => {
          this.extractArcsFromRing(ring, arcs, arcRefs, ringIndexOffset + ringIndex);
        });
        break;
        
      case 'MultiPolygon':
        let offset = 0;
        geometry.coordinates.forEach(polygon => {
          polygon.forEach((ring, ringIndex) => {
            this.extractArcsFromRing(ring, arcs, arcRefs, offset + ringIndex);
          });
          offset += polygon.length;
        });
        break;
        
      case 'GeometryCollection':
        let gcOffset = 0;
        geometry.geometries.forEach(geom => {
          this.extractArcsFromGeometry(geom as Geometry, arcs, arcRefs, gcOffset);
          // Estimate ring count for offset
          gcOffset += this.estimateRingCount(geom as Geometry);
        });
        break;
        
      // LineStrings can also share edges but are less common in choropleths
      case 'LineString':
        this.extractArcFromLine(geometry.coordinates, arcs, arcRefs, ringIndexOffset);
        break;
        
      case 'MultiLineString':
        geometry.coordinates.forEach((line, lineIndex) => {
          this.extractArcFromLine(line, arcs, arcRefs, ringIndexOffset + lineIndex);
        });
        break;
    }
  }
  
  /**
   * Extracts edges from a polygon ring.
   * Breaks the ring into segments between junction points.
   */
  private static extractArcsFromRing(
    ring: Position[],
    arcs: Map<string, Position[]>,
    arcRefs: Map<string, { ringIndex: number; isReversed: boolean }[]>,
    ringIndex: number
  ): void {
    if (ring.length < 2) return;
    
    // For topology preservation, we need to identify shared edges.
    // We'll use a simple approach: treat each edge (pair of consecutive points) 
    // as a potential shared segment.
    
    // Create a canonical key for each edge that is the same regardless of direction
    for (let i = 0; i < ring.length - 1; i++) {
      const p1 = ring[i];
      const p2 = ring[i + 1];
      
      // Create canonical edge key (sorted coordinates)
      const { key, isReversed } = this.createEdgeKey(p1, p2);
      
      // Store the edge if we haven't seen it
      if (!arcs.has(key)) {
        arcs.set(key, isReversed ? [p2, p1] : [p1, p2]);
      }
      
      // Record this feature's reference to this arc
      if (!arcRefs.has(key)) {
        arcRefs.set(key, []);
      }
      arcRefs.get(key)!.push({ ringIndex, isReversed });
    }
  }
  
  /**
   * Extracts arc from a LineString.
   */
  private static extractArcFromLine(
    line: Position[],
    arcs: Map<string, Position[]>,
    arcRefs: Map<string, { ringIndex: number; isReversed: boolean }[]>,
    lineIndex: number
  ): void {
    if (line.length < 2) return;
    
    // For LineStrings, treat the whole line as one arc
    const key = this.createLineKey(line);
    
    if (!arcs.has(key)) {
      arcs.set(key, line.map(c => [...c] as Position));
    }
    
    if (!arcRefs.has(key)) {
      arcRefs.set(key, []);
    }
    arcRefs.get(key)!.push({ ringIndex: lineIndex, isReversed: false });
  }
  
  /**
   * Creates a canonical key for an edge that is the same regardless of direction.
   */
  private static createEdgeKey(p1: Position, p2: Position): { key: string; isReversed: boolean } {
    // Use string comparison to determine canonical order
    const s1 = `${p1[0].toFixed(10)},${p1[1].toFixed(10)}`;
    const s2 = `${p2[0].toFixed(10)},${p2[1].toFixed(10)}`;
    
    if (s1 < s2) {
      return { key: `${s1}|${s2}`, isReversed: false };
    } else {
      return { key: `${s2}|${s1}`, isReversed: true };
    }
  }
  
  /**
   * Creates a key for a LineString.
   */
  private static createLineKey(line: Position[]): string {
    // Use endpoints to create a reversible key
    const first = `${line[0][0].toFixed(10)},${line[0][1].toFixed(10)}`;
    const last = `${line[line.length-1][0].toFixed(10)},${line[line.length-1][1].toFixed(10)}`;
    return first < last ? `${first}>${last}` : `${last}>${first}`;
  }
  
  /**
   * Estimates the number of rings in a geometry.
   */
  private static estimateRingCount(geometry: Geometry): number {
    switch (geometry.type) {
      case 'Polygon':
        return geometry.coordinates.length;
      case 'MultiPolygon':
        return geometry.coordinates.reduce((sum, poly) => sum + poly.length, 0);
      case 'GeometryCollection':
        return geometry.geometries.reduce(
          (sum, g) => sum + this.estimateRingCount(g as Geometry), 0
        );
      default:
        return 1;
    }
  }
  
  /**
   * Reconstructs a geometry using simplified arcs.
   */
  private static reconstructGeometry(
    geometry: Geometry,
    arcRefs: Map<string, { ringIndex: number; isReversed: boolean }[]>,
    simplifiedArcs: Map<string, Position[]>,
    tolerance: number
  ): Geometry {
    switch (geometry.type) {
      case 'Point':
        return { type: 'Point', coordinates: [...geometry.coordinates] };
        
      case 'MultiPoint':
        return { type: 'MultiPoint', coordinates: geometry.coordinates.map(c => [...c]) };
        
      case 'LineString':
        // For lines, reconstruct from simplified arcs or fallback to direct simplification
        return {
          type: 'LineString',
          coordinates: this.reconstructLine(geometry.coordinates, simplifiedArcs, tolerance)
        };
        
      case 'MultiLineString':
        return {
          type: 'MultiLineString',
          coordinates: geometry.coordinates.map(line => 
            this.reconstructLine(line, simplifiedArcs, tolerance)
          )
        };
        
      case 'Polygon':
        return {
          type: 'Polygon',
          coordinates: geometry.coordinates.map(ring =>
            this.reconstructRing(ring, simplifiedArcs, tolerance)
          )
        };
        
      case 'MultiPolygon':
        return {
          type: 'MultiPolygon',
          coordinates: geometry.coordinates.map(polygon =>
            polygon.map(ring => this.reconstructRing(ring, simplifiedArcs, tolerance))
          )
        };
        
      case 'GeometryCollection':
        return {
          type: 'GeometryCollection',
          geometries: geometry.geometries.map(g => 
            this.reconstructGeometry(g as Geometry, arcRefs, simplifiedArcs, tolerance)
          )
        };
        
      default:
        return geometry;
    }
  }
  
  /**
   * Reconstructs a polygon ring using simplified edges.
   */
  private static reconstructRing(
    ring: Position[],
    simplifiedArcs: Map<string, Position[]>,
    tolerance: number
  ): Position[] {
    if (ring.length <= 4) return ring.map(c => [...c] as Position);
    
    const simplified: Position[] = [];
    
    for (let i = 0; i < ring.length - 1; i++) {
      const p1 = ring[i];
      const p2 = ring[i + 1];
      const { key, isReversed } = this.createEdgeKey(p1, p2);
      
      // Look up the simplified edge
      const simplifiedEdge = simplifiedArcs.get(key);
      
      if (simplifiedEdge && simplifiedEdge.length >= 2) {
        // Use simplified edge coordinates
        const edge = isReversed ? [...simplifiedEdge].reverse() : simplifiedEdge;
        
        // Avoid duplicating the first point except at the start
        if (simplified.length === 0) {
          simplified.push([...edge[0]] as Position);
        }
        // Add remaining points (skip first to avoid duplicate)
        for (let j = 1; j < edge.length; j++) {
          simplified.push([...edge[j]] as Position);
        }
      } else {
        // Fallback: add points directly
        if (simplified.length === 0) {
          simplified.push([...p1] as Position);
        }
        simplified.push([...p2] as Position);
      }
    }
    
    // Ensure ring has minimum valid points
    if (simplified.length < 4) {
      return ring.map(c => [...c] as Position);
    }
    
    // Ensure ring is properly closed
    const first = simplified[0];
    const last = simplified[simplified.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      simplified.push([...first] as Position);
    }
    
    return simplified;
  }
  
  /**
   * Reconstructs a line using simplified arcs or direct simplification.
   */
  private static reconstructLine(
    line: Position[],
    simplifiedArcs: Map<string, Position[]>,
    tolerance: number
  ): Position[] {
    const key = this.createLineKey(line);
    const simplified = simplifiedArcs.get(key);
    
    if (simplified) {
      // Check if we need to reverse
      const lineFirst = `${line[0][0].toFixed(10)},${line[0][1].toFixed(10)}`;
      const simpFirst = `${simplified[0][0].toFixed(10)},${simplified[0][1].toFixed(10)}`;
      
      if (lineFirst === simpFirst) {
        return simplified.map(c => [...c] as Position);
      } else {
        return [...simplified].reverse().map(c => [...c] as Position);
      }
    }
    
    // Fallback to direct simplification
    return this.douglasPeucker(line, tolerance);
  }
  
  /**
   * Recursively simplifies a geometry, handling all types including GeometryCollections.
   * 
   * Simplification Rules:
   * - Points: NEVER simplified (cannot reduce 1 coordinate)
   * - Lines: Douglas-Peucker simplification
   * - Polygons: Douglas-Peucker on rings, with minimum vertex validation
   * - GeometryCollections: Recursively process each member
   */
  static simplifyGeometry(geometry: Geometry, tolerance: number): Geometry {
    if (!geometry) return geometry;
    
    switch (geometry.type) {
      case 'Point':
        // Points cannot be simplified - return as-is
        return { type: 'Point', coordinates: [...geometry.coordinates] };
        
      case 'MultiPoint':
        // MultiPoints cannot be simplified - return as-is
        return { 
          type: 'MultiPoint', 
          coordinates: geometry.coordinates.map(c => [...c]) 
        };
        
      case 'LineString':
        return {
          type: 'LineString',
          coordinates: this.douglasPeucker(geometry.coordinates, tolerance)
        };
        
      case 'MultiLineString':
        return {
          type: 'MultiLineString',
          coordinates: geometry.coordinates.map(line => 
            this.douglasPeucker(line, tolerance)
          )
        };
        
      case 'Polygon':
        return {
          type: 'Polygon',
          coordinates: geometry.coordinates.map(ring =>
            this.simplifyRing(ring, tolerance)
          )
        };
        
      case 'MultiPolygon':
        return {
          type: 'MultiPolygon',
          coordinates: geometry.coordinates.map(polygon =>
            polygon.map(ring => this.simplifyRing(ring, tolerance))
          )
        };
        
      case 'GeometryCollection':
        // Recursively simplify each geometry in the collection
        return {
          type: 'GeometryCollection',
          geometries: geometry.geometries.map(g => 
            this.simplifyGeometry(g as Geometry, tolerance)
          )
        };
        
      default:
        // Unknown geometry type - return as-is
        return geometry;
    }
  }
  
  // ==========================================================================
  // Douglas-Peucker Algorithm
  // ==========================================================================
  
  /**
   * Douglas-Peucker line simplification algorithm.
   * Reduces the number of points in a curve while preserving its shape.
   * 
   * Time Complexity: O(n²) worst case, O(n log n) average
   * Space Complexity: O(n)
   * 
   * @param coords - Array of [lon, lat] coordinates
   * @param tolerance - Maximum perpendicular distance threshold (in degrees)
   * @returns Simplified coordinate array
   */
  static douglasPeucker(coords: Position[], tolerance: number): Position[] {
    if (coords.length <= 2) return coords.map(c => [...c] as Position);
    
    // Find the point with maximum distance from the line
    let maxDist = 0;
    let maxIdx = 0;
    const first = coords[0];
    const last = coords[coords.length - 1];
    
    for (let i = 1; i < coords.length - 1; i++) {
      const dist = this.perpendicularDistance(coords[i], first, last);
      if (dist > maxDist) {
        maxDist = dist;
        maxIdx = i;
      }
    }
    
    // If max distance exceeds tolerance, recursively simplify
    if (maxDist > tolerance) {
      const left = this.douglasPeucker(coords.slice(0, maxIdx + 1), tolerance);
      const right = this.douglasPeucker(coords.slice(maxIdx), tolerance);
      // Combine results, avoiding duplicate at junction
      return [...left.slice(0, -1), ...right];
    }
    
    // Otherwise, return just the endpoints
    return [[...first] as Position, [...last] as Position];
  }
  
  /**
   * Simplifies a polygon ring, ensuring it remains valid.
   * 
   * GeoJSON Polygon Ring Requirements:
   * - Minimum 4 coordinates (3 unique points + closing point)
   * - First and last coordinates must be identical (closed ring)
   * 
   * @param ring - Ring coordinates
   * @param tolerance - Simplification tolerance
   * @returns Simplified ring, or original if too simplified
   */
  static simplifyRing(ring: Position[], tolerance: number): Position[] {
    // Very small rings - keep as-is
    if (ring.length <= 4) return ring.map(c => [...c] as Position);
    
    const simplified = this.douglasPeucker(ring, tolerance);
    
    // Ensure ring has at least 4 points (3 unique + closing)
    if (simplified.length < 4) {
      // Keep original if too simplified
      return ring.map(c => [...c] as Position);
    }
    
    // Ensure ring is properly closed
    const first = simplified[0];
    const last = simplified[simplified.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      simplified.push([...first] as Position);
    }
    
    return simplified;
  }
  
  /**
   * Calculates perpendicular distance from a point to a line segment.
   * Uses the standard formula for point-to-line distance.
   * 
   * @param point - The point [x, y]
   * @param lineStart - Line start [x, y]
   * @param lineEnd - Line end [x, y]
   * @returns Distance in the same units as input coordinates (degrees)
   */
  static perpendicularDistance(
    point: Position,
    lineStart: Position,
    lineEnd: Position
  ): number {
    const dx = lineEnd[0] - lineStart[0];
    const dy = lineEnd[1] - lineStart[1];
    
    // If line segment is a point, return distance to that point
    if (dx === 0 && dy === 0) {
      return Math.sqrt(
        Math.pow(point[0] - lineStart[0], 2) +
        Math.pow(point[1] - lineStart[1], 2)
      );
    }
    
    // Calculate perpendicular distance using cross product formula
    const numerator = Math.abs(
      dy * point[0] - dx * point[1] + lineEnd[0] * lineStart[1] - lineEnd[1] * lineStart[0]
    );
    const denominator = Math.sqrt(dx * dx + dy * dy);
    
    return numerator / denominator;
  }
  
  // ==========================================================================
  // Utility Methods
  // ==========================================================================
  
  /**
   * Detects whether the source data is TopoJSON or GeoJSON.
   * TopoJSON sources should skip simplification (already optimized).
   * 
   * @param data - Raw data object from fetch
   * @returns 'topojson' or 'geojson'
   */
  static detectSourceType(data: any): 'topojson' | 'geojson' {
    if (!data || typeof data !== 'object') {
      return 'geojson';
    }
    
    // TopoJSON has a 'type' of 'Topology' and 'objects' property
    if (data.type === 'Topology' && data.objects) {
      return 'topojson';
    }
    
    // Check if it has arcs (TopoJSON-specific)
    if (Array.isArray(data.arcs)) {
      return 'topojson';
    }
    
    // Default to GeoJSON
    return 'geojson';
  }
  
  /**
   * Checks if a dataset should skip simplification (e.g., point-only data).
   */
  static shouldSkipSimplification(metrics: SimplificationMetrics): boolean {
    // Skip if only points (nothing to simplify)
    if (metrics.vertexBreakdown.lines === 0 && metrics.vertexBreakdown.polygons === 0) {
      return true;
    }
    
    // Skip for very small datasets
    if (metrics.featureCount <= 10 && metrics.totalVertices <= 500) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Estimates memory usage for a GeoJSON dataset.
   * Useful for determining if simplification is needed for memory reasons.
   * 
   * @returns Estimated size in bytes
   */
  static estimateMemoryUsage(metrics: SimplificationMetrics): number {
    // Rough estimation:
    // - Each coordinate is 2 numbers * 8 bytes = 16 bytes
    // - Plus overhead for arrays and objects
    const coordBytes = metrics.totalVertices * 16;
    const overhead = metrics.featureCount * 200; // Properties, structure
    return coordBytes + overhead;
  }
  
  /**
   * Gets a human-readable description of the simplification result.
   */
  static describeResult(result: SimplificationResult): string {
    if (!result.wasSimplified) {
      return `No simplification applied (${result.metrics.featureCount} features, ${result.metrics.totalVertices} vertices)`;
    }
    
    return `Applied ${result.level} simplification (tolerance: ${result.tolerance.toFixed(6)}°) - ${result.metrics.featureCount} features, ${result.metrics.totalVertices} vertices`;
  }
}

// Export for convenience
export default GeometrySimplificationService;
