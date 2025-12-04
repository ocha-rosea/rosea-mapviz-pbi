/**
 * Unit tests for color utility functions.
 * Tests isValidCssColor() and getFeatureColor() for various color formats and edge cases.
 */

import { isValidCssColor, getFeatureColor } from '../../../src/utils/color';

describe('Color Utilities', () => {
    describe('isValidCssColor()', () => {
        describe('hex colors', () => {
            it('should validate 3-digit hex colors', () => {
                expect(isValidCssColor('#fff')).toBe(true);
                expect(isValidCssColor('#FFF')).toBe(true);
                expect(isValidCssColor('#abc')).toBe(true);
                expect(isValidCssColor('#123')).toBe(true);
            });

            it('should validate 6-digit hex colors', () => {
                expect(isValidCssColor('#ffffff')).toBe(true);
                expect(isValidCssColor('#FFFFFF')).toBe(true);
                expect(isValidCssColor('#ff0000')).toBe(true);
                expect(isValidCssColor('#00ff00')).toBe(true);
                expect(isValidCssColor('#0000ff')).toBe(true);
            });

            it('should validate 8-digit hex colors with alpha', () => {
                expect(isValidCssColor('#ffffffff')).toBe(true);
                expect(isValidCssColor('#ff000080')).toBe(true);
                expect(isValidCssColor('#00ff00aa')).toBe(true);
            });

            it('should reject invalid hex colors', () => {
                expect(isValidCssColor('#gg')).toBe(false);
                expect(isValidCssColor('#gggggg')).toBe(false);
                expect(isValidCssColor('#12')).toBe(false);
                expect(isValidCssColor('#12345')).toBe(false);
                expect(isValidCssColor('#1234567')).toBe(false);
                expect(isValidCssColor('#123456789')).toBe(false);
                expect(isValidCssColor('fff')).toBe(false); // missing #
            });
        });

        describe('rgb colors', () => {
            it('should validate rgb() colors', () => {
                expect(isValidCssColor('rgb(255,0,0)')).toBe(true);
                expect(isValidCssColor('rgb(0, 255, 0)')).toBe(true);
                expect(isValidCssColor('rgb( 0 , 0 , 255 )')).toBe(true);
                expect(isValidCssColor('RGB(128,128,128)')).toBe(true);
            });

            it('should reject invalid rgb() colors', () => {
                expect(isValidCssColor('rgb(255,0)')).toBe(false); // missing value
                expect(isValidCssColor('rgb(255,0,0,0.5)')).toBe(false); // wrong format (should be rgba)
            });
        });

        describe('rgba colors', () => {
            it('should validate rgba() colors', () => {
                expect(isValidCssColor('rgba(255,0,0,0.5)')).toBe(true);
                expect(isValidCssColor('rgba(0, 255, 0, 1)')).toBe(true);
                expect(isValidCssColor('rgba( 0 , 0 , 255 , 0.75 )')).toBe(true);
                expect(isValidCssColor('RGBA(128,128,128,0)')).toBe(true);
            });

            it('should reject invalid rgba() colors', () => {
                expect(isValidCssColor('rgba(255,0,0)')).toBe(false); // missing alpha
            });
        });

        describe('invalid inputs', () => {
            it('should reject named colors (not supported)', () => {
                expect(isValidCssColor('red')).toBe(false);
                expect(isValidCssColor('blue')).toBe(false);
                expect(isValidCssColor('transparent')).toBe(false);
            });

            it('should reject non-string values', () => {
                expect(isValidCssColor(123)).toBe(false);
                expect(isValidCssColor(null)).toBe(false);
                expect(isValidCssColor(undefined)).toBe(false);
                expect(isValidCssColor({})).toBe(false);
                expect(isValidCssColor([])).toBe(false);
                expect(isValidCssColor(true)).toBe(false);
            });

            it('should reject random strings', () => {
                expect(isValidCssColor('not-a-color')).toBe(false);
                expect(isValidCssColor('')).toBe(false);
                expect(isValidCssColor('   ')).toBe(false);
            });
        });

        describe('whitespace handling', () => {
            it('should handle leading/trailing whitespace', () => {
                expect(isValidCssColor('  #fff  ')).toBe(true);
                expect(isValidCssColor('  rgb(255,0,0)  ')).toBe(true);
            });
        });
    });

    describe('getFeatureColor()', () => {
        describe('exact property name match', () => {
            it('should extract color from properties with exact match', () => {
                expect(getFeatureColor({ color: '#ff0000' }, 'color')).toBe('#ff0000');
                expect(getFeatureColor({ fill: '#00ff00' }, 'fill')).toBe('#00ff00');
                expect(getFeatureColor({ style_color: '#0000ff' }, 'style_color')).toBe('#0000ff');
            });

            it('should use default property name "color"', () => {
                expect(getFeatureColor({ color: '#ff0000' })).toBe('#ff0000');
            });
        });

        describe('case-insensitive fallback', () => {
            it('should support case-insensitive fallback', () => {
                expect(getFeatureColor({ Color: '#ff0000' }, 'color')).toBe('#ff0000');
                expect(getFeatureColor({ COLOR: '#ff0000' }, 'color')).toBe('#ff0000');
                expect(getFeatureColor({ cOlOr: '#ff0000' }, 'color')).toBe('#ff0000');
            });

            it('should prefer exact match over case-insensitive match', () => {
                expect(getFeatureColor({ color: '#ff0000', Color: '#00ff00' }, 'color')).toBe('#ff0000');
            });
        });

        describe('color format support', () => {
            it('should extract hex colors', () => {
                expect(getFeatureColor({ color: '#fff' }, 'color')).toBe('#fff');
                expect(getFeatureColor({ color: '#ffffff' }, 'color')).toBe('#ffffff');
                expect(getFeatureColor({ color: '#ffffffaa' }, 'color')).toBe('#ffffffaa');
            });

            it('should extract rgb/rgba colors', () => {
                expect(getFeatureColor({ color: 'rgb(255,0,0)' }, 'color')).toBe('rgb(255,0,0)');
                expect(getFeatureColor({ color: 'rgba(255,0,0,0.5)' }, 'color')).toBe('rgba(255,0,0,0.5)');
            });

            it('should trim whitespace from color values', () => {
                expect(getFeatureColor({ color: '  #ff0000  ' }, 'color')).toBe('#ff0000');
            });
        });

        describe('invalid inputs', () => {
            it('should return null for invalid colors', () => {
                expect(getFeatureColor({ color: 'not-a-color' }, 'color')).toBe(null);
                expect(getFeatureColor({ color: 'red' }, 'color')).toBe(null); // named colors not supported
                expect(getFeatureColor({ color: 123 }, 'color')).toBe(null);
            });

            it('should return null for null/undefined properties', () => {
                expect(getFeatureColor(null, 'color')).toBe(null);
                expect(getFeatureColor(undefined, 'color')).toBe(null);
            });

            it('should return null for empty property name', () => {
                expect(getFeatureColor({ color: '#ff0000' }, '')).toBe(null);
            });

            it('should return null when property does not exist', () => {
                expect(getFeatureColor({ fill: '#ff0000' }, 'color')).toBe(null);
                expect(getFeatureColor({}, 'color')).toBe(null);
            });
        });
    });

    describe('FeatureCollection vs GeometryCollection styling', () => {
        it('should style each FeatureCollection feature independently', () => {
            const features = [
                { properties: { color: '#ff0000' } },
                { properties: { color: '#00ff00' } },
                { properties: { color: '#0000ff' } }
            ];

            const colors = features.map(f => getFeatureColor(f.properties, 'color'));
            expect(colors).toEqual(['#ff0000', '#00ff00', '#0000ff']);
        });

        it('should use same color for all nested geometries in GeometryCollection', () => {
            // In a GeometryCollection, all geometries share one properties object
            const feature = {
                type: 'Feature',
                properties: { color: '#ff0000', name: 'Test' },
                geometry: {
                    type: 'GeometryCollection',
                    geometries: [
                        { type: 'Point', coordinates: [0, 0] },
                        { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
                        { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }
                    ]
                }
            };

            // Color is extracted once from the parent feature's properties
            // and applies to all nested geometries
            const color = getFeatureColor(feature.properties, 'color');
            expect(color).toBe('#ff0000');

            // This single color would be used for:
            // - Polygon fill
            // - Line stroke (or nestedStyle.lineColor override)
            // - Point fill (or nestedStyle.pointColor override)
        });
    });
});
