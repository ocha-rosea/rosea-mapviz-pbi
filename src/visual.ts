/*
 *  Power BI Visual CLI
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */
"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import { createTooltipServiceWrapper, ITooltipServiceWrapper } from "powerbi-visuals-utils-tooltiputils";
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISandboxExtendedColorPalette = powerbi.extensibility.ISandboxExtendedColorPalette;

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import { MessageService, DOMManager, StateManager, LocalizationService } from "./services";

import { RoseaMapVizFormattingSettingsModel } from "./settings"; import "ol/ol.css";
import Map from "ol/Map";
import { MapToolsOptions, HighContrastColors } from "./types/index";
import type { CircleSvgLayer } from "./layers/svg/circleSvgLayer";
import type { ChoroplethSvgLayer } from "./layers/svg/choroplethSvgLayer";
import type { CircleCanvasLayer } from "./layers/canvas/circleCanvasLayer";
import type { ChoroplethCanvasLayer } from "./layers/canvas/choroplethCanvasLayer";
import * as d3 from "d3";
import { LegendService, MapService, ChoroplethDataService, ColorRampManager, CacheService, OptionsService, ColorRampHelper, DataRoleService, GeoBoundariesCatalogService } from "./services";
import { View } from "ol";
import { MapToolsOrchestrator } from "./orchestration/MapToolsOrchestrator";
import { ChoroplethOrchestrator } from "./orchestration/ChoroplethOrchestrator";
import { CircleOrchestrator } from "./orchestration/CircleOrchestrator";
import { DomIds } from "./constants/strings";
import { RoleNames } from "./constants/roles";

export class RoseaMapViz implements IVisual {
    private host: IVisualHost;
    private formattingSettingsService: FormattingSettingsService;
    private visualFormattingSettingsModel: RoseaMapVizFormattingSettingsModel;
    private tooltipServiceWrapper: ITooltipServiceWrapper;
    private selectionManager: ISelectionManager;
    
    // DOM Management
    private domManager: DOMManager;
    private stateManager: StateManager;
    private container: HTMLElement;
    private svg: d3.Selection<SVGElement, unknown, HTMLElement, any>;
    
    // Services
    private colorRampManager: ColorRampManager;
    private legendService: LegendService;
    private mapService: MapService;
    private dataService: ChoroplethDataService;
    private cacheService: CacheService;
    private messages: MessageService;
    private localizationService: LocalizationService;
    
    // Map
    private map: Map;
    private view: View;
    private mapToolsOptions: MapToolsOptions;
    
    // Layers
    private circleLayer: CircleSvgLayer | CircleCanvasLayer;
    private choroplethLayer: ChoroplethSvgLayer | ChoroplethCanvasLayer;
    private choroplethDisplayed: boolean = false;
    
    // Orchestrators
    private events: IVisualEventService;
    private mapToolsOrchestrator: MapToolsOrchestrator;
    private circleOrchestrator: CircleOrchestrator;
    private choroplethOrchestrator: ChoroplethOrchestrator;

    // High Contrast Mode
    private isHighContrast: boolean = false;
    private highContrastColors: HighContrastColors | null = null;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.events = options.host.eventService;
        this.container = options.element;
        
        // Initialize state manager (handles debug settings)
        this.stateManager = new StateManager({ host: this.host });
        this.messages = new MessageService(this.host);
        
        // Initialize localization service (with fallback for test environments)
        const localizationManager = this.host.createLocalizationManager?.() ?? {
            getDisplayName: (key: string) => key
        };
        this.localizationService = new LocalizationService(localizationManager);
        
        // Initialize formatting
        this.formattingSettingsService = new FormattingSettingsService();
        this.visualFormattingSettingsModel = new RoseaMapVizFormattingSettingsModel();
        
        // Initialize Power BI services
        this.tooltipServiceWrapper = createTooltipServiceWrapper(this.host.tooltipService);
        this.selectionManager = this.host.createSelectionManager();
        
        // Initialize DOM Manager and create DOM elements
        this.domManager = new DOMManager({ container: this.container });
        this.domManager.setLocalizationService(this.localizationService);
        const elements = this.domManager.getElements();
        
        // Initialize legend service
        this.legendService = new LegendService(elements.legendContainer);
        
        // Initialize map
        this.mapService = new MapService(this.container, this.mapToolsOptions?.showZoomControl !== false, this.host);
        this.map = this.mapService.getMap();
        this.view = this.mapService.getView();
        this.mapToolsOrchestrator = new MapToolsOrchestrator(this.map, this.mapService);
        
        // Get D3 selection from DOM manager's SVG
        this.svg = d3.select(elements.svgOverlay);
        
        // Subscribe to selection changes
        this.selectionManager.registerOnSelectCallback(() => {
            const selectionIds = this.selectionManager.getSelectionIds();
            if (this.circleOrchestrator) {
                this.circleOrchestrator.setSelectedIds(selectionIds as any);
                this.circleLayer?.changed();
            }
            if (this.choroplethOrchestrator) {
                this.choroplethOrchestrator.setSelectedIds(selectionIds as any);
                this.choroplethLayer?.changed();
            }
        });
        
        // Initialize cache and prefetch catalog
        this.cacheService = new CacheService();
        try { GeoBoundariesCatalogService.getCatalog().catch(() => {}); } catch {}
        
        // Initialize orchestrators
        this.circleOrchestrator = new CircleOrchestrator({
            svg: this.svg as unknown as d3.Selection<SVGElement, unknown, HTMLElement, any>,
            svgOverlay: elements.svgOverlay,
            svgContainer: elements.svgContainer,
            legendService: this.legendService,
            host: this.host,
            map: this.map,
            selectionManager: this.selectionManager,
            tooltipServiceWrapper: this.tooltipServiceWrapper,
        });
        this.choroplethOrchestrator = new ChoroplethOrchestrator({
            svg: this.svg as unknown as d3.Selection<SVGElement, unknown, HTMLElement, any>,
            svgOverlay: elements.svgOverlay,
            svgContainer: elements.svgContainer,
            legendService: this.legendService,
            host: this.host,
            map: this.map,
            selectionManager: this.selectionManager,
            tooltipServiceWrapper: this.tooltipServiceWrapper,
            cacheService: this.cacheService,
        });

        // Add context menu handler for empty map area (right-click on map background)
        this.container.addEventListener('contextmenu', (event: MouseEvent) => {
            // Only handle if target is the map container or viewport (not data points)
            const target = event.target as HTMLElement;
            if (target.closest('.ol-viewport') && !target.closest('path') && !target.closest('circle')) {
                event.preventDefault();
                this.selectionManager.showContextMenu(
                    {},
                    { x: event.clientX, y: event.clientY }
                );
            }
        });
    }

    private updateOverlayVisibility(): void {
        this.domManager.updateOverlayVisibility(
            this.choroplethLayer as any,
            this.circleLayer as any
        );
    }

    public update(options: VisualUpdateOptions) {
        this.events.renderingStarted(options);
        const elements = this.domManager.getElements();
        
        try {
            const dataView = options.dataViews[0];
            this.map.setView(this.view); // default view

            // Detect high contrast mode
            const colorPalette = this.host.colorPalette as ISandboxExtendedColorPalette;
            this.isHighContrast = colorPalette?.isHighContrast ?? false;
            if (this.isHighContrast && colorPalette) {
                this.highContrastColors = {
                    foreground: colorPalette.foreground?.value ?? '#ffffff',
                    background: colorPalette.background?.value ?? '#000000',
                    foregroundSelected: colorPalette.foregroundSelected?.value ?? '#00ffff',
                    hyperlink: colorPalette.hyperlink?.value ?? '#ffff00'
                };
            } else {
                this.highContrastColors = null;
            }

            // Update formatting settings
            this.visualFormattingSettingsModel = this.formattingSettingsService
                .populateFormattingSettingsModel(RoseaMapVizFormattingSettingsModel, options.dataViews[0]);

            // Get latest options early for lockMapExtent
            this.mapToolsOptions = OptionsService.getMapToolsOptions(this.visualFormattingSettingsModel);

            const categorical = dataView?.categorical;
            const mapboxCredential = categorical
                ? DataRoleService.getFirstStringValueForRole(categorical, RoleNames.MapboxAccessToken)
                : undefined;
            const maptilerCredential = categorical
                ? DataRoleService.getFirstStringValueForRole(categorical, RoleNames.MaptilerApiKey)
                : undefined;

            // Apply conditional display logic
            this.visualFormattingSettingsModel.BasemapVisualCardSettings.applyConditionalDisplayRules();
            this.visualFormattingSettingsModel.ChoroplethVisualCardSettings.choroplethLocationBoundarySettingsGroup.applyConditionalDisplayRules();
            
            // Auto-detect unique values from color data for classification settings
            // Uses stable ordering - values persist across filtering
            const classificationGroup = this.visualFormattingSettingsModel.ChoroplethVisualCardSettings.choroplethClassificationSettingsGroup;
            if (categorical) {
                const colorMeasure = categorical.values?.find(v => v.source.roles?.['Color']);
                if (colorMeasure?.values) {
                    // Get unique values, convert to strings, sort, take top 7
                    const uniqueValues = Array.from(new Set(
                        colorMeasure.values
                            .filter(v => v !== null && v !== undefined)
                            .map(v => String(v).trim())
                    )).sort((a, b) => {
                        // Try numeric sort first, then string sort
                        const numA = parseFloat(a);
                        const numB = parseFloat(b);
                        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                        return a.localeCompare(b);
                    });
                    // Pass measure query name for stable color tracking across filter changes
                    const measureQueryName = colorMeasure.source?.queryName;
                    classificationGroup.setDataDetectedValues(
                        uniqueValues.slice(0, 7), 
                        uniqueValues.length,
                        measureQueryName
                    );
                }
            }
            classificationGroup.applyConditionalDisplayRules();
            
            this.visualFormattingSettingsModel.mapToolsVisualCardSettings.applyConditionalDisplayRules();
            this.visualFormattingSettingsModel.legendContainerVisualCardSettings.applyConditionalDisplayRules();

            // Detect if Circle 2 data is present for conditional settings visibility
            const circleSizeValues = categorical?.values?.filter(c => c.source?.roles?.[RoleNames.Size]) || [];
            const hasCircle2Data = circleSizeValues.length >= 2;
            const circleDisplayGroup = this.visualFormattingSettingsModel.ProportionalCirclesVisualCardSettings.proportionalCirclesDisplaySettingsGroup;
            circleDisplayGroup.setCircle2DataAvailable(hasCircle2Data);
            circleDisplayGroup.applyConditionalDisplayRules();

            // Apply conditional visibility to legend settings based on chart type
            const circleLegendGroup = this.visualFormattingSettingsModel.ProportionalCirclesVisualCardSettings.proportionalCirclesLegendSettingsGroup;
            const currentChartType = String(circleDisplayGroup.chartType.value?.value || "nested-circle");
            circleLegendGroup.setChartType(currentChartType);
            circleLegendGroup.applyConditionalDisplayRules();

            // Apply conditional visibility to label settings based on chart type
            // Labels are hidden for H3 hexbin and hotspot as they use aggregated data
            const circleLabelGroup = this.visualFormattingSettingsModel.ProportionalCirclesVisualCardSettings.circleLabelSettingsGroup;
            circleLabelGroup.setChartType(currentChartType);
            circleLabelGroup.applyConditionalDisplayRules();

            const basemapSettingGroups = this.visualFormattingSettingsModel.BasemapVisualCardSettings;
            basemapSettingGroups.mapBoxSettingsGroup.mapboxAccessToken.visible = !mapboxCredential;
            basemapSettingGroups.maptilerSettingsGroup.maptilerApiKey.visible = !maptilerCredential;

            // Clean up previous overlay graphics (never touch base map layer stack here)
            this.svg.selectAll('*').remove();
            elements.svgOverlay.style.display = 'none';

            // Build option objects
            const basemapOptions = OptionsService.getBasemapOptions(this.visualFormattingSettingsModel, {
                mapboxAccessToken: mapboxCredential,
                maptilerApiKey: maptilerCredential
            });
            const circleOptions = OptionsService.getCircleOptions(this.visualFormattingSettingsModel);
            const circleLabelOptions = OptionsService.getCircleLabelOptions(this.visualFormattingSettingsModel);
            const choroplethOptions = OptionsService.getChoroplethOptions(this.visualFormattingSettingsModel, {
                mapboxAccessToken: mapboxCredential,
            });
            this.mapToolsOptions = OptionsService.getMapToolsOptions(this.visualFormattingSettingsModel);

            // User-driven layer toggles (no auto state)
            circleOptions.layerControl = circleOptions.layerControl;
            choroplethOptions.layerControl = choroplethOptions.layerControl;

            // Always update basemap first so it's visible even if layers fail
            try {
                this.mapService.updateBasemap(basemapOptions);
            } catch (e) {
                this.stateManager.displayWarning('Basemap error', 'roseaMapVizWarning: Failed to update basemap. Previous basemap retained.');
            }

            // Zoom control + legend styling
            this.mapService.setZoomControlVisible(Boolean(this.mapToolsOptions.showZoomControl));
            this.updateLegendContainer();

            // Color ramp + data service (safe)
            let selectedColorRamp;
            try {
                selectedColorRamp = ColorRampHelper.selectColorRamp(
                    choroplethOptions.colorRamp,
                    choroplethOptions.customColorRamp,
                    this.messages
                );
                this.colorRampManager = new ColorRampManager(selectedColorRamp);
                this.dataService = new ChoroplethDataService(this.colorRampManager, this.host);
            } catch (e) {
                this.stateManager.displayWarning('Color ramp error', 'roseaMapVizWarning: Failed to initialize color ramp. Layers may not render.');
            }

            // No data -> clear overlays, show landing page, keep basemap visible
            if (!dataView || !dataView.categorical) {
                this.svg.selectAll('*').remove();
                this.domManager.setLegendVisible(false);
                this.domManager.showLandingPage();
                return; // finally will fire
            }

            // Hide landing page when data is available
            this.domManager.hideLandingPage();

            this.choroplethDisplayed = choroplethOptions.layerControl;

            // Check if interactions are allowed (e.g., false when pinned to dashboard tile)
            const allowInteractions = this.host.hostCapabilities?.allowInteractions !== false;
            this.circleOrchestrator.setAllowInteractions(allowInteractions);
            this.choroplethOrchestrator.setAllowInteractions(allowInteractions);

            // Pass high contrast state to orchestrators
            this.circleOrchestrator.setHighContrast(this.isHighContrast, this.highContrastColors);
            this.choroplethOrchestrator.setHighContrast(this.isHighContrast, this.highContrastColors);

            // Choropleth layer (async) with guarded errors
            if (choroplethOptions.layerControl === true) {
                try {
                    const res = this.choroplethOrchestrator.render(
                        dataView.categorical,
                        choroplethOptions,
                        this.dataService,
                        this.mapToolsOptions
                    );
                    // If render returned a promise, attach handlers to isolate failures
                    if (res && typeof (res as any).then === 'function') {
                        (res as unknown as Promise<any>)
                            .then(layer => { this.choroplethLayer = layer as any; this.updateOverlayVisibility(); })
                            .catch(() => {
                                try { this.stateManager.displayWarning('Choropleth render error', 'roseaMapVizWarning: Failed to render choropleth layer.'); } catch {}
                            });
                    } else {
                        // Non-promise return (defensive): assign directly
                        this.choroplethLayer = res as any;
                        this.updateOverlayVisibility();
                    }
                } catch (err) {
                    this.stateManager.displayWarning('Choropleth render error', 'roseaMapVizWarning: Failed to render choropleth layer.');
                }
            } else {
                const group = this.svg.select(`#${DomIds.ChoroplethGroup}`);
                group.selectAll('*').remove();
                try { this.svg.select('#choropleth-hitlayer').remove(); } catch {}
                try {
                    const el = elements.svgContainer.querySelector('#choropleth-canvas');
                    if (el && el.parentElement) el.parentElement.removeChild(el);
                } catch {}
                if (this.choroplethLayer) {
                    try { (this.choroplethLayer as any).dispose?.(); } catch {}
                    this.map.removeLayer(this.choroplethLayer);
                    this.choroplethLayer = undefined;
                }
                this.updateOverlayVisibility();
                this.legendService.hideLegend('choropleth');
            }

            // Circle layer (sync) with guarded errors
            if (circleOptions.layerControl === true) {
                try {
                    const res = this.circleOrchestrator.render(
                        dataView.categorical,
                        circleOptions,
                        this.dataService,
                        this.mapToolsOptions,
                        this.choroplethDisplayed,
                        circleLabelOptions
                    );
                    if (res && typeof (res as any).then === 'function') {
                        (res as unknown as Promise<any>)
                            .then(layer => { this.circleLayer = layer as any; this.updateOverlayVisibility(); })
                            .catch(() => {
                                this.stateManager.displayWarning('Circle render error', 'roseaMapVizWarning: Failed to render circle layer.');
                            });
                    } else {
                        this.circleLayer = res as any;
                        this.updateOverlayVisibility();
                    }
                } catch (err) {
                    this.stateManager.displayWarning('Circle render error', 'roseaMapVizWarning: Failed to render circle layer.');
                }
            } else {
                const group1 = this.svg.select(`#${DomIds.CirclesGroup1}`);
                const group2 = this.svg.select(`#${DomIds.CirclesGroup2}`);
                group1.selectAll('*').remove();
                group2.selectAll('*').remove();
                try { this.svg.select('#circles-hitlayer').remove(); } catch {}
                try {
                    const el = elements.svgContainer.querySelector('#circles-canvas');
                    if (el && el.parentElement) el.parentElement.removeChild(el);
                } catch {}
                if (this.circleLayer) {
                    try { (this.circleLayer as any).dispose?.(); } catch {}
                    this.map.removeLayer(this.circleLayer);
                    this.circleLayer = undefined;
                }
                this.updateOverlayVisibility();
                this.legendService.hideLegend('circle');
            }

            // Legend container overall visibility (based on settings, not render success)
            const parentLegendVisible =
                (choroplethOptions.layerControl === true && choroplethOptions.showLegend === true) ||
                (circleOptions.layerControl === true && circleOptions.showLegend === true);
            this.domManager.setLegendVisible(parentLegendVisible);

            // Resize and attach map tools
            try { this.map.updateSize(); } catch {}
            this.mapToolsOrchestrator.attach(this.mapToolsOptions, (extentStr, zoom) =>
                this.stateManager.persistLockedExtent(extentStr, zoom)
            );
            this.stateManager.setPreviousLockMapExtent(this.mapToolsOptions.lockMapExtent);
        } catch (e) {
            this.stateManager.displayWarning('Rendering error', 'roseaMapVizWarning: An unexpected error occurred while rendering. Basemap may still be visible.');
        } finally {
            this.events.renderingFinished(options);
        }
    }

    private updateLegendContainer(): void {
        this.domManager.updateLegendContainer({
            backgroundColor: this.mapToolsOptions.legendBackgroundColor,
            backgroundOpacity: this.mapToolsOptions.legendBackgroundOpacity,
            borderWidth: this.mapToolsOptions.legendBorderWidth,
            borderColor: this.mapToolsOptions.legendBorderColor,
            borderRadius: this.mapToolsOptions.legendBorderRadius,
            marginBottom: this.mapToolsOptions.legendBottomMargin,
            marginTop: this.mapToolsOptions.legendTopMargin,
            marginLeft: this.mapToolsOptions.legendLeftMargin,
            marginRight: this.mapToolsOptions.legendRightMargin,
            position: this.mapToolsOptions.legendPosition
        });
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(
            this.visualFormattingSettingsModel
        );
    }

    public destroy(): void {
        this.map.setTarget(null);
        this.svg.selectAll('*').remove();
        this.domManager.dispose();
    }
}


