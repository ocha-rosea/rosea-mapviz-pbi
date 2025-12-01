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

    public getLayer(): ChoroplethLayer | ChoroplethCanvasLayer | ChoroplethWebGLLayer | undefined {
        return this.choroplethLayer as any;
    }

    public setSelectedIds(selectionIds: ISelectionId[]) {
        if (this.choroplethLayer && (this.choroplethLayer as any).setSelectedIds) (this.choroplethLayer as any).setSelectedIds(selectionIds);
    }

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
                this.legendService.createChoroplethLegend(
                    colorValues,
                    classBreaks as any,
                    colorScale as any,
                    choroplethOptions,
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
            });

            this.renderChoroplethLayerOnMap(layerOptions, mapToolsOptions);
        } catch (error) { this.messages.choroplethFetchError(); }
    }

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
