/**
 * Tests for polygon winding order utilities.
 * These ensure polygons are wound correctly per RFC 7946 GeoJSON spec:
 * - Exterior rings: counter-clockwise (positive signed area)
 * - Interior rings (holes): clockwise (negative signed area)
 */

import {
    ringSignedArea,
    isClockwise,
    reverseRing,
    rewindPolygon,
    rewindGeometry,
    rewindFeatureCollection
} from '../../../src/utils/geometry';

describe('Polygon Winding Utilities', () => {
    
    // Counter-clockwise square (correct for exterior ring)
    const ccwSquare: number[][] = [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0]
    ];
    
    // Clockwise square (correct for hole, incorrect for exterior)
    const cwSquare: number[][] = [
        [0, 0],
        [0, 10],
        [10, 10],
        [10, 0],
        [0, 0]
    ];
    
    // Small clockwise hole inside the square
    const cwHole: number[][] = [
        [2, 2],
        [2, 8],
        [8, 8],
        [8, 2],
        [2, 2]
    ];
    
    // Counter-clockwise hole (incorrect for hole)
    const ccwHole: number[][] = [
        [2, 2],
        [8, 2],
        [8, 8],
        [2, 8],
        [2, 2]
    ];

    describe('ringSignedArea', () => {
        it('should return positive area for counter-clockwise ring', () => {
            const area = ringSignedArea(ccwSquare);
            expect(area).toBeGreaterThan(0);
        });
        
        it('should return negative area for clockwise ring', () => {
            const area = ringSignedArea(cwSquare);
            expect(area).toBeLessThan(0);
        });
        
        it('should return 0 for degenerate ring (less than 3 points)', () => {
            const area = ringSignedArea([[0, 0], [1, 1]]);
            // A line has no area
            expect(area).toBe(0);
        });
        
        it('should handle empty ring', () => {
            expect(ringSignedArea([])).toBe(0);
        });
    });

    describe('isClockwise', () => {
        it('should return true for clockwise ring', () => {
            expect(isClockwise(cwSquare)).toBe(true);
        });
        
        it('should return false for counter-clockwise ring', () => {
            expect(isClockwise(ccwSquare)).toBe(false);
        });
    });

    describe('reverseRing', () => {
        it('should reverse ring coordinates', () => {
            const reversed = reverseRing(ccwSquare);
            expect(reversed[0]).toEqual(ccwSquare[ccwSquare.length - 1]);
            expect(reversed[reversed.length - 1]).toEqual(ccwSquare[0]);
        });
        
        it('should not mutate original ring', () => {
            const original = [...ccwSquare.map(c => [...c])];
            reverseRing(ccwSquare);
            expect(ccwSquare).toEqual(original);
        });
        
        it('should convert CCW to CW', () => {
            const reversed = reverseRing(ccwSquare);
            expect(isClockwise(reversed)).toBe(true);
        });
        
        it('should convert CW to CCW', () => {
            const reversed = reverseRing(cwSquare);
            expect(isClockwise(reversed)).toBe(false);
        });
    });

    describe('rewindPolygon', () => {
        it('should keep correct exterior ring as-is', () => {
            // CCW exterior is already correct
            const result = rewindPolygon([ccwSquare]);
            expect(isClockwise(result[0])).toBe(false);
        });
        
        it('should fix incorrect exterior ring (clockwise to counter-clockwise)', () => {
            // CW exterior should be rewound to CCW
            const result = rewindPolygon([cwSquare]);
            expect(isClockwise(result[0])).toBe(false);
        });
        
        it('should keep correct hole as-is', () => {
            // Polygon with CCW exterior and CW hole (correct)
            const result = rewindPolygon([ccwSquare, cwHole]);
            expect(isClockwise(result[0])).toBe(false); // exterior CCW
            expect(isClockwise(result[1])).toBe(true);  // hole CW
        });
        
        it('should fix incorrect hole (counter-clockwise to clockwise)', () => {
            // Polygon with CCW exterior and CCW hole (hole is wrong)
            const result = rewindPolygon([ccwSquare, ccwHole]);
            expect(isClockwise(result[0])).toBe(false); // exterior CCW
            expect(isClockwise(result[1])).toBe(true);  // hole should be CW now
        });
        
        it('should fix both exterior and hole if both wrong', () => {
            // CW exterior (wrong) and CCW hole (wrong)
            const result = rewindPolygon([cwSquare, ccwHole]);
            expect(isClockwise(result[0])).toBe(false); // exterior should be CCW
            expect(isClockwise(result[1])).toBe(true);  // hole should be CW
        });
        
        it('should handle empty coordinates', () => {
            expect(rewindPolygon([])).toEqual([]);
        });
        
        it('should handle degenerate ring (less than 3 points)', () => {
            const degenerate = [[0, 0], [1, 1]];
            const result = rewindPolygon([degenerate as number[][]]);
            expect(result[0]).toEqual(degenerate);
        });
    });

    describe('rewindGeometry', () => {
        it('should rewind Polygon geometry', () => {
            const geometry = {
                type: 'Polygon',
                coordinates: [cwSquare] // Wrong winding
            };
            
            rewindGeometry(geometry);
            expect(isClockwise(geometry.coordinates[0])).toBe(false);
        });
        
        it('should rewind MultiPolygon geometry', () => {
            const geometry = {
                type: 'MultiPolygon',
                coordinates: [
                    [cwSquare],  // Wrong winding
                    [cwSquare, ccwHole] // Both wrong
                ]
            };
            
            rewindGeometry(geometry);
            
            // First polygon
            expect(isClockwise(geometry.coordinates[0][0])).toBe(false);
            // Second polygon exterior
            expect(isClockwise(geometry.coordinates[1][0])).toBe(false);
            // Second polygon hole
            expect(isClockwise(geometry.coordinates[1][1])).toBe(true);
        });
        
        it('should rewind GeometryCollection', () => {
            const geometry = {
                type: 'GeometryCollection',
                geometries: [
                    { type: 'Polygon', coordinates: [cwSquare] },
                    { type: 'MultiPolygon', coordinates: [[cwSquare]] }
                ]
            };
            
            rewindGeometry(geometry);
            
            expect(isClockwise(geometry.geometries[0].coordinates[0])).toBe(false);
            expect(isClockwise(geometry.geometries[1].coordinates[0][0])).toBe(false);
        });
        
        it('should not affect Point geometry', () => {
            const geometry = {
                type: 'Point',
                coordinates: [10, 20]
            };
            
            const result = rewindGeometry(geometry);
            expect(result.coordinates).toEqual([10, 20]);
        });
        
        it('should not affect LineString geometry', () => {
            const geometry = {
                type: 'LineString',
                coordinates: [[0, 0], [10, 10], [20, 0]]
            };
            
            const original = JSON.parse(JSON.stringify(geometry.coordinates));
            rewindGeometry(geometry);
            expect(geometry.coordinates).toEqual(original);
        });
        
        it('should handle null geometry', () => {
            expect(rewindGeometry(null)).toBe(null);
        });
        
        it('should handle undefined geometry', () => {
            expect(rewindGeometry(undefined)).toBe(undefined);
        });
    });

    describe('rewindFeatureCollection', () => {
        it('should rewind all polygon features', () => {
            const fc = {
                type: 'FeatureCollection',
                features: [
                    {
                        type: 'Feature',
                        properties: { id: 1 },
                        geometry: { type: 'Polygon', coordinates: [cwSquare] }
                    },
                    {
                        type: 'Feature',
                        properties: { id: 2 },
                        geometry: { type: 'Polygon', coordinates: [cwSquare, ccwHole] }
                    }
                ]
            };
            
            rewindFeatureCollection(fc);
            
            // Feature 1
            expect(isClockwise(fc.features[0].geometry.coordinates[0])).toBe(false);
            // Feature 2 exterior
            expect(isClockwise(fc.features[1].geometry.coordinates[0])).toBe(false);
            // Feature 2 hole
            expect(isClockwise(fc.features[1].geometry.coordinates[1])).toBe(true);
        });
        
        it('should handle features with null geometry', () => {
            const fc = {
                type: 'FeatureCollection',
                features: [
                    {
                        type: 'Feature',
                        properties: { id: 1 },
                        geometry: null
                    }
                ]
            };
            
            // Should not throw
            expect(() => rewindFeatureCollection(fc)).not.toThrow();
        });
        
        it('should handle empty FeatureCollection', () => {
            const fc = {
                type: 'FeatureCollection',
                features: []
            };
            
            const result = rewindFeatureCollection(fc);
            expect(result.features).toEqual([]);
        });
        
        it('should return non-FeatureCollection as-is', () => {
            const notFC = { type: 'Feature', geometry: null };
            expect(rewindFeatureCollection(notFC)).toBe(notFC);
        });
        
        it('should handle mixed geometry types', () => {
            const fc = {
                type: 'FeatureCollection',
                features: [
                    {
                        type: 'Feature',
                        properties: {},
                        geometry: { type: 'Point', coordinates: [10, 20] }
                    },
                    {
                        type: 'Feature',
                        properties: {},
                        geometry: { type: 'Polygon', coordinates: [cwSquare] }
                    },
                    {
                        type: 'Feature',
                        properties: {},
                        geometry: { type: 'LineString', coordinates: [[0, 0], [10, 10]] }
                    }
                ]
            };
            
            // Should not throw and should fix the polygon
            rewindFeatureCollection(fc);
            expect(isClockwise(fc.features[1].geometry.coordinates[0])).toBe(false);
        });
    });

    describe('Real-world scenario: TopoJSON conversion', () => {
        it('should fix "world-filling" polygon from incorrectly wound TopoJSON', () => {
            // This simulates what happens when TopoJSON produces a clockwise exterior
            // The polygon appears to "fill the world" because the inside/outside is inverted
            const badPolygon = {
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    properties: { name: 'Gaalkacyo' },
                    geometry: {
                        type: 'Polygon',
                        // Clockwise winding (wrong for exterior)
                        coordinates: [[
                            [46.5, 6.5],
                            [46.5, 7.0],
                            [47.0, 7.0],
                            [47.0, 6.5],
                            [46.5, 6.5]
                        ]]
                    }
                }]
            };
            
            // Before: clockwise (incorrect)
            expect(isClockwise(badPolygon.features[0].geometry.coordinates[0])).toBe(true);
            
            // Apply fix
            rewindFeatureCollection(badPolygon);
            
            // After: counter-clockwise (correct)
            expect(isClockwise(badPolygon.features[0].geometry.coordinates[0])).toBe(false);
        });
    });
});
