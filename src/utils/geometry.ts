// Helper function to validate GeoJSON data
export function isValidGeoJson(data: any): boolean {
    if (!data || typeof data !== "object" || !data.type) {
        return false;
    }

    const validGeoJsonTypes = [
        "Feature",
        "FeatureCollection",
        "Point",
        "LineString",
        "Polygon",
        "MultiPoint",
        "MultiLineString",
        "MultiPolygon",
    ];

    if (!validGeoJsonTypes.includes(data.type)) {
        return false;
    }

    // Additional checks for "Feature" and "FeatureCollection"
    if (
        data.type === "Feature" &&
        (!data.geometry || typeof data.geometry !== "object")
    ) {
        return false;
    }

    if (data.type === "FeatureCollection" && !Array.isArray(data.features)) {
        return false;
    }

    return true;
}

// Helper function to validate TopoJSON data
export function isValidTopoJson(data: any): boolean {
    if (!data || typeof data !== "object") {
        return false;
    }

    // TopoJSON must have a "type" property, which should be "Topology"
    if (data.type !== "Topology") {
        return false;
    }

    // TopoJSON must have an "objects" property, which should be an object
    if (!data.objects || typeof data.objects !== "object") {
        return false;
    }

    // Validate that "arcs" (if present) is an array
    if (data.arcs && !Array.isArray(data.arcs)) {
        return false;
    }

    // Validate that "transform" (if present) has scale and translate properties
    if (data.transform) {
        const { scale, translate } = data.transform;
        if (
            !Array.isArray(scale) ||
            scale.length !== 2 ||
            !Array.isArray(translate) ||
            translate.length !== 2
        ) {
            return false;
        }
    }

    // Validate each object in "objects"
    for (const key in data.objects) {
        const object = data.objects[key];
        if (
            !object ||
            typeof object !== "object" ||
            !["Point", "LineString", "Polygon", "MultiPoint", "MultiLineString", "MultiPolygon", "GeometryCollection"].includes(object.type)
        ) {
            return false;
        }

        // Additional validation for GeometryCollection
        if (object.type === "GeometryCollection" && !Array.isArray(object.geometries)) {
            return false;
        }
    }

    return true;
}

/**
 * Calculates the signed area of a ring (array of [lon, lat] coordinates).
 * Positive = counter-clockwise (exterior ring in GeoJSON)
 * Negative = clockwise (hole in GeoJSON)
 * Uses the shoelace formula.
 */
export function ringSignedArea(ring: number[][]): number {
    let sum = 0;
    const n = ring.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        sum += (ring[j][0] - ring[i][0]) * (ring[i][1] + ring[j][1]);
    }
    return sum / 2;
}

/**
 * Checks if a ring is wound clockwise.
 */
export function isClockwise(ring: number[][]): boolean {
    return ringSignedArea(ring) < 0;
}

/**
 * Reverses a ring's winding order.
 */
export function reverseRing(ring: number[][]): number[][] {
    return ring.slice().reverse();
}

/**
 * Rewinds a polygon's rings to comply with RFC 7946 GeoJSON spec:
 * - Exterior ring: counter-clockwise (positive signed area)
 * - Interior rings (holes): clockwise (negative signed area)
 * 
 * This fixes polygons that "fill the world" because their exterior ring
 * is wound in the wrong direction.
 */
export function rewindPolygon(coordinates: number[][][]): number[][][] {
    if (!coordinates || coordinates.length === 0) return coordinates;
    
    const result: number[][][] = [];
    
    for (let i = 0; i < coordinates.length; i++) {
        const ring = coordinates[i];
        if (!ring || ring.length < 3) {
            result.push(ring);
            continue;
        }
        
        const signedArea = ringSignedArea(ring);
        
        if (i === 0) {
            // Exterior ring: should be counter-clockwise (positive area)
            result.push(signedArea < 0 ? reverseRing(ring) : ring);
        } else {
            // Interior ring (hole): should be clockwise (negative area)
            result.push(signedArea > 0 ? reverseRing(ring) : ring);
        }
    }
    
    return result;
}

/**
 * Rewinds a GeoJSON geometry's polygon coordinates to comply with RFC 7946.
 * Handles Polygon, MultiPolygon, and GeometryCollection types.
 * Modifies the geometry in-place and returns it.
 */
export function rewindGeometry(geometry: any): any {
    if (!geometry || !geometry.type) return geometry;
    
    switch (geometry.type) {
        case 'Polygon':
            geometry.coordinates = rewindPolygon(geometry.coordinates);
            break;
        case 'MultiPolygon':
            geometry.coordinates = geometry.coordinates.map((poly: number[][][]) => rewindPolygon(poly));
            break;
        case 'GeometryCollection':
            if (Array.isArray(geometry.geometries)) {
                geometry.geometries.forEach((g: any) => rewindGeometry(g));
            }
            break;
        // Point, LineString, MultiPoint, MultiLineString don't need rewinding
    }
    
    return geometry;
}

/**
 * Rewinds all features in a FeatureCollection to have correct polygon winding.
 * Modifies the collection in-place and returns it.
 */
export function rewindFeatureCollection(fc: any): any {
    if (!fc || fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
        return fc;
    }
    
    for (const feature of fc.features) {
        if (feature && feature.geometry) {
            rewindGeometry(feature.geometry);
        }
    }
    
    return fc;
}