"use strict";

/**
 * Type guards for runtime validation of external data structures.
 * Used to validate data from GeoBoundaries API, TopoJSON/GeoJSON files,
 * and other external sources before processing.
 * 
 * @example
 * ```typescript
 * import { isGeoJSON, isTopoJSON, isFeatureCollection } from './types/guards';
 * 
 * if (isGeoJSON(data)) {
 *   // data is typed as GeoJSON
 * }
 * ```
 */

// =============================================================================
// GeoJSON Type Guards
// =============================================================================

/**
 * Valid GeoJSON geometry types as defined by the GeoJSON specification.
 */
export const GeoJSONGeometryTypes = [
    "Point",
    "MultiPoint",
    "LineString",
    "MultiLineString",
    "Polygon",
    "MultiPolygon",
    "GeometryCollection"
] as const;

export type GeoJSONGeometryType = typeof GeoJSONGeometryTypes[number];

/**
 * Checks if the given value is a valid GeoJSON geometry type string.
 * @param value - Value to check
 * @returns true if value is a valid geometry type
 */
export function isGeoJSONGeometryType(value: unknown): value is GeoJSONGeometryType {
    return typeof value === "string" && GeoJSONGeometryTypes.includes(value as GeoJSONGeometryType);
}

/**
 * Checks if the given object is a valid GeoJSON Geometry object.
 * @param obj - Object to validate
 * @returns true if obj is a valid GeoJSON Geometry
 */
export function isGeoJSONGeometry(obj: unknown): obj is GeoJSON.Geometry {
    if (!isObject(obj)) return false;
    if (!isGeoJSONGeometryType(obj.type)) return false;
    
    // GeometryCollection has geometries array instead of coordinates
    if (obj.type === "GeometryCollection") {
        return Array.isArray((obj as any).geometries);
    }
    
    return Array.isArray((obj as any).coordinates);
}

/**
 * Checks if the given object is a valid GeoJSON Feature.
 * @param obj - Object to validate
 * @returns true if obj is a valid GeoJSON Feature
 */
export function isGeoJSONFeature(obj: unknown): obj is GeoJSON.Feature {
    if (!isObject(obj)) return false;
    if (obj.type !== "Feature") return false;
    
    // geometry can be null for features without geometry
    if (obj.geometry !== null && !isGeoJSONGeometry(obj.geometry)) return false;
    
    // properties must be an object or null
    if (obj.properties !== null && !isObject(obj.properties)) return false;
    
    return true;
}

/**
 * Checks if the given object is a valid GeoJSON FeatureCollection.
 * @param obj - Object to validate
 * @returns true if obj is a valid GeoJSON FeatureCollection
 */
export function isFeatureCollection(obj: unknown): obj is GeoJSON.FeatureCollection {
    if (!isObject(obj)) return false;
    if (obj.type !== "FeatureCollection") return false;
    if (!Array.isArray(obj.features)) return false;
    
    // Optionally validate each feature (can be expensive for large datasets)
    // For performance, we only check the first few features
    const samplesToCheck = Math.min(obj.features.length, 5);
    for (let i = 0; i < samplesToCheck; i++) {
        if (!isGeoJSONFeature(obj.features[i])) return false;
    }
    
    return true;
}

/**
 * Checks if the given object is any valid GeoJSON type.
 * @param obj - Object to validate
 * @returns true if obj is valid GeoJSON
 */
export function isGeoJSON(obj: unknown): obj is GeoJSON.GeoJSON {
    if (!isObject(obj)) return false;
    
    const type = obj.type;
    
    if (type === "FeatureCollection") return isFeatureCollection(obj);
    if (type === "Feature") return isGeoJSONFeature(obj);
    if (isGeoJSONGeometryType(type)) return isGeoJSONGeometry(obj);
    
    return false;
}

// =============================================================================
// TopoJSON Type Guards
// =============================================================================

/**
 * Minimal TopoJSON Topology interface for type checking.
 */
export interface TopoJSONTopology {
    type: "Topology";
    objects: Record<string, TopoJSONObject>;
    arcs: number[][][];
    transform?: {
        scale: [number, number];
        translate: [number, number];
    };
}

/**
 * TopoJSON object types.
 */
export interface TopoJSONObject {
    type: "Point" | "MultiPoint" | "LineString" | "MultiLineString" | "Polygon" | "MultiPolygon" | "GeometryCollection";
    geometries?: TopoJSONObject[];
    arcs?: number[] | number[][] | number[][][];
    coordinates?: number[] | number[][];
    properties?: Record<string, unknown>;
}

/**
 * Checks if the given object is a valid TopoJSON Topology.
 * @param obj - Object to validate
 * @returns true if obj is a valid TopoJSON Topology
 */
export function isTopoJSON(obj: unknown): obj is TopoJSONTopology {
    if (!isObject(obj)) return false;
    if (obj.type !== "Topology") return false;
    if (!isObject(obj.objects)) return false;
    if (!Array.isArray(obj.arcs)) return false;
    
    // Validate that objects contains at least one object with geometries
    const objectKeys = Object.keys(obj.objects);
    if (objectKeys.length === 0) return false;
    
    return true;
}

/**
 * Checks if a TopoJSON object contains polygon geometries.
 * @param obj - TopoJSON object to check
 * @returns true if the object contains polygons
 */
export function hasPolygonGeometries(obj: TopoJSONObject): boolean {
    if (obj.type === "Polygon" || obj.type === "MultiPolygon") return true;
    if (obj.type === "GeometryCollection" && Array.isArray(obj.geometries)) {
        return obj.geometries.some(g => hasPolygonGeometries(g));
    }
    return false;
}

// =============================================================================
// GeoBoundaries API Response Guards
// =============================================================================

/**
 * GeoBoundaries metadata response structure.
 */
export interface GeoBoundariesMetadataResponse {
    boundaryID: string;
    boundaryName: string;
    boundaryISO: string;
    gjDownloadURL?: string;
    tjDownloadURL?: string;
    [key: string]: unknown;
}

/**
 * Checks if the object is a valid GeoBoundaries metadata response.
 * @param obj - Object to validate
 * @returns true if obj is a valid GeoBoundaries metadata response
 */
export function isGeoBoundariesMetadata(obj: unknown): obj is GeoBoundariesMetadataResponse {
    if (!isObject(obj)) return false;
    
    // Required fields
    if (typeof obj.boundaryID !== "string") return false;
    if (typeof obj.boundaryName !== "string") return false;
    if (typeof obj.boundaryISO !== "string") return false;
    
    return true;
}

/**
 * GeoBoundaries catalog entry structure.
 */
export interface GeoBoundariesCatalogEntry {
    iso3: string;
    release: string;
    level: string;
    url: string;
}

/**
 * Checks if the object is a valid GeoBoundaries catalog entry.
 * @param obj - Object to validate
 * @returns true if obj is a valid catalog entry
 */
export function isGeoBoundariesCatalogEntry(obj: unknown): obj is GeoBoundariesCatalogEntry {
    if (!isObject(obj)) return false;
    
    if (typeof obj.iso3 !== "string") return false;
    if (typeof obj.release !== "string") return false;
    if (typeof obj.level !== "string") return false;
    if (typeof obj.url !== "string") return false;
    
    return true;
}

// =============================================================================
// Coordinate and Number Array Guards
// =============================================================================

/**
 * Checks if the value is a valid longitude (-180 to 180).
 * @param value - Value to check
 * @returns true if value is a valid longitude
 */
export function isValidLongitude(value: unknown): value is number {
    return typeof value === "number" && !isNaN(value) && value >= -180 && value <= 180;
}

/**
 * Checks if the value is a valid latitude (-90 to 90).
 * @param value - Value to check
 * @returns true if value is a valid latitude
 */
export function isValidLatitude(value: unknown): value is number {
    return typeof value === "number" && !isNaN(value) && value >= -90 && value <= 90;
}

/**
 * Checks if the array contains valid coordinate pairs [longitude, latitude].
 * @param arr - Array to validate
 * @returns true if arr contains valid coordinate pairs
 */
export function isCoordinatePair(arr: unknown): arr is [number, number] {
    if (!Array.isArray(arr) || arr.length < 2) return false;
    return isValidLongitude(arr[0]) && isValidLatitude(arr[1]);
}

/**
 * Checks if the array is a valid coordinate ring (for polygons).
 * @param arr - Array to validate
 * @returns true if arr is a valid coordinate ring
 */
export function isCoordinateRing(arr: unknown): arr is [number, number][] {
    if (!Array.isArray(arr) || arr.length < 4) return false;
    return arr.every(isCoordinatePair);
}

// =============================================================================
// Generic Utility Guards
// =============================================================================

/**
 * Checks if the value is a non-null object (not an array).
 * @param value - Value to check
 * @returns true if value is a plain object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Checks if the value is a non-empty string.
 * @param value - Value to check
 * @returns true if value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

/**
 * Checks if the value is a finite number (not NaN or Infinity).
 * @param value - Value to check
 * @returns true if value is a finite number
 */
export function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

/**
 * Checks if the value is a positive finite number.
 * @param value - Value to check
 * @returns true if value is a positive finite number
 */
export function isPositiveNumber(value: unknown): value is number {
    return isFiniteNumber(value) && value > 0;
}

/**
 * Checks if the value is a valid hex color string.
 * @param value - Value to check
 * @returns true if value is a valid hex color
 */
export function isHexColor(value: unknown): value is string {
    if (typeof value !== "string") return false;
    return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(value);
}

/**
 * Checks if the value is a valid URL string.
 * @param value - Value to check
 * @returns true if value is a valid URL
 */
export function isValidUrl(value: unknown): value is string {
    if (typeof value !== "string") return false;
    try {
        new URL(value);
        return true;
    } catch {
        return false;
    }
}

// =============================================================================
// Data Validation Helpers
// =============================================================================

/**
 * Validates and extracts features from GeoJSON or TopoJSON data.
 * Returns null if data is invalid.
 * @param data - Data to validate
 * @returns Validated FeatureCollection or null
 */
export function validateAndExtractFeatures(data: unknown): GeoJSON.FeatureCollection | null {
    if (isFeatureCollection(data)) {
        return data;
    }
    
    // TopoJSON needs to be converted - return null here and let caller handle conversion
    if (isTopoJSON(data)) {
        return null; // Caller should use topojson-client to convert
    }
    
    return null;
}

/**
 * Safely extracts a property value from a GeoJSON feature.
 * @param feature - GeoJSON feature
 * @param key - Property key to extract
 * @returns Property value as string or undefined
 */
export function safeGetFeatureProperty(feature: unknown, key: string): string | undefined {
    if (!isGeoJSONFeature(feature)) return undefined;
    if (feature.properties === null) return undefined;
    
    const value = feature.properties[key];
    if (value === null || value === undefined) return undefined;
    
    return String(value).trim();
}
