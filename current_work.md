# ROSEA MapViz - Choropleth Efficiency Enhancement Plan

## Overview

This document outlines efficiency improvements for choropleth mapping while maintaining:
1. **Full GeoJSON geometry type support** - All types including GeometryCollections
2. **1-1 Power BI data relationship** - Feature structure preserved exactly
3. **Consistent cross-engine rendering** - Same simplified data for SVG/Canvas/WebGL
4. **Evidence-based simplification** - Thresholds based on feature count and data density

---

## Core Design Principles

### Principle 1: Preserve Feature Structure
```
Power BI Row 1  ←→  GeoJSON Feature 1  ←→  Simplified Feature 1
Power BI Row 2  ←→  GeoJSON Feature 2  ←→  Simplified Feature 2
Power BI Row N  ←→  GeoJSON Feature N  ←→  Simplified Feature N

✅ GeometryCollections stay as GeometryCollections
✅ Feature properties remain unchanged
✅ Feature array indices preserved
```

### Principle 2: Simplify Before Rendering (Orchestrator Level)
```
┌─────────────────────────────────────────────────────────────────────────┐
│                   PROPOSED ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ChoroplethOrchestrator                                                  │
│       │                                                                  │
│       ▼                                                                  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  GeometrySimplificationService.process(geojson, options)          │   │
│  │                                                                    │   │
│  │  1. Detect source type (TopoJSON vs GeoJSON)                      │   │
│  │  2. If TopoJSON source → SKIP simplification (already optimized)  │   │
│  │  3. If GeoJSON source → Apply evidence-based simplification       │   │
│  │  4. Cache result for reuse                                        │   │
│  │                                                                    │   │
│  │  Returns: SimplifiedGeoJSON (same structure, fewer vertices)      │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│       │                                                                  │
│       ▼                                                                  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  SAME simplified data passed to ALL render engines                │   │
│  │                                                                    │   │
│  │  ┌──────────┐    ┌──────────┐    ┌──────────┐                    │   │
│  │  │   SVG    │    │  Canvas  │    │  WebGL   │                    │   │
│  │  │  Layer   │    │  Layer   │    │  Layer   │                    │   │
│  │  └──────────┘    └──────────┘    └──────────┘                    │   │
│  │                                                                    │   │
│  │  ✅ Consistent visual output                                      │   │
│  │  ✅ No per-layer simplification logic                            │   │
│  │  ✅ Simpler layer implementations                                 │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Principle 3: Evidence-Based Simplification Thresholds

Based on Power BI constraints and rendering performance:

| Metric | Threshold | Action |
|--------|-----------|--------|
| **Feature Count** | ≤ 500 | No simplification needed |
| **Feature Count** | 501 - 2,000 | Light simplification (preserve detail) |
| **Feature Count** | 2,001 - 10,000 | Moderate simplification |
| **Feature Count** | > 10,000 | Aggressive simplification |
| **Total Vertices** | ≤ 50,000 | No simplification needed |
| **Total Vertices** | 50,001 - 200,000 | Light simplification |
| **Total Vertices** | 200,001 - 1,000,000 | Moderate simplification |
| **Total Vertices** | > 1,000,000 | Aggressive simplification |
| **Avg Feature Area** | Small (< 0.1% viewport) | Less aggressive (preserve shape) |
| **Avg Feature Area** | Large (> 5% viewport) | More aggressive OK |

**Power BI Reference Limits:**
- Maximum rows in visual: 30,000 (standard), 150,000 (with scrolling)
- Recommended for performance: < 10,000 data points
- Memory limit per visual: ~100MB

---

## Current Architecture Analysis

### Current State by Layer

| Layer | File | Simplification | Issue |
|-------|------|----------------|-------|
| **SVG** | `choroplethLayer.ts` | ✅ TopoJSON LOD | Applied per-layer, not shared |
| **Canvas** | `choroplethCanvasLayer.ts` | ❌ None | Raw GeoJSON, no optimization |
| **WebGL** | `choroplethWebGLLayer.ts` | ❌ None | Raw GeoJSON, no optimization |

### Current Data Flow

```
ChoroplethOrchestrator
       │
       ├─── processGeoData() → Raw GeoJSON
       │
       └─── Creates layer with raw data
               │
               ├── SVG Layer: Applies its own simplification (TopoJSON)
               ├── Canvas Layer: Uses raw data (slow for large datasets)
               └── WebGL Layer: Uses raw data (slow for large datasets)
               
⚠️ Problem: Each engine sees different data
```

---

## Proposed Enhancements

### Enhancement 1: Centralized Pre-Render Simplification

**Goal:** Simplify geometry ONCE at orchestrator level, share with all engines.

**New Service:** `src/services/GeometrySimplificationService.ts`

```typescript
export interface SimplificationOptions {
  /** Source data type - TopoJSON sources skip simplification */
  sourceType: 'topojson' | 'geojson';
  
  /** User-configured simplification strength (0-100, from settings) */
  strength: number;
  
  /** Enable auto-detection of optimal simplification */
  autoDetect: boolean;
}

export interface SimplificationMetrics {
  featureCount: number;
  totalVertices: number;
  avgVerticesPerFeature: number;
  boundingBox: [number, number, number, number];
  geometryTypes: Set<string>;
}

export interface SimplificationResult {
  /** Simplified GeoJSON (same structure as input) */
  geojson: FeatureCollection;
  
  /** Metrics about the simplification */
  metrics: SimplificationMetrics;
  
  /** Whether simplification was applied */
  wasSimplified: boolean;
  
  /** Simplification level used */
  level: 'none' | 'light' | 'moderate' | 'aggressive';
}

export class GeometrySimplificationService {
  
  /**
   * Main entry point - analyzes data and applies appropriate simplification.
   * Maintains 1-1 feature relationship with source data.
   */
  static process(
    geojson: FeatureCollection,
    options: SimplificationOptions
  ): SimplificationResult {
    
    // 1. If source is TopoJSON, skip (already optimized)
    if (options.sourceType === 'topojson') {
      return {
        geojson,
        metrics: this.computeMetrics(geojson),
        wasSimplified: false,
        level: 'none'
      };
    }
    
    // 2. Compute metrics to determine simplification need
    const metrics = this.computeMetrics(geojson);
    
    // 3. Determine simplification level based on evidence
    const level = this.determineLevel(metrics, options);
    
    // 4. If no simplification needed, return as-is
    if (level === 'none') {
      return { geojson, metrics, wasSimplified: false, level };
    }
    
    // 5. Apply simplification while preserving structure
    const simplified = this.simplifyPreservingStructure(geojson, level);
    
    return {
      geojson: simplified,
      metrics: this.computeMetrics(simplified),
      wasSimplified: true,
      level
    };
  }
  
  /**
   * Computes metrics about the dataset for threshold decisions.
   */
  static computeMetrics(geojson: FeatureCollection): SimplificationMetrics {
    let totalVertices = 0;
    const geometryTypes = new Set<string>();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const feature of geojson.features) {
      const count = this.countVertices(feature.geometry);
      totalVertices += count;
      this.collectGeometryTypes(feature.geometry, geometryTypes);
      this.expandBbox(feature.geometry, { minX, minY, maxX, maxY });
    }
    
    return {
      featureCount: geojson.features.length,
      totalVertices,
      avgVerticesPerFeature: totalVertices / Math.max(1, geojson.features.length),
      boundingBox: [minX, minY, maxX, maxY],
      geometryTypes
    };
  }
  
  /**
   * Determines simplification level based on metrics and thresholds.
   */
  static determineLevel(
    metrics: SimplificationMetrics,
    options: SimplificationOptions
  ): 'none' | 'light' | 'moderate' | 'aggressive' {
    
    // User disabled simplification
    if (options.strength === 0) return 'none';
    
    // Evidence-based thresholds
    const { featureCount, totalVertices, avgVerticesPerFeature } = metrics;
    
    // Small datasets don't need simplification
    if (featureCount <= 500 && totalVertices <= 50000) {
      return 'none';
    }
    
    // Very large datasets need aggressive simplification
    if (featureCount > 10000 || totalVertices > 1000000) {
      return 'aggressive';
    }
    
    // Medium datasets - moderate
    if (featureCount > 2000 || totalVertices > 200000) {
      return 'moderate';
    }
    
    // Smallish but complex - light
    if (avgVerticesPerFeature > 100 || totalVertices > 50000) {
      return 'light';
    }
    
    return 'none';
  }
  
  /**
   * Applies simplification while maintaining exact feature structure.
   * Each input feature maps to exactly one output feature.
   */
  static simplifyPreservingStructure(
    geojson: FeatureCollection,
    level: 'light' | 'moderate' | 'aggressive'
  ): FeatureCollection {
    
    // Tolerance values based on level (in degrees, ~111km per degree at equator)
    const tolerances = {
      light: 0.0001,     // ~11 meters
      moderate: 0.001,   // ~111 meters  
      aggressive: 0.01   // ~1.1 km
    };
    
    const tolerance = tolerances[level];
    
    return {
      type: 'FeatureCollection',
      features: geojson.features.map(feature => ({
        ...feature,
        geometry: this.simplifyGeometry(feature.geometry, tolerance)
      }))
    };
  }
  
  /**
   * Recursively simplifies a geometry, handling all types including GeometryCollections.
   * Points are never simplified. Lines and Polygons use Douglas-Peucker.
   */
  static simplifyGeometry(geometry: Geometry, tolerance: number): Geometry {
    if (!geometry) return geometry;
    
    switch (geometry.type) {
      case 'Point':
      case 'MultiPoint':
        // Points cannot be simplified - return as-is
        return geometry;
        
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
            this.simplifyGeometry(g, tolerance)
          )
        };
        
      default:
        return geometry;
    }
  }
  
  /**
   * Douglas-Peucker line simplification algorithm.
   */
  static douglasPeucker(coords: number[][], tolerance: number): number[][] {
    if (coords.length <= 2) return coords;
    
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
      return [...left.slice(0, -1), ...right];
    }
    
    // Otherwise, return just the endpoints
    return [first, last];
  }
  
  /**
   * Simplifies a polygon ring, ensuring it remains valid (minimum 4 points for closed ring).
   */
  static simplifyRing(ring: number[][], tolerance: number): number[][] {
    const simplified = this.douglasPeucker(ring, tolerance);
    
    // Ensure ring has at least 4 points (3 + closing point)
    if (simplified.length < 4) {
      // Keep original if too simplified
      return ring;
    }
    
    // Ensure ring is closed
    const first = simplified[0];
    const last = simplified[simplified.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      simplified.push([...first]);
    }
    
    return simplified;
  }
  
  /**
   * Calculates perpendicular distance from point to line.
   */
  static perpendicularDistance(
    point: number[],
    lineStart: number[],
    lineEnd: number[]
  ): number {
    const dx = lineEnd[0] - lineStart[0];
    const dy = lineEnd[1] - lineStart[1];
    
    if (dx === 0 && dy === 0) {
      return Math.sqrt(
        Math.pow(point[0] - lineStart[0], 2) +
        Math.pow(point[1] - lineStart[1], 2)
      );
    }
    
    const t = ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) /
              (dx * dx + dy * dy);
    
    const nearestX = lineStart[0] + t * dx;
    const nearestY = lineStart[1] + t * dy;
    
    return Math.sqrt(
      Math.pow(point[0] - nearestX, 2) +
      Math.pow(point[1] - nearestY, 2)
    );
  }
  
  // Helper methods for counting vertices and collecting types
  static countVertices(geometry: any): number { /* ... */ }
  static collectGeometryTypes(geometry: any, types: Set<string>): void { /* ... */ }
  static expandBbox(geometry: any, bbox: any): void { /* ... */ }
}
```

---

### Enhancement 2: Skip TopoJSON Source Simplification

**Rationale:** TopoJSON files from GeoBoundaries and similar sources are already optimized. Re-simplifying them:

- Wastes computation
- May degrade carefully tuned boundaries
- Could break shared arc topology

**Implementation:**

```typescript
// In ChoroplethOrchestrator or ChoroplethDataService

// Track source type when loading data
private sourceType: 'topojson' | 'geojson' = 'geojson';

async loadBoundaryData(url: string): Promise<FeatureCollection> {
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.type === 'Topology') {
    // Source is TopoJSON - mark it
    this.sourceType = 'topojson';
    // Convert to GeoJSON for rendering
    return topojsonClient.feature(data, data.objects[objectName]);
  } else {
    // Source is GeoJSON
    this.sourceType = 'geojson';
    return data;
  }
}

// When building layer options
const simplificationResult = GeometrySimplificationService.process(
  geojson,
  {
    sourceType: this.sourceType,  // TopoJSON sources skip simplification
    strength: choroplethOptions.simplificationStrength,
    autoDetect: true
  }
);
```

---

### Enhancement 3: Adaptive Feature-Size Simplification

**Goal:** Smaller features need less aggressive simplification to remain visible.

**Implementation:**

```typescript
static determineFeatureTolerance(
  feature: Feature,
  baseLevel: 'light' | 'moderate' | 'aggressive',
  viewportBbox: [number, number, number, number]
): number {
  const baseTolerance = {
    light: 0.0001,
    moderate: 0.001,
    aggressive: 0.01
  }[baseLevel];
  
  // Calculate feature's bounding box area
  const featureBbox = turf.bbox(feature);
  const featureArea = (featureBbox[2] - featureBbox[0]) * (featureBbox[3] - featureBbox[1]);
  
  // Calculate viewport area
  const viewportArea = (viewportBbox[2] - viewportBbox[0]) * (viewportBbox[3] - viewportBbox[1]);
  
  // Feature's relative size
  const relativeSize = featureArea / viewportArea;
  
  // Smaller features get reduced tolerance (less simplification)
  if (relativeSize < 0.001) {
    return baseTolerance * 0.1;  // Very small: 10% of base tolerance
  } else if (relativeSize < 0.01) {
    return baseTolerance * 0.5;  // Small: 50% of base tolerance
  } else if (relativeSize < 0.1) {
    return baseTolerance * 0.8;  // Medium: 80% of base tolerance
  }
  
  return baseTolerance;  // Large: full tolerance
}
```

---

### Enhancement 4: Spatial Indexing Evaluation

#### Current State

| Layer | Spatial Index | Usage |
|-------|---------------|-------|
| **SVG** | rbush (in Layer) | Tooltip hit testing |
| **Canvas** | rbush (in Layer) | Tooltip hit testing |
| **WebGL** | None | OpenLayers handles internally |

#### Analysis: Is Spatial Indexing Worth It?

**Benefits:**

1. **Fast hit testing** - O(log n) instead of O(n) for tooltip/selection lookups
2. **Viewport culling** - Only render visible features

**Costs:**

1. **Index build time** - O(n log n) for rbush bulk load
2. **Memory overhead** - Additional data structure
3. **Complexity** - More code to maintain

**Recommendation:**

| Scenario | Recommendation |
|----------|----------------|
| Feature count < 500 | ❌ Skip indexing (linear scan is fast enough) |
| Feature count 500-5000 | ✅ Use rbush for hit testing |
| Feature count > 5000 | ✅ Use rbush + viewport culling |

**Proposed Change:** Move spatial index creation to orchestrator, share single index across all layers (if used):

```typescript
// In ChoroplethOrchestrator
private spatialIndex: RBush<IndexedFeature> | null = null;

private buildSpatialIndexIfNeeded(geojson: FeatureCollection): void {
  // Only build index for datasets that benefit from it
  if (geojson.features.length < 500) {
    this.spatialIndex = null;
    return;
  }
  
  const items = geojson.features.map((f, i) => {
    const bbox = this.computeBbox(f);
    return {
      minX: bbox[0], minY: bbox[1],
      maxX: bbox[2], maxY: bbox[3],
      featureIndex: i
    };
  });
  
  this.spatialIndex = new RBush();
  this.spatialIndex.load(items);
}

// Pass to layer options
layerOptions.spatialIndex = this.spatialIndex; // May be null
```

---

### Enhancement 5: Remove Per-Layer Simplification from SVG

**Goal:** SVG layer should receive pre-simplified data like Canvas/WebGL.

**Current SVG Layer Issues:**

1. Has its own TopoJSON simplification logic
2. Creates LOD cache independently
3. Behaves differently from other engines

**Proposed Change:**

```typescript
// BEFORE: SVG layer does its own simplification
export class ChoroplethLayer extends Layer {
  constructor(options: ChoroplethLayerOptions) {
    // ... 
    this.topo = topology({ layer: this.geojson });
    this.topoPresimplified = presimplify(this.topo);
    // ...
  }
}

// AFTER: SVG layer receives pre-simplified data
export class ChoroplethLayer extends Layer {
  constructor(options: ChoroplethLayerOptions) {
    // ...
    // Data is already simplified by orchestrator
    this.geojson = options.geojson;
    // No TopoJSON conversion needed
    // ...
  }
}
```

**Migration Path:**

1. Add `skipInternalSimplification` option to ChoroplethLayerOptions
2. When true, layer uses geojson as-is
3. Once stable, remove internal simplification code entirely

---

## Implementation Roadmap

### Phase 1: Create GeometrySimplificationService (Priority: HIGH)

**Effort:** 3-4 hours

**Tasks:**

1. Create `src/services/GeometrySimplificationService.ts`
2. Implement `process()`, `computeMetrics()`, `determineLevel()`
3. Implement Douglas-Peucker simplification
4. Handle all geometry types including GeometryCollections
5. Add unit tests

**Files to Create:**

- `src/services/GeometrySimplificationService.ts`
- `tests/unit/services/geometrySimplificationService.test.ts`

---

### Phase 2: Integrate with Orchestrator (Priority: HIGH)

**Effort:** 2-3 hours

**Tasks:**

1. Track source type (TopoJSON vs GeoJSON) in data loading
2. Call simplification service before layer creation
3. Pass same simplified data to all layer types
4. Add metrics logging for debugging

**Files to Modify:**

- `src/services/ChoroplethDataService.ts` - Track source type
- `src/orchestration/ChoroplethOrchestrator.ts` - Apply simplification

---

### Phase 3: Remove SVG Layer Internal Simplification (Priority: MEDIUM)

**Effort:** 2-3 hours

**Tasks:**

1. Add `skipInternalSimplification` flag
2. Bypass TopoJSON conversion when flag is true
3. Update render method to use pre-simplified data
4. Verify visual parity with old approach
5. Remove obsolete code once stable

**Files to Modify:**

- `src/layers/choroplethLayer.ts`
- `src/types/index.ts` (add option to interface)

---

### Phase 4: Consolidate Spatial Indexing (Priority: LOW)

**Effort:** 1-2 hours

**Tasks:**

1. Move rbush creation to orchestrator
2. Add feature count threshold for index creation
3. Pass shared index to layers
4. Remove duplicate index creation from layers

**Files to Modify:**

- `src/orchestration/ChoroplethOrchestrator.ts`
- `src/layers/choroplethLayer.ts`
- `src/layers/canvas/choroplethCanvasLayer.ts`

---

## Testing Requirements

### Unit Tests

```typescript
describe('GeometrySimplificationService', () => {
  describe('process()', () => {
    it('should skip simplification for TopoJSON sources', () => {
      const result = GeometrySimplificationService.process(geojson, {
        sourceType: 'topojson',
        strength: 50,
        autoDetect: true
      });
      expect(result.wasSimplified).toBe(false);
      expect(result.level).toBe('none');
    });
    
    it('should preserve 1-1 feature mapping', () => {
      const result = GeometrySimplificationService.process(geojson, {
        sourceType: 'geojson',
        strength: 50,
        autoDetect: true
      });
      expect(result.geojson.features.length).toBe(geojson.features.length);
    });
    
    it('should not simplify Points', () => {
      const pointFeature = { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] }};
      const result = GeometrySimplificationService.simplifyGeometry(
        pointFeature.geometry, 0.1
      );
      expect(result.coordinates).toEqual([1, 2]);
    });
    
    it('should handle GeometryCollections', () => {
      const gc = {
        type: 'GeometryCollection',
        geometries: [
          { type: 'Point', coordinates: [1, 2] },
          { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] }
        ]
      };
      const result = GeometrySimplificationService.simplifyGeometry(gc, 0.1);
      expect(result.type).toBe('GeometryCollection');
      expect(result.geometries.length).toBe(2);
    });
  });
  
  describe('determineLevel()', () => {
    it('should return none for small datasets', () => {
      const metrics = { featureCount: 100, totalVertices: 5000, avgVerticesPerFeature: 50 };
      const level = GeometrySimplificationService.determineLevel(metrics, { strength: 50 });
      expect(level).toBe('none');
    });
    
    it('should return aggressive for very large datasets', () => {
      const metrics = { featureCount: 15000, totalVertices: 2000000, avgVerticesPerFeature: 133 };
      const level = GeometrySimplificationService.determineLevel(metrics, { strength: 50 });
      expect(level).toBe('aggressive');
    });
  });
});
```

### Integration Tests

```typescript
describe('Cross-Engine Consistency', () => {
  it('should render same boundaries regardless of engine', async () => {
    const geojson = loadTestData('complex-boundaries.geojson');
    
    // Get simplified data from orchestrator
    const simplified = GeometrySimplificationService.process(geojson, options);
    
    // Render with each engine and compare bounding boxes
    const svgBounds = renderWithSVG(simplified.geojson);
    const canvasBounds = renderWithCanvas(simplified.geojson);
    const webglBounds = renderWithWebGL(simplified.geojson);
    
    expect(svgBounds).toEqual(canvasBounds);
    expect(canvasBounds).toEqual(webglBounds);
  });
});
```

---

## Summary

| Enhancement | Priority | Effort | Impact |
|-------------|----------|--------|--------|
| Create GeometrySimplificationService | HIGH | 3-4h | Core functionality |
| Integrate with Orchestrator | HIGH | 2-3h | Unified simplification |
| Remove SVG internal simplification | MEDIUM | 2-3h | Consistency |
| Consolidate spatial indexing | LOW | 1-2h | Performance |

**Total Estimated Effort:** 8-12 hours

**Key Benefits:**

1. ✅ Maintains 1-1 Power BI data relationship
2. ✅ Supports all GeoJSON geometry types
3. ✅ Consistent rendering across all engines
4. ✅ Evidence-based, adaptive simplification
5. ✅ Respects pre-optimized TopoJSON sources
6. ✅ Smaller features preserved appropriately
