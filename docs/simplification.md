# Geometry Simplification

This document describes how the ROSEA MapViz visual handles geometry simplification for choropleth (filled polygon) and scaled circle visualizations.

## Overview

Geometry simplification reduces the number of vertices in complex polygon boundaries while preserving their visual appearance. This is critical for:

- **Performance**: Fewer vertices = faster rendering and lower memory usage
- **Power BI Constraints**: Visuals have memory limits (~100MB) and row limits (30,000 standard)
- **Responsiveness**: Complex boundaries can cause lag during pan/zoom operations

## Architecture

Simplification is handled by the **GeometrySimplificationService** (`src/services/GeometrySimplificationService.ts`), which provides centralized pre-render simplification for all rendering engines.

```text
┌─────────────────────────────────────────────────────────────────┐
│                    ChoroplethOrchestrator                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │           GeometrySimplificationService.process()        │    │
│  │                                                          │    │
│  │  1. Compute metrics (vertex count, feature count)        │    │
│  │  2. Determine simplification level (none/light/mod/agg)  │    │
│  │  3. Apply topology-preserving Douglas-Peucker            │    │
│  │  4. Return PreparedGeometry                              │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│              ┌───────────────┼───────────────┐                  │
│              ▼               ▼               ▼                  │
│     ┌────────────┐   ┌────────────┐   ┌────────────┐           │
│     │ SVG Layer  │   │Canvas Layer│   │WebGL Layer │           │
│     └────────────┘   └────────────┘   └────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

## Simplification Levels

The service uses evidence-based thresholds to automatically select the appropriate simplification level:

| Level | Tolerance | Approx. Distance | Use Case |
|-------|-----------|------------------|----------|
| `none` | 0 | - | Small datasets (<500 features, <50K vertices) |
| `light` | 0.0001° | ~11 meters | Medium datasets, detailed boundaries |
| `moderate` | 0.001° | ~111 meters | Large datasets, country/region level |
| `aggressive` | 0.01° | ~1.1 km | Very large datasets, global views |

### Threshold Logic

```typescript
// Feature count thresholds
FEATURE_COUNT_SKIP: 500      // Below: skip simplification
FEATURE_COUNT_LIGHT: 2000    // Below: use light
FEATURE_COUNT_MODERATE: 10000 // Below: use moderate
// Above: use aggressive

// Vertex count thresholds  
VERTEX_COUNT_SKIP: 50000
VERTEX_COUNT_LIGHT: 200000
VERTEX_COUNT_MODERATE: 1000000
```

## Topology Preservation

A key feature of the simplification service is **topology preservation**. When simplifying adjacent polygons (like countries sharing a border), naive simplification can create gaps or overlaps.

### The Problem

Without topology preservation:

```text
Before:              After (naive):
┌────┬────┐         ┌────┬────┐
│    │    │         │   /│\   │  ← Gap/overlap!
│ A  │ B  │   →     │ A/ │ \B │
│    │    │         │   \│/   │
└────┴────┘         └────┴────┘
```

### The Solution

The service extracts shared edges, simplifies each edge once, then reconstructs polygons:

```text
1. Extract edges:    2. Simplify once:    3. Reconstruct:
   A: [e1,e2,e3,e4]     e2' = simplify(e2)    A: [e1,e2',e3,e4]
   B: [e2,e5,e6,e7]                           B: [e2',e5,e6,e7]
        ↑                                          ↑
     shared edge                               same simplified edge
```

This is enabled by default (`preserveTopology: true`) and can be disabled via options.

## Render Engine Differences

### SVG Engine

The SVG engine previously had its own internal Level-of-Detail (LOD) system using TopoJSON:

```typescript
// REMOVED in Phase 3 refactoring
// Old approach: Convert GeoJSON → TopoJSON → Presimplify → Cache by zoom
private topo: Topology;
private topoPresimplified: Topology;
private topoThresholds: number[];
private simplifiedCache: Map<number, FeatureCollection>;
```

**Current State**: SVG now receives pre-simplified geometry from the orchestrator. The internal TopoJSON-based LOD was redundant because:

1. The orchestrator already simplifies before rendering
2. TopoJSON round-trip (GeoJSON→TopoJSON→GeoJSON) added overhead
3. Zoom-based re-simplification caused visual "popping" artifacts

**Future Consideration**: Zoom-level LOD may be revisited for all engines through a unified approach in the orchestrator.

### Canvas Engine

The Canvas engine renders to a 2D canvas context:

```typescript
// Receives pre-simplified geometry
constructor(options: ChoroplethLayerOptions) {
  this.geojson = options.geojson; // Already simplified
}

render(frameState: FrameState) {
  // Draw paths directly - no additional simplification
  for (const feature of this.geojson.features) {
    ctx.beginPath();
    // ... draw polygon
  }
}
```

**Simplification**: None performed at render time. Uses orchestrator-provided geometry.

### WebGL Engine

The WebGL engine uses OpenLayers' `WebGLVectorLayer`:

```typescript
// OpenLayers handles its own optimizations
this.vectorSource = new VectorSource({
  features: new GeoJSON().readFeatures(options.geojson, {
    featureProjection: 'EPSG:3857'
  })
});

this.layer = new WebGLVectorLayer({
  source: this.vectorSource,
  style: { /* ... */ }
});
```

**Simplification**: OpenLayers performs internal optimizations for WebGL rendering. The input geometry is still pre-simplified by the orchestrator.

## Data Source Handling

### TopoJSON Sources

When the data source is TopoJSON (e.g., from GeoBoundaries), simplification is **skipped**:

```typescript
if (options.sourceType === 'topojson') {
  // TopoJSON is already optimized with shared arcs
  return { geojson, wasSimplified: false, level: 'none' };
}
```

TopoJSON sources are pre-optimized with:

- Shared arc encoding (topology preservation built-in)
- Quantization (reduced coordinate precision)
- Delta encoding (smaller file sizes)

### GeoJSON Sources

GeoJSON from custom URLs or user data is analyzed and simplified:

```typescript
const metrics = this.computeMetrics(geojson);
const level = this.determineLevel(metrics, options);
const simplified = this.simplifyWithTopologyPreservation(geojson, tolerance);
```

## Algorithm: Douglas-Peucker

The core simplification algorithm is **Douglas-Peucker** (also known as Ramer-Douglas-Peucker):

```text
Input: Polyline with points P1, P2, ..., Pn and tolerance ε

1. Find point Pk with maximum perpendicular distance from line P1-Pn
2. If distance > ε:
   - Recursively simplify P1...Pk
   - Recursively simplify Pk...Pn
   - Combine results
3. Else:
   - Return just P1 and Pn (remove intermediate points)
```

**Time Complexity**: O(n²) worst case, O(n log n) average
**Space Complexity**: O(n)

### Ring Validation

Polygon rings require special handling:

```typescript
static simplifyRing(ring: Position[], tolerance: number): Position[] {
  // Minimum 4 points required (3 unique + closing point)
  if (ring.length <= 4) return ring;
  
  const simplified = this.douglasPeucker(ring, tolerance);
  
  // Ensure valid ring
  if (simplified.length < 4) return ring; // Keep original
  
  // Ensure properly closed
  if (first !== last) simplified.push([...first]);
  
  return simplified;
}
```

## PreparedGeometry Interface

The orchestrator passes simplified geometry using the `PreparedGeometry` type:

```typescript
interface PreparedGeometry {
  /** Simplified GeoJSON FeatureCollection */
  geojson: FeatureCollection;
  
  /** Whether simplification was applied */
  wasSimplified: boolean;
  
  /** Simplification level used */
  level: 'none' | 'light' | 'moderate' | 'aggressive';
  
  /** Tolerance value in degrees */
  tolerance: number;
  
  /** Dataset metrics */
  metrics: {
    featureCount: number;
    totalVertices: number;
    avgVerticesPerFeature: number;
    geometryTypes: Set<string>;
  };
  
  /** Detected source type */
  sourceType: 'topojson' | 'geojson';
}
```

## User Configuration

Users can control simplification through the visual's Format pane:

| Setting | Description | Default |
|---------|-------------|---------|
| `simplificationStrength` | Manual control (0-100) | 50 |
| `autoDetect` | Use evidence-based thresholds | true |

When `autoDetect` is enabled, the strength value is used to fine-tune the tolerance within the selected level.

## Performance Metrics

Typical simplification results for country boundaries:

| Dataset | Original Vertices | After Light | After Moderate | After Aggressive |
|---------|------------------|-------------|----------------|------------------|
| World countries | 180,000 | 45,000 | 12,000 | 3,500 |
| US states | 85,000 | 21,000 | 5,500 | 1,600 |
| EU regions | 250,000 | 62,000 | 16,000 | 4,800 |

## Future Enhancements

1. **Zoom-Level LOD**: Implement unified zoom-based detail adjustment in the orchestrator
2. **Progressive Loading**: Load coarse geometry first, refine on zoom
3. **WebWorker Processing**: Move simplification to background thread for large datasets
4. **Caching**: Cache simplified geometry by tolerance level

## Related Files

- `src/services/GeometrySimplificationService.ts` - Main service
- `src/orchestration/ChoroplethOrchestrator.ts` - Integration point
- `src/types/index.ts` - PreparedGeometry interface
- `tests/unit/services/geometrySimplificationService.test.ts` - Unit tests
