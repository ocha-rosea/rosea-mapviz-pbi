import { FeatureCollection } from "geojson";
import * as ss from "simple-statistics";
import * as chroma from "chroma-js";
import * as topojson from 'topojson-client';
import { ColorRampManager } from "./ColorRampManager";
import { ClassificationMethods } from "../constants/strings";
import { RoleNames } from "../constants/roles";
import { ChoroplethOptions } from "../types/index";
import { rewindFeatureCollection } from "../utils/geometry";
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;

/**
 * Service class responsible for processing and transforming geographic and statistical data
 * for visualization on maps. Handles data classification, tooltip generation, and geometry processing.
 */

export class ChoroplethDataService {

    private colorRampService: ColorRampManager;
    private host: IVisualHost;

    constructor(colorRampManager: ColorRampManager, host: IVisualHost) {
        this.colorRampService = colorRampManager;
        this.host = host;
    }

    /**
     * Processes geographic data by converting TopoJSON to GeoJSON if needed, simplifying geometries,
     * and filtering features based on valid PCodes.
     * @param data Raw geographic data in either TopoJSON or GeoJSON format
     * @param pcodeKey The property key used to identify PCodes in the features
     * @param validPCodes Array of valid PCodes to filter features by
     * @returns Processed GeoJSON FeatureCollection with simplified and filtered features
     */
    public processGeoData(
        data: any,
        pcodeKey: string,
        validPCodes: string[],
        topojsonObjectName?: string,
        preferFirstLayer: boolean = true,
        honorPreferredName: boolean = false
    ): {
        originalGeojson: FeatureCollection;
        filteredByBest: FeatureCollection;
        filteredByOriginal: FeatureCollection;
        usedPcodeKey: string;
        bestCount: number;
        originalCount: number;
    } {

        // Handle topojson if needed (pass flags through to selector)
        let geojson: FeatureCollection = this.isTopoJSON(data)
            ? this.convertTopoJSONToGeoJSON(data, topojsonObjectName, preferFirstLayer, honorPreferredName)
            : data as FeatureCollection;

        // Stricter GeoJSON schema validation
        if (!geojson || geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
            throw new Error("Invalid GeoJSON: expected a FeatureCollection with a features array.");
        }

        // Normalize validPCodes to strings trimmed for robust matching
        const normalizedValid = new Set(validPCodes.map(v => String(v).trim()));

        // Candidate keys to test (deduplicated while preserving order)
        const candidateKeys = Array.from(new Set<string>([
            pcodeKey,
            'hdx_pcode',
            'hdx_name',
            'shapeISO',
            'shapeID',
            'shapeGroup',
            'shapeName'
        ]));

        const matchCounts: number[] = candidateKeys.map(key => 0);

        // Compute match counts using normalized string comparison
        for (let i = 0; i < candidateKeys.length; i++) {
            const key = candidateKeys[i];
            let cnt = 0;
            for (const feature of geojson.features) {
                try {
                    const raw = feature.properties ? feature.properties[key] : undefined;
                    if (raw === undefined || raw === null) continue;
                    const sval = String(raw).trim();
                    if (normalizedValid.has(sval)) cnt++;
                } catch (e) {
                    // ignore per-feature errors
                }
            }
            matchCounts[i] = cnt;
        }

        const bestIndex = matchCounts.reduce((best, cnt, idx) => cnt > matchCounts[best] ? idx : best, 0);
        const bestKey = candidateKeys[bestIndex] || pcodeKey;
        const bestCount = matchCounts[bestIndex] || 0;
        const originalIndex = candidateKeys.indexOf(pcodeKey);
        const originalCount = originalIndex >= 0 ? matchCounts[originalIndex] || 0 : 0;


        // Build filtered FeatureCollections for both the best key and the original key
        const filteredByKey = (key: string) => {
            const features = geojson.features.filter(feature => {
                try {
                    const raw = feature.properties ? feature.properties[key] : undefined;
                    if (raw === undefined || raw === null) return false;
                    const sval = String(raw).trim();
                    return normalizedValid.has(sval);
                } catch (e) { return false; }
            });
            return { ...geojson, features } as FeatureCollection;
        };

        const filteredByBest = filteredByKey(bestKey);
        const filteredByOriginal = filteredByKey(pcodeKey);


        return {
            originalGeojson: geojson,
            filteredByBest,
            filteredByOriginal,
            usedPcodeKey: bestKey,
            bestCount,
            originalCount
        };
    }

    /**
     * Extracts tooltip data from PowerBI categorical data format
     * @param categorical PowerBI categorical data containing values and categories
     * @returns Array of tooltip items arrays, where each inner array contains tooltip items for a feature
     */
    public extractTooltips(categorical: any): VisualTooltipDataItem[][] {

        // Get all fields that have the Tooltips role
        const tooltipFields = categorical.values
            .filter(v => v.source.roles[RoleNames.Tooltips])
            // Sort by the original order in Power BI
            .sort((a, b) => {
                const aIndex = a.source.index || 0;
                const bIndex = b.source.index || 0;
                return aIndex - bIndex;
            });

        const tooltips: VisualTooltipDataItem[][] = [];

        for (let i = 0; i < categorical.categories[0].values.length; i++) {
            const tooltipItems: VisualTooltipDataItem[] = tooltipFields.map(field => {
                const value = field.values[i];
                const format = field.source.format;

                // Create tooltip item with original formatting
                const tooltipItem: VisualTooltipDataItem = {
                    displayName: field.source.displayName,
                    value: this.formatValue(value, format)
                };

                // Add color if specified in Power BI
                if (field.source.color) {
                    tooltipItem.color = field.source.color;
                }

                return tooltipItem;
            });
            tooltips.push(tooltipItems);
        }

        return tooltips;
    }

    /**
     * Formats a value according to Power BI formatting rules
     * @param value The value to format
     * @param format The Power BI format string
     * @returns Formatted string value
     */
    private formatValue(value: any, format?: string): string {
        if (value === null || value === undefined) {
            return '';
        }

        // If no format specified, use default conversion
        if (!format) {
            return this.convertToString(value);
        }

        // Handle Date objects with format
        if (value instanceof Date) {
            try {
                // Use Power BI's date format if available
                return value.toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } catch {
                return value.toLocaleDateString();
            }
        }

        // Handle numbers with format
        if (typeof value === 'number') {
            try {
                // Use Power BI's number format if available
                return value.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                    useGrouping: true
                });
            } catch {
                return this.convertToString(value);
            }
        }

        // Handle arrays
        if (Array.isArray(value)) {
            return value.map(v => this.formatValue(v, format)).join(', ');
        }

        // Handle objects
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }

        // Default case: convert to string
        return String(value);
    }

    /**
     * Converts any value to a string representation (fallback method)
     * @param value The value to convert
     * @returns String representation of the value
     */
    private convertToString(value: any): string {
        if (value === null || value === undefined) {
            return '';
        }

        // Handle Date objects
        if (value instanceof Date) {
            return value.toLocaleDateString();
        }

        // Handle numbers
        if (typeof value === 'number') {
            // Check if it's an integer
            if (Number.isInteger(value)) {
                return value.toString();
            }
            // For floating point numbers, limit decimal places
            return value.toFixed(2);
        }

        // Handle arrays
        if (Array.isArray(value)) {
            return value.map(v => this.convertToString(v)).join(', ');
        }

        // Handle objects
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }

        // Default case: convert to string
        return String(value);
    }

    /**
     * Calculates class breaks for choropleth map data classification
     * @param values Array of values to be classified (can be numeric or string)
     * @param options Classification options object containing:
     *   - classifyData: boolean - Whether to classify the data or use unique values
     *   - classes: number - Number of desired classes/breaks (max 7)
     *   - classificationMethod: string - Classification method to use:
     *     - "j": Jenks natural breaks
     *     - "k": K-means clustering
     *     - "q": Quantile
     *     - "e": Equal interval
     *     - "l": Linear
     *     - "u": Unique values (categorical)
     * @returns Array of break points or unique values that define the class intervals
     */
    public getClassBreaks(values: any[], options: any): any[] {

    if (options.classificationMethod === ClassificationMethods.Unique) {
            // Unique value (categorical) classification
            const unique = Array.from(new Set(values));
            
            // Sort: numbers ascending, strings alphabetically
            unique.sort((a, b) => {
                const aNum = typeof a === 'number' || !isNaN(Number(a));
                const bNum = typeof b === 'number' || !isNaN(Number(b));
                
                if (aNum && bNum) {
                    // Both numeric: sort ascending
                    return Number(a) - Number(b);
                } else if (!aNum && !bNum) {
                    // Both strings: sort alphabetically
                    return String(a).localeCompare(String(b));
                } else {
                    // Mixed: numbers first
                    return aNum ? -1 : 1;
                }
            });
            
            const n = Math.min(options.classes || 7, 7);
            return unique.slice(0, n);
        }

        // Numeric classification
        const uniqueValues = new Set(values);
        const numValues = uniqueValues.size;
        const adjustedClasses = Math.min(options.classes, numValues);

        if (numValues <= 2) {
            return Array.from(uniqueValues).sort((a, b) => a - b);
        }

    switch (options.classificationMethod) {
        case ClassificationMethods.Jenks:
                return ss.jenks(values, adjustedClasses);
        case ClassificationMethods.KMeans: {
                const clusters = ss.ckmeans(values, adjustedClasses);
                const maxValues = clusters.map(cluster => Math.max(...cluster));
                return [Math.min(...values), ...maxValues.sort((a, b) => a - b)];
            }
            default:
                return chroma.limits(
                    values,
            options.classificationMethod as "q" | "e" | "l",
                    adjustedClasses
                );
        }
    }

    /**
     * Generates a color scale based on class breaks and choropleth options
     * @param classBreaks Array of break points or unique values
     * @param options Choropleth options object containing:    
     *   - invertColorRamp: boolean - Whether to invert the color ramp order
     *   - classes: number - Number of color classes to generate    
     *   - colorMode: string - Color interpolation mode (e.g. 'lch', 'lab', 'rgb')
     * @returns Array of color strings representing the generated color scale
     */
    public getColorScale(classBreaks: any[], options: ChoroplethOptions): string[] {

        // For unique values, use user-defined category colors if available
        if (options.classificationMethod === ClassificationMethods.Unique) {
            const classesRequested = typeof options.classes === "number" && options.classes > 0 ? options.classes : classBreaks.length;
            const maxClasses = Math.min(Math.max(classesRequested, 0), 7);

            if (maxClasses === 0) {
                return [];
            }

            // Use user-defined category colors if provided
            if (options.categoryColors && Array.isArray(options.categoryColors) && options.categoryColors.length > 0) {
                // Return the user-defined colors, limited to maxClasses
                const colors = options.categoryColors.slice(0, maxClasses);
                // Pad with othersColor if needed (shouldn't normally happen)
                while (colors.length < maxClasses) {
                    colors.push(options.othersColor || "#999999");
                }
                return colors;
            }

            // Fallback to color ramp if no category colors defined
            const baseRamp = this.colorRampService.getColorRamp();
            const ramp = options.invertColorRamp === true ? baseRamp.slice().reverse() : baseRamp.slice();
            const usingCustomRamp = (options.colorRamp || "").toLowerCase() === "custom";

            let colors = ramp.slice(0, maxClasses);

            if (ramp.length !== maxClasses && usingCustomRamp) {
                try {
                    const provided = ramp.length;
                    const title = "Custom color ramp mismatch";
                    const pluralProvided = provided === 1 ? "color" : "colors";
                    const pluralClasses = maxClasses === 1 ? "class" : "classes";
                    const message = provided > maxClasses
                        ? `roseaMapVizWarning: Custom color ramp provides ${provided} ${pluralProvided} but ${maxClasses} ${pluralClasses} are configured. Extra colors will be ignored.`
                        : `roseaMapVizWarning: Custom color ramp provides ${provided} ${pluralProvided} but ${maxClasses} ${pluralClasses} are configured. Missing colors will use #000000.`;
                    this.host.displayWarningIcon(title, message);
                } catch {
                    // ignore host warning errors
                }
            }

            while (colors.length < maxClasses) {
                colors.push("#000000");
            }

            return colors;
        }
        
        // Numeric classification
        const numClasses = options.classes;
        if (options.invertColorRamp === true) {
            this.colorRampService.invertRamp();
        }

        return this.colorRampService.generateColorRamp(
            classBreaks,
            numClasses,
            options.colorMode
        );
    }

    /**
     * Gets the color from the color scale based on the value and class breaks
     * @param value The value to get the color for (can be string or number)
     * @param classBreaks The class breaks or unique values
     * @param colorScale The color scale to use for the color
     * @param classificationMethod Classification method being used
     * @param othersColor Color for values not in the top 7 categories
     * @param categoryValues User-defined category values for mapping (optional)
     * @param categoryColors Fixed colors aligned with categoryValues (optional, for unique classification)
     * @returns The color from the color scale
     */
    public getColorFromClassBreaks(
        value: any,
        classBreaks: any[],
        colorScale: string[],
        classificationMethod: string,
        othersColor?: string,
        categoryValues?: string[],
        categoryColors?: string[]
    ): string {

        const isNoDataValue = (candidate: any): boolean => {
            if (candidate === null || candidate === undefined) return true;
            if (typeof candidate === "number") {
                return !Number.isFinite(candidate);
            }
            if (typeof candidate === "string") {
                return candidate.trim().length === 0;
            }
            return false;
        };

        if (isNoDataValue(value)) {
            return "rgba(0,0,0,0)";
        }

        if (classificationMethod === ClassificationMethods.Unique) {
            // Normalize value to string for comparison
            const valueStr = String(value).trim();
            
            // For unique classification, prefer categoryColors (fixed per slot) over colorScale (may be filtered)
            // categoryColors is always aligned with categoryValues by index
            const effectiveColors = (categoryColors && categoryColors.length >= 7) ? categoryColors : colorScale;
            
            // If user has defined category values, use them for mapping
            if (categoryValues && Array.isArray(categoryValues)) {
                // Find matching category value
                for (let i = 0; i < Math.min(categoryValues.length, 7); i++) {
                    const catValue = categoryValues[i]?.trim();
                    if (catValue && catValue.length > 0 && catValue === valueStr) {
                        return effectiveColors[i] || othersColor || "#999999";
                    }
                }
            }
            
            // Fall back to class breaks matching
            // Try string comparison first
            const stringIndex = classBreaks.findIndex(b => String(b).trim() === valueStr);
            if (stringIndex >= 0 && stringIndex < 7) {
                return effectiveColors[stringIndex] || othersColor || "#999999";
            }
            
            // Try direct comparison for numbers
            const directIndex = classBreaks.indexOf(value);
            if (directIndex >= 0 && directIndex < 7) {
                return effectiveColors[directIndex] || othersColor || "#999999";
            }
            
            return othersColor || "#999999";
        }

        // Numeric classification
        if (typeof value !== "number") return "#009edb";
        if (value < classBreaks[0]) return colorScale[0];
        if (value > classBreaks[classBreaks.length - 1]) {
            return colorScale[colorScale.length - 1];
        }
        for (let i = 0; i < classBreaks.length - 1; i++) {
            if (value >= classBreaks[i] && value <= classBreaks[i + 1]) {
                return colorScale[i];
            }
        }
        return "#009edb"; // Default color
    }


    /**
     * Checks if the provided data is in TopoJSON format
     * @param data Data to check format of
     * @returns boolean indicating if data is TopoJSON
     */
    private isTopoJSON(data: any): boolean {
        return data.type === "Topology" && data.objects && Array.isArray(data.arcs);
    }


    /**
     * Converts TopoJSON data to GeoJSON format
     * @param topology TopoJSON data to convert
     * @returns GeoJSON FeatureCollection
     */
    private convertTopoJSONToGeoJSON(topology: any, preferredObjectName?: string, preferFirstLayer: boolean = true, honorPreferredName: boolean = false): FeatureCollection {

        if (!topology || typeof topology !== "object") {
            throw new Error("Invalid TopoJSON object provided.");
        }

        if (!topology.objects || typeof topology.objects !== "object") {
            throw new Error("Invalid or missing 'objects' property in TopoJSON.");
        }

    const layerNames = Object.keys(topology.objects);

        // Helper to count polygonal geometries within a TopoJSON object
        const countPolygonGeometries = (obj: any): number => {
            if (!obj) return 0;
            const polyTypes = new Set(["Polygon", "MultiPolygon"]);
            if (obj.type === "GeometryCollection" && Array.isArray(obj.geometries)) {
                return obj.geometries.reduce((acc: number, g: any) => acc + (polyTypes.has(g?.type) ? 1 : 0), 0);
            }
            return polyTypes.has(obj.type) ? 1 : 0;
        };

        let selectedLayerName: string | null = null;

        // Selection policy:
        // - Default: prefer the first object in the TopoJSON (simple and predictable).
        // - If honorPreferredName is true and the caller supplied a preferredObjectName that exists,
        //   select that object (used for custom sources where user may specify which layer to use).
        // - Fallback: if only one object exists, use it; otherwise, if no decision yet, pick the first.
        if (honorPreferredName && preferredObjectName && layerNames.includes(preferredObjectName)) {
            selectedLayerName = preferredObjectName;
        } else if (layerNames.length > 0) {
            // Prefer the first layer deterministically
            selectedLayerName = layerNames[0];
        } else {
            // Prefer the object with the highest count of polygonal geometries
            let maxCount = -1;
            for (const name of layerNames) {
                const count = countPolygonGeometries((topology.objects as any)[name]);
                if (count > maxCount) {
                    maxCount = count;
                    selectedLayerName = name;
                }
            }

            // If none appear polygonal, fall back to the first object deterministically
            if (maxCount <= 0 && layerNames.length > 0) {
                selectedLayerName = layerNames[0];
            }
        }


        if (!selectedLayerName) {
            throw new Error("Unable to select a TopoJSON object for conversion.");
        }

        const geo = topojson.feature(topology, (topology.objects as any)[selectedLayerName]) as any;
        
        // Rewind polygon coordinates to comply with RFC 7946 GeoJSON spec.
        // This fixes polygons where the exterior ring is wound clockwise (which causes
        // them to "fill the world" by inverting the inside/outside interpretation).
        // TopoJSON doesn't guarantee winding order, so we normalize it here.
        
        // Ensure a FeatureCollection is returned
        if (geo && geo.type === "FeatureCollection") {
            return rewindFeatureCollection(geo) as FeatureCollection;
        }
        if (geo && geo.type === "Feature") {
            const fc = { type: "FeatureCollection", features: [geo] } as any;
            return rewindFeatureCollection(fc) as FeatureCollection;
        }
        // Fallback: wrap empty collection if unexpected
        return { type: "FeatureCollection", features: [] } as FeatureCollection;
    }

}