import Map from "ol/Map";
import View from "ol/View";
import { fromLonLat } from "ol/proj";
import { defaults as defaultControls } from "ol/control";
import { VisualConfig } from "../config/VisualConfig";
import { MapState } from "../types/index";
import { MaplyticsAttributionControl } from "../utils/attribution";
import TileLayer from "ol/layer/Tile";
import { MapboxVectorLayer } from "ol-mapbox-style";
import { BasemapOptions } from "../types/index";
import { BasemapNames } from "../constants/strings";
import OSM from "ol/source/OSM";
import TileJSON from "ol/source/TileJSON";
import Tile from "ol/layer/Tile";
import VectorTileSource from "ol/source/VectorTile";
import VectorTileLayer from "ol/layer/VectorTile";
import Zoom from "ol/control/Zoom";
import { ZoomControlManager } from "./ZoomControlManager";
import { defaults as defaultInteractions } from 'ol/interaction';


/**
 * Service responsible for managing the OpenLayers map instance.
 * Handles basemap configuration, view state, and map controls.
 * 
 * @example
 * ```typescript
 * const mapService = new MapService(container, true, host);
 * mapService.updateBasemap(basemapOptions);
 * const olMap = mapService.getMap();
 * ```
 */
export class MapService {
    private map: Map;
    private state: MapState;
    private container: HTMLElement;
    private attributionControl: MaplyticsAttributionControl;
    private showZoomControl: boolean;
    private zoomControlManager: ZoomControlManager;
    private host: any; // Add host property for debugging
    private view: View;

    /**
     * Creates a new MapService instance.
     * @param container - The HTML element to render the map into
     * @param showZoomControl - Whether to display zoom controls (default: true)
     * @param host - Optional Power BI visual host for debugging
     */
    constructor(container: HTMLElement, showZoomControl: boolean = true, host?: any) {

        this.container = container;
        this.showZoomControl = showZoomControl;
        this.host = host;
        this.view = new View({
            center: fromLonLat(VisualConfig.MAP.DEFAULT_CENTER),
            zoom: VisualConfig.MAP.DEFAULT_ZOOM
        });
        this.initializeMap();
        this.zoomControlManager = new ZoomControlManager(this.map);
        this.setZoomControlVisible(this.showZoomControl);
        
    }

    private initializeMap(): void {
        const controls = defaultControls({
            zoom: false, // Disable default zoom control
            attribution: false,
            attributionOptions: {
                collapsible: false, // Keep the attribution always visible
            },
        });

        this.map = new Map({
            target: this.container,
            layers: [],
            view: this.view,
            controls: controls
        });

        this.state = {
            basemapType: "",
            attribution: "",
            mapboxStyle: "",
            maptilerStyle: "",
            view: null,
            extent: null,
            zoom: null,
            interactions: controls
        };
    }

    /**
     * Updates the basemap layer based on the provided options.
     * Handles Mapbox, MapTiler, OpenStreetMap, and custom basemap sources.
     * @param options - Basemap configuration options including style and attribution
     */
    public updateBasemap(options: any): void {
        
        const { selectedBasemap, customMapAttribution } = options;

        // Get default attribution
        const defaultAttribution = VisualConfig.BASEMAP.DEFAULT_ATTRIBUTION[selectedBasemap] || "";

        // Compute effective attribution
        const newAttribution = customMapAttribution
            ? `${customMapAttribution} ${defaultAttribution}`
            : defaultAttribution;

        // Check if update is needed
        if (
            selectedBasemap === this.state.basemapType &&
            newAttribution === this.state.attribution &&
            options.mapboxStyle === this.state.mapboxStyle &&
            options.maptilerStyle === this.state.maptilerStyle
        ) {
            return;
        }

        // Update state
        this.state.basemapType = selectedBasemap;
        this.state.attribution = newAttribution;
        this.state.mapboxStyle = options.mapboxStyle;
        this.state.maptilerStyle = options.maptilerStyle;

        // Update attribution control
        if (this.attributionControl) {
            this.map.removeControl(this.attributionControl);
        }
        this.attributionControl = new MaplyticsAttributionControl({ attribution: newAttribution });
        this.map.addControl(this.attributionControl);

        // Update basemap layer
        const newLayer = this.getBasemap(options);
        try {
            if (newLayer) {
                newLayer.getSource()?.setAttributions(newAttribution);
                const layers = this.map.getLayers();
                const len = layers.getLength?.() ?? (layers.getArray ? layers.getArray().length : 0);
                if (len === 0) {
                    // Insert when there are no existing layers
                    try { (layers as any).insertAt(0, newLayer); } catch { /* no-op */ }
                } else {
                    // Replace existing base layer at index 0
                    try { layers.setAt(0, newLayer); } catch { /* no-op */ }
                }
                // Basemap updated (debug logging intentionally suppressed)
            }
        } catch (e) {
            // Defensive: don't throw from basemap update (logging removed)
        }
    }

    /**
     * Returns the underlying OpenLayers Map instance.
     * @returns The OpenLayers Map object
     */
    public getMap(): Map {
        return this.map;
    }

    /**
     * Returns the map's View instance for controlling center, zoom, and extent.
     * @returns The OpenLayers View object
     */
    public getView(): View {
        return this.view;
    }

    /**
     * Returns the current map state including basemap type and attribution.
     * @returns Current MapState object
     */
    public getState(): MapState {
        return this.state;
    }

    /**
     * Updates the map state with new values.
     * @param newState - Partial MapState to merge with current state
     */
    public setState(newState: Partial<MapState>): void {
        this.state = { ...this.state, ...newState };
    }

    /**
     * Cleans up map resources and removes the map from the DOM.
     * Should be called when the visual is destroyed.
     */
    public destroy(): void {
        if (this.map) {
            this.map.setTarget(null);
        }
    }

    public setZoomControlVisible(visible: boolean) {
        
        this.zoomControlManager.setZoomControlVisible(visible);
        this.showZoomControl = visible;
    }

    private getBasemap(basemapOptions: BasemapOptions): TileLayer | MapboxVectorLayer | VectorTileLayer {

        switch (basemapOptions.selectedBasemap) {
            case BasemapNames.OpenStreetMap:
                return this.getDefaultBasemap();
            case BasemapNames.Mapbox:
                return this.getMapboxBasemap(basemapOptions);
            case BasemapNames.MapTiler:
                return this.getMaptilerBasemap(basemapOptions);
            case BasemapNames.None:
                return new TileLayer({
                    source: null, // No source, so it remains empty
                    visible: false
                });
            default:
                return this.getDefaultBasemap(); // fallback to default basemap
        }

    }


    private getDefaultBasemap = (): TileLayer => {
        return new TileLayer({
            source: new OSM() // Default basemap source
        })
    };

    private getMapboxBasemap = (basemapOptions: BasemapOptions): MapboxVectorLayer => {
        if (basemapOptions.mapboxStyle === 'custom' && basemapOptions.mapboxCustomStyleUrl.startsWith('mapbox://')) {
           
            return new MapboxVectorLayer({
                styleUrl: basemapOptions.mapboxCustomStyleUrl,
                accessToken: basemapOptions.mapboxAccessToken,
                declutter: basemapOptions.declutterLabels
            });

        } else {

            return new MapboxVectorLayer({
                styleUrl: basemapOptions.mapboxStyle,
                accessToken: basemapOptions.mapboxAccessToken,
                declutter: basemapOptions.declutterLabels
            });
        }
    };

    private getMaptilerBasemap = (basemapOptions: BasemapOptions): TileLayer | VectorTileLayer | MapboxVectorLayer => {

        const url = `${VisualConfig.MAP_BASE_URL.MAPTILER}/${basemapOptions.maptilerStyle}/tiles.json?key=${basemapOptions.maptilerApiKey}`;

        return new Tile({
            source: new TileJSON({
                url: url,
                crossOrigin: "anonymous"
            })
        });

    };

    /**
     * Locks the map extent to the given bounding box and sets center/zoom, constraining zoom/pan within the extent.
     * @param extent [minX, minY, maxX, maxY] in map projection
     * @param center Center coordinate in map projection (optional)
     * @param zoom Zoom level (optional)
     */
    public lockExtent(extent: [number, number, number, number], center?: [number, number], zoom?: number) {
        if (this.view) {
            // Set extent
            //this.view.setProperties({ extent });
            // Calculate minZoom that fits the extent
            const size = this.map.getSize();
            if (size) {
                const resolution = this.view.getResolutionForExtent(extent, size);
                if (resolution) {
                    const minZoom = this.view.getZoomForResolution(resolution);
                    // Always set minZoom to the provided zoom if available
                    if (typeof zoom === 'number') {
                        this.view.setMinZoom(zoom);
                    } else {
                        this.view.setMinZoom(minZoom);
                    }
                }
            }
            // Set maxZoom to provided zoom or current
            if (typeof zoom === 'number') {
                this.view.setMaxZoom(zoom);
                this.view.setZoom(zoom);
            } else {
                this.view.setMaxZoom(this.view.getZoom());
            }
            // Set center if provided
            if (center) {
                this.view.setCenter(center);
            }

            this.setState({
            extent: extent,
            zoom: typeof zoom === 'number' ? zoom : this.view.getZoom()
        });
        }
    }

   
}