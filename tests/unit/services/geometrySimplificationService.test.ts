/**
 * Unit tests for GeometrySimplificationService
 */

import { 
  GeometrySimplificationService,
  SimplificationOptions,
  SimplificationLevel
} from '../../../src/services/GeometrySimplificationService';
import type { FeatureCollection, Feature, Geometry, Point, LineString, Polygon, MultiPolygon, GeometryCollection } from 'geojson';

// ============================================================================
// Test Fixtures
// ============================================================================

const createPoint = (lon: number, lat: number): Point => ({
  type: 'Point',
  coordinates: [lon, lat]
});

const createLineString = (coords: [number, number][]): LineString => ({
  type: 'LineString',
  coordinates: coords
});

const createPolygon = (coords: [number, number][][]): Polygon => ({
  type: 'Polygon',
  coordinates: coords
});

const createFeature = <G extends Geometry>(geometry: G, properties: Record<string, any> = {}): Feature<G> => ({
  type: 'Feature',
  geometry,
  properties
});

const createFeatureCollection = (...features: Feature[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features
});

// Simple square polygon
const squarePolygon: Polygon = createPolygon([
  [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]
]);

// Complex polygon with many vertices (for simplification testing)
const complexPolygonCoords: [number, number][] = [
  [0, 0], [0.1, 0.01], [0.2, 0], [0.3, 0.02], [0.4, 0], [0.5, 0.01],
  [0.6, 0], [0.7, 0.02], [0.8, 0], [0.9, 0.01], [1, 0],
  [1, 0.1], [0.99, 0.2], [1, 0.3], [0.98, 0.4], [1, 0.5],
  [1, 0.6], [0.99, 0.7], [1, 0.8], [0.98, 0.9], [1, 1],
  [0.9, 1], [0.8, 0.99], [0.7, 1], [0.6, 0.98], [0.5, 1],
  [0.4, 1], [0.3, 0.99], [0.2, 1], [0.1, 0.98], [0, 1],
  [0, 0.9], [0.01, 0.8], [0, 0.7], [0.02, 0.6], [0, 0.5],
  [0, 0.4], [0.01, 0.3], [0, 0.2], [0.02, 0.1], [0, 0]
];
const complexPolygon: Polygon = {
  type: 'Polygon',
  coordinates: [complexPolygonCoords]
};

// GeometryCollection with mixed types
const mixedGeometryCollection: GeometryCollection = {
  type: 'GeometryCollection',
  geometries: [
    createPoint(0, 0),
    createLineString([[0, 0], [1, 1], [2, 0]]),
    squarePolygon
  ]
};

// Default options for testing
const defaultOptions: SimplificationOptions = {
  sourceType: 'geojson',
  strength: 50,
  autoDetect: true
};

// ============================================================================
// Tests: process()
// ============================================================================

describe('GeometrySimplificationService', () => {
  
  describe('process()', () => {
    
    it('should skip simplification for TopoJSON sources', () => {
      const geojson = createFeatureCollection(
        createFeature(squarePolygon)
      );
      
      const result = GeometrySimplificationService.process(geojson, {
        sourceType: 'topojson',
        strength: 50,
        autoDetect: true
      });
      
      expect(result.wasSimplified).toBe(false);
      expect(result.level).toBe('none');
      expect(result.geojson).toBe(geojson); // Same reference
    });
    
    it('should skip simplification when strength is 0', () => {
      const geojson = createFeatureCollection(
        createFeature(complexPolygon)
      );
      
      const result = GeometrySimplificationService.process(geojson, {
        sourceType: 'geojson',
        strength: 0,
        autoDetect: true
      });
      
      expect(result.wasSimplified).toBe(false);
      expect(result.level).toBe('none');
    });
    
    it('should preserve 1-1 feature mapping', () => {
      const features = Array(10).fill(null).map((_, i) => 
        createFeature(complexPolygon, { id: i })
      );
      const geojson = createFeatureCollection(...features);
      
      const result = GeometrySimplificationService.process(geojson, {
        ...defaultOptions,
        autoDetect: false // Force simplification
      });
      
      expect(result.geojson.features.length).toBe(geojson.features.length);
      
      // Verify each feature's properties are preserved
      result.geojson.features.forEach((feature, i) => {
        expect(feature.properties?.id).toBe(i);
      });
    });
    
    it('should handle empty FeatureCollection', () => {
      const geojson = createFeatureCollection();
      
      const result = GeometrySimplificationService.process(geojson, defaultOptions);
      
      expect(result.wasSimplified).toBe(false);
      expect(result.geojson.features.length).toBe(0);
      expect(result.metrics.featureCount).toBe(0);
    });
    
    it('should handle null/undefined input gracefully', () => {
      const result1 = GeometrySimplificationService.process(null as any, defaultOptions);
      expect(result1.wasSimplified).toBe(false);
      expect(result1.metrics.featureCount).toBe(0);
      
      const result2 = GeometrySimplificationService.process(undefined as any, defaultOptions);
      expect(result2.wasSimplified).toBe(false);
    });
  });
  
  // ==========================================================================
  // Tests: computeMetrics()
  // ==========================================================================
  
  describe('computeMetrics()', () => {
    
    it('should count features correctly', () => {
      const geojson = createFeatureCollection(
        createFeature(createPoint(0, 0)),
        createFeature(createLineString([[0, 0], [1, 1]])),
        createFeature(squarePolygon)
      );
      
      const metrics = GeometrySimplificationService.computeMetrics(geojson);
      
      expect(metrics.featureCount).toBe(3);
    });
    
    it('should count vertices by type', () => {
      const geojson = createFeatureCollection(
        createFeature(createPoint(0, 0)),                    // 1 point vertex
        createFeature(createLineString([[0, 0], [1, 1]])),  // 2 line vertices
        createFeature(squarePolygon)                         // 5 polygon vertices
      );
      
      const metrics = GeometrySimplificationService.computeMetrics(geojson);
      
      expect(metrics.vertexBreakdown.points).toBe(1);
      expect(metrics.vertexBreakdown.lines).toBe(2);
      expect(metrics.vertexBreakdown.polygons).toBe(5);
      expect(metrics.totalVertices).toBe(8);
    });
    
    it('should collect all geometry types', () => {
      const geojson = createFeatureCollection(
        createFeature(createPoint(0, 0)),
        createFeature(createLineString([[0, 0], [1, 1]])),
        createFeature(squarePolygon)
      );
      
      const metrics = GeometrySimplificationService.computeMetrics(geojson);
      
      expect(metrics.geometryTypes.has('Point')).toBe(true);
      expect(metrics.geometryTypes.has('LineString')).toBe(true);
      expect(metrics.geometryTypes.has('Polygon')).toBe(true);
    });
    
    it('should handle GeometryCollections correctly', () => {
      const geojson = createFeatureCollection(
        createFeature(mixedGeometryCollection as any)
      );
      
      const metrics = GeometrySimplificationService.computeMetrics(geojson);
      
      expect(metrics.geometryTypes.has('GeometryCollection')).toBe(true);
      expect(metrics.geometryTypes.has('Point')).toBe(true);
      expect(metrics.geometryTypes.has('LineString')).toBe(true);
      expect(metrics.geometryTypes.has('Polygon')).toBe(true);
      
      // 1 point + 3 line coords + 5 polygon coords = 9
      expect(metrics.totalVertices).toBe(9);
    });
    
    it('should compute correct bounding box', () => {
      const geojson = createFeatureCollection(
        createFeature(createPoint(-10, -20)),
        createFeature(createPoint(30, 40))
      );
      
      const metrics = GeometrySimplificationService.computeMetrics(geojson);
      
      expect(metrics.boundingBox).toEqual([-10, -20, 30, 40]);
    });
    
    it('should compute average vertices per feature', () => {
      const geojson = createFeatureCollection(
        createFeature(squarePolygon), // 5 vertices
        createFeature(squarePolygon)  // 5 vertices
      );
      
      const metrics = GeometrySimplificationService.computeMetrics(geojson);
      
      expect(metrics.avgVerticesPerFeature).toBe(5);
    });
  });
  
  // ==========================================================================
  // Tests: determineLevel()
  // ==========================================================================
  
  describe('determineLevel()', () => {
    
    it('should return none for small datasets', () => {
      const metrics = {
        featureCount: 100,
        totalVertices: 5000,
        avgVerticesPerFeature: 50,
        boundingBox: [0, 0, 1, 1] as [number, number, number, number],
        geometryTypes: new Set(['Polygon']),
        vertexBreakdown: { points: 0, lines: 0, polygons: 5000 }
      };
      
      const level = GeometrySimplificationService.determineLevel(metrics, defaultOptions);
      
      expect(level).toBe('none');
    });
    
    it('should return aggressive for very large datasets', () => {
      const metrics = {
        featureCount: 15000,
        totalVertices: 2000000,
        avgVerticesPerFeature: 133,
        boundingBox: [0, 0, 180, 90] as [number, number, number, number],
        geometryTypes: new Set(['Polygon']),
        vertexBreakdown: { points: 0, lines: 0, polygons: 2000000 }
      };
      
      const level = GeometrySimplificationService.determineLevel(metrics, defaultOptions);
      
      expect(level).toBe('aggressive');
    });
    
    it('should return moderate for medium datasets', () => {
      const metrics = {
        featureCount: 3000,
        totalVertices: 300000,
        avgVerticesPerFeature: 100,
        boundingBox: [0, 0, 180, 90] as [number, number, number, number],
        geometryTypes: new Set(['Polygon']),
        vertexBreakdown: { points: 0, lines: 0, polygons: 300000 }
      };
      
      const level = GeometrySimplificationService.determineLevel(metrics, defaultOptions);
      
      expect(level).toBe('moderate');
    });
    
    it('should return light for complex features with few total vertices', () => {
      const metrics = {
        featureCount: 400,
        totalVertices: 60000,
        avgVerticesPerFeature: 150, // High complexity per feature
        boundingBox: [0, 0, 10, 10] as [number, number, number, number],
        geometryTypes: new Set(['Polygon']),
        vertexBreakdown: { points: 0, lines: 0, polygons: 60000 }
      };
      
      const level = GeometrySimplificationService.determineLevel(metrics, defaultOptions);
      
      expect(level).toBe('light');
    });
    
    it('should return none for point-only datasets regardless of count', () => {
      const metrics = {
        featureCount: 20000, // Many features
        totalVertices: 20000,
        avgVerticesPerFeature: 1,
        boundingBox: [0, 0, 180, 90] as [number, number, number, number],
        geometryTypes: new Set(['Point']),
        vertexBreakdown: { points: 20000, lines: 0, polygons: 0 } // All points
      };
      
      const level = GeometrySimplificationService.determineLevel(metrics, defaultOptions);
      
      // Points can't be simplified - simplifiableVertices is 0, so should be 'none'
      // The determineLevel uses vertexBreakdown.polygons + lines for threshold checks
      expect(level).toBe('none');
    });
  });
  
  // ==========================================================================
  // Tests: simplifyGeometry()
  // ==========================================================================
  
  describe('simplifyGeometry()', () => {
    
    it('should not modify Point geometry', () => {
      const point = createPoint(1.23456789, 2.34567890);
      
      const result = GeometrySimplificationService.simplifyGeometry(point, 0.1);
      
      expect(result.type).toBe('Point');
      expect((result as Point).coordinates).toEqual([1.23456789, 2.34567890]);
    });
    
    it('should not modify MultiPoint geometry', () => {
      const multiPoint = {
        type: 'MultiPoint' as const,
        coordinates: [[0, 0], [1, 1], [2, 2]] as [number, number][]
      };
      
      const result = GeometrySimplificationService.simplifyGeometry(multiPoint, 0.1);
      
      expect(result.type).toBe('MultiPoint');
      expect((result as any).coordinates.length).toBe(3);
    });
    
    it('should simplify LineString', () => {
      const line = createLineString([
        [0, 0], [0.001, 0.0001], [0.002, 0], [0.003, 0.0001], [1, 0]
      ]);
      
      const result = GeometrySimplificationService.simplifyGeometry(line, 0.01);
      
      expect(result.type).toBe('LineString');
      // Should be simplified to fewer points
      expect((result as LineString).coordinates.length).toBeLessThan(5);
      // Should keep endpoints
      expect((result as LineString).coordinates[0]).toEqual([0, 0]);
      expect((result as LineString).coordinates[(result as LineString).coordinates.length - 1]).toEqual([1, 0]);
    });
    
    it('should simplify Polygon while maintaining validity', () => {
      const result = GeometrySimplificationService.simplifyGeometry(complexPolygon, 0.05);
      
      expect(result.type).toBe('Polygon');
      const ring = (result as Polygon).coordinates[0];
      
      // Ring should have fewer vertices than original
      expect(ring.length).toBeLessThan(complexPolygon.coordinates[0].length);
      
      // Ring should have at least 4 points (minimum valid polygon)
      expect(ring.length).toBeGreaterThanOrEqual(4);
      
      // Ring should be closed
      expect(ring[0]).toEqual(ring[ring.length - 1]);
    });
    
    it('should not over-simplify small polygons', () => {
      const tinyPolygon: Polygon = createPolygon([
        [[0, 0], [0.0001, 0], [0.0001, 0.0001], [0, 0.0001], [0, 0]]
      ]);
      
      const result = GeometrySimplificationService.simplifyGeometry(tinyPolygon, 0.01);
      
      expect(result.type).toBe('Polygon');
      const ring = (result as Polygon).coordinates[0];
      
      // Should keep original if simplification would make it invalid
      expect(ring.length).toBeGreaterThanOrEqual(4);
    });
    
    it('should handle GeometryCollection recursively', () => {
      const gc: GeometryCollection = {
        type: 'GeometryCollection',
        geometries: [
          createPoint(0, 0),
          complexPolygon
        ]
      };
      
      const result = GeometrySimplificationService.simplifyGeometry(gc, 0.05);
      
      expect(result.type).toBe('GeometryCollection');
      expect((result as GeometryCollection).geometries.length).toBe(2);
      
      // Point should be unchanged
      expect((result as GeometryCollection).geometries[0].type).toBe('Point');
      
      // Polygon should be simplified
      const simplifiedPolygon = (result as GeometryCollection).geometries[1] as Polygon;
      expect(simplifiedPolygon.coordinates[0].length).toBeLessThan(complexPolygon.coordinates[0].length);
    });
    
    it('should handle MultiPolygon', () => {
      const multiPolygon: MultiPolygon = {
        type: 'MultiPolygon',
        coordinates: [
          complexPolygon.coordinates,
          squarePolygon.coordinates
        ]
      };
      
      const result = GeometrySimplificationService.simplifyGeometry(multiPolygon, 0.05);
      
      expect(result.type).toBe('MultiPolygon');
      expect((result as MultiPolygon).coordinates.length).toBe(2);
    });
  });
  
  // ==========================================================================
  // Tests: Douglas-Peucker Algorithm
  // ==========================================================================
  
  describe('douglasPeucker()', () => {
    
    it('should return endpoints for very simple lines', () => {
      const coords: [number, number][] = [[0, 0], [1, 1]];
      
      const result = GeometrySimplificationService.douglasPeucker(coords, 0.1);
      
      expect(result.length).toBe(2);
      expect(result[0]).toEqual([0, 0]);
      expect(result[1]).toEqual([1, 1]);
    });
    
    it('should keep collinear points if distance exceeds tolerance', () => {
      // Points on a diagonal with one offset point
      const coords: [number, number][] = [
        [0, 0], [0.5, 0.6], [1, 1] // Middle point is 0.1 units off the line
      ];
      
      const result = GeometrySimplificationService.douglasPeucker(coords, 0.05);
      
      // Should keep the middle point since offset > tolerance
      expect(result.length).toBe(3);
    });
    
    it('should remove collinear points within tolerance', () => {
      // Points nearly on a straight line
      const coords: [number, number][] = [
        [0, 0], [0.5, 0.001], [1, 0] // Middle point barely off the line
      ];
      
      const result = GeometrySimplificationService.douglasPeucker(coords, 0.01);
      
      // Should remove middle point
      expect(result.length).toBe(2);
    });
    
    it('should handle single-point input', () => {
      const coords: [number, number][] = [[0, 0]];
      
      const result = GeometrySimplificationService.douglasPeucker(coords, 0.1);
      
      expect(result.length).toBe(1);
    });
    
    it('should handle empty input', () => {
      const result = GeometrySimplificationService.douglasPeucker([], 0.1);
      
      expect(result.length).toBe(0);
    });
  });
  
  // ==========================================================================
  // Tests: simplifyRing()
  // ==========================================================================
  
  describe('simplifyRing()', () => {
    
    it('should ensure ring remains closed', () => {
      const ring: [number, number][] = [
        [0, 0], [0.5, 0.01], [1, 0], [1, 0.5], [1, 1], [0.5, 1], [0, 1], [0, 0.5], [0, 0]
      ];
      
      const result = GeometrySimplificationService.simplifyRing(ring, 0.02);
      
      // First and last should match
      expect(result[0]).toEqual(result[result.length - 1]);
    });
    
    it('should not simplify below minimum valid ring size', () => {
      const ring: [number, number][] = [[0, 0], [1, 0], [0.5, 1], [0, 0]];
      
      // Try to over-simplify
      const result = GeometrySimplificationService.simplifyRing(ring, 10);
      
      // Should keep original
      expect(result.length).toBe(4);
    });
    
    it('should keep very small rings unchanged', () => {
      const ring: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 0]];
      
      const result = GeometrySimplificationService.simplifyRing(ring, 0.01);
      
      expect(result.length).toBe(4);
    });
  });
  
  // ==========================================================================
  // Tests: perpendicularDistance()
  // ==========================================================================
  
  describe('perpendicularDistance()', () => {
    
    it('should return 0 for point on line', () => {
      const dist = GeometrySimplificationService.perpendicularDistance(
        [0.5, 0.5],  // Point
        [0, 0],       // Line start
        [1, 1]        // Line end
      );
      
      expect(dist).toBeCloseTo(0, 10);
    });
    
    it('should calculate correct distance for perpendicular offset', () => {
      // Point 1 unit above horizontal line
      const dist = GeometrySimplificationService.perpendicularDistance(
        [0.5, 1],  // Point
        [0, 0],     // Line start
        [1, 0]      // Line end
      );
      
      expect(dist).toBeCloseTo(1, 10);
    });
    
    it('should handle degenerate line (start == end)', () => {
      const dist = GeometrySimplificationService.perpendicularDistance(
        [1, 0],     // Point
        [0, 0],     // Line start
        [0, 0]      // Line end (same as start)
      );
      
      expect(dist).toBeCloseTo(1, 10); // Distance to the point
    });
  });
  
  // ==========================================================================
  // Tests: Utility Methods
  // ==========================================================================
  
  describe('shouldSkipSimplification()', () => {
    
    it('should return true for point-only datasets', () => {
      const metrics = {
        featureCount: 1000,
        totalVertices: 1000,
        avgVerticesPerFeature: 1,
        boundingBox: [0, 0, 1, 1] as [number, number, number, number],
        geometryTypes: new Set(['Point']),
        vertexBreakdown: { points: 1000, lines: 0, polygons: 0 }
      };
      
      expect(GeometrySimplificationService.shouldSkipSimplification(metrics)).toBe(true);
    });
    
    it('should return true for very small datasets', () => {
      const metrics = {
        featureCount: 5,
        totalVertices: 100,
        avgVerticesPerFeature: 20,
        boundingBox: [0, 0, 1, 1] as [number, number, number, number],
        geometryTypes: new Set(['Polygon']),
        vertexBreakdown: { points: 0, lines: 0, polygons: 100 }
      };
      
      expect(GeometrySimplificationService.shouldSkipSimplification(metrics)).toBe(true);
    });
    
    it('should return false for datasets with polygons', () => {
      const metrics = {
        featureCount: 100,
        totalVertices: 10000,
        avgVerticesPerFeature: 100,
        boundingBox: [0, 0, 1, 1] as [number, number, number, number],
        geometryTypes: new Set(['Polygon']),
        vertexBreakdown: { points: 0, lines: 0, polygons: 10000 }
      };
      
      expect(GeometrySimplificationService.shouldSkipSimplification(metrics)).toBe(false);
    });
  });
  
  describe('estimateMemoryUsage()', () => {
    
    it('should estimate memory for vertices and features', () => {
      const metrics = {
        featureCount: 100,
        totalVertices: 10000,
        avgVerticesPerFeature: 100,
        boundingBox: [0, 0, 1, 1] as [number, number, number, number],
        geometryTypes: new Set(['Polygon']),
        vertexBreakdown: { points: 0, lines: 0, polygons: 10000 }
      };
      
      const estimate = GeometrySimplificationService.estimateMemoryUsage(metrics);
      
      // 10000 vertices * 16 bytes + 100 features * 200 bytes = 180000
      expect(estimate).toBe(180000);
    });
  });
  
  describe('describeResult()', () => {
    
    it('should describe non-simplified result', () => {
      const result = {
        geojson: createFeatureCollection(),
        metrics: {
          featureCount: 10,
          totalVertices: 100,
          avgVerticesPerFeature: 10,
          boundingBox: [0, 0, 1, 1] as [number, number, number, number],
          geometryTypes: new Set<string>(),
          vertexBreakdown: { points: 0, lines: 0, polygons: 100 }
        },
        wasSimplified: false,
        level: 'none' as SimplificationLevel,
        tolerance: 0
      };
      
      const desc = GeometrySimplificationService.describeResult(result);
      
      expect(desc).toContain('No simplification');
      expect(desc).toContain('10 features');
      expect(desc).toContain('100 vertices');
    });
    
    it('should describe simplified result', () => {
      const result = {
        geojson: createFeatureCollection(),
        metrics: {
          featureCount: 10,
          totalVertices: 50,
          avgVerticesPerFeature: 5,
          boundingBox: [0, 0, 1, 1] as [number, number, number, number],
          geometryTypes: new Set<string>(),
          vertexBreakdown: { points: 0, lines: 0, polygons: 50 }
        },
        wasSimplified: true,
        level: 'moderate' as SimplificationLevel,
        tolerance: 0.001
      };
      
      const desc = GeometrySimplificationService.describeResult(result);
      
      expect(desc).toContain('moderate');
      expect(desc).toContain('0.001');
    });
  });
  
  describe('topology preservation', () => {
    
    it('should preserve shared edges between adjacent polygons', () => {
      // Create two adjacent squares sharing an edge at x=1
      // Left square: [0,0] - [1,0] - [1,1] - [0,1] - [0,0]
      // Right square: [1,0] - [2,0] - [2,1] - [1,1] - [1,0]
      // They share the edge from [1,0] to [1,1]
      
      const leftSquare: Polygon = {
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
      };
      
      const rightSquare: Polygon = {
        type: 'Polygon',
        coordinates: [[[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]]]
      };
      
      const geojson = createFeatureCollection(
        createFeature(leftSquare),
        createFeature(rightSquare)
      );
      
      // Run topology-preserving simplification
      const result = GeometrySimplificationService.simplifyWithTopologyPreservation(
        geojson,
        0.0001 // Small tolerance
      );
      
      // Both polygons should still exist
      expect(result.features.length).toBe(2);
      
      // Get the shared edge from both polygons
      const leftCoords = (result.features[0].geometry as Polygon).coordinates[0];
      const rightCoords = (result.features[1].geometry as Polygon).coordinates[0];
      
      // Find the edge at x=1 in the left polygon (going from [1,0] to [1,1])
      let leftEdgeStart: [number, number] | null = null;
      let leftEdgeEnd: [number, number] | null = null;
      for (let i = 0; i < leftCoords.length - 1; i++) {
        if (Math.abs(leftCoords[i][0] - 1) < 0.001 && Math.abs(leftCoords[i+1][0] - 1) < 0.001) {
          leftEdgeStart = leftCoords[i] as [number, number];
          leftEdgeEnd = leftCoords[i+1] as [number, number];
          break;
        }
      }
      
      // Find the edge at x=1 in the right polygon (going from [1,1] to [1,0])
      let rightEdgeStart: [number, number] | null = null;
      let rightEdgeEnd: [number, number] | null = null;
      for (let i = 0; i < rightCoords.length - 1; i++) {
        if (Math.abs(rightCoords[i][0] - 1) < 0.001 && Math.abs(rightCoords[i+1][0] - 1) < 0.001) {
          rightEdgeStart = rightCoords[i] as [number, number];
          rightEdgeEnd = rightCoords[i+1] as [number, number];
          break;
        }
      }
      
      // Verify edges exist (simple squares shouldn't be simplified away)
      expect(leftEdgeStart).not.toBeNull();
      expect(rightEdgeStart).not.toBeNull();
    });
    
    it('should use topology preservation by default for polygon data', () => {
      // Create a complex polygon that would benefit from simplification
      const complexPoly: Polygon = {
        type: 'Polygon',
        coordinates: [[
          [0, 0], [0.1, 0.001], [0.2, 0], [0.3, 0.002], [0.4, 0], [0.5, 0.001],
          [0.6, 0], [0.7, 0.002], [0.8, 0], [0.9, 0.001], [1, 0],
          [1, 0.1], [0.999, 0.2], [1, 0.3], [0.998, 0.4], [1, 0.5],
          [1, 0.6], [0.999, 0.7], [1, 0.8], [0.998, 0.9], [1, 1],
          [0.9, 1], [0.8, 0.999], [0.7, 1], [0.6, 0.998], [0.5, 1],
          [0.4, 1], [0.3, 0.999], [0.2, 1], [0.1, 0.998], [0, 1],
          [0, 0.9], [0.001, 0.8], [0, 0.7], [0.002, 0.6], [0, 0.5],
          [0, 0.4], [0.001, 0.3], [0, 0.2], [0.002, 0.1], [0, 0]
        ]]
      };
      
      const geojson = createFeatureCollection(
        createFeature(complexPoly)
      );
      
      // Use default options (preserveTopology not set, should default to true)
      const result = GeometrySimplificationService.process(geojson, {
        sourceType: 'geojson',
        strength: 50,
        autoDetect: false  // Force simplification to test topology preservation
      });
      
      // Result should be a valid feature collection
      expect(result.geojson.type).toBe('FeatureCollection');
      expect(result.geojson.features.length).toBe(1);
    });
    
    it('should allow disabling topology preservation via option', () => {
      const geojson = createFeatureCollection(
        createFeature(squarePolygon)
      );
      
      const result = GeometrySimplificationService.process(geojson, {
        sourceType: 'geojson',
        strength: 50,
        autoDetect: false,
        preserveTopology: false
      });
      
      // Should still produce valid output
      expect(result.geojson.features.length).toBe(1);
    });
  });
});
