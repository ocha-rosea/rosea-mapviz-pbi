/**
 * H3 Hexbin Aggregation Utilities
 * 
 * Provides functions for aggregating point data into H3 hexagonal bins
 * using the h3-js library.
 */

import { latLngToCell, cellToBoundary, cellToLatLng } from 'h3-js';

/**
 * Aggregation types supported for hexbin values
 */
export type H3AggregationType = 'sum' | 'count' | 'average' | 'min' | 'max';

/**
 * Scaling methods for value normalization
 */
export type ScalingMethod = 'linear' | 'logarithmic' | 'squareRoot' | 'quantile';

/**
 * Color ramp types for hexbin visualization
 */
export type H3ColorRamp = 'viridis' | 'plasma' | 'inferno' | 'magma' | 'warm' | 'cool' | 
                          'blues' | 'greens' | 'reds' | 'oranges' | 'custom';

/**
 * Options for hexbin color calculation
 */
export interface H3ColorOptions {
    colorRamp: H3ColorRamp;
    customColor?: string;
    minOpacity: number; // 0-100
    maxOpacity: number; // 0-100
    scalingMethod?: ScalingMethod;
    /** All values for quantile calculation (optional) */
    allValues?: number[];
}

/**
 * A single hexbin with its H3 index, boundary, center, and aggregated value
 */
export interface H3Hexbin {
    /** H3 cell index */
    h3Index: string;
    /** Boundary coordinates as [lat, lng] pairs */
    boundary: [number, number][];
    /** Center point as [lat, lng] */
    center: [number, number];
    /** Aggregated value for this hexbin */
    value: number;
    /** Number of points in this hexbin */
    count: number;
    /** All original point indices that fall within this hexbin */
    pointIndices: number[];
}

/**
 * Options for H3 hexbin aggregation
 */
export interface H3AggregationOptions {
    /** H3 resolution (0-15, lower = larger hexbins) */
    resolution: number;
    /** Aggregation method */
    aggregationType: H3AggregationType;
}

/**
 * Apply scaling transformation to normalize a value
 * This spreads out values more evenly, especially helpful for data with outliers
 */
export function applyScaling(
    value: number,
    minValue: number,
    maxValue: number,
    method: ScalingMethod,
    allValues?: number[]
): number {
    if (maxValue <= minValue) return 0.5;
    
    switch (method) {
        case 'logarithmic': {
            // Add 1 to handle zeros, use natural log
            const logMin = Math.log1p(minValue);
            const logMax = Math.log1p(maxValue);
            const logVal = Math.log1p(value);
            return logMax > logMin ? (logVal - logMin) / (logMax - logMin) : 0.5;
        }
        
        case 'squareRoot': {
            // Square root scaling - less aggressive than log
            const sqrtMin = Math.sqrt(Math.max(0, minValue));
            const sqrtMax = Math.sqrt(Math.max(0, maxValue));
            const sqrtVal = Math.sqrt(Math.max(0, value));
            return sqrtMax > sqrtMin ? (sqrtVal - sqrtMin) / (sqrtMax - sqrtMin) : 0.5;
        }
        
        case 'quantile': {
            // Quantile-based scaling - equal number of items in each color band
            if (!allValues || allValues.length === 0) {
                // Fall back to linear if no values provided
                return (value - minValue) / (maxValue - minValue);
            }
            // Sort values and find percentile rank
            const sorted = [...allValues].sort((a, b) => a - b);
            const rank = sorted.filter(v => v <= value).length;
            return rank / sorted.length;
        }
        
        case 'linear':
        default:
            return (value - minValue) / (maxValue - minValue);
    }
}

/**
 * Aggregates point data into H3 hexbins
 * 
 * @param longitudes - Array of longitude values
 * @param latitudes - Array of latitude values
 * @param values - Array of values to aggregate (optional, defaults to 1 for count)
 * @param options - Aggregation options
 * @returns Array of H3Hexbin objects with aggregated data
 */
export function aggregateToH3Hexbins(
    longitudes: number[],
    latitudes: number[],
    values: number[] | undefined,
    options: H3AggregationOptions
): H3Hexbin[] {
    const { resolution, aggregationType } = options;
    
    // Map to collect points by H3 index
    const hexbinMap = new Map<string, {
        values: number[];
        pointIndices: number[];
    }>();

    // Assign each point to an H3 cell
    for (let i = 0; i < longitudes.length; i++) {
        const lat = latitudes[i];
        const lng = longitudes[i];
        
        // Skip invalid coordinates
        if (lat === undefined || lng === undefined || 
            isNaN(lat) || isNaN(lng) ||
            lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            continue;
        }

        try {
            const h3Index = latLngToCell(lat, lng, resolution);
            
            if (!hexbinMap.has(h3Index)) {
                hexbinMap.set(h3Index, { values: [], pointIndices: [] });
            }
            
            const cell = hexbinMap.get(h3Index)!;
            cell.values.push(values?.[i] ?? 1);
            cell.pointIndices.push(i);
        } catch (e) {
            // Skip points that fail H3 conversion
            console.warn(`H3 conversion failed for point ${i}: (${lat}, ${lng})`);
        }
    }

    // Convert map to array of hexbins with aggregated values
    const hexbins: H3Hexbin[] = [];
    
    hexbinMap.forEach((data, h3Index) => {
        const aggregatedValue = aggregateValues(data.values, aggregationType);
        
        // Get boundary and center for rendering
        const boundary = cellToBoundary(h3Index) as [number, number][];
        const center = cellToLatLng(h3Index) as [number, number];
        
        hexbins.push({
            h3Index,
            boundary,
            center,
            value: aggregatedValue,
            count: data.values.length,
            pointIndices: data.pointIndices
        });
    });

    return hexbins;
}

/**
 * Aggregate an array of values using the specified method
 */
function aggregateValues(values: number[], type: H3AggregationType): number {
    if (values.length === 0) return 0;
    
    switch (type) {
        case 'count':
            return values.length;
        case 'sum':
            return values.reduce((a, b) => a + b, 0);
        case 'average':
            return values.reduce((a, b) => a + b, 0) / values.length;
        case 'min':
            return Math.min(...values);
        case 'max':
            return Math.max(...values);
        default:
            return values.reduce((a, b) => a + b, 0);
    }
}

/**
 * Color ramp definitions with RGB values at different stops
 * Each ramp has colors from low (index 0) to high (index 4)
 */
const COLOR_RAMPS: Record<Exclude<H3ColorRamp, 'custom'>, [number, number, number][]> = {
    viridis: [
        [68, 1, 84],      // Dark purple
        [59, 82, 139],    // Blue
        [33, 145, 140],   // Teal
        [94, 201, 98],    // Green
        [253, 231, 37]    // Yellow
    ],
    plasma: [
        [13, 8, 135],     // Dark blue
        [126, 3, 168],    // Purple
        [204, 71, 120],   // Pink
        [248, 149, 64],   // Orange
        [240, 249, 33]    // Yellow
    ],
    inferno: [
        [0, 0, 4],        // Black
        [87, 16, 110],    // Dark purple
        [188, 55, 84],    // Red
        [249, 142, 9],    // Orange
        [252, 255, 164]   // Light yellow
    ],
    magma: [
        [0, 0, 4],        // Black
        [81, 18, 124],    // Purple
        [183, 54, 121],   // Magenta
        [252, 135, 97],   // Peach
        [252, 253, 191]   // Light cream
    ],
    warm: [
        [110, 64, 170],   // Purple
        [191, 60, 175],   // Pink
        [254, 75, 131],   // Red-pink
        [255, 120, 71],   // Orange
        [226, 183, 47]    // Yellow
    ],
    cool: [
        [110, 64, 170],   // Purple
        [75, 107, 169],   // Blue
        [69, 165, 181],   // Teal
        [97, 199, 150],   // Green
        [226, 183, 47]    // Yellow
    ],
    blues: [
        [247, 251, 255],  // Very light blue
        [198, 219, 239],  // Light blue
        [107, 174, 214],  // Medium blue
        [33, 113, 181],   // Blue
        [8, 48, 107]      // Dark blue
    ],
    greens: [
        [247, 252, 245],  // Very light green
        [199, 233, 192],  // Light green
        [116, 196, 118],  // Medium green
        [35, 139, 69],    // Green
        [0, 68, 27]       // Dark green
    ],
    reds: [
        [255, 245, 240],  // Very light red
        [252, 187, 161],  // Light red
        [251, 106, 74],   // Medium red
        [203, 24, 29],    // Red
        [103, 0, 13]      // Dark red
    ],
    oranges: [
        [255, 245, 235],  // Very light orange
        [253, 208, 162],  // Light orange
        [253, 141, 60],   // Medium orange
        [217, 72, 1],     // Orange
        [127, 39, 4]      // Dark orange
    ]
};

/**
 * Interpolate between colors in a color ramp
 */
function interpolateColor(ramp: [number, number, number][], t: number): [number, number, number] {
    // Clamp t to 0-1
    t = Math.max(0, Math.min(1, t));
    
    // Find the two colors to interpolate between
    const numStops = ramp.length;
    const scaledT = t * (numStops - 1);
    const lowerIndex = Math.floor(scaledT);
    const upperIndex = Math.min(lowerIndex + 1, numStops - 1);
    const localT = scaledT - lowerIndex;
    
    const lowerColor = ramp[lowerIndex];
    const upperColor = ramp[upperIndex];
    
    return [
        Math.round(lowerColor[0] + (upperColor[0] - lowerColor[0]) * localT),
        Math.round(lowerColor[1] + (upperColor[1] - lowerColor[1]) * localT),
        Math.round(lowerColor[2] + (upperColor[2] - lowerColor[2]) * localT)
    ];
}

/**
 * Get color based on value using a color ramp with configurable opacity and scaling
 * 
 * @param value - The value to map to a color
 * @param minValue - Minimum value in the dataset
 * @param maxValue - Maximum value in the dataset
 * @param options - Color options including ramp type, custom color, opacity range, and scaling method
 * @returns RGBA color string
 */
export function getHexbinColor(
    value: number,
    minValue: number,
    maxValue: number,
    options: H3ColorOptions
): string {
    const { colorRamp, customColor, minOpacity, maxOpacity, scalingMethod = 'linear', allValues } = options;
    
    // Apply scaling transformation for better distribution
    const normalized = applyScaling(value, minValue, maxValue, scalingMethod, allValues);
    
    // Calculate opacity (convert from 0-100 to 0-1)
    const opacity = (minOpacity / 100) + normalized * ((maxOpacity - minOpacity) / 100);
    
    let r: number, g: number, b: number;
    
    if (colorRamp === 'custom' && customColor) {
        // Use custom color with opacity variation
        const hex = customColor.replace('#', '');
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
    } else {
        // Use color ramp
        const rampColors = COLOR_RAMPS[colorRamp as Exclude<H3ColorRamp, 'custom'>] || COLOR_RAMPS.viridis;
        [r, g, b] = interpolateColor(rampColors, normalized);
    }
    
    return `rgba(${r}, ${g}, ${b}, ${opacity.toFixed(2)})`;
}

/**
 * Get color for a specific value without opacity (solid color from ramp)
 * Useful for stroke colors or when full opacity is needed
 */
export function getHexbinSolidColor(
    value: number,
    minValue: number,
    maxValue: number,
    colorRamp: H3ColorRamp,
    customColor?: string
): string {
    // Normalize value to 0-1 range
    const range = maxValue - minValue;
    const normalized = range > 0 ? (value - minValue) / range : 0.5;
    
    let r: number, g: number, b: number;
    
    if (colorRamp === 'custom' && customColor) {
        const hex = customColor.replace('#', '');
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
    } else {
        const rampColors = COLOR_RAMPS[colorRamp as Exclude<H3ColorRamp, 'custom'>] || COLOR_RAMPS.viridis;
        [r, g, b] = interpolateColor(rampColors, normalized);
    }
    
    return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Convert H3 boundary from [lat, lng] to [lng, lat] for GeoJSON/mapping
 * 
 * @param boundary - Boundary coordinates as [lat, lng] pairs
 * @returns Boundary coordinates as [lng, lat] pairs
 */
export function boundaryToLngLat(boundary: [number, number][]): [number, number][] {
    return boundary.map(([lat, lng]) => [lng, lat]);
}
