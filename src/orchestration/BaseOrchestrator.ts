"use strict";

import * as d3 from "d3";
import Map from "ol/Map";
import powerbi from "powerbi-visuals-api";
import { ITooltipServiceWrapper } from "powerbi-visuals-utils-tooltiputils";
import { LegendService } from "../services/LegendService";
import { VisualConfig } from "../config/VisualConfig";
import { MessageService } from "../services/MessageService";
import { HighContrastColors } from "../types";

import ISelectionManager = powerbi.extensibility.ISelectionManager;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;

/**
 * Configuration options for initializing an orchestrator.
 */
export interface OrchestratorConfig {
    /** D3 selection for the SVG element used for rendering */
    svg: d3.Selection<SVGElement, unknown, HTMLElement, any>;
    /** SVG overlay element for additional rendering */
    svgOverlay: SVGSVGElement;
    /** Container element for the SVG */
    svgContainer: HTMLElement;
    /** Service for managing legend display */
    legendService: LegendService;
    /** Power BI visual host for accessing platform features */
    host: IVisualHost;
    /** OpenLayers map instance */
    map: Map;
    /** Power BI selection manager for handling data point selections */
    selectionManager: ISelectionManager;
    /** Tooltip service wrapper for displaying tooltips */
    tooltipServiceWrapper: ITooltipServiceWrapper;
}

/**
 * Abstract base class for visualization orchestrators.
 * 
 * Provides common functionality for managing layers, legends, and map interactions.
 * Concrete implementations handle specific visualization types (choropleth, circles, etc.).
 * 
 * @abstract
 * @example
 * ```typescript
 * class MyOrchestrator extends BaseOrchestrator {
 *   public render(data: any, options: any) {
 *     this.clearGroup('#myGroup');
 *     // Render logic...
 *     this.fitExtentIfUnlocked(extent, options.lockMapExtent);
 *   }
 * }
 * ```
 */
export abstract class BaseOrchestrator {
    /** D3 selection for the main SVG element */
    protected svg: d3.Selection<SVGElement, unknown, HTMLElement, any>;
    /** SVG overlay element for additional rendering layers */
    protected svgOverlay: SVGSVGElement;
    /** Container element holding the SVG */
    protected svgContainer: HTMLElement;
    /** Service for creating and managing legends */
    protected legendService: LegendService;
    /** Power BI visual host for platform integration */
    protected host: IVisualHost;
    /** OpenLayers map instance for geographic rendering */
    protected map: Map;
    /** Power BI selection manager for data point selection */
    protected selectionManager: ISelectionManager;
    /** Tooltip service for displaying hover information */
    protected tooltipServiceWrapper: ITooltipServiceWrapper;
    /** Message service for displaying warnings and errors to users */
    protected messages: MessageService;
    /** Whether high contrast mode is enabled */
    protected isHighContrast: boolean = false;
    /** High contrast colors from Power BI (null if not in high contrast mode) */
    protected highContrastColors: HighContrastColors | null = null;

    /**
     * Creates a new orchestrator instance.
     * 
     * @param args - Configuration options for the orchestrator
     */
    constructor(args: OrchestratorConfig) {
        this.svg = args.svg;
        this.svgOverlay = args.svgOverlay;
        this.svgContainer = args.svgContainer;
        this.legendService = args.legendService;
        this.host = args.host;
        this.map = args.map;
        this.selectionManager = args.selectionManager;
        this.tooltipServiceWrapper = args.tooltipServiceWrapper;
        this.messages = new MessageService(this.host);
    }

    /**
     * Sets high contrast mode state and colors.
     * Should be called from visual.ts update() when high contrast mode changes.
     * 
     * @param isHighContrast - Whether high contrast mode is enabled
     * @param colors - High contrast colors from Power BI (null if not in high contrast mode)
     */
    public setHighContrast(isHighContrast: boolean, colors: HighContrastColors | null): void {
        this.isHighContrast = isHighContrast;
        this.highContrastColors = colors;
    }

    /**
     * Clears all child elements from an SVG group.
     * 
     * @param groupId - CSS selector for the group to clear (e.g., '#myGroup')
     */
    protected clearGroup(groupId: string): void {
        const group = this.svg.select(groupId);
        group.selectAll("*").remove();
    }

    /**
     * Safely removes a layer from the map if it exists.
     * 
     * @param layer - The layer to remove (may be undefined)
     * @param remover - Function to call for removing the layer (typically map.removeLayer)
     */
    protected removeLayerIfPresent(layer: { dispose?: () => void } | undefined, remover: (layer: any) => void): void {
        if (layer) {
            try { remover(layer); } catch {}
        }
    }

    /**
     * Fits the map view to the given extent unless map extent is locked.
     * 
     * @param extent - Bounding box extent [minX, minY, maxX, maxY]
     * @param lockMapExtent - If true, the map extent will not be changed
     * @param fitPadding - Optional custom padding [top, right, bottom, left] in pixels
     */
    protected fitExtentIfUnlocked(extent: number[] | undefined, lockMapExtent: boolean | undefined, fitPadding?: [number, number, number, number]): void {
        if (!lockMapExtent && extent) {
            const fitOptions = fitPadding 
                ? { padding: fitPadding, duration: 0 }
                : VisualConfig.MAP.FIT_OPTIONS;
            this.map.getView().fit(extent, fitOptions);
        }
    }
}
