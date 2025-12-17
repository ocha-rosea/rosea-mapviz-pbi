import { LegendOrientations, LegendLabelPositions, ClassificationMethods } from "../constants/strings";

export type LegendOrientation = typeof LegendOrientations[keyof typeof LegendOrientations];
export type LegendLabelPosition = typeof LegendLabelPositions[keyof typeof LegendLabelPositions];
export type ClassificationMethod = typeof ClassificationMethods[keyof typeof ClassificationMethods];

// ============================================================================
// High Contrast Mode Types
// ============================================================================

/**
 * High contrast color palette for accessibility support.
 * These colors are provided by Power BI when high contrast mode is enabled.
 */
export interface HighContrastColors {
    /** Foreground color (text, icons, data elements) */
    foreground: string;
    /** Background color */
    background: string;
    /** Color for selected/highlighted elements */
    foregroundSelected: string;
    /** Color for hyperlinks and interactive elements */
    hyperlink: string;
}

// ============================================================================
// Nested Geometry Styling (for GeometryCollections)
// ============================================================================

/**
 * Styling options for nested geometries within GeometryCollections.
 * Used for IPC-style data where polygons represent areas and points show exact locations.
 */
export interface NestedGeometryStyle {
    /** Whether to show point geometries in GeometryCollections */
    showPoints: boolean;
    /** Point radius in pixels */
    pointRadius: number;
    /** Point fill color (use 'inherit' to match polygon fill) */
    pointColor: string;
    /** Point stroke color */
    pointStrokeColor: string;
    /** Point stroke width */
    pointStrokeWidth: number;
    
    /** Whether to show line geometries in GeometryCollections */
    showLines: boolean;
    /** Line stroke color (use 'inherit' to match polygon stroke) */
    lineColor: string;
    /** Line stroke width */
    lineWidth: number;
}

// ============================================================================
// Geometry Simplification Types
// ============================================================================

/**
 * Represents pre-processed geometry data for rendering.
 * Computed once by GeometrySimplificationService and shared across all render engines.
 */
export interface PreparedGeometry {
    /** Simplified GeoJSON (same structure as input, maintains 1-1 feature mapping) */
    geojson: import("geojson").FeatureCollection;
    
    /** Whether simplification was applied */
    wasSimplified: boolean;
    
    /** Simplification level used */
    level: 'none' | 'light' | 'moderate' | 'aggressive';
    
    /** Tolerance value used (in degrees) */
    tolerance: number;
    
    /** Metrics about the original dataset */
    metrics: {
        /** Total number of features */
        featureCount: number;
        /** Total vertex count across all geometries */
        totalVertices: number;
        /** Average vertices per feature */
        avgVerticesPerFeature: number;
        /** Set of geometry types present */
        geometryTypes: Set<string>;
    };
    
    /** Source data type */
    sourceType: 'topojson' | 'geojson';
}

import { FeatureCollection } from "geojson";
import * as d3 from "d3";
import { Collection } from "ol";
import { Control } from "ol/control";
import View from "ol/View";
import { ITooltipServiceWrapper } from "powerbi-visuals-utils-tooltiputils";
import ISelectionManager = powerbi.extensibility.ISelectionManager;

import { Options as OlLayerOptions } from 'ol/layer/Base.js';
import { Feature } from 'ol';
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import ISelectionId = powerbi.visuals.ISelectionId;

// ============================================================================
// Power BI Categorical Data Types
// ============================================================================

/**
 * Represents a Power BI data category with values and source metadata.
 * Used for dimension fields like PCode, Longitude, Latitude.
 */
export interface DataViewCategory {
    /** Array of category values */
    values: (string | number | boolean | null)[];
    /** Source column metadata */
    source: {
        /** Display name in Power BI */
        displayName: string;
        /** Query name for selection IDs */
        queryName: string;
        /** Data role assignments */
        roles?: Record<string, boolean>;
        /** Format string for values */
        format?: string;
    };
}

/**
 * Represents a Power BI data measure with values and aggregation metadata.
 * Used for measure fields like Color, Size.
 */
export interface DataViewMeasure {
    /** Array of measure values */
    values: (number | null)[];
    /** Source column metadata */
    source: {
        /** Display name in Power BI */
        displayName: string;
        /** Query name for selection IDs */
        queryName: string;
        /** Data role assignments */
        roles?: Record<string, boolean>;
        /** Format string for values */
        format?: string;
    };
}

// ============================================================================
// Data Point Types
// ============================================================================

/**
 * Represents a single data point for choropleth visualization.
 */
export interface ChoroplethDataPoint {
    /** P-Code or boundary identifier */
    pcode: string;
    /** Numeric value for color mapping */
    value: number;
    /** Tooltip items for hover display */
    tooltip: VisualTooltipDataItem[];
    /** Power BI selection ID for cross-filtering */
    selectionId: ISelectionId;
}

/**
 * Represents a single data point for circle visualization.
 */
export interface CircleDataPoint {
    /** Longitude coordinate */
    longitude: number;
    /** Latitude coordinate */
    latitude: number;
    /** Tooltip items for hover display */
    tooltip: VisualTooltipDataItem[];
    /** Power BI selection ID for cross-filtering */
    selectionId: ISelectionId;
}

// ============================================================================
// Map State Types
// ============================================================================

// ============================================================================
// Map State Types
// ============================================================================

export interface MapState {
    basemapType: string;
    attribution: string;
    mapboxStyle: string;
    maptilerStyle: string;
    view: View | null;
    extent: number[] | null;
    zoom: number | null;
    interactions: Collection<Control>;
}

export interface CacheEntry<T> {
    data: T;
    timestamp: number; // time stored
    expiresAt: number; // absolute expiry time in ms epoch
}

export interface MapData {
    geojson: FeatureCollection;
    properties: MapProperties;
}

export interface MapProperties {
    id: string;
    name: string;
    value: number;
    [key: string]: any;
}


export interface LayerOptions extends OlLayerOptions {
    svg: d3.Selection<SVGElement, unknown, HTMLElement, any>;
    svgContainer: HTMLElement;
    zIndex: number;
    /** Whether interactions (selection, click) are allowed. When false (e.g., on dashboard tiles), click handlers should be disabled. */
    allowInteractions?: boolean;
    /** Whether high contrast mode is enabled */
    isHighContrast?: boolean;
    /** High contrast colors from Power BI (only set when isHighContrast is true) */
    highContrastColors?: HighContrastColors;
    // tooltipServiceWrapper: ITooltipServiceWrapper;
    // selectionManager: ISelectionManager;
}

export interface CircleData {
    longitudes: number[] | undefined;
    latitudes: number[] | undefined;
    circleSizeValuesObjects: DataViewMeasure[];
}

export interface ChoroplethData {
    /** Category containing P-Code/boundary ID values */
    AdminPCodeNameIDCategory: DataViewCategory | undefined;
    /** Measure containing color values */
    colorMeasure: DataViewMeasure | undefined;
    /** Array of P-Code strings */
    pCodes: string[] | undefined;
}

export interface ChoroplethDataSet {
    /** Array of numeric values for color mapping */
    colorValues: number[];
    /** Classification break points */
    classBreaks: number[];
    /** Color scale array or function */
    colorScale: string[] | ((value: number) => string);
    /** Property key for matching features to data */
    pcodeKey: string;   
    /** Array of data points with selection IDs */
    dataPoints: ChoroplethDataPoint[];
}

export interface CircleLayerOptions extends LayerOptions {

    longitudes: number[];
    latitudes: number[];
    circleOptions: CircleOptions;
    combinedCircleSizeValues?: number[];
    circle1SizeValues?: number[];
    circle2SizeValues?: number[];
    minCircleSizeValue?: number;
    maxCircleSizeValue?: number;
    circleScale?: number;
    svg: any;
    svgContainer: HTMLElement;
    zIndex: number;
    dataPoints?: Array<{
        longitude: number;
        latitude: number;
        tooltip: VisualTooltipDataItem[];
        selectionId: ISelectionId;
    }>;
    tooltipServiceWrapper: ITooltipServiceWrapper;
    selectionManager: powerbi.extensibility.ISelectionManager;
    /** Label text values to display on circles */
    labelValues?: string[];
    /** Label display and formatting options */
    labelOptions?: CircleLabelOptions;
}

export interface ChoroplethLayerOptions extends LayerOptions {
    geojson: any;
    strokeColor: string;
    strokeWidth: number;
    fillOpacity: number;
    colorScale: (value: any) => string;
    dataKey: string;
    svg: any;
    svgContainer: HTMLElement;
    zIndex: number;
    categoryValues: string[];
    measureValues: number[];
    selectionManager: ISelectionManager;
    tooltipServiceWrapper: ITooltipServiceWrapper;
    simplificationStrength?: number;
    /** Pre-processed geometry from GeometrySimplificationService (Phase 2 integration) */
    preparedGeometry?: PreparedGeometry;
    /** Styling options for nested geometries in GeometryCollections (points, lines) */
    nestedGeometryStyle?: NestedGeometryStyle;
    /** Whether to use color property from feature properties */
    useFeatureColor?: boolean;
    /** Property name to look for color values (default: "color") */
    featureColorProperty?: string;
    dataPoints?: Array<{
        pcode: string;
        value: number;
        tooltip: VisualTooltipDataItem[];
        selectionId: ISelectionId;
    }>;
}

export interface EventData {
    type: string;
    payload: any;
}

export interface EventCallback {
    (data: EventData): void;
}





export interface GeoJSONFeature {
    type: string;
    geometry: {
        type: string;
        coordinates: any[];
    };
    properties: {
        [key: string]: any;
        selectionId?: ISelectionId; //powerbi.visuals.ISelectionId; // Optional field for selection ID
        tooltip?: VisualTooltipDataItem[]; // Optional field for tooltips
    };
}

export interface GeoJSON {
    type: string;
    features: GeoJSONFeature[];
}

export interface BasemapOptions {
    selectedBasemap: string;
    customMapAttribution: string;

    mapboxCustomStyleUrl: string;
    mapboxStyle: string;
    mapboxAccessToken: string;

    declutterLabels: boolean;

    maptilerStyle: string;
    maptilerApiKey: string;

}

export interface CircleOptions {
    layerControl: boolean;
    color1: string;
    color2: string;
    minRadius: number;
    maxRadius: number;
    strokeColor: string;
    strokeWidth: number;
    layer1Opacity: number;
    layer2Opacity: number;
    showLegend: boolean;
    legendTitle: string;
    //legendTitleFontSize: string;
    //legendTitleFontWeight: string;
    legendTitleColor: string;
    legendItemStrokeColor: string;
    legendItemStrokeWidth: number;
    leaderLineColor: string;
    leaderLineStrokeWidth: number;
    labelTextColor: string;
    //labelTextFontSize: string;
    roundOffLegendValues: boolean;
    hideMinIfBelowThreshold: boolean;
    minValueThreshold: number;
    minRadiusThreshold: number;
    yPadding: number;
    xPadding: number;
    labelSpacing: number;
    chartType: string; // "nested-circle" | "donut-chart" | "pie-chart" | "hotspot" | "h3-hexbin"
    scalingMethod: string; // Fixed to 'square-root' for optimal area-based scaling
    // Blur/glow effects
    enableBlur: boolean;
    blurRadius: number;
    enableGlow: boolean;
    glowColor: string;
    glowIntensity: number;
    // H3 Hexbin settings
    h3Resolution: number;
    h3AggregationType: string; // "sum" | "count" | "average" | "min" | "max"
    h3ColorRamp: string; // "viridis" | "plasma" | "inferno" | "magma" | "warm" | "cool" | "blues" | "greens" | "reds" | "oranges" | "custom"
    h3FillColor: string; // Custom fill color when h3ColorRamp is "custom"
    h3StrokeColor: string;
    h3StrokeWidth: number;
    h3MinOpacity: number; // 0-100
    h3MaxOpacity: number; // 0-100
    h3ScalingMethod: string; // "linear" | "logarithmic" | "squareRoot" | "quantile"
    // Hotspot settings
    hotspotIntensity: number;
    hotspotRadius: number;
    hotspotColor: string;
    hotspotGlowColor: string;
    hotspotBlurAmount: number;
    hotspotMinOpacity: number; // 0-100
    hotspotMaxOpacity: number; // 0-100
    hotspotScaleByValue: boolean;
    hotspotScalingMethod: string; // "linear" | "logarithmic" | "squareRoot" | "quantile"
}

/**
 * Configuration options for circle label display and formatting.
 */
export interface CircleLabelOptions {
    /** Whether to show labels on circles */
    showLabels: boolean;
    /** Source for label values: "field", "location", "size", "size2", "tooltip" */
    labelSource: "field" | "location" | "size" | "size2" | "tooltip";
    /** Display units for numeric labels: "auto", "none", "thousands", "millions", "billions", "trillions" */
    displayUnits: "auto" | "none" | "thousands" | "millions" | "billions" | "trillions";
    /** Number of decimal places for numeric labels */
    decimalPlaces: number;
    /** Font size in pixels */
    fontSize: number;
    /** Font color (hex or CSS color) */
    fontColor: string;
    /** Font family (e.g., "sans-serif", "Arial") */
    fontFamily: string;
    /** Label position relative to circle: "center", "above", "below", "left", "right" */
    position: "center" | "above" | "below" | "left" | "right";
    /** Whether to show background behind label */
    showBackground: boolean;
    /** Background fill color */
    backgroundColor: string;
    /** Background opacity (0-100) */
    backgroundOpacity: number;
    /** Background padding in pixels */
    backgroundPadding: number;
    /** Background border radius in pixels */
    backgroundBorderRadius: number;
    /** Whether to show border around label background */
    showBorder: boolean;
    /** Border stroke color */
    borderColor: string;
    /** Border stroke width in pixels */
    borderWidth: number;
    /** Whether to show text halo (text stroke) for readability */
    showHalo: boolean;
    /** Halo stroke color */
    haloColor: string;
    /** Halo stroke width in pixels */
    haloWidth: number;
}

export interface ChoroplethOptions {
    layerControl: boolean;

    // Boundary data source options
    boundaryDataSource: string;
    
    // GeoBoundaries-specific options
    geoBoundariesReleaseType: string;
    geoBoundariesCountry: string;
    geoBoundariesAdminLevel: string;
    geoBoundariesSourceTag?: string;
    sourceFieldID: string;

    locationPcodeNameId: string,
    topoJSON_geoJSON_FileUrl: string,
    topojsonObjectName?: string,

    // Mapbox Tileset-specific options
    /** Mapbox tileset ID (e.g., 'mapbox.country-boundaries-v1') */
    mapboxTilesetId?: string;
    /** Source layer name within the tileset */
    mapboxTilesetSourceLayer?: string;
    /** Property name to match with data's location/pcode field */
    mapboxTilesetIdField?: string;
    /** Mapbox access token for tileset API calls (fallback from basemap or data role) */
    mapboxAccessToken?: string;
    /** Dedicated Mapbox access token for tileset (highest priority) */
    mapboxTilesetAccessToken?: string;

    //usePredefinedColorRamp: boolean;

    invertColorRamp: boolean;
    colorMode: string;
    colorRamp: string;
    customColorRamp: string;

    classes: number;
    classificationMethod: ClassificationMethod;

    // Category colors for unique classification
    /** Array of 7 user-defined colors for unique value categories */
    categoryColors?: string[];
    /** Array of 7 user-defined values for unique value categories */
    categoryValues?: string[];
    /** Color for values beyond the top 7 categories */
    othersColor?: string;

    strokeColor: string;
    strokeWidth: number;
    layerOpacity: number;
    simplificationStrength?: number;

    // Feature color property support
    /** Whether to use color property from feature properties */
    useFeatureColor: boolean;
    /** Property name to look for color values (default: "color") */
    featureColorProperty: string;

    // Nested geometry styling (for GeometryCollections)
    showNestedPoints: boolean;
    nestedPointRadius: number;
    nestedPointColor: string;
    nestedPointStrokeColor: string;
    nestedPointStrokeWidth: number;
    showNestedLines: boolean;
    nestedLineColor: string;
    nestedLineWidth: number;

    showLegend: boolean;
    legendLabelPosition: LegendLabelPosition;
    legendOrientation: LegendOrientation;
    legendTitle: string;
    legendTitleAlignment: string;
    legendTitleColor: string;
    legendLabelsColor: string;
    legendItemMargin: number;
    //legendLabelsFontSize: string;

}




export interface HeatmapOptions {
    layerControl: boolean;
    radius: number;
    blur: number;
    maxZoom: number;
    layerOpacity: number;
    showLegend: boolean;
}

export interface MapToolsOptions {
    lockMapExtent: boolean;
    showZoomControl: boolean;
    renderEngine?: 'svg' | 'canvas' | 'webgl';

    lockedMapExtent: string; // Stores the locked map extent as a comma-separated string: "minX,minY,maxX,maxY"
    lockedMapZoom?: number; // Stores the locked map zoom level

    // Map fit padding options (in pixels)
    mapFitPaddingTop: number;
    mapFitPaddingRight: number;
    mapFitPaddingBottom: number;
    mapFitPaddingLeft: number;

    legendPosition: string;
    legendBorderWidth: number;
    legendBorderRadius: number;
    legendBorderColor: string;
    legendBackgroundColor: string;
    legendBackgroundOpacity: number;
    legendBottomMargin: number;
    legendTopMargin: number;
    legendLeftMargin: number;
    legendRightMargin: number;

}

// Re-export type guards for runtime validation
export * from "./guards";