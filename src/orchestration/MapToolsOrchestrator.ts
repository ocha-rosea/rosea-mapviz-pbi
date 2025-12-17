import Map from "ol/Map";
import { VisualConfig } from "../config/VisualConfig";
import { MapService } from "../services/MapService";
import { MapToolsOptions } from "../types/index";

/**
 * Orchestrator for map interaction tools and extent locking.
 * 
 * Manages map controls visibility (zoom buttons) and handles extent locking
 * functionality that allows users to persist their map view across data refreshes.
 * 
 * @example
 * ```typescript
 * const orchestrator = new MapToolsOrchestrator(map, mapService);
 * orchestrator.attach(options, (extent, zoom) => {
 *   // Persist extent and zoom to Power BI properties
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
  /** Handler for map postrender events (extent persistence) */
  private postRenderHandler?: (e: any) => void;
  /** Debounce timer for extent persistence */
  private postRenderDebounce?: number;

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
   * When extent is locked, the map view will be restored to the saved position
   * and any changes will be persisted via the callback.
   * 
   * @param options - Map tools configuration options
   * @param persist - Callback function to persist extent and zoom changes
   */
  public attach(options: MapToolsOptions, persist: (extent: string, zoom: number) => void): void {
    this.mapToolsOptions = options;

    // Toggle zoom control
    const zoomVisible = this.mapToolsOptions.lockMapExtent ? false : Boolean(this.mapToolsOptions.showZoomControl);
    this.mapService.setZoomControlVisible(zoomVisible);
    this.mapToolsOptions.showZoomControl = zoomVisible;

    if (this.mapToolsOptions.lockMapExtent) {
      if (!this.postRenderHandler) {
        this.postRenderHandler = () => {
          if (this.postRenderDebounce) {
            window.clearTimeout(this.postRenderDebounce);
          }
          this.postRenderDebounce = window.setTimeout(() => {
            const currentExtent = this.map.getView().calculateExtent(this.map.getSize());
            const currentExtentString = currentExtent.join(",");
            const currentZoom = this.map.getView().getZoom();
            if (
              currentExtentString !== this.mapToolsOptions.lockedMapExtent ||
              currentZoom !== this.mapToolsOptions.lockedMapZoom
            ) {
              persist(currentExtentString, currentZoom);
            }
          }, VisualConfig.MAP.POSTRENDER_DEBOUNCE_MS);
        };
        this.map.on("postrender", this.postRenderHandler);
      }

      let lockedExtent: [number, number, number, number] | undefined = undefined;
      if (
        typeof this.mapToolsOptions.lockedMapExtent === "string" &&
        this.mapToolsOptions.lockedMapExtent.trim() !== ""
      ) {
        lockedExtent = this.mapToolsOptions.lockedMapExtent
          .split(",")
          .map(Number) as [number, number, number, number];
      }
      if (this.mapToolsOptions.lockMapExtent === true && lockedExtent && lockedExtent.length === 4) {
        const center: [number, number] = [
          (lockedExtent[0] + lockedExtent[2]) / 2,
          (lockedExtent[1] + lockedExtent[3]) / 2,
        ];
        let zoom = this.map.getView().getZoom();
        if (
          typeof this.mapToolsOptions.lockedMapZoom === "number" &&
          !isNaN(this.mapToolsOptions.lockedMapZoom)
        ) {
          zoom = this.mapToolsOptions.lockedMapZoom;
        }
        this.mapService.lockExtent(lockedExtent, center, zoom);
        const fitPadding: [number, number, number, number] = [
          this.mapToolsOptions.mapFitPaddingTop,
          this.mapToolsOptions.mapFitPaddingRight,
          this.mapToolsOptions.mapFitPaddingBottom,
          this.mapToolsOptions.mapFitPaddingLeft
        ];
        this.map.getView().fit(lockedExtent, { padding: fitPadding, duration: 0 });
      }
    } else {
      this.detach();
      this.map.getView().setProperties({ extent: undefined, minZoom: 0, maxZoom: 28 });
    }
  }

  /**
   * Detaches map tools functionality and cleans up event handlers.
   * 
   * Should be called when extent locking is disabled or when the visual is destroyed.
   */
  public detach(): void {
    if (this.postRenderHandler) {
      this.map.un("postrender", this.postRenderHandler);
      this.postRenderHandler = undefined;
      if (this.postRenderDebounce) {
        window.clearTimeout(this.postRenderDebounce);
        this.postRenderDebounce = undefined;
      }
    }
  }
}
