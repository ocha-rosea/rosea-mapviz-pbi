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
        } catch { }
    }
}