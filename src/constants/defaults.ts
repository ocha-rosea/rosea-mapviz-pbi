"use strict";

/**
 * Default values for Power BI formatting settings.
 * These constants centralize magic numbers used throughout the visual
 * for easier maintenance and consistency.
 */

// =============================================================================
// PROPORTIONAL CIRCLES (Scaled Circles) DEFAULTS
// =============================================================================

/**
 * Default settings for proportional/scaled circles visualization
 */
export const ProportionalCirclesDefaults = {
    /** Default color for circles layer 1 (orange) */
    CIRCLES_1_COLOR: "#f58220",
    /** Default color for circles layer 2 (yellow) */
    CIRCLES_2_COLOR: "#ffc800",
    /** Minimum radius in pixels for scaled circles */
    MIN_RADIUS: 3,
    /** Maximum radius in pixels for scaled circles */
    MAX_RADIUS: 30,
    /** Default stroke color (white) */
    STROKE_COLOR: "#ffffff",
    /** Default stroke width in pixels */
    STROKE_WIDTH: 1,
    /** Default layer opacity (0-100) */
    LAYER_OPACITY: 100,
    /** Slider limits for radius */
    RADIUS_SLIDER_MAX: 50,
    RADIUS_SLIDER_MIN: 0,
} as const;

/**
 * Default settings for proportional circles legend
 */
export const ProportionalCirclesLegendDefaults = {
    /** Whether to show legend by default */
    SHOW_LEGEND: false,
    /** Default legend title */
    LEGEND_TITLE: "Legend",
    /** Default title color (black) */
    TITLE_COLOR: "#000000",
    /** Default item stroke color (white) */
    ITEM_STROKE_COLOR: "#ffffff",
    /** Default item stroke width */
    ITEM_STROKE_WIDTH: 1,
    /** Max stroke width allowed */
    ITEM_STROKE_WIDTH_MAX: 5,
    /** Default leader line color (black) */
    LEADER_LINE_COLOR: "#000000",
    /** Default leader line stroke width */
    LEADER_LINE_STROKE_WIDTH: 1,
    /** Default label text color (black) */
    LABEL_TEXT_COLOR: "#000000",
    /** Default label spacing */
    LABEL_SPACING: 15,
    /** Label spacing range */
    LABEL_SPACING_MIN: 5,
    LABEL_SPACING_MAX: 20,
    /** Whether to round legend values by default */
    ROUND_LEGEND_VALUES: false,
    /** Whether to hide min circle if below threshold */
    HIDE_MIN_IF_BELOW_THRESHOLD: false,
    /** Default min value threshold */
    MIN_VALUE_THRESHOLD: 10,
    /** Default min radius threshold */
    MIN_RADIUS_THRESHOLD: 5,
    /** Default padding values */
    X_PADDING: 15,
    Y_PADDING: 5,
    /** Padding ranges */
    X_PADDING_MAX: 30,
    Y_PADDING_MAX: 15,
} as const;

// =============================================================================
// CHOROPLETH DEFAULTS
// =============================================================================

/**
 * Default settings for choropleth classification
 */
export const ChoroplethClassificationDefaults = {
    /** Default number of classes */
    NUM_CLASSES: 5,
    /** Maximum number of classes */
    NUM_CLASSES_MAX: 7,
    /** Minimum number of classes */
    NUM_CLASSES_MIN: 0,
} as const;

/**
 * Default settings for choropleth display
 */
export const ChoroplethDisplayDefaults = {
    /** Default color ramp */
    COLOR_RAMP: "blue",
    /** Default custom color ramp hex values */
    CUSTOM_COLOR_RAMP: " #e1eef9, #c7e1f5, #64beeb, #009edb",
    /** Whether to invert color ramp by default */
    INVERT_COLOR_RAMP: false,
    /** Default color interpolation mode */
    COLOR_MODE: "lab",
    /** Default stroke color (white) */
    STROKE_COLOR: "#ffffff",
    /** Default stroke width */
    STROKE_WIDTH: 1,
    /** Default layer opacity (0-100) */
    LAYER_OPACITY: 100,
    /** Default simplification strength (0-100) */
    SIMPLIFICATION_STRENGTH: 50,
} as const;

/**
 * Default settings for choropleth legend
 */
export const ChoroplethLegendDefaults = {
    /** Whether to show legend by default */
    SHOW_LEGEND: false,
    /** Default legend title */
    LEGEND_TITLE: "Legend",
    /** Default title color (black) */
    TITLE_COLOR: "#000000",
    /** Default labels color (black) */
    LABELS_COLOR: "#000000",
    /** Default legend item margin */
    ITEM_MARGIN: 2.5,
    /** Item margin range */
    ITEM_MARGIN_MAX: 5,
    ITEM_MARGIN_MIN: 0,
} as const;

// =============================================================================
// LEGEND CONTAINER DEFAULTS
// =============================================================================

/**
 * Default settings for legend container styling
 */
export const LegendContainerDefaults = {
    /** Default border width */
    BORDER_WIDTH: 1,
    /** Default border radius (rounded corners) */
    BORDER_RADIUS: 5,
    /** Border radius range */
    BORDER_RADIUS_MAX: 30,
    BORDER_RADIUS_MIN: 0,
    /** Default border color (white) */
    BORDER_COLOR: "#ffffff",
    /** Default background color (white) */
    BACKGROUND_COLOR: "#ffffff",
    /** Default background opacity (0-100) */
    BACKGROUND_OPACITY: 90,
    /** Default margins */
    BOTTOM_MARGIN: 25,
    TOP_MARGIN: 0,
    LEFT_MARGIN: 25,
    RIGHT_MARGIN: 0,
    /** Margin range */
    MARGIN_MAX: 80,
    MARGIN_MIN: 0,
    TOP_MARGIN_MIN: 0,
    BOTTOM_MARGIN_MIN: 10,
} as const;

// =============================================================================
// MAP CONTROLS DEFAULTS
// =============================================================================

/**
 * Default settings for map controls
 */
export const MapControlsDefaults = {
    /** Default render engine */
    RENDER_ENGINE: "svg",
    /** Whether to lock map extent by default */
    LOCK_MAP_EXTENT: false,
    /** Whether to show zoom control by default */
    SHOW_ZOOM_CONTROL: true,
} as const;

// =============================================================================
// BASEMAP DEFAULTS
// =============================================================================

/**
 * Default settings for basemap
 */
export const BasemapDefaults = {
    /** Default basemap type */
    TYPE: "mapbox",
    /** Default basemap style */
    STYLE: "streets-v12",
    /** Whether to show basemap by default */
    SHOW_BASEMAP: false,
} as const;

// =============================================================================
// SLIDER/RANGE COMMON VALUES
// =============================================================================

/**
 * Common slider and range values used across multiple settings
 */
export const SliderRanges = {
    /** Standard opacity slider range (0-100) */
    OPACITY_MIN: 0,
    OPACITY_MAX: 100,
    /** Standard stroke width range */
    STROKE_WIDTH_MIN: 0,
    STROKE_WIDTH_MAX: 5,
} as const;

// =============================================================================
// GEOBOUNDARIES DEFAULTS
// =============================================================================

/**
 * Default settings for GeoBoundaries data source
 */
export const GeoBoundariesDefaults = {
    /** Default boundary data source */
    BOUNDARY_DATA_SOURCE: "geoboundaries",
    /** Default country/region */
    COUNTRY: "ALL",
    /** Default release type */
    RELEASE_TYPE: "gbOpen",
    /** Default source tag (dataset version) */
    SOURCE_TAG: "v2025-11",
    /** Default administrative level */
    ADMIN_LEVEL: "ADM0",
    /** Default boundary ID field */
    BOUNDARY_ID_FIELD: "shapeName",
} as const;
