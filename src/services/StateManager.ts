/**
 * State Manager Service
 * 
 * Handles state persistence for the visual including:
 * - Map extent locking
 * - Property persistence to Power BI
 * - Debug settings management
 */

import powerbi from "powerbi-visuals-api";
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import { VisualObjectNames, VisualObjectProps } from "../constants/strings";

/**
 * Configuration for initializing the StateManager.
 */
export interface StateManagerConfig {
    /** Power BI visual host for property persistence */
    host: IVisualHost;
}

/**
 * Manages state persistence and debug settings for the visual.
 */
export class StateManager {
    private host: IVisualHost;
    private previousLockMapExtent: boolean | undefined;

    constructor(config: StateManagerConfig) {
        this.host = config.host;
        this.initializeDebugSettings();
    }

    /**
     * Initializes debug settings based on localStorage or URL query parameters.
     * Enables cache debugging when:
     * - localStorage has 'roseamapviz:debugCache' set to '1'
     * - URL contains '?debugCache=1' query parameter
     */
    private initializeDebugSettings(): void {
        try {
            const already = (globalThis as any).__ROSEA_MAPVIZ_DEBUG_CACHE__ === true;
            const byLocalStorage = typeof localStorage !== 'undefined' && 
                localStorage.getItem('roseamapviz:debugCache') === '1';
            const byQuery = typeof location !== 'undefined' && 
                /(^|[?&])debugCache=1(&|$)/.test(location.search || '');
            
            if (!already && (byLocalStorage || byQuery)) {
                (globalThis as any).__ROSEA_MAPVIZ_DEBUG_CACHE__ = true;
            }
        } catch { 
            /* ignore - may fail in restricted environments */ 
        }
    }

    /**
     * Persists the current map extent as the locked extent.
     * @param extentString - The extent as a comma-separated string "minX,minY,maxX,maxY"
     * @param zoom - The current zoom level
     */
    public persistLockedExtent(extentString: string, zoom: number): void {
        this.host.persistProperties({
            merge: [{
                objectName: VisualObjectNames.MapTools,
                properties: { 
                    [VisualObjectProps.LockedMapExtent]: extentString, 
                    [VisualObjectProps.LockedMapZoom]: zoom 
                },
                selector: null
            }]
        });
    }

    /**
     * Gets the previous lock map extent state.
     */
    public getPreviousLockMapExtent(): boolean | undefined {
        return this.previousLockMapExtent;
    }

    /**
     * Sets the previous lock map extent state.
     */
    public setPreviousLockMapExtent(value: boolean | undefined): void {
        this.previousLockMapExtent = value;
    }

    /**
     * Displays a warning icon via the Power BI host.
     * @param title - Warning title
     * @param message - Warning message
     */
    public displayWarning(title: string, message: string): void {
        try {
            this.host.displayWarningIcon(title, message);
        } catch {
            /* ignore - may fail in test environments */
        }
    }

    /**
     * Gets the Power BI host reference.
     * Useful for services that need direct host access.
     */
    public getHost(): IVisualHost {
        return this.host;
    }
}
