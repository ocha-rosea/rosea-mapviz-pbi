"use strict";

import powerbi from "powerbi-visuals-api";
import * as d3 from "d3";
import { DomIds } from "../constants/strings";
import Map from "ol/Map";
import { VisualConfig } from "../config/VisualConfig";
import { ChoroplethDataService } from "../services/ChoroplethDataService";
import { LegendService, CircleMeasureLegendEntry } from "../services/LegendService";
import { CircleSvgLayer } from "../layers/svg/circleSvgLayer";
import { CircleCanvasLayer } from "../layers/canvas/circleCanvasLayer";
import { CircleData, CircleLabelOptions, CircleLayerOptions, CircleOptions, MapToolsOptions } from "../types";
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
 * data values. Supports multiple rendering engines (SVG, Canvas) and
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
    /** Current circle layer instance (SVG or Canvas) */
    private circleLayer: CircleSvgLayer | CircleCanvasLayer | undefined;

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
    public getLayer(): CircleSvgLayer | CircleCanvasLayer | undefined {
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
     * @param labelOptions - Optional label configuration for circle labels
     * @returns The rendered circle layer or undefined if rendering failed
     */
    public render(
        categorical: any,
        circleOptions: CircleOptions,
        dataService: ChoroplethDataService,
        mapToolsOptions: MapToolsOptions,
        choroplethDisplayed: boolean,
        labelOptions?: CircleLabelOptions
    ): CircleSvgLayer | CircleCanvasLayer | undefined {
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
        const { longitudes, latitudes, circleSizeValuesObjects, locationIds, tooltipValues, circleLabelValues, circleLabelFormat } = parsed;
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

        // Build label values based on labelSource option
        // Labels are disabled for H3 hexbin and hotspot chart types as they use aggregated data
        const isAggregatedChartType = circleOptions.chartType === 'h3-hexbin' || circleOptions.chartType === 'hotspot';
        const labelValues = isAggregatedChartType ? undefined : this.buildLabelValues(labelOptions, {
            locationIds,
            circle1SizeValues: circleSizeValuesObjects[0]?.values as number[] | undefined,
            circle2SizeValues: circleSizeValuesObjects[1]?.values as number[] | undefined,
            tooltipValues,
            circleLabelValues,
            circle1Format: circleSizeValuesObjects[0]?.source?.format,
            circle2Format: circleSizeValuesObjects[1]?.source?.format,
            circleLabelFormat,
            count: longitudes.length
        });

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
            sizeMeasureName: circleSizeValuesObjects[0]?.source?.displayName,
            labelValues,
            labelOptions,
        });

        this.renderCircleLayerOnMap(layerOptions, mapToolsOptions, choroplethDisplayed);

        const circleMeasureLegendEntries = this.buildCircleMeasureLegendEntries(circleSizeValuesObjects, circleOptions);

        // Derive legend title from circle size measure display names
        const circleLegendTitle = this.buildCircleLegendTitle(circleSizeValuesObjects);

        if (circleOptions.showLegend) {
            const isGradientLegendType = circleOptions.chartType === 'h3-hexbin' || circleOptions.chartType === 'hotspot';
            
            if (isGradientLegendType) {
                // Use gradient legend for H3 hexbin and hotspot
                this.renderGradientLegend(circleOptions, circleLegendTitle);
            } else {
                // Use proportional circle legend for standard chart types
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
            }
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
        this.circleLayer = engine === 'canvas'
            ? new CircleCanvasLayer(circleLayerOptions)
            : new CircleSvgLayer(circleLayerOptions);
        this.map.addLayer(this.circleLayer);

        if (choroplethDisplayed === false && mapToolsOptions.lockMapExtent === false) {
            const anyLayer: any = this.circleLayer as any;
            const extent = anyLayer?.getFeaturesExtent?.();
            if (extent) {
                const fitPadding: [number, number, number, number] = [
                    mapToolsOptions.mapFitPaddingTop,
                    mapToolsOptions.mapFitPaddingRight,
                    mapToolsOptions.mapFitPaddingBottom,
                    mapToolsOptions.mapFitPaddingLeft
                ];
                this.map.getView().fit(extent, { padding: fitPadding, duration: 0 });
            }
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
     * Renders a gradient legend for H3 hexbin and hotspot chart types.
     * Shows a continuous color gradient bar with Low/High labels.
     * 
     * @param circleOptions - Circle configuration options
     * @param legendTitle - Optional legend title from measure display names
     */
    private renderGradientLegend(
        circleOptions: CircleOptions,
        legendTitle?: string
    ): void {
        const title = legendTitle || circleOptions.legendTitle || "Values";
        let colors: string[];

        if (circleOptions.chartType === 'h3-hexbin') {
            // Use H3 color ramp or custom colors
            if (circleOptions.h3ColorRamp === 'custom') {
                colors = [
                    circleOptions.h3FillColor,
                    circleOptions.h3FillColorMiddle,
                    circleOptions.h3FillColorEnd
                ];
            } else {
                // Get colors from predefined color ramps
                colors = this.getColorRampColors(circleOptions.h3ColorRamp);
            }
        } else {
            // Hotspot: use hotspot colors
            colors = [
                '#ffffff', // Low (transparent to colored)
                circleOptions.hotspotColor,
                circleOptions.hotspotGlowColor || circleOptions.hotspotColor
            ];
        }

        this.legendService.createGradientLegend(
            title,
            colors,
            circleOptions.legendTitleColor,
            circleOptions.labelTextColor
        );

        this.legendService.showLegend("circle");
    }

    /**
     * Returns sample colors for predefined color ramps.
     * Used for gradient legend display.
     * 
     * @param rampName - Name of the color ramp
     * @returns Array of 3 colors representing start, middle, end
     */
    private getColorRampColors(rampName: string): string[] {
        const colorRamps: Record<string, string[]> = {
            'viridis': ['#440154', '#21918c', '#fde725'],
            'plasma': ['#0d0887', '#cc4778', '#f0f921'],
            'inferno': ['#000004', '#bb3754', '#fcffa4'],
            'magma': ['#000004', '#b73779', '#fcfdbf'],
            'warm': ['#6e40aa', '#ff5e63', '#aff05b'],
            'cool': ['#6e40aa', '#28bbec', '#aff05b'],
            'blues': ['#f7fbff', '#6baed6', '#08306b'],
            'greens': ['#f7fcf5', '#74c476', '#00441b'],
            'reds': ['#fff5f0', '#fb6a4a', '#67000d'],
            'oranges': ['#fff5eb', '#fd8d3c', '#7f2704']
        };
        return colorRamps[rampName] || colorRamps['viridis'];
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

    /**
     * Builds label values based on the labelSource option.
     * 
     * @param labelOptions - Label configuration including source selection
     * @param data - Available data for label values
     * @returns Array of label strings or undefined if no labels should be shown
     */
    private buildLabelValues(
        labelOptions: CircleLabelOptions | undefined,
        data: {
            locationIds?: string[];
            circle1SizeValues?: number[];
            circle2SizeValues?: number[];
            tooltipValues?: (string | number | null)[];
            circleLabelValues?: (string | number | null)[];
            circle1Format?: string;
            circle2Format?: string;
            circleLabelFormat?: string;
            count: number;
        }
    ): string[] | undefined {
        if (!labelOptions?.showLabels) {
            return undefined;
        }

        const { labelSource, displayUnits, decimalPlaces } = labelOptions;
        const { locationIds, circle1SizeValues, circle2SizeValues, tooltipValues, circleLabelValues } = data;

        switch (labelSource) {
            case "field":
                if (!circleLabelValues) return undefined;
                return circleLabelValues.map(value => {
                    if (value === null || value === undefined) return '';
                    // If it's a number, apply formatting
                    if (typeof value === 'number') {
                        return this.formatNumericValue(value, displayUnits, decimalPlaces);
                    }
                    return String(value);
                });

            case "location":
                return locationIds;

            case "size":
                if (!circle1SizeValues) return undefined;
                return circle1SizeValues.map((value) => 
                    this.formatNumericValue(value, displayUnits, decimalPlaces)
                );

            case "size2":
                if (!circle2SizeValues) return undefined;
                return circle2SizeValues.map((value) => 
                    this.formatNumericValue(value, displayUnits, decimalPlaces)
                );

            case "tooltip":
                if (!tooltipValues) return undefined;
                return tooltipValues.map(value => {
                    if (value === null || value === undefined) return '';
                    // If it's a number, apply formatting
                    if (typeof value === 'number') {
                        return this.formatNumericValue(value, displayUnits, decimalPlaces);
                    }
                    return String(value);
                });

            default:
                return undefined;
        }
    }

    /**
     * Formats a numeric value with display units and decimal places.
     * 
     * @param value - The numeric value to format
     * @param displayUnits - Display units setting (auto, none, thousands, millions, billions, trillions)
     * @param decimalPlaces - Number of decimal places to show
     * @returns Formatted string representation
     */
    private formatNumericValue(
        value: number | null | undefined, 
        displayUnits: "auto" | "none" | "thousands" | "millions" | "billions" | "trillions",
        decimalPlaces: number
    ): string {
        if (value === null || value === undefined) {
            return '';
        }

        let scaledValue = value;
        let suffix = '';

        // Determine scale factor based on display units
        switch (displayUnits) {
            case "auto":
                // Auto-scale based on value magnitude
                if (Math.abs(value) >= 1e12) {
                    scaledValue = value / 1e12;
                    suffix = 'T';
                } else if (Math.abs(value) >= 1e9) {
                    scaledValue = value / 1e9;
                    suffix = 'B';
                } else if (Math.abs(value) >= 1e6) {
                    scaledValue = value / 1e6;
                    suffix = 'M';
                } else if (Math.abs(value) >= 1e3) {
                    scaledValue = value / 1e3;
                    suffix = 'K';
                }
                break;
            case "thousands":
                scaledValue = value / 1e3;
                suffix = 'K';
                break;
            case "millions":
                scaledValue = value / 1e6;
                suffix = 'M';
                break;
            case "billions":
                scaledValue = value / 1e9;
                suffix = 'B';
                break;
            case "trillions":
                scaledValue = value / 1e12;
                suffix = 'T';
                break;
            case "none":
            default:
                // No scaling
                break;
        }

        // Format with specified decimal places
        const formattedNumber = scaledValue.toLocaleString(undefined, {
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces
        });

        return formattedNumber + suffix;
    }

    // findClosestValue moved to src/math/circles.ts
}
