import Map from "ol/Map";
import { MapService } from "../services/MapService";
import { MapToolsOptions } from "../types/index";

/**
 * Orchestrator for map interaction tools and extent locking.
 * 
 * Manages map controls visibility (zoom buttons) and handles extent locking
 * functionality that allows users to persist their map view across data refreshes.
 * 
 * **Lock Map Extent Behavior:**
 * - **Authoring (Desktop)**: Position the map, enable lock → current position is captured ONCE
 * - **Reading (Published)**: Map always restores to locked position on page load
 * - **Temporary navigation**: Users can zoom/pan to explore, but changes are NOT persisted
 * - **Page navigation**: Returning to the page restores the locked position
 * 
 * @example
 * ```typescript
 * const orchestrator = new MapToolsOrchestrator(map, mapService);
 * orchestrator.attach(options, (extent, zoom) => {
 *   // Persist extent and zoom to Power BI properties (only called once when first locking)
 * });
 * ```
 */
export class MapToolsOrchestrator {
  /** OpenLayers map instance */
  private map: Map;
  /** Map service for managing map controls */
  private mapService: MapService;
  /** Current map tools configuration */
  private mapToolsOptions: MapToolsOptions;

  /**
   * Creates a new MapToolsOrchestrator.
   * 
   * @param map - OpenLayers map instance
   * @param mapService - Service for managing map controls and interactions
   */
  constructor(map: Map, mapService: MapService) {
    this.map = map;
    this.mapService = mapService;
  }

  /**
   * Attaches map tools functionality based on the provided options.
   * 
   * Configures zoom control visibility and sets up extent locking if enabled.
   * 
   * **Lock behavior:**
   * - First time lock enabled: Captures current map position and persists it ONCE
   * - Subsequent renders: Restores to the persisted locked position
   * - Users can temporarily zoom/pan to explore, but changes are NOT persisted
   * - Navigating away and back restores the locked position
   * 
   * @param options - Map tools configuration options
   * @param persist - Callback function to persist extent and zoom changes (called only once when first locking)
   */
  public attach(options: MapToolsOptions, persist: (extent: string, zoom: number) => void): void {
    this.mapToolsOptions = options;

    // Toggle zoom control - independent of lockMapExtent
    const zoomVisible = Boolean(this.mapToolsOptions.showZoomControl);
    this.mapService.setZoomControlVisible(zoomVisible);

    if (this.mapToolsOptions.lockMapExtent) {
      // Check if we have a stored extent (previously locked position)
      const hasStoredExtent = 
        typeof this.mapToolsOptions.lockedMapExtent === "string" &&
        this.mapToolsOptions.lockedMapExtent.trim() !== "" &&
        this.mapToolsOptions.lockedMapExtent.split(",").length === 4;
      
      if (!hasStoredExtent) {
        // FIRST TIME LOCKING: Capture current position and persist it ONCE
        // This happens when user enables lock in authoring mode
        const currentExtent = this.map.getView().calculateExtent(this.map.getSize());
        const currentExtentString = currentExtent.join(",");
        const currentZoom = this.map.getView().getZoom();
        
        // Persist the current position - this is the only time we persist while locked
        persist(currentExtentString, currentZoom);
      } else {
        // RESTORE TO LOCKED POSITION: Parse and apply the saved extent/zoom
        // This happens on page load, data refresh, or returning to the page
        const lockedExtent = this.mapToolsOptions.lockedMapExtent
          .split(",")
          .map(Number) as [number, number, number, number];
        
        if (lockedExtent.every(n => !isNaN(n))) {
          // Calculate center from extent
          const center: [number, number] = [
            (lockedExtent[0] + lockedExtent[2]) / 2,
            (lockedExtent[1] + lockedExtent[3]) / 2,
          ];
          
          // Use stored zoom or current zoom as fallback
          const zoom = (
            typeof this.mapToolsOptions.lockedMapZoom === "number" &&
            !isNaN(this.mapToolsOptions.lockedMapZoom)
          ) ? this.mapToolsOptions.lockedMapZoom : this.map.getView().getZoom();
          
          // Restore the saved view
          this.map.getView().setCenter(center);
          this.map.getView().setZoom(zoom);
        }
      }
      // NOTE: No postrender handler - we don't persist pan/zoom changes while locked
      // Users can explore temporarily, but the locked position remains unchanged
    }
    // NOTE: When lock is disabled, we don't need to do anything special
    // The normal fit-to-data behavior will take over
  }

  /**
   * Detaches map tools functionality and cleans up event handlers.
   * 
   * @deprecated No longer needed as we don't attach event handlers anymore.
   * Kept for API compatibility.
   */
  public detach(): void {
    // No-op - we no longer use event handlers for extent locking
  }
}
