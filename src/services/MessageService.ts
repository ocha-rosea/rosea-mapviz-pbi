"use strict";

import powerbi from "powerbi-visuals-api";
import IVisualHost = powerbi.extensibility.visual.IVisualHost;

export class MessageService {
    private host: IVisualHost;

    constructor(host: IVisualHost) {
        this.host = host;
    }

    private warn(title: string, message: string) {
        this.host.displayWarningIcon(title, message);
    }

    // Generic / shared
    missingMeasures() {
        this.warn("Measures not found", "roseaMapVizWarning: Measures field is missing. Please ensure it is included in your data.");
    }
    missingLonLat() {
        this.warn("Missing Longitude or Latitude roles", "roseaMapVizWarning: Both Longitude and Latitude roles must be assigned to view scaled cirles. Please check your data fields.");
    }
    lonLatLengthMismatch() {
        this.warn("Longitude and Latitude have different lengths.", "roseaMapVizWarning: Longitude and Latitude have different lengths. Please ensure that both fields are populated with the same number of values.");
    }
    noValidPCodes() {
        this.warn("No valid PCodes found", "roseaMapVizWarning: No valid PCodes found in the Admin PCode/Name/ID field. Please ensure it is populated.");
    }
    adminPcodeMissing() {
        this.warn("Admin PCode/Name/ID not found", "roseaMapVizWarning: Admin PCode/Name/ID field is missing. Please ensure it is included in your data.");
    }
    colorMeasureMissing() {
        this.warn("Color Measure not found", "roseaMapVizWarning: Color measure field is missing. Please ensure it is included in your data.");
    }
    tooManyUniqueValues() {
        this.warn("Too many unique values for unique value classification.", "roseaMapVizWarning: Only the top 7 unique values are mapped to colors; all others are shown in black. Please select a different classification method for better results.");
    }
    invalidOrEmptyCustomColorRamp() {
        this.warn(
            "Invalid or empty custom color ramp.",
            "roseaMapVizWarning: Invalid or empty custom color ramp. Using default color ramp instead. Please provide a valid comma-separated list of hex color codes."
        );
    }

    // GeoBoundaries / data fetch
    geoBoundariesConfigError(msg: string) {
        this.warn("GeoBoundaries Configuration Error", `roseaMapVizWarning: ${msg}`);
    }
    geoBoundariesMetadataError() {
        this.warn("GeoBoundaries API Error", "roseaMapVizWarning: Failed to fetch boundary metadata from GeoBoundaries API. Please check your settings.");
    }
    geoBoundariesConnectionError() {
        this.warn("GeoBoundaries API Error", "roseaMapVizWarning: Error connecting to GeoBoundaries API. Please check your network connection.");
    }
    invalidGeoTopoUrl() {
        this.warn("Invalid Geo/TopoJSON URL", "roseaMapVizWarning: The provided GeoJSON URL is not valid. Please check the data source URL.");
    }
    geoTopoFetchNetworkError() {
        this.warn("Geo/TopoJSON Fetch Error", "roseaMapVizWarning: Failed to fetch Geo/TopoJSON data. Please check your network connection or the data source URL.");
    }
    geoTopoFetchStatusError(status: number) {
        this.warn("Geo/TopoJSON Fetch Error", `roseaMapVizWarning: Failed to fetch Geo/TopoJSON data. Server responded with status: ${status}`);
    }
    invalidGeoTopoData() {
        this.warn("Invalid Geo/TopoJSON Data", "roseaMapVizWarning: The fetched Geo/TopoJSON data is not valid. Please check the data source.");
    }
    choroplethFetchError() {
        this.warn("Error fetching data", "roseaMapVizWarning: An error occurred while fetching the choropleth data. Please check the URL and your network connection.");
    }

    // Inform user that the boundary ID field was auto-selected due to better matches
    autoSelectedBoundaryField(original: string, chosen: string, matches: number) {
        if (original === chosen) return; // don't show redundant message
        this.warn("Auto-selected Boundary ID", `roseaMapVizInfo: Auto-selected boundary ID '${chosen}' (matched ${matches} features) instead of '${original}'. You can override this in the formatting pane.`);
    }
}
