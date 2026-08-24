/**
 * DOM Manager Service
 * 
 * Handles creation and management of DOM elements for the visual including:
 * - Legend container creation and positioning
 * - SVG overlay creation
 * - Overlay visibility management
 */

import * as d3 from "d3";
import { DomIds, LegendPositions } from "../constants/strings";
import { MAPVIZ_LOGO_PATHS, MAPVIZ_LOGO_VIEWBOX, MAPVIZ_LOGO_FILL } from "../assets/roseaLogo";
import type { LocalizationService } from "./LocalizationService";

/**
 * Overlay groups owned by this visual. Clearing is scoped to these so unrelated
 * SVG content in the container is never removed.
 */
const OVERLAY_GROUP_SELECTORS = [
    `#${DomIds.ChoroplethGroup}`,
    `#${DomIds.CirclesGroup1}`,
    `#${DomIds.CirclesGroup2}`,
    `#${DomIds.CircleLabelsGroup}`,
    '#choropleth-hitlayer',
    '#circles-hitlayer'
];

/**
 * Configuration for creating the visual's DOM structure.
 */
export interface DOMConfig {
    /** The root container element provided by Power BI */
    container: HTMLElement;
}

/**
 * References to all DOM elements created by the manager.
 */
export interface DOMElements {
    /** Container for legend elements */
    legendContainer: HTMLElement;
    /** Button used to trigger map export */
    exportButton: HTMLButtonElement;
    /** SVG element for vector overlays */
    svgOverlay: SVGSVGElement;
    /** Container that holds overlay elements (SVG and canvases) */
    svgContainer: HTMLElement;
    /** D3 selection wrapping the SVG overlay */
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
}

/**
 * Configuration for legend container positioning and styling.
 */
export interface LegendPositionConfig {
    backgroundColor: string;
    backgroundOpacity: number;
    borderWidth: number;
    borderColor: string;
    borderRadius: number;
    marginBottom: number;
    marginTop: number;
    marginLeft: number;
    marginRight: number;
    position: string;
}

/**
 * Manages DOM element creation and manipulation for the visual.
 * Centralizes all DOM operations to reduce complexity in visual.ts.
 */
export class DOMManager {
    private container: HTMLElement;
    private legendContainer: HTMLElement;
    private exportButton: HTMLButtonElement;
    private svgOverlay: SVGSVGElement;
    private svgContainer: HTMLElement;
    private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private landingPage: HTMLElement | null = null;
    private localizationService: LocalizationService | null = null;

    constructor(config: DOMConfig) {
        this.container = config.container;
        this.initializeDOMElements();
    }

    /**
     * Sets the localization service for localized content.
     */
    public setLocalizationService(service: LocalizationService): void {
        this.localizationService = service;
    }

    /**
     * Creates all required DOM elements for the visual.
     */
    private initializeDOMElements(): void {
        // Create legend container
        this.legendContainer = this.createLegendContainer();
        this.container.appendChild(this.legendContainer);

        this.exportButton = this.createExportButton();
        this.container.appendChild(this.exportButton);

        // Create SVG overlay
        this.svgOverlay = this.createSvgOverlay();
        this.svg = d3.select(this.svgOverlay);

        // Create SVG container (holds SVG and canvases)
        this.svgContainer = this.createSvgContainer();
        this.svgContainer.appendChild(this.svgOverlay);

        // Mount containers to DOM
        if (!this.container.contains(this.svgContainer)) {
            this.container.appendChild(this.svgContainer);
        }
        if (!this.legendContainer.parentElement) {
            this.container.appendChild(this.legendContainer);
        }
        if (!this.exportButton.parentElement) {
            this.container.appendChild(this.exportButton);
        }
    }

    /**
     * Creates the legend container element.
     */
    private createLegendContainer(): HTMLElement {
        const container = document.createElement("div");
        container.setAttribute("id", DomIds.LegendContainer);
        container.style.position = "absolute";
        container.style.zIndex = "1000";
        container.style.display = "none";
        container.style.pointerEvents = 'none';
        return container;
    }

    private createExportButton(): HTMLButtonElement {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "rosea-map-export-button";
        button.title = "Export map";
        button.setAttribute("aria-label", "Export map");

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");

        const arrowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        arrowPath.setAttribute("d", "M12 3v10.6l3.3-3.3 1.4 1.4L12 16.4l-4.7-4.7 1.4-1.4 3.3 3.3V3h2z");

        const trayPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        trayPath.setAttribute("d", "M5 19h14v-4h2v6H3v-6h2v4z");

        svg.appendChild(arrowPath);
        svg.appendChild(trayPath);
        button.appendChild(svg);
        return button;
    }

    /**
     * Creates the SVG overlay element for vector graphics.
     */
    private createSvgOverlay(): SVGSVGElement {
        // Always build a dedicated overlay. Reusing whatever `svg` the container
        // already held would adopt unrelated inline icons such as the export button.
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = DomIds.SvgOverlay;
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.pointerEvents = 'none';
        return svg;
    }

    /**
     * Creates the container that holds overlay elements.
     */
    private createSvgContainer(): HTMLElement {
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '100';
        return container;
    }

    /**
     * Gets all DOM element references.
     */
    public getElements(): DOMElements {
        return {
            legendContainer: this.legendContainer,
            exportButton: this.exportButton,
            svgOverlay: this.svgOverlay,
            svgContainer: this.svgContainer,
            svg: this.svg
        };
    }

    /**
     * Converts a hex color to rgba with the specified opacity.
     */
    private hexToRgba(hex: string, opacity: number): string {
        // Remove # if present
        hex = hex.replace('#', '');
        
        // Parse hex values
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    /**
     * Updates the legend container's styling and position based on config.
     * @param config - Configuration for legend positioning and styling
     */
    public updateLegendContainer(config: LegendPositionConfig): void {
        // Background color with opacity
        const rgbaColor = this.hexToRgba(config.backgroundColor, config.backgroundOpacity);
        this.legendContainer.style.backgroundColor = rgbaColor;

        // Border styling
        this.legendContainer.style.border = `${config.borderWidth}px solid ${config.borderColor}`;
        this.legendContainer.style.borderRadius = `${config.borderRadius}px`;

        // Margins
        this.legendContainer.style.marginBottom = `${config.marginBottom}px`;
        this.legendContainer.style.marginTop = `${config.marginTop}px`;
        this.legendContainer.style.marginLeft = `${config.marginLeft}px`;
        this.legendContainer.style.marginRight = `${config.marginRight}px`;

        // Reset all positioning properties first
        this.legendContainer.style.top = 'auto';
        this.legendContainer.style.right = 'auto';
        this.legendContainer.style.bottom = 'auto';
        this.legendContainer.style.left = 'auto';
        this.legendContainer.style.transform = 'none';

        // Set position based on option
        this.applyLegendPosition(config.position);
    }

    /**
     * Applies the legend position based on the position setting.
     */
    private applyLegendPosition(position: string): void {
        switch (position) {
            case LegendPositions.TopRight:
                this.legendContainer.style.top = '10px';
                this.legendContainer.style.right = '10px';
                break;
            case LegendPositions.TopLeft:
                this.legendContainer.style.top = '10px';
                this.legendContainer.style.left = '10px';
                break;
            case LegendPositions.BottomRight:
                this.legendContainer.style.bottom = '10px';
                this.legendContainer.style.right = '10px';
                break;
            case LegendPositions.TopCenter:
                this.legendContainer.style.top = '10px';
                this.legendContainer.style.left = '50%';
                this.legendContainer.style.transform = 'translateX(-50%)';
                break;
            case LegendPositions.BottomCenter:
                this.legendContainer.style.bottom = '10px';
                this.legendContainer.style.left = '50%';
                this.legendContainer.style.transform = 'translateX(-50%)';
                break;
            default: // bottom-left (default)
                this.legendContainer.style.bottom = '10px';
                this.legendContainer.style.left = '10px';
                break;
        }
    }

    /**
     * Updates the visibility of the SVG overlay based on layer content.
     * @param choroplethLayer - The choropleth layer (if any)
     * @param circleLayer - The circle layer (if any)
     */
    public updateOverlayVisibility(choroplethLayer: any, circleLayer: any): void {
        try {
            // Check if layers have visible features
            const choroplethHasFeatures = !!choroplethLayer && 
                typeof choroplethLayer.getFeaturesExtent === 'function' && 
                choroplethLayer.getFeaturesExtent?.();
            
            const circleHasFeatures = !!circleLayer && 
                typeof circleLayer.getFeaturesExtent === 'function' && 
                circleLayer.getFeaturesExtent?.();

            // Also check for canvas elements
            const hasChoroplethCanvas = !!this.svgContainer.querySelector('#choropleth-canvas');
            const hasCirclesCanvas = !!this.svgContainer.querySelector('#circles-canvas');

            const shouldShow = !!choroplethHasFeatures || !!circleHasFeatures || 
                               hasChoroplethCanvas || hasCirclesCanvas;
            
            this.svgOverlay.style.display = shouldShow ? 'block' : 'none';
        } catch (e) {
            try { 
                this.svgOverlay.style.display = 'none'; 
            } catch { }
        }
    }

    /**
     * Shows or hides the legend container.
     */
    public setLegendVisible(visible: boolean): void {
        this.legendContainer.style.display = visible ? 'block' : 'none';
    }

    /**
     * Removes the overlay groups this visual owns, leaving any other overlay
     * content (and the surrounding DOM) untouched.
     */
    public clearOverlayGroups(): void {
        OVERLAY_GROUP_SELECTORS.forEach(selector => {
            try { this.svg.selectAll(selector).remove(); } catch { }
        });
    }

    /**
     * Clears the visual's SVG content and hides the overlay.
     */
    public clearSvg(): void {
        this.clearOverlayGroups();
        this.svgOverlay.style.display = 'none';
    }

    /**
     * Removes a canvas element by ID from the SVG container.
     */
    public removeCanvas(canvasId: string): void {
        try {
            const el = this.svgContainer.querySelector(`#${canvasId}`);
            if (el && el.parentElement) {
                el.parentElement.removeChild(el);
            }
        } catch { }
    }

    /**
     * Removes SVG elements by selector.
     */
    public removeSvgElements(selector: string): void {
        try {
            this.svg.select(selector).remove();
        } catch { }
    }

    /**
     * Gets a D3 selection for a specific SVG group.
     */
    public getSvgGroup(groupId: string): d3.Selection<d3.BaseType, unknown, null, undefined> {
        return this.svg.select(`#${groupId}`);
    }

    /**
     * Cleans up DOM elements and releases references.
     */
    public dispose(): void {
        try {
            // Clear SVG content
            this.clearOverlayGroups();
            
            // Remove containers from DOM
            if (this.legendContainer.parentElement) {
                this.legendContainer.parentElement.removeChild(this.legendContainer);
            }
            if (this.svgContainer.parentElement) {
                this.svgContainer.parentElement.removeChild(this.svgContainer);
            }
            
            // Remove landing page if present
            this.hideLandingPage();
        } catch { }
    }

    /**
     * Shows the landing page with instructions when no data is provided.
     */
    public showLandingPage(): void {
        if (this.landingPage) return; // Already showing

        const ls = this.localizationService;
        const roleName = (key: string, fallback: string) => ls?.get(key) || fallback;

        this.landingPage = document.createElement('div');
        this.landingPage.className = 'rosea-landing-page';

        const content = document.createElement('div');
        content.className = 'landing-content';
        content.appendChild(this.createLandingIcon());

        const title = document.createElement('h2');
        title.textContent = ls?.getLandingTitle() || 'ROSEA MapViz';

        const description = document.createElement('p');
        description.className = 'landing-description';
        description.textContent = ls?.getLandingDescription() || 'Custom Power BI Visual for Humanitarian Maps';

        const instructions = document.createElement('div');
        instructions.className = 'landing-instructions';

        const instructionsTitle = document.createElement('h3');
        instructionsTitle.textContent = ls?.getLandingGettingStarted() || 'Getting Started';
        instructions.appendChild(instructionsTitle);

        const recipes = [
            {
                label: ls?.getLandingChoroplethMap() || 'Choropleth Map:',
                hint: ls?.getLandingChoroplethInstructions() || 'Add Boundary ID and Choropleth Color fields',
                fields: [
                    roleName('Role_BoundaryID', 'Boundary ID'),
                    roleName('Role_ChoroplethColor', 'Choropleth Color')
                ]
            },
            {
                label: ls?.getLandingScaledCircles() || 'Scaled Circles:',
                hint: ls?.getLandingScaledCirclesInstructions() || 'Add Longitude, Latitude, and Circle Size fields',
                fields: [
                    roleName('Role_Longitude', 'Longitude'),
                    roleName('Role_Latitude', 'Latitude'),
                    roleName('Role_CircleSize', 'Circle Size')
                ]
            }
        ];

        const list = document.createElement('ul');
        recipes.forEach(recipe => list.appendChild(this.createLandingRecipe(recipe)));
        instructions.appendChild(list);

        const tip = document.createElement('p');
        tip.className = 'landing-tip';
        tip.textContent = ls?.getLandingTip() || 'Tip: Configure basemap and styling in the Format pane';
        instructions.appendChild(tip);

        content.appendChild(title);
        content.appendChild(description);
        content.appendChild(instructions);

        this.landingPage.appendChild(content);
        this.container.appendChild(this.landingPage);
    }

    /**
     * Builds the inline logo shown on the landing page.
     * Power BI's sandbox blocks data URLs for img src, so the logo is inlined as SVG.
     */
    private createLandingIcon(): HTMLElement {
        const icon = document.createElement('div');
        icon.className = 'landing-icon';

        const svgNS = 'http://www.w3.org/2000/svg';
        const iconSvg = document.createElementNS(svgNS, 'svg');
        iconSvg.setAttribute('viewBox', MAPVIZ_LOGO_VIEWBOX);
        iconSvg.setAttribute('aria-label', 'ROSEA MapViz');
        MAPVIZ_LOGO_PATHS.forEach(pathData => {
            const path = document.createElementNS(svgNS, 'path');
            path.setAttribute('fill', MAPVIZ_LOGO_FILL);
            path.setAttribute('d', pathData);
            iconSvg.appendChild(path);
        });
        icon.appendChild(iconSvg);
        return icon;
    }

    /**
     * Builds one "how to build this map" row: a localized sentence plus the
     * data role names rendered as field chips.
     */
    private createLandingRecipe(recipe: { label: string; hint: string; fields: string[] }): HTMLLIElement {
        const item = document.createElement('li');

        const label = document.createElement('strong');
        label.textContent = recipe.label;

        const hint = document.createElement('span');
        hint.className = 'landing-hint';
        hint.textContent = recipe.hint;

        const fields = document.createElement('span');
        fields.className = 'landing-fields';
        recipe.fields.forEach(fieldName => {
            const chip = document.createElement('em');
            chip.textContent = fieldName;
            fields.appendChild(chip);
        });

        item.appendChild(label);
        item.appendChild(hint);
        item.appendChild(fields);
        return item;
    }

    /**
     * Hides the landing page.
     */
    public hideLandingPage(): void {
        if (this.landingPage && this.landingPage.parentElement) {
            this.landingPage.parentElement.removeChild(this.landingPage);
            this.landingPage = null;
        }
    }

    /**
     * Returns whether the landing page is currently shown.
     */
    public isLandingPageShown(): boolean {
        return this.landingPage !== null;
    }
}