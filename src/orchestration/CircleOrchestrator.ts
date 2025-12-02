"use strict";

import powerbi from "powerbi-visuals-api";
import * as d3 from "d3";
import { DomIds } from "../constants/strings";
import Map from "ol/Map";
import { VisualConfig } from "../config/VisualConfig";
import { ChoroplethDataService } from "../services/ChoroplethDataService";
import { LegendService, CircleMeasureLegendEntry } from "../services/LegendService";
import { CircleLayer } from "../layers/circleLayer";
import { CircleCanvasLayer } from "../layers/canvas/circleCanvasLayer";
import { CircleData, CircleLayerOptions, CircleOptions, MapToolsOptions } from "../types";
import { CircleWebGLLayer } from "../layers/webgl/circleWebGLLayer";
import { ITooltipServiceWrapper } from "powerbi-visuals-utils-tooltiputils";
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISelectionId = powerbi.extensibility.ISelectionId;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import { parseCircleCategorical } from "../data/circle";
import { calculateCircleScale, applyScaling, findClosestValue } from "../math/circles";
import { MessageService } from "../services/MessageService";
import { CircleLayerOptionsBuilder } from "../services/LayerOptionBuilders";
import { BaseOrchestrator } from "./BaseOrchestrator";

/**
 * Orchestrator for scaled circle (proportional symbol) visualizations.
 * 
 * Manages the rendering of circle markers on the map where circle size represents
 * data values. Supports multiple rendering engines (SVG, Canvas, WebGL) and
 * chart types (simple circles, pie charts, donut charts).
 * 
 * @extends BaseOrchestrator
 * @example
 * ```typescript
 * const orchestrator = new CircleOrchestrator({ svg, map, host, ... });
 * const layer = orchestrator.render(categorical, circleOptions, dataService, mapToolsOptions, false);
 * ```
 */
export class CircleOrchestrator extends BaseOrchestrator {
    /** Builder for constructing circle layer options */
    private circleOptsBuilder: CircleLayerOptionsBuilder;
    /** Current circle layer instance (SVG, Canvas, or WebGL) */
    private circleLayer: CircleLayer | CircleCanvasLayer | CircleWebGLLayer | undefined;

    /**
     * Creates a new CircleOrchestrator.
     * 
     * @param args - Configuration options inherited from BaseOrchestrator
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
    }) {
    super(args);
    this.messages = new MessageService(this.host);
        this.circleOptsBuilder = new CircleLayerOptionsBuilder({
            svg: this.svg,
            svgContainer: this.svgContainer,
            selectionManager: this.selectionManager,
            tooltipServiceWrapper: this.tooltipServiceWrapper,
        });
    }

    /**
     * Sets whether interactions (click/selection) are allowed for the circle layer.
     * Should be set to false when visual is pinned to a dashboard tile.
     * 
     * @param allowInteractions - Whether click/selection interactions are permitted
     */
    public setAllowInteractions(allowInteractions: boolean): void {
        this.circleOptsBuilder.setAllowInteractions(allowInteractions);
    }

    /**
     * Override setHighContrast to also update the layer options builder.
     * 
     * @param isHighContrast - Whether high contrast mode is enabled
     * @param colors - High contrast colors from Power BI
     */
    public override setHighContrast(isHighContrast: boolean, colors: import("../types").HighContrastColors | null): void {
        super.setHighContrast(isHighContrast, colors);
        this.circleOptsBuilder.setHighContrast(isHighContrast, colors);
    }

    /**
     * Returns the current circle layer instance.
     * 
     * @returns The active circle layer or undefined if not rendered
     */
    public getLayer(): CircleLayer | CircleCanvasLayer | CircleWebGLLayer | undefined {
        return this.circleLayer;
    }

    /**
     * Updates the selected data points on the circle layer.
     * 
     * @param selectionIds - Array of Power BI selection IDs to highlight
     */
    public setSelectedIds(selectionIds: ISelectionId[]): void {
        if (this.circleLayer && (this.circleLayer as any).setSelectedIds) (this.circleLayer as any).setSelectedIds(selectionIds);
    }

    /**
     * Renders the circle visualization based on categorical data.
     * 
     * Parses the input data, calculates circle scales, creates the appropriate
     * layer type based on render engine settings, and renders the legend.
     * 
     * @param categorical - Power BI categorical data containing coordinates and measures
     * @param circleOptions - Configuration options for circle appearance and behavior
     * @param dataService - Service for data processing and tooltip extraction
     * @param mapToolsOptions - Map interaction options (extent locking, render engine)
     * @param choroplethDisplayed - Whether a choropleth layer is also displayed (affects extent fitting)
     * @returns The rendered circle layer or undefined if rendering failed
     */
    public render(
        categorical: any,
        circleOptions: CircleOptions,
        dataService: ChoroplethDataService,
        mapToolsOptions: MapToolsOptions,
        choroplethDisplayed: boolean
    ): CircleLayer | CircleCanvasLayer | CircleWebGLLayer | undefined {
        if (circleOptions.layerControl == false) {
            const group1 = this.svg.select(`#${DomIds.CirclesGroup1}`);
            const group2 = this.svg.select(`#${DomIds.CirclesGroup2}`);
            group1.selectAll("*").remove();
            group2.selectAll("*").remove();
            if (this.circleLayer) {
                this.map.removeLayer(this.circleLayer);
                this.circleLayer = undefined;
            }
            this.legendService.hideLegend("circle");
            return undefined;
        }

    const group1 = this.svg.select(`#${DomIds.CirclesGroup1}`);
    const group2 = this.svg.select(`#${DomIds.CirclesGroup2}`);
        group1.selectAll("*").remove();
        group2.selectAll("*").remove();

        const circleLegendContainer = this.legendService.getCircleLegendContainer();
        if (circleLegendContainer) {
            circleLegendContainer.style.display = "flex";
        }

        const parsed = parseCircleCategorical(categorical);
        if (!parsed.hasLon || !parsed.hasLat) {
            this.messages.missingLonLat();
            return undefined;
        }
        const { longitudes, latitudes, circleSizeValuesObjects } = parsed;
        if (!longitudes || !latitudes) return undefined;

        const combinedCircleSizeValues = this.combineCircleSizeValues(circleSizeValuesObjects, circleOptions);
    const { minCircleSizeValue, maxCircleSizeValue, circleScale, selectedScalingMethod } = calculateCircleScale(
            combinedCircleSizeValues,
            circleOptions
        );

        const dataPoints = this.createCircleDataPoints(longitudes, latitudes, circleSizeValuesObjects, categorical, dataService);

        if (longitudes.length !== latitudes.length) {
            this.messages.lonLatLengthMismatch();
            return undefined;
        }

        const layerOptions: CircleLayerOptions = this.circleOptsBuilder.build({
            longitudes,
            latitudes,
            circleOptions,
            combinedCircleSizeValues,
            minCircleSizeValue,
            maxCircleSizeValue,
            circleScale,
            dataPoints,
            circle1SizeValues: circleSizeValuesObjects[0]?.values as number[],
            circle2SizeValues: circleSizeValuesObjects[1]?.values as number[],
        });

        this.renderCircleLayerOnMap(layerOptions, mapToolsOptions, choroplethDisplayed);

        const circleMeasureLegendEntries = this.buildCircleMeasureLegendEntries(circleSizeValuesObjects, circleOptions);

        // Derive legend title from circle size measure display names
        const circleLegendTitle = this.buildCircleLegendTitle(circleSizeValuesObjects);

        if (circleOptions.showLegend) {
            this.renderCircleLegend(
                combinedCircleSizeValues,
                circleSizeValuesObjects.length,
                minCircleSizeValue,
                maxCircleSizeValue,
                circleScale,
                selectedScalingMethod,
                circleOptions,
                circleMeasureLegendEntries,
                circleLegendTitle
            );
        } else {
            this.legendService.hideLegend("circle");
        }

    return this.circleLayer as any;
    }

    // parsing moved to src/data/circle.ts

    /**
     * Combines circle size values from multiple measures into a single array.
     * For pie/donut charts, also includes the sum of paired values.
     * 
     * @param circleSizeValuesObjects - Array of measure value objects
     * @param circleOptions - Circle configuration options
     * @returns Combined array of all size values
     */
    private combineCircleSizeValues(circleSizeValuesObjects: any[], circleOptions: CircleOptions): number[] {
        const individual = [
            ...(circleSizeValuesObjects[0]?.values || []),
            ...(circleSizeValuesObjects[1]?.values || []),
        ].map(Number);

        if (circleOptions.chartType === 'donut-chart' || circleOptions.chartType === 'pie-chart') {
            const values1 = circleSizeValuesObjects[0]?.values || [];
            const values2 = circleSizeValuesObjects[1]?.values || [];
            const minLength = Math.min(values1.length, values2.length);
            for (let i = 0; i < minLength; i++) {
                if (values1[i] !== undefined && values2[i] !== undefined) {
                    individual.push(Number(values1[i]) + Number(values2[i]));
                }
            }
        }

        return individual;
    }

    // scaling moved to src/math/circles.ts

    // applyScaling moved to src/math/circles.ts

    /**
     * Creates data point objects for each circle with coordinates, tooltips, and selection IDs.
     * 
     * @param longitudes - Array of longitude values
     * @param latitudes - Array of latitude values
     * @param circleSizeValuesObjects - Measure value objects for tooltip/selection binding
     * @param categorical - Power BI categorical data for selection ID creation
     * @param dataService - Service for extracting tooltip information
     * @returns Array of circle data point objects
     */
    private createCircleDataPoints(
        longitudes: number[],
        latitudes: number[],
        circleSizeValuesObjects: any[],
        categorical: any,
        dataService: ChoroplethDataService
    ): any[] {
        const tooltips = dataService.extractTooltips(categorical);
        return longitudes.map((lon, i) => {
            const selectionId = this.host
                .createSelectionIdBuilder()
                .withCategory(categorical.categories[0], i)
                .withMeasure(circleSizeValuesObjects[0]?.source?.queryName)
                .withMeasure(circleSizeValuesObjects[1]?.source?.queryName)
                .createSelectionId();
            return {
                longitude: lon,
                latitude: latitudes[i],
                tooltip: tooltips[i],
                selectionId,
            };
        });
    }

    // Options construction moved to LayerOptionBuilders

    /**
     * Renders the circle layer on the map with the appropriate rendering engine.
     * Automatically falls back to Canvas for pie/donut charts when WebGL is selected.
     * 
     * @param circleLayerOptions - Configuration options for the circle layer
     * @param mapToolsOptions - Map tools configuration including render engine
     * @param choroplethDisplayed - Whether choropleth layer is also displayed (affects auto-fit behavior)
     */
    private renderCircleLayerOnMap(circleLayerOptions: CircleLayerOptions, mapToolsOptions: MapToolsOptions, choroplethDisplayed: boolean): void {
        if (this.circleLayer) {
            try { (this.circleLayer as any).dispose?.(); } catch {}
            this.map.removeLayer(this.circleLayer);
        }
    const engine = mapToolsOptions.renderEngine;
    const chartType = circleLayerOptions.circleOptions?.chartType;
        const needCanvasForCharts = chartType === 'pie-chart' || chartType === 'donut-chart';
        // Fallback to Canvas for pies/donuts in WebGL mode (WebGLVectorLayer doesn't support sector drawing)
        this.circleLayer = engine === 'webgl'
            ? (needCanvasForCharts ? new CircleCanvasLayer(circleLayerOptions) : new CircleWebGLLayer(circleLayerOptions))
            : engine === 'canvas'
                ? new CircleCanvasLayer(circleLayerOptions)
                : new CircleLayer(circleLayerOptions);
    this.map.addLayer(this.circleLayer);
    // Attach hit overlay for WebGL only
    try { (this.circleLayer as any).attachHitLayer?.(this.map); } catch {}

        if (choroplethDisplayed === false && mapToolsOptions.lockMapExtent === false) {
            const anyLayer: any = this.circleLayer as any;
            const extent = anyLayer?.getFeaturesExtent?.();
            if (extent) this.map.getView().fit(extent, VisualConfig.MAP.FIT_OPTIONS);
        }
    }

    /**
     * Renders the proportional circle legend showing size-to-value mapping.
     * Calculates appropriate legend values and radii based on the data distribution.
     * Handles adaptive scaling when data values exceed the configured maximum.
     * 
     * @param combinedCircleSizeValues - All combined measure values
     * @param numberofCircleCategories - Number of circle categories (1 or 2)
     * @param minCircleSizeValue - Minimum value for scaling
     * @param maxCircleSizeValue - Maximum value for scaling
     * @param circleScale - Computed scale factor
     * @param selectedScalingMethod - The scaling method name (e.g., 'flannery', 'linear')
     * @param circleOptions - Circle configuration options
     * @param circleMeasureLegendEntries - Optional legend entries for multi-measure display
     */
    private renderCircleLegend(
        combinedCircleSizeValues: number[],
        numberofCircleCategories: number,
        minCircleSizeValue: number,
        maxCircleSizeValue: number,
        circleScale: number,
        selectedScalingMethod: string,
        circleOptions: CircleOptions,
        circleMeasureLegendEntries?: CircleMeasureLegendEntry[],
        legendTitle?: string
    ): void {
        // Override legend title with measure display name(s) if available
        if (legendTitle) {
            circleOptions = { ...circleOptions, legendTitle };
        }
        const validDataValues = combinedCircleSizeValues.filter(v => !isNaN(v) && isFinite(v));
        if (validDataValues.length === 0) return;
        const sortedValues = [...validDataValues].sort((a, b) => a - b);
        const mapScalingMaxValue = maxCircleSizeValue;
        const mapScalingMinValue = minCircleSizeValue;
        const actualMaxValue = Math.max(...validDataValues);
        const n = sortedValues.length;
        const percentile95 = sortedValues[Math.floor(n * 0.95)];
        const isAdaptiveScaling = actualMaxValue > maxCircleSizeValue;

        let maxMapCircleRadius: number;
        let maxLegendValue: number;
        if (isAdaptiveScaling) {
            maxMapCircleRadius = applyScaling(actualMaxValue, minCircleSizeValue, maxCircleSizeValue, circleScale, circleOptions, validDataValues);
            maxLegendValue = actualMaxValue;
        } else {
            maxMapCircleRadius = applyScaling(mapScalingMaxValue, minCircleSizeValue, maxCircleSizeValue, circleScale, circleOptions, validDataValues);
            maxLegendValue = mapScalingMaxValue;
        }

    const largeLegendRadius = maxMapCircleRadius;
    const mediumLegendRadius = maxMapCircleRadius * 0.5;
    const smallLegendRadius = maxMapCircleRadius * 0.25;

        const minRadiusSquared = circleOptions.minRadius * circleOptions.minRadius;
        const largeValue = maxLegendValue;
        const mediumValue = ((mediumLegendRadius * mediumLegendRadius - minRadiusSquared) / circleScale) + minCircleSizeValue;
        const clampedMediumValue = Math.max(mapScalingMinValue, Math.min(mediumValue, mapScalingMaxValue));
    const closestMediumValue = findClosestValue(sortedValues, clampedMediumValue);
        const smallValue = ((smallLegendRadius * smallLegendRadius - minRadiusSquared) / circleScale) + minCircleSizeValue;
        const clampedSmallValue = Math.max(mapScalingMinValue, Math.min(smallValue, mapScalingMaxValue));
    const closestSmallValue = findClosestValue(sortedValues, clampedSmallValue);

        const finalValues = [closestSmallValue, closestMediumValue, largeValue];
        const finalRadii = finalValues.map(value =>
            applyScaling(value, minCircleSizeValue, maxCircleSizeValue, circleScale, circleOptions, validDataValues)
        );

        this.legendService.createProportionalCircleLegend(
            finalValues,
            finalRadii,
            numberofCircleCategories,
            circleOptions,
            undefined,
            undefined,
            circleMeasureLegendEntries
        );

        this.legendService.showLegend("circle");
    }

    /**
     * Builds legend entries for circle measures showing color and name.
     * Used for pie/donut charts to display what each color represents.
     * 
     * @param circleSizeValuesObjects - Array of measure value objects (expects exactly 2 for pie/donut)
     * @param circleOptions - Circle configuration options including colors
     * @returns Array of legend entries with name, color, and opacity
     */
    private buildCircleMeasureLegendEntries(
        circleSizeValuesObjects: any[],
        circleOptions: CircleOptions
    ): CircleMeasureLegendEntry[] {
        if (!Array.isArray(circleSizeValuesObjects) || circleSizeValuesObjects.length !== 2) {
            return [];
        }

        const createEntry = (obj: any, color: string, opacity: number | undefined): CircleMeasureLegendEntry | undefined => {
            if (!obj) {
                return undefined;
            }

            const name = obj?.source?.displayName || obj?.source?.queryName;
            if (!name) {
                return undefined;
            }

            return {
                name,
                color: color,
                opacity,
            };
        };

        const first = createEntry(circleSizeValuesObjects[0], circleOptions.color1, circleOptions.layer1Opacity);
        const second = createEntry(circleSizeValuesObjects[1], circleOptions.color2, circleOptions.layer2Opacity);

        return [first, second].filter((entry): entry is CircleMeasureLegendEntry => !!entry);
    }

    /**
     * Builds the legend title from circle size measure display names.
     * If two measures are provided, concatenates their names with " / ".
     * 
     * @param circleSizeValuesObjects - Array of measure value objects
     * @returns Legend title string derived from measure display names, or undefined
     */
    private buildCircleLegendTitle(circleSizeValuesObjects: any[]): string | undefined {
        if (!Array.isArray(circleSizeValuesObjects) || circleSizeValuesObjects.length === 0) {
            return undefined;
        }

        const displayNames: string[] = [];
        for (const obj of circleSizeValuesObjects) {
            const name = obj?.source?.displayName;
            if (name) {
                displayNames.push(name);
            }
        }

        if (displayNames.length === 0) {
            return undefined;
        }

        return displayNames.join(" / ");
    }

    // findClosestValue moved to src/math/circles.ts
}
