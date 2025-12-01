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
    private svgOverlay: SVGSVGElement;
    private svgContainer: HTMLElement;
    private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private landingPage: HTMLElement | null = null;

    constructor(config: DOMConfig) {
        this.container = config.container;
        this.initializeDOMElements();
    }

    /**
     * Creates all required DOM elements for the visual.
     */
    private initializeDOMElements(): void {
        // Create legend container
        this.legendContainer = this.createLegendContainer();
        this.container.appendChild(this.legendContainer);

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

    /**
     * Creates the SVG overlay element for vector graphics.
     */
    private createSvgOverlay(): SVGSVGElement {
        // Check if one already exists
        const existing = this.container.querySelector('svg') as SVGSVGElement;
        if (existing) {
            return existing;
        }        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
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
     * Clears all SVG content.
     */
    public clearSvg(): void {
        this.svg.selectAll('*').remove();
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
            this.svg.selectAll('*').remove();
            
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

        this.landingPage = document.createElement('div');
        this.landingPage.className = 'rosea-landing-page';

        // Build landing page content using DOM methods (avoid innerHTML for security)
        const content = document.createElement('div');
        content.className = 'landing-content';

        const icon = document.createElement('div');
        icon.className = 'landing-icon';
        // Create inline SVG using DOM methods (Power BI sandbox blocks data URLs for img src)
        const svgNS = 'http://www.w3.org/2000/svg';
        const iconSvg = document.createElementNS(svgNS, 'svg');
        iconSvg.setAttribute('viewBox', '0 0 100 100');
        iconSvg.setAttribute('width', '40');
        iconSvg.setAttribute('height', '40');
        iconSvg.setAttribute('aria-label', 'ROSEA MapViz');
        // ROSEA logo paths (from assets/icon.svg)
        const pathData = [
            'M27.616,19.912c0.008,0.015,0.022,0.021,0.033,0.034c0.01,0.013,0.019,0.022,0.031,0.032c0.044,0.038,0.096,0.064,0.154,0.064c0,0,0,0,0.001,0s0,0,0,0c0.041,0,0.082-0.01,0.12-0.031l5.232-2.857l2.314-1.039l2.709-0.835c0.038-0.012,0.058-0.045,0.085-0.07c0.013-0.012,0.034-0.008,0.044-0.023l0.996-1.39l1.976-0.487c0.008-0.002,0.011-0.011,0.019-0.014c0.048-0.017,0.09-0.045,0.121-0.089c0.004-0.006,0.011-0.009,0.015-0.016c0.001-0.002,0.004-0.003,0.005-0.005l0.593-1.094l1.776-1.881c0,0,0-0.001,0-0.002c0.001,0,0.002,0,0.003-0.001c0.027-0.03,0.028-0.069,0.038-0.105c0.007-0.025,0.027-0.046,0.026-0.073C43.907,9.992,43.88,9.96,43.86,9.925c-0.012-0.021-0.011-0.048-0.03-0.066c0,0-0.001,0-0.001,0c-0.001-0.001,0-0.002-0.001-0.003L43.28,9.356c-0.024-0.022-0.057-0.02-0.086-0.031c-0.027-0.011-0.047-0.034-0.078-0.034l-2.513-0.044c0,0,0,0,0,0l-2.871-0.126c-0.004,0-0.008,0-0.011,0c-0.02,0-0.032,0.016-0.05,0.02c-0.017,0.004-0.034-0.006-0.051,0.001l-3.768,1.672c-0.002,0.001-0.002,0.003-0.004,0.004c-0.032,0.015-0.047,0.048-0.071,0.075c-0.019,0.023-0.047,0.038-0.057,0.066c0,0.002-0.003,0.003-0.004,0.005l-0.489,1.47c-0.009,0.026,0.005,0.049,0.005,0.075c0,0.034-0.005,0.063,0.007,0.093c0.012,0.031,0.036,0.048,0.059,0.072c0.018,0.019,0.024,0.046,0.048,0.059l0.918,0.495l-3.603,2.281c-0.007,0.004-0.007,0.014-0.013,0.019c-0.006,0.004-0.015,0.002-0.021,0.007l-2.956,2.667c-0.002,0.001-0.001,0.004-0.003,0.006c-0.023,0.022-0.027,0.056-0.041,0.085s-0.036,0.055-0.037,0.087c0,0.002-0.002,0.003-0.002,0.006l-0.002,1.405c0,0.022,0.019,0.037,0.024,0.058S27.605,19.893,27.616,19.912z',
            'M96.121,45.363c-0.002-0.018-0.02-0.027-0.025-0.043c-0.01-0.034-0.024-0.058-0.049-0.084c-0.02-0.022-0.039-0.037-0.065-0.051c-0.017-0.009-0.024-0.028-0.044-0.033c-0.017-0.004-0.031,0.007-0.047,0.006c-0.018-0.001-0.03-0.015-0.047-0.014c-0.02,0.002-0.029,0.02-0.047,0.026c-0.03,0.01-0.053,0.022-0.077,0.043c-0.026,0.022-0.042,0.044-0.058,0.074c-0.008,0.016-0.025,0.022-0.031,0.04l-0.646,2.382l-0.775,0.843c-0.004,0.003-0.002,0.009-0.005,0.012c-0.021,0.024-0.021,0.056-0.032,0.086c-0.01,0.032-0.027,0.06-0.023,0.093c0,0.004-0.004,0.008-0.004,0.012l0.359,2.599c0.002,0.012,0.014,0.019,0.017,0.029s-0.005,0.021-0.001,0.031c0.011,0.025,0.033,0.04,0.051,0.061c0.011,0.014,0.018,0.028,0.031,0.039c0.043,0.033,0.094,0.055,0.148,0.056c0,0,0.001,0.001,0.002,0.001l0,0l0,0l0,0c0.012,0,0.022-0.002,0.034-0.003c0.005-0.001,0.007-0.005,0.011-0.007c0.016-0.002,0.033-0.002,0.049-0.009l1.174-0.474c0.014-0.006,0.017-0.021,0.028-0.027c0.031-0.019,0.052-0.041,0.071-0.071c0.017-0.023,0.03-0.042,0.037-0.068c0.004-0.013,0.016-0.02,0.018-0.033l0.31-2.325c0.001-0.011-0.009-0.02-0.009-0.031c0.001-0.011,0.011-0.02,0.01-0.031L96.121,45.363z',
            'M65.085,63.656c0.005,0.033,0.003,0.064,0.02,0.093c0.003,0.005,0,0.011,0.003,0.015l0.662,0.981c0.01,0.015,0.025,0.022,0.038,0.034c0.011,0.011,0.02,0.021,0.032,0.029c0.041,0.027,0.088,0.047,0.137,0.047c0.019,0,0.037-0.002,0.057-0.006l1.543-0.357c0.013-0.002,0.018-0.016,0.029-0.02c0.039-0.016,0.069-0.037,0.097-0.07c0.014-0.016,0.025-0.026,0.034-0.045c0.006-0.011,0.017-0.016,0.021-0.027l0.89-2.602c0.002-0.006-0.003-0.012-0.001-0.018c0.002-0.008,0.009-0.012,0.011-0.02l0.536-2.953c0.005-0.029-0.013-0.054-0.018-0.082c-0.005-0.027,0.006-0.055-0.008-0.08l-0.606-1.143c-0.008-0.016-0.027-0.02-0.039-0.033c-0.02-0.023-0.038-0.037-0.064-0.053c-0.029-0.018-0.056-0.027-0.09-0.031c-0.016-0.002-0.027-0.016-0.043-0.016l-0.27,0.018c-0.002,0-0.002,0.002-0.004,0.003c-0.031,0.003-0.055,0.026-0.083,0.04c-0.03,0.016-0.064,0.021-0.086,0.047c-0.001,0.001-0.003,0.001-0.004,0.002l-1.79,2.186l-0.715,0.666c-0.004,0.003-0.002,0.01-0.006,0.014c-0.022,0.023-0.027,0.055-0.039,0.086c-0.012,0.029-0.029,0.056-0.029,0.088c0,0.005-0.005,0.009-0.004,0.014l0.147,1.938l-0.366,1.147c-0.002,0.005,0.003,0.011,0.002,0.016C65.069,63.595,65.081,63.623,65.085,63.656z',
            'M97.894,43.04c-0.001-0.019-0.007-0.036-0.012-0.054c-0.001-0.004,0.003-0.007,0.001-0.011l-0.264-0.905c-0.316-1.815-0.729-3.623-1.27-5.414c-0.459-1.518-1.002-2.995-1.61-4.435l-0.121-0.415c-0.003-0.012-0.017-0.016-0.021-0.026c-0.006-0.011,0-0.023-0.006-0.034l-0.165-0.271c-1.525-3.438-3.47-6.634-5.751-9.539l-0.107-0.176c-0.006-0.01-0.02-0.011-0.027-0.02s-0.006-0.023-0.014-0.031l-0.148-0.14c-8.436-10.512-21.383-17.09-35.316-17.09c-4.415,0-8.818,0.653-13.085,1.941C16.102,13.624,2.54,38.911,9.745,62.789c5.716,18.943,23.516,32.174,43.285,32.174c0.001,0,0,0,0.001,0c4.413,0,8.814-0.653,13.08-1.94c11.566-3.49,21.082-11.276,26.793-21.924c0.726-1.352,1.377-2.729,1.957-4.128l0.469-0.842c0.005-0.01,0-0.02,0.004-0.029c0.005-0.012,0.018-0.02,0.021-0.032l0.255-1.026c1.062-2.932,1.807-5.943,2.24-8.996l0.11-0.444c0.001-0.001-0.001-0.003-0.001-0.005c0.001-0.002,0.002-0.002,0.003-0.004l0.175-0.832c0.007-0.029-0.011-0.053-0.015-0.081c0-0.002,0.002-0.003,0.002-0.005l-0.018-0.846c0.017-0.184,0.027-0.369,0.042-0.554c0-0.003,0.004-0.005,0.004-0.009l-0.001-0.03c0.238-3.066,0.16-6.158-0.239-9.238L97.894,43.04z'
        ];
        pathData.forEach(d => {
            const path = document.createElementNS(svgNS, 'path');
            path.setAttribute('fill', '#009edb');
            path.setAttribute('d', d);
            iconSvg.appendChild(path);
        });
        icon.appendChild(iconSvg);

        const title = document.createElement('h2');
        title.textContent = 'ROSEA MapViz';

        const description = document.createElement('p');
        description.textContent = 'Custom Power BI Visual for Humanitarian Maps';

        const instructions = document.createElement('div');
        instructions.className = 'landing-instructions';

        const instructionsTitle = document.createElement('h3');
        instructionsTitle.textContent = 'Getting Started';

        const list = document.createElement('ul');

        const item1 = document.createElement('li');
        const item1Strong = document.createElement('strong');
        item1Strong.textContent = 'Choropleth Map:';
        const item1Text = document.createTextNode(' Add ');
        const item1Em1 = document.createElement('em');
        item1Em1.textContent = 'Boundary ID';
        const item1Text2 = document.createTextNode(' and ');
        const item1Em2 = document.createElement('em');
        item1Em2.textContent = 'Choropleth Color';
        const item1Text3 = document.createTextNode(' fields');
        item1.appendChild(item1Strong);
        item1.appendChild(item1Text);
        item1.appendChild(item1Em1);
        item1.appendChild(item1Text2);
        item1.appendChild(item1Em2);
        item1.appendChild(item1Text3);

        const item2 = document.createElement('li');
        const item2Strong = document.createElement('strong');
        item2Strong.textContent = 'Scaled Circles:';
        const item2Text = document.createTextNode(' Add ');
        const item2Em1 = document.createElement('em');
        item2Em1.textContent = 'Longitude';
        const item2Text2 = document.createTextNode(', ');
        const item2Em2 = document.createElement('em');
        item2Em2.textContent = 'Latitude';
        const item2Text3 = document.createTextNode(', and ');
        const item2Em3 = document.createElement('em');
        item2Em3.textContent = 'Circle Size';
        const item2Text4 = document.createTextNode(' fields');
        item2.appendChild(item2Strong);
        item2.appendChild(item2Text);
        item2.appendChild(item2Em1);
        item2.appendChild(item2Text2);
        item2.appendChild(item2Em2);
        item2.appendChild(item2Text3);
        item2.appendChild(item2Em3);
        item2.appendChild(item2Text4);

        list.appendChild(item1);
        list.appendChild(item2);

        const tip = document.createElement('p');
        tip.className = 'landing-tip';
        tip.textContent = '💡 Tip: Configure basemap and styling in the Format pane';

        instructions.appendChild(instructionsTitle);
        instructions.appendChild(list);
        instructions.appendChild(tip);

        content.appendChild(icon);
        content.appendChild(title);
        content.appendChild(description);
        content.appendChild(instructions);

        this.landingPage.appendChild(content);
        this.container.appendChild(this.landingPage);
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