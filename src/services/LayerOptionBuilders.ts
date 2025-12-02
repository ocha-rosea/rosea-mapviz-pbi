"use strict";

import { CircleLayerOptions, CircleOptions, ChoroplethLayerOptions, HighContrastColors, NestedGeometryStyle } from "../types";
import * as d3 from "d3";
import powerbi from "powerbi-visuals-api";
import { ITooltipServiceWrapper } from "powerbi-visuals-utils-tooltiputils";
import ISelectionManager = powerbi.extensibility.ISelectionManager;

export class CircleLayerOptionsBuilder {
    private svg: d3.Selection<SVGElement, unknown, HTMLElement, any>;
    private svgContainer: HTMLElement;
    private selectionManager: ISelectionManager;
    private tooltipServiceWrapper: ITooltipServiceWrapper;
    private zIndex: number = 5;
    private allowInteractions: boolean = true;
    private isHighContrast: boolean = false;
    private highContrastColors: HighContrastColors | null = null;

    constructor(args: {
        svg: d3.Selection<SVGElement, unknown, HTMLElement, any>;
        svgContainer: HTMLElement;
        selectionManager: ISelectionManager;
        tooltipServiceWrapper: ITooltipServiceWrapper;
    }) {
        this.svg = args.svg;
        this.svgContainer = args.svgContainer;
        this.selectionManager = args.selectionManager;
        this.tooltipServiceWrapper = args.tooltipServiceWrapper;
    }

    /**
     * Sets whether interactions are allowed.
     * @param allowInteractions - Whether click/selection interactions are permitted
     */
    setAllowInteractions(allowInteractions: boolean): void {
        this.allowInteractions = allowInteractions;
    }

    /**
     * Sets high contrast mode state and colors.
     * @param isHighContrast - Whether high contrast mode is enabled
     * @param colors - High contrast colors from Power BI (null if not in high contrast mode)
     */
    setHighContrast(isHighContrast: boolean, colors: HighContrastColors | null): void {
        this.isHighContrast = isHighContrast;
        this.highContrastColors = colors;
    }

    build(params: {
        longitudes: number[];
        latitudes: number[];
        circleOptions: CircleOptions;
        combinedCircleSizeValues: number[];
        minCircleSizeValue: number;
        maxCircleSizeValue: number;
        circleScale: number;
        dataPoints: any[];
        circle1SizeValues?: number[];
        circle2SizeValues?: number[];
    }): CircleLayerOptions {
        return {
            longitudes: params.longitudes,
            latitudes: params.latitudes,
            circleOptions: params.circleOptions,
            combinedCircleSizeValues: params.combinedCircleSizeValues,
            circle1SizeValues: params.circle1SizeValues,
            circle2SizeValues: params.circle2SizeValues,
            minCircleSizeValue: params.minCircleSizeValue,
            maxCircleSizeValue: params.maxCircleSizeValue,
            circleScale: params.circleScale,
            svg: this.svg,
            svgContainer: this.svgContainer,
            zIndex: this.zIndex,
            dataPoints: params.dataPoints,
            tooltipServiceWrapper: this.tooltipServiceWrapper,
            selectionManager: this.selectionManager,
            allowInteractions: this.allowInteractions,
            isHighContrast: this.isHighContrast,
            highContrastColors: this.highContrastColors ?? undefined,
        };
    }
}

export class ChoroplethLayerOptionsBuilder {
    private svg: d3.Selection<SVGElement, unknown, HTMLElement, any>;
    private svgContainer: HTMLElement;
    private selectionManager: ISelectionManager;
    private tooltipServiceWrapper: ITooltipServiceWrapper;
    private zIndex: number = 5;
    private allowInteractions: boolean = true;
    private isHighContrast: boolean = false;
    private highContrastColors: HighContrastColors | null = null;

    constructor(args: {
        svg: d3.Selection<SVGElement, unknown, HTMLElement, any>;
        svgContainer: HTMLElement;
        selectionManager: ISelectionManager;
        tooltipServiceWrapper: ITooltipServiceWrapper;
    }) {
        this.svg = args.svg;
        this.svgContainer = args.svgContainer;
        this.selectionManager = args.selectionManager;
        this.tooltipServiceWrapper = args.tooltipServiceWrapper;
    }

    /**
     * Sets whether interactions are allowed.
     * @param allowInteractions - Whether click/selection interactions are permitted
     */
    setAllowInteractions(allowInteractions: boolean): void {
        this.allowInteractions = allowInteractions;
    }

    /**
     * Sets high contrast mode state and colors.
     * @param isHighContrast - Whether high contrast mode is enabled
     * @param colors - High contrast colors from Power BI (null if not in high contrast mode)
     */
    setHighContrast(isHighContrast: boolean, colors: HighContrastColors | null): void {
        this.isHighContrast = isHighContrast;
        this.highContrastColors = colors;
    }

    build(params: {
        geojson: any;
        strokeColor: string;
        strokeWidth: number;
        fillOpacity: number;
        colorScale: (value: any) => string;
        dataKey: string;
        categoryValues: string[];
        measureValues: number[];
        dataPoints: any[];
        simplificationStrength?: number;
        nestedGeometryStyle?: NestedGeometryStyle;
    }): ChoroplethLayerOptions {
        return {
            geojson: params.geojson,
            strokeColor: params.strokeColor,
            strokeWidth: params.strokeWidth,
            fillOpacity: params.fillOpacity,
            colorScale: params.colorScale,
            dataKey: params.dataKey,
            svg: this.svg,
            svgContainer: this.svgContainer,
            zIndex: this.zIndex,
            categoryValues: params.categoryValues,
            measureValues: params.measureValues,
            selectionManager: this.selectionManager,
            tooltipServiceWrapper: this.tooltipServiceWrapper,
            simplificationStrength: params.simplificationStrength,
            nestedGeometryStyle: params.nestedGeometryStyle,
            dataPoints: params.dataPoints,
            allowInteractions: this.allowInteractions,
            isHighContrast: this.isHighContrast,
            highContrastColors: this.highContrastColors ?? undefined,
        };
    }
}
