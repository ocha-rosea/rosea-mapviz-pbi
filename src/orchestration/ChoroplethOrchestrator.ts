"use strict";

import powerbi from "powerbi-visuals-api";
import * as d3 from "d3";
import { DomIds, ClassificationMethods } from "../constants/strings";
import Map from "ol/Map";
import { ChoroplethDataService } from "../services/ChoroplethDataService";
import { LegendService } from "../services/LegendService";
import { ChoroplethLayer } from "../layers/choroplethLayer";
import { ChoroplethWebGLLayer } from "../layers/webgl/choroplethWebGLLayer";
import { ChoroplethData, ChoroplethDataSet, ChoroplethLayerOptions, ChoroplethOptions, MapToolsOptions } from "../types";
import { ITooltipServiceWrapper } from "powerbi-visuals-utils-tooltiputils";
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISelectionId = powerbi.extensibility.ISelectionId;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import * as requestHelpers from "../utils/requestHelpers";
import { VisualConfig } from "../config/VisualConfig";
import { GeoBoundariesService } from "../services/GeoBoundariesService";
import { GeoBoundariesCatalogService } from "../services/GeoBoundariesCatalogService";
import { CacheService } from "../services/CacheService";
import { BaseOrchestrator } from "./BaseOrchestrator";
import { ChoroplethLayerOptionsBuilder } from "../services/LayerOptionBuilders";
import { filterValidPCodes, parseChoroplethCategorical, validateChoroplethInput } from "../data/choropleth";
import { MessageService } from "../services/MessageService";
import { ChoroplethCanvasLayer } from "../layers/canvas/choroplethCanvasLayer";
import { UniqueClassificationService } from "../services/UniqueClassificationService";

/**
 * Orchestrator for choropleth (filled polygon) visualizations.
 * 
 * Coordinates data fetching, boundary resolution, color mapping, and layer rendering
 * for choropleth maps. Handles multiple boundary data sources including GeoBoundaries
 * API and custom TopoJSON/GeoJSON URLs.
 * 
 * @example
 * ```typescript
 * const orchestrator = new ChoroplethOrchestrator({ svg, map, host, ... });
 * await orchestrator.render(categorical, choroplethOptions, dataService, mapToolsOptions);
 * ```
 */
export class ChoroplethOrchestrator extends BaseOrchestrator {
    private cacheService: CacheService;
    private choroplethLayer: ChoroplethLayer | ChoroplethCanvasLayer | ChoroplethWebGLLayer | undefined;
    private abortController: AbortController | null = null;
    private choroplethOptsBuilder: ChoroplethLayerOptionsBuilder;
    private uniqueClassification: UniqueClassificationService;

    /**
     * Creates a new ChoroplethOrchestrator instance.
     * 
     * @param args - Configuration object containing required dependencies
     * @param args.svg - D3 selection for the main SVG container
     * @param args.svgOverlay - SVG overlay element for additional graphics
     * @param args.svgContainer - HTML container for the SVG elements
     * @param args.legendService - Service for managing choropleth legends
     * @param args.host - Power BI visual host for API access
     * @param args.map - OpenLayers map instance
     * @param args.selectionManager - Power BI selection manager for cross-filtering
     * @param args.tooltipServiceWrapper - Tooltip service wrapper for hover info
     * @param args.cacheService - Cache service for boundary data caching
     */
    constructor(args: {
        svg: d3.Selection<SVGElement, unknown, HTMLElement, any>;
        svgOverlay: SVGSVGElement;
        svgContainer: HTMLElement;
        legendService: LegendService;
        host: IVisualHost;
        map: Map;
        selectionManager: ISelectionManager;
        tooltipServiceWrapper: ITooltipServiceWrapper;
        cacheService: CacheService;
    }) {
        super(args);
        this.cacheService = args.cacheService;
        this.messages = new MessageService(this.host);
        this.uniqueClassification = new UniqueClassificationService();
        this.choroplethOptsBuilder = new ChoroplethLayerOptionsBuilder({
            svg: this.svg,
            svgContainer: this.svgContainer,
            selectionManager: this.selectionManager,
            tooltipServiceWrapper: this.tooltipServiceWrapper,
        });
    }

    /**
     * Sets whether interactions (click/selection) are allowed for the choropleth layer.
     * Should be set to false when visual is pinned to a dashboard tile.
     * 
     * @param allowInteractions - Whether click/selection interactions are permitted
     */
    public setAllowInteractions(allowInteractions: boolean): void {
        this.choroplethOptsBuilder.setAllowInteractions(allowInteractions);
    }

    /**
     * Override setHighContrast to also update the layer options builder.
     * 
     * @param isHighContrast - Whether high contrast mode is enabled
     * @param colors - High contrast colors from Power BI
     */
    public override setHighContrast(isHighContrast: boolean, colors: import("../types").HighContrastColors | null): void {
        super.setHighContrast(isHighContrast, colors);
        this.choroplethOptsBuilder.setHighContrast(isHighContrast, colors);
    }

    /**
     * Returns the current choropleth layer instance if one exists.
     * 
     * @returns The active choropleth layer (Canvas, WebGL, or SVG), or undefined if not rendered
     */
    public getLayer(): ChoroplethLayer | ChoroplethCanvasLayer | ChoroplethWebGLLayer | undefined {
        return this.choroplethLayer as any;
    }

    /**
     * Updates the selection state on the choropleth layer.
     * Used for cross-filtering and highlighting selected regions.
     * 
     * @param selectionIds - Array of Power BI selection IDs to highlight
     */
    public setSelectedIds(selectionIds: ISelectionId[]) {
        if (this.choroplethLayer && (this.choroplethLayer as any).setSelectedIds) (this.choroplethLayer as any).setSelectedIds(selectionIds);
    }

    /**
     * Main render method for choropleth visualization.
     * 
     * Orchestrates the full rendering pipeline:
     * 1. Validates input data and options
     * 2. Parses categorical data to extract P-Codes and color values
     * 3. Prepares data with classification and color scales
     * 4. Fetches boundary data (GeoBoundaries or custom URL)
     * 5. Renders the choropleth layer on the map
     * 6. Creates or hides the legend based on options
     * 
     * @param categorical - Power BI categorical data containing boundary IDs and measures
     * @param choroplethOptions - Configuration options for choropleth display
     * @param dataService - Service for data processing and classification
     * @param mapToolsOptions - Map tools configuration including render engine
     * @returns Promise resolving to the rendered layer, or undefined if rendering failed
     */
    public async render(
        categorical: any,
        choroplethOptions: ChoroplethOptions,
        dataService: ChoroplethDataService,
        mapToolsOptions: MapToolsOptions
    ): Promise<ChoroplethLayer | ChoroplethCanvasLayer | ChoroplethWebGLLayer | undefined> {
        if (choroplethOptions.layerControl == false) {
            const group = this.svg.select(`#${DomIds.ChoroplethGroup}`);
            group.selectAll("*").remove();
            if (this.choroplethLayer) {
                this.map.removeLayer(this.choroplethLayer);
                this.choroplethLayer = undefined;
            }
            this.legendService.hideLegend("choropleth");
            return undefined;
        }

    const group = this.svg.select(`#${DomIds.ChoroplethGroup}`);
    group.selectAll("*").remove();

    const validation = validateChoroplethInput(categorical);
    if (!validation.ok) { this.messages.missingMeasures(); return undefined; }

        const { AdminPCodeNameIDCategory, colorMeasure, pCodes } = parseChoroplethCategorical(categorical);
        if (!AdminPCodeNameIDCategory || !colorMeasure || !pCodes) return undefined;

    const validPCodes = filterValidPCodes(pCodes);
    if (validPCodes.length === 0) { this.messages.noValidPCodes(); return undefined; }

        const { colorValues, classBreaks, colorScale, pcodeKey, dataPoints } =
            this.prepareChoroplethData(categorical, choroplethOptions, AdminPCodeNameIDCategory, colorMeasure, pCodes, dataService);

        await this.fetchAndRenderChoroplethLayer(
            choroplethOptions,
            AdminPCodeNameIDCategory,
            colorMeasure,
            colorValues,
            classBreaks,
            colorScale,
            pcodeKey,
            dataPoints,
            validPCodes,
            dataService,
            mapToolsOptions
        );

        if (this.choroplethLayer) {
            if (choroplethOptions.showLegend) {
                const choroplethLegendContainer = this.legendService.getChoroplethLegendContainer();
                if (choroplethLegendContainer) {
                    choroplethLegendContainer.style.display = "flex";
                }
                const formatString = colorMeasure?.source?.format;
                // Override legend title with colorMeasure display name if available
                const legendOptionsWithTitle = colorMeasure?.source?.displayName
                    ? { ...choroplethOptions, legendTitle: colorMeasure.source.displayName }
                    : choroplethOptions;
                this.legendService.createChoroplethLegend(
                    colorValues,
                    classBreaks as any,
                    colorScale as any,
                    legendOptionsWithTitle,
                    undefined,
                    formatString,
                    this.host.locale
                );
                this.legendService.showLegend('choropleth');
            } else {
                this.legendService.hideLegend('choropleth');
            }
        }

    return this.choroplethLayer as any;
    }

    // parsing moved to src/data/choropleth.ts

    /**
     * Prepares choropleth data including color values, class breaks, and color scales.
     * Handles unique classification with stable color mapping and single-value numeric collapse.
     * 
     * @param categorical - Power BI categorical data
     * @param choroplethOptions - Choropleth configuration options
     * @param AdminPCodeNameIDCategory - Category containing boundary IDs
     * @param colorMeasure - Measure containing values for coloring
     * @param pCodes - Array of P-Code values from the data
     * @param dataService - Service for classification and color scale generation
     * @returns Dataset containing color values, class breaks, color scale, and data points
     */
    private prepareChoroplethData(
        categorical: any,
        choroplethOptions: ChoroplethOptions,
        AdminPCodeNameIDCategory: any,
        colorMeasure: any,
        pCodes: string[],
        dataService: ChoroplethDataService
    ): ChoroplethDataSet {
        const colorValues: number[] = colorMeasure.values;
        let classBreaks = dataService.getClassBreaks(colorValues, choroplethOptions);
        let colorScale = dataService.getColorScale(classBreaks as any, choroplethOptions);
        const pcodeKey = choroplethOptions.locationPcodeNameId;
        const tooltips = dataService.extractTooltips(categorical);
        const dataPoints = pCodes.map((pcode, i) => {
            const selectionId = this.host.createSelectionIdBuilder()
                .withCategory(AdminPCodeNameIDCategory, i)
                .withMeasure(colorMeasure.source.queryName)
                .createSelectionId();
            return { pcode, value: colorValues[i], tooltip: tooltips[i], selectionId };
        });

        // Apply unique classification with stable color mapping
        if (choroplethOptions.classificationMethod === ClassificationMethods.Unique) {
            const result = this.uniqueClassification.applyStableMapping(
                colorValues,
                colorScale,
                {
                    classificationMethod: choroplethOptions.classificationMethod,
                    classes: choroplethOptions.classes,
                    measureQueryName: colorMeasure?.source?.queryName
                }
            );
            if (result.stableOrderingApplied) {
                classBreaks = result.classBreaks;
                colorScale = result.colorScale;
                (choroplethOptions as any)._stableUniqueCategories = classBreaks;
                (choroplethOptions as any)._stableUniqueColors = colorScale;
            }
        } else {
            // Clear unique state when switching to other methods
            this.uniqueClassification.clearStateIfNotUnique(choroplethOptions.classificationMethod);
        }

        // Single-value numeric collapse: if non-categorical and only one distinct numeric value, force one color & two identical breaks
        if (choroplethOptions.classificationMethod !== ClassificationMethods.Unique) {
            try {
                const numericValues = colorValues.filter(v => typeof v === 'number' && !Number.isNaN(v));
                const uniqueNums = Array.from(new Set(numericValues));
                if (uniqueNums.length === 1) {
                    const v = uniqueNums[0];
                    const firstColor = Array.isArray(colorScale) ? colorScale[0] : (colorScale as any)[0];
                    classBreaks = [v, v]; // ensures legend creates exactly one range entry (v - v)
                    colorScale = [firstColor];
                }
            } catch (e) { }
        }

        return { colorValues, classBreaks, colorScale, pcodeKey, dataPoints } as any;
    }

    /**
     * Fetches boundary data and renders the choropleth layer on the map.
     * 
     * Handles two data sources:
     * - **GeoBoundaries**: Resolves URL via catalog or API, supports world dataset for ADM0
     * - **Custom URL**: Uses user-provided TopoJSON/GeoJSON URL with validation
     * 
     * Includes caching, abort controller for cancellation, and error handling.
     * 
     * @param choroplethOptions - Choropleth configuration options
     * @param AdminPCodeNameIDCategory - Category containing boundary IDs
     * @param colorMeasure - Measure containing values for coloring
     * @param colorValues - Array of numeric values for coloring
     * @param classBreaks - Classification breaks for color mapping
     * @param colorScale - Color scale function or array
     * @param pcodeKey - Property name for matching features to data
     * @param dataPoints - Array of data points with P-Code, value, tooltip, and selection ID
     * @param validPCodes - Array of valid P-Code values to filter boundaries
     * @param dataService - Service for geo data processing
     * @param mapToolsOptions - Map tools configuration including render engine
     */
    private async fetchAndRenderChoroplethLayer(
        choroplethOptions: ChoroplethOptions,
        AdminPCodeNameIDCategory: any,
        colorMeasure: any,
        colorValues: number[],
        classBreaks: any,
        colorScale: any,
        pcodeKey: string,
        dataPoints: any[],
        validPCodes: string[],
        dataService: ChoroplethDataService,
        mapToolsOptions: MapToolsOptions
    ): Promise<void> {
    let serviceUrl: string;
        let cacheKey: string;

        if (choroplethOptions.boundaryDataSource === "geoboundaries") {
            const validation = GeoBoundariesService.validateOptions(choroplethOptions);
            if (!validation.isValid) {
                this.host.displayWarningIcon("GeoBoundaries Configuration Error", `roseaMapVizWarning: ${validation.message}`);
                return;
            }
            try {
                // Special case: efficiently support multiple countries by using a consolidated world dataset at ADM0
                if (GeoBoundariesService.isAllCountriesRequest(choroplethOptions)) {
                    serviceUrl = GeoBoundariesService.getAllCountriesUrl();
                    const boundaryFieldName = GeoBoundariesService.getBoundaryFieldName(choroplethOptions);
                    pcodeKey = boundaryFieldName;
                    cacheKey = `geoboundaries_${choroplethOptions.geoBoundariesReleaseType}_ALL_ADM0`;
                } else {
                    // Prefer manifest-based direct TopoJSON path from the catalog
                    const resolvedUrl = GeoBoundariesCatalogService.resolveTopoJsonUrlSync(
                        choroplethOptions.geoBoundariesReleaseType,
                        choroplethOptions.geoBoundariesCountry,
                        choroplethOptions.geoBoundariesAdminLevel
                    ) || await GeoBoundariesCatalogService.resolveTopoJsonUrl(
                        choroplethOptions.geoBoundariesReleaseType,
                        choroplethOptions.geoBoundariesCountry,
                        choroplethOptions.geoBoundariesAdminLevel
                    );

                    if (resolvedUrl) {
                        serviceUrl = resolvedUrl;
                        const boundaryFieldName = GeoBoundariesService.getBoundaryFieldName(choroplethOptions);
                        pcodeKey = boundaryFieldName;
                        cacheKey = `geoboundaries_${choroplethOptions.geoBoundariesReleaseType}_${choroplethOptions.geoBoundariesCountry}_${choroplethOptions.geoBoundariesAdminLevel}`;
                    } else {
                        // Safe fallback to the legacy API metadata approach if manifest resolution fails
                        const metadata = await GeoBoundariesService.fetchMetadata(choroplethOptions);
                        if (!metadata || !metadata.data) {
                            this.host.displayWarningIcon("GeoBoundaries API Error", "roseaMapVizWarning: Failed to resolve boundary URL from manifest or fetch metadata from API. Please check your settings.");
                            return;
                        }
                        serviceUrl = GeoBoundariesService.getDownloadUrl(metadata.data, true);
                        const boundaryFieldName = GeoBoundariesService.getBoundaryFieldName(choroplethOptions);
                        pcodeKey = boundaryFieldName;
                        cacheKey = `geoboundaries_${choroplethOptions.geoBoundariesReleaseType}_${choroplethOptions.geoBoundariesCountry}_${choroplethOptions.geoBoundariesAdminLevel}`;
                    }
                }
            } catch (error) {
                this.host.displayWarningIcon("GeoBoundaries API Error", "roseaMapVizWarning: Error connecting to GeoBoundaries API. Please check your network connection.");
                return;
            }
        } else {
            serviceUrl = choroplethOptions.topoJSON_geoJSON_FileUrl as any;
            // Cache by resource URL (not by location field) so different URLs don't collide
            // Normalize cache key by stripping helper query params we add (e.g., ml_source)
            cacheKey = `custom_${encodeURIComponent(requestHelpers.stripQueryParams(serviceUrl || ''))}`;
            // Open redirect guard for custom URLs
            if (requestHelpers.hasOpenRedirect(serviceUrl)) {
                this.host.displayWarningIcon(
                    "Unsafe URL detected",
                    "roseaMapVizWarning: The provided boundary URL contains an open redirect parameter and was blocked."
                );
                return;
            }
        }

        if (this.abortController) this.abortController.abort();
        this.abortController = new AbortController();

            try {
                const data = await this.cacheService.getOrFetch(cacheKey, async () => {
                // Append a client identifier to outbound request URL
                    const fetchUrl = requestHelpers.appendClientIdQuery(serviceUrl);
                    if (!requestHelpers.isValidURL(fetchUrl)) { this.messages.invalidGeoTopoUrl(); return null; }
                    if (!requestHelpers.enforceHttps(fetchUrl)) { this.messages.geoTopoFetchNetworkError(); return null; }
                    let response: Response;
                    try {
                        response = await requestHelpers.fetchWithTimeout(fetchUrl, VisualConfig.NETWORK.FETCH_TIMEOUT_MS);
                    } catch (e) {
                        this.messages.geoTopoFetchNetworkError(); return null;
                    }
                    if (!response.ok) {
                        this.messages.geoTopoFetchStatusError(response.status); return null;
                    }
                    const json = await response.json();
                    if (!(await requestHelpers.isValidJsonResponse(json))) { this.messages.invalidGeoTopoData(); return null; }
                    return { data: json, response };
            }, { respectCacheHeaders: true });

                if (!data || !choroplethOptions.layerControl) {
                    // Surface a warning so users can see something happened
                    try { this.host.displayWarningIcon('GeoBoundaries', 'roseaMapVizWarning: No boundary data was returned for the selected dataset.'); } catch {}
                    return;
                }

            let processedGeoData;
            try {
                const preferFirstLayer = true; // prefer first layer by default for all sources
                const honorPreferredName = choroplethOptions.boundaryDataSource === 'custom' && !!choroplethOptions.topojsonObjectName;
                const procResult = dataService.processGeoData(
                    data,
                    pcodeKey,
                    // Use validated, non-empty PCodes only
                    validPCodes,
                    choroplethOptions.topojsonObjectName,
                    preferFirstLayer,
                    honorPreferredName
                );
                // Decide whether to adopt the auto-detected key based on confidence thresholds
                const bestKey = procResult.usedPcodeKey;
                const bestCount = procResult.bestCount || 0;
                const originalCount = procResult.originalCount || 0;
                // Base thresholds
                const baseMinMatches = VisualConfig.AUTO_DETECT?.PCODE_MIN_MATCHES ?? 3;
                const baseMinMargin = VisualConfig.AUTO_DETECT?.PCODE_MIN_MARGIN ?? 2;
                // Dynamically adapt thresholds for small filtered datasets so we don't reject valid small selections
                const dynamicMinMatches = Math.max(1, Math.min(baseMinMatches, validPCodes.length));
                const dynamicMinMargin = Math.min(baseMinMargin, Math.max(1, validPCodes.length - 1));

                let chosenGeojson = procResult.filteredByOriginal;
                let chosenKey = pcodeKey;

                if (bestKey && bestKey !== pcodeKey) {
                    const thresholdsMet = bestCount >= dynamicMinMatches && (bestCount >= originalCount + dynamicMinMargin);
                    const originalEmptyBestNonZero = originalCount === 0 && bestCount > 0; // Fallback: avoid zero-feature result
                    if (thresholdsMet || originalEmptyBestNonZero) {
                        chosenGeojson = procResult.filteredByBest;
                        chosenKey = bestKey;
                        try { this.messages.autoSelectedBoundaryField(pcodeKey, bestKey, bestCount); } catch (e) {}
                    } else {
                    }
                }

                processedGeoData = chosenGeojson;
                pcodeKey = chosenKey;
            } catch (e: any) {
                try { this.host.displayWarningIcon(
                    "Invalid Geo/TopoJSON Data",
                    "roseaMapVizWarning: The boundary data isn't valid GeoJSON (FeatureCollection with features). Please verify the URL, selected object name, and file format."
                ); } catch {}
                return;
            }


            // Defensive: if the processed GeoJSON has no features, bail early and
            // avoid adding an empty vector layer which can lead to confusing UI states.
            if (!processedGeoData || !Array.isArray((processedGeoData as any).features) || (processedGeoData as any).features.length === 0) {
                try { this.host.displayWarningIcon('No boundary features', 'roseaMapVizWarning: The selected boundary dataset produced zero matching features. Please check your Boundary ID field and data.'); } catch {}
                // Remove any previously-added choropleth layer so we don't leave a stale layer
                if (this.choroplethLayer) {
                    try { (this.choroplethLayer as any).dispose?.(); } catch {}
                    try { this.map.removeLayer(this.choroplethLayer); } catch {}
                    this.choroplethLayer = undefined;
                }
                // Give the caller a chance to update overlay visibility
                return;
            }

            const layerOptions: ChoroplethLayerOptions = this.choroplethOptsBuilder.build({
                geojson: processedGeoData,
                strokeColor: choroplethOptions.strokeColor,
                strokeWidth: choroplethOptions.strokeWidth,
                fillOpacity: choroplethOptions.layerOpacity,
                colorScale: (value: any) => dataService.getColorFromClassBreaks(value, classBreaks, colorScale, choroplethOptions.classificationMethod),
                dataKey: pcodeKey,
                categoryValues: AdminPCodeNameIDCategory.values,
                measureValues: colorMeasure.values,
                dataPoints,
                simplificationStrength: choroplethOptions.simplificationStrength,
                nestedGeometryStyle: {
                    showPoints: choroplethOptions.showNestedPoints,
                    pointRadius: choroplethOptions.nestedPointRadius,
                    pointColor: choroplethOptions.nestedPointColor,
                    pointStrokeColor: choroplethOptions.nestedPointStrokeColor,
                    pointStrokeWidth: choroplethOptions.nestedPointStrokeWidth,
                    showLines: choroplethOptions.showNestedLines,
                    lineColor: choroplethOptions.nestedLineColor,
                    lineWidth: choroplethOptions.nestedLineWidth,
                },
            });

            this.renderChoroplethLayerOnMap(layerOptions, mapToolsOptions);
        } catch (error) { this.messages.choroplethFetchError(); }
    }

    /**
     * Renders the choropleth layer on the map with the appropriate rendering engine.
     * Disposes of any existing layer before creating a new one.
     * 
     * @param layerOptions - Configuration options for the choropleth layer
     * @param mapToolsOptions - Map tools configuration including render engine ('webgl', 'canvas', or 'svg')
     */
    private renderChoroplethLayerOnMap(
        layerOptions: ChoroplethLayerOptions,
        mapToolsOptions: MapToolsOptions
    ): void {
        if (this.choroplethLayer) {
            try { (this.choroplethLayer as any).dispose?.(); } catch {}
            this.map.removeLayer(this.choroplethLayer);
        }
        // Use WebGL vector layer for choropleth when engine is 'webgl' and geojson is valid
        const hasValidGeoJSON = !!(layerOptions as any)?.geojson && !!(layerOptions as any)?.geojson?.type;
        this.choroplethLayer = mapToolsOptions.renderEngine === 'webgl'
            ? (hasValidGeoJSON ? new ChoroplethWebGLLayer(layerOptions) : new ChoroplethCanvasLayer(layerOptions))
            : mapToolsOptions.renderEngine === 'canvas'
                ? new ChoroplethCanvasLayer(layerOptions)
                : new ChoroplethLayer(layerOptions);
    this.map.addLayer(this.choroplethLayer);
    try { (this.choroplethLayer as any).attachHitLayer?.(this.map); } catch {}
        if (mapToolsOptions.lockMapExtent === false) {
            const anyLayer: any = this.choroplethLayer as any;
            const extent = anyLayer?.getFeaturesExtent?.();
            if (extent) this.map.getView().fit(extent, VisualConfig.MAP.FIT_OPTIONS);
        }
    }
}
