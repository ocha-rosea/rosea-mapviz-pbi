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
 * Get color based on value using a color scale
 * 
 * @param value - The value to map to a color
 * @param minValue - Minimum value in the dataset
 * @param maxValue - Maximum value in the dataset
 * @param baseColor - Base color for the scale (hex format)
 * @returns RGBA color string
 */
export function getHexbinColor(
    value: number,
    minValue: number,
    maxValue: number,
    baseColor: string
): string {
    // Normalize value to 0-1 range
    const range = maxValue - minValue;
    const normalized = range > 0 ? (value - minValue) / range : 0.5;
    
    // Parse base color (expect hex format)
    const hex = baseColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // Adjust opacity based on value (0.3 to 0.9)
    const opacity = 0.3 + normalized * 0.6;
    
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
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
