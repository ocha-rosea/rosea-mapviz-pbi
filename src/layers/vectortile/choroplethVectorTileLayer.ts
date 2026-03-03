"use strict";

import VectorTileLayer from 'ol/layer/VectorTile';
import VectorTileSource from 'ol/source/VectorTile';
import MVT from 'ol/format/MVT';
import { Style, Fill, Stroke } from 'ol/style';
import { FeatureLike } from 'ol/Feature';
import OLMap from 'ol/Map';
import { MapBrowserEvent } from 'ol';
import { fromLonLat } from 'ol/proj';
import powerbi from "powerbi-visuals-api";
import { ChoroplethDataPoint, HighContrastColors } from "../../types";
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISelectionId = powerbi.extensibility.ISelectionId;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

/**
 * Options for the ChoroplethVectorTileLayer.
 */
export interface ChoroplethVectorTileLayerOptions {
    /** Mapbox tileset ID (e.g., 'username.tileset-name') - uses v4 Vector Tiles API */
    tilesetId: string;
    /** Source layer name within the tileset */
    sourceLayer: string;
    /** Property name in tile features to match with data */
    idField: string;
    /** Mapbox access token (public token pk.* works for public tilesets) */
    accessToken: string;
    /** Color scale function to map values to colors */
    colorScale: ((value: number | null | undefined) => string) | string[];
    /** Classification break points (used with array color scales) */
    classBreaks?: number[];
    /** Stroke color for feature boundaries */
    strokeColor: string;
    /** Stroke width in pixels */
    strokeWidth: number;
    /** Fill opacity (0-1) */
    fillOpacity: number;
    /** Data points with tooltip and selection info */
    dataPoints: ChoroplethDataPoint[];
    /** Power BI visual host for tooltip service */
    host: IVisualHost;
    /** Selection manager for cross-filtering */
    selectionManager: ISelectionManager;
    /** Z-index for layer ordering */
    zIndex?: number;
    /** Whether interactions (selection, click) are allowed */
    allowInteractions?: boolean;
    /** Whether high contrast mode is enabled */
    isHighContrast?: boolean;
    /** High contrast colors from Power BI */
    highContrastColors?: HighContrastColors;
    /** Whether map extent is locked (skip fit operations) */
    lockMapExtent?: boolean;
}
const NO_DATA_COLOR = "rgba(0,0,0,0)";

/**
 * Vector tile layer for choropleth visualization using Mapbox styles.
 * 
 * Renders vector tiles from a Mapbox Style URL via OpenLayers, with support for
 * Power BI tooltips and selection. Uses the styles:tiles API which works with
 * public access tokens (pk.*).
 * 
 * Note: The tileset must be added as a layer in a Mapbox Studio style first.
 * Direct tileset access requires secret tokens which don't work in browsers.
 * 
 * @example
 * ```typescript
 * const layer = new ChoroplethVectorTileLayer({
 *     styleUrl: 'mapbox://styles/username/styleId',
 *     sourceLayer: 'my-tileset-layer',
 *     idField: 'iso_3166_1_alpha_3',
 *     accessToken: 'pk.xxx',
 *     colorScale: (v) => colorMap[v],
 *     dataPoints: [...],
 *     host: visualHost,
 *     selectionManager
 * });
 * map.addLayer(layer);
 * layer.attachToMap(map);
 * ```
 */
export class ChoroplethVectorTileLayer extends VectorTileLayer {
    private options: ChoroplethVectorTileLayerOptions;
    private valueLookup: Map<string, number | null | undefined>;
    private tooltipLookup: Map<string, VisualTooltipDataItem[]>;
    private selectionIdLookup: Map<string, ISelectionId>;
    private selectedIds: ISelectionId[] = [];
    private isActive: boolean = true;
    private attachedMap: OLMap | null = null;
    private pointerMoveHandler: ((evt: MapBrowserEvent<PointerEvent>) => void) | null = null;
    private clickHandler: ((evt: MapBrowserEvent<PointerEvent>) => void) | null = null;
    private contextMenuHandler: ((event: MouseEvent) => void) | null = null;
    private colorScaleFn: (value: number | null | undefined) => string;
    private hasFittedExtent: boolean = false;
    private lastFittedExtent: [number, number, number, number] | null = null;
    private lastTooltipTime: number = 0;
    private readonly TOOLTIP_THROTTLE_MS = 50; // Throttle tooltip updates
    private readonly EXTENT_CHANGE_THRESHOLD = 0.05; // 5% change threshold

    /**
     * Builds the tile URL from a Mapbox style URL or tileset ID.
     * 
     * Supports multiple formats:
     * - Tileset ID: username.tilesetname → direct tileset access
     * - Style URL: mapbox://styles/username/styleId → fetches style's vector sources
     * - Custom tile URL with {z}/{x}/{y} placeholders
     * 
     * @param input - Style URL, tileset ID, or custom tile URL
     * @param accessToken - Mapbox access token
     * @returns Full tile URL with {z}/{x}/{y} placeholders
     */
    private static buildTileUrl(input: string, accessToken: string): string {
        const trimmed = input.trim();
        
        // Check if it's already a tile URL template
        if (trimmed.includes('{z}') && trimmed.includes('{x}') && trimmed.includes('{y}')) {
            return trimmed.includes('access_token=') 
                ? trimmed 
                : `${trimmed}${trimmed.includes('?') ? '&' : '?'}access_token=${accessToken}`;
        }

        // Check if it's a tileset ID (format: username.tilesetname or multiple comma-separated)
        // Examples: mapbox.mapbox-streets-v8, ocha-rosea-1.rosea-ipc-combined-areas
        if (/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/.test(trimmed) && !trimmed.includes('://')) {
            // Direct tileset access via v4 API
            return `https://api.mapbox.com/v4/${trimmed}/{z}/{x}/{y}.mvt?access_token=${accessToken}`;
        }

        // Parse mapbox:// style protocol
        const mapboxProtocolMatch = trimmed.match(/^mapbox:\/\/styles\/([^/]+)\/([^/?]+)/);
        if (mapboxProtocolMatch) {
            const [, username, styleId] = mapboxProtocolMatch;
            // Use the style's vector tile endpoint
            // Note: This returns the style's composite vector tiles
            return `https://api.mapbox.com/styles/v1/${username}/${styleId}/tiles/{z}/{x}/{y}?access_token=${accessToken}`;
        }

        // Parse HTTPS style URL
        const httpsMatch = trimmed.match(/api\.mapbox\.com\/styles\/v1\/([^/]+)\/([^/?]+)/);
        if (httpsMatch) {
            const [, username, styleId] = httpsMatch;
            return `https://api.mapbox.com/styles/v1/${username}/${styleId}/tiles/{z}/{x}/{y}?access_token=${accessToken}`;
        }

        throw new Error(`Invalid Mapbox input: ${input}. Use tileset ID (user.tileset) or style URL (mapbox://styles/user/id)`);
    }

    constructor(options: ChoroplethVectorTileLayerOptions) {
        // Build the tile URL from tileset ID
        const tileUrl = ChoroplethVectorTileLayer.buildTileUrl(options.tilesetId, options.accessToken);
        
        // Create the vector tile source with source layer filter for better performance
        const source = new VectorTileSource({
            format: new MVT({
                // Filter to only parse the specific source layer we need
                layers: options.sourceLayer ? [options.sourceLayer] : undefined
            }),
            url: tileUrl
        });

        // Add error handling for tile loading
        source.on('tileloaderror', (event) => {
            console.error('[ChoroplethVectorTileLayer] Tile load error:', event);
        });

        // Call parent constructor
        super({
            source,
            zIndex: options.zIndex ?? 10,
            // Specify declutter if needed
            declutter: false,
        });

        this.options = options;
        
        // Build lookup tables from data points
        this.valueLookup = new Map();
        this.tooltipLookup = new Map();
        this.selectionIdLookup = new Map();
        
        const { dataPoints, colorScale, classBreaks } = options;
        
        // Build lookups from data points
        for (const dp of dataPoints) {
            this.valueLookup.set(dp.pcode, dp.value);
            this.tooltipLookup.set(dp.pcode, dp.tooltip);
            this.selectionIdLookup.set(dp.pcode, dp.selectionId);
        }

        // Create color scale function from array if needed
        if (typeof colorScale === 'function') {
            this.colorScaleFn = colorScale;
        } else {
            // Array color scale - use with class breaks
            this.colorScaleFn = (value: number | null | undefined) => {
                if (value === null || value === undefined || !Number.isFinite(value)) {
                    return NO_DATA_COLOR;
                }
                if (!classBreaks || classBreaks.length === 0) {
                    return colorScale[0] || NO_DATA_COLOR;
                }
                for (let i = 0; i < classBreaks.length; i++) {
                    if (value <= classBreaks[i]) {
                        return colorScale[i] || colorScale[colorScale.length - 1];
                    }
                }
                return colorScale[colorScale.length - 1] || NO_DATA_COLOR;
            };
        }

        // Set style function
        this.setStyle((feature: FeatureLike) => this.styleFeature(feature));
    }

    /**
     * Attaches the layer to a map and sets up interaction handlers.
     * Must be called after the layer is added to the map.
     */
    public attachToMap(map: OLMap): void {
        this.attachedMap = map;
        this.setupInteractions();
        // Only fit to extent if map is not locked
        if (!this.options.lockMapExtent) {
            this.setupFitToExtent(map);
        }
    }

    /**
     * Fetches TileJSON metadata from Mapbox API to get tileset bounds.
     * Uses the v4 TileJSON endpoint: https://api.mapbox.com/v4/{tileset}.json
     */
    private async fetchTilesetBounds(): Promise<[number, number, number, number] | null> {
        try {
            const tilesetId = this.options.tilesetId;
            const accessToken = this.options.accessToken;
            
            // TileJSON endpoint
            const url = `https://api.mapbox.com/v4/${tilesetId}.json?access_token=${accessToken}`;
            
            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`[ChoroplethVectorTileLayer] Failed to fetch TileJSON: ${response.status}`);
                return null;
            }
            
            const tileJson = await response.json();
            
            // TileJSON bounds: [west, south, east, north]
            if (tileJson.bounds && Array.isArray(tileJson.bounds) && tileJson.bounds.length === 4) {
                return tileJson.bounds as [number, number, number, number];
            }
            
            return null;
        } catch (err) {
            console.warn('[ChoroplethVectorTileLayer] Error fetching TileJSON:', err);
            return null;
        }
    }

    /**
     * Sets up fit-to-extent behavior.
     * 
     * Fetches tileset bounds to trigger tile loading, waits for tiles
     * to load, then fits to the extent of filtered data.
     */
    private setupFitToExtent(map: OLMap): void {
        if (this.hasFittedExtent) return;
        
        const source = this.getSource();
        if (!source) return;
        
        // Fetch tileset bounds to set initial view and trigger tile loading
        this.fetchTilesetBounds().then(bounds => {
            if (this.hasFittedExtent) return;
            
            if (bounds) {
                const [west, south, east, north] = bounds;
                const minCoord = fromLonLat([west, south]);
                const maxCoord = fromLonLat([east, north]);
                const tilesetExtent = [minCoord[0], minCoord[1], maxCoord[0], maxCoord[1]];
                
                // Set view to tileset bounds to trigger tile loading (no animation)
                map.getView().fit(tilesetExtent, {
                    duration: 0,
                    padding: [50, 50, 50, 50]
                });
            }
            
            // Wait for tiles to load then fit to filtered extent
            this.waitForTilesAndFit(map);
        });
    }
    
    /**
     * Waits for tiles to finish loading, then fits to filtered data extent.
     */
    private waitForTilesAndFit(map: OLMap): void {
        const source = this.getSource();
        if (!source || this.hasFittedExtent) return;
        
        let loadingCount = 0;
        let checkScheduled = false;
        
        const doFit = () => {
            if (this.hasFittedExtent) return;
            
            const extent = this.calculateFilteredExtent();
            if (extent) {
                this.fitToExtentIfChanged(map, extent);
            }
        };
        
        const scheduleCheck = () => {
            if (checkScheduled) return;
            checkScheduled = true;
            // Small delay to batch multiple tile loads
            setTimeout(() => {
                checkScheduled = false;
                if (loadingCount === 0 && !this.hasFittedExtent) {
                    doFit();
                }
            }, 100);
        };
        
        const onTileLoadStart = () => {
            loadingCount++;
        };
        
        const onTileLoadEnd = () => {
            loadingCount = Math.max(0, loadingCount - 1);
            scheduleCheck();
        };
        
        const onTileLoadError = () => {
            loadingCount = Math.max(0, loadingCount - 1);
            scheduleCheck();
        };
        
        source.on('tileloadstart', onTileLoadStart);
        source.on('tileloadend', onTileLoadEnd);
        source.on('tileloaderror', onTileLoadError);
        
        // Cleanup after fit or timeout
        const cleanup = () => {
            source.un('tileloadstart', onTileLoadStart);
            source.un('tileloadend', onTileLoadEnd);
            source.un('tileloaderror', onTileLoadError);
        };
        
        // Try immediately in case tiles are cached
        setTimeout(() => {
            if (!this.hasFittedExtent) {
                doFit();
            }
            if (this.hasFittedExtent) {
                cleanup();
            }
        }, 200);
        
        // Final timeout - cleanup listeners
        setTimeout(() => {
            cleanup();
            if (!this.hasFittedExtent) {
                doFit();
                this.hasFittedExtent = true; // Mark as done even if no extent found
            }
        }, 2000);
    }
    
    /**
     * Calculates the bounding extent from loaded features that match the filtered data.
     * Only considers features whose ID is in the valueLookup (i.e., filtered data).
     * 
     * @returns The extent [minX, minY, maxX, maxY] or null if no features found
     */
    private calculateFilteredExtent(): [number, number, number, number] | null {
        const source = this.getSource();
        if (!source) return null;
        
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        let foundAny = false;
        
        const map = this.attachedMap;
        if (!map) return null;
        
        const view = map.getView();
        const resolution = view.getResolution();
        if (!resolution) return null;
        
        try {
            // For VectorTileLayer, use getFeaturesInExtent on the LAYER (not source)
            // Use a very large extent to get ALL loaded features, not just visible ones
            // This ensures we calculate extent from all data, not just what's in view
            const worldExtent = [-20037508.34, -20037508.34, 20037508.34, 20037508.34]; // Web Mercator world bounds
            const renderedFeatures = this.getFeaturesInExtent(worldExtent);
            
            for (const feature of renderedFeatures) {
                // Check if feature ID matches our data (filtered or not)
                const id = feature.get(this.options.idField);
                if (id === undefined || id === null) continue;
                
                const idStr = String(id);
                if (!this.valueLookup.has(idStr)) continue;
                
                // Feature is in our data - include in extent
                const geometry = feature.getGeometry();
                if (!geometry) continue;
                
                const featureExtent = geometry.getExtent();
                if (featureExtent && featureExtent.length === 4) {
                    if (isFinite(featureExtent[0]) && isFinite(featureExtent[1]) && 
                        isFinite(featureExtent[2]) && isFinite(featureExtent[3])) {
                        minX = Math.min(minX, featureExtent[0]);
                        minY = Math.min(minY, featureExtent[1]);
                        maxX = Math.max(maxX, featureExtent[2]);
                        maxY = Math.max(maxY, featureExtent[3]);
                        foundAny = true;
                    }
                }
            }
        } catch (err) {
            // If getting features fails, fall back to no extent
            console.warn('[ChoroplethVectorTileLayer] Error calculating filtered extent:', err);
        }
        
        if (!foundAny) return null;
        
        // Validate extent
        if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
            return null;
        }
        
        // Check for degenerate extent (point or line)
        if (minX === maxX) {
            minX -= 1000;
            maxX += 1000;
        }
        if (minY === maxY) {
            minY -= 1000;
            maxY += 1000;
        }
        
        return [minX, minY, maxX, maxY];
    }
    
    /**
     * Checks if two extents are similar enough to skip re-fitting.
     * Returns true if the change is minimal (within threshold).
     */
    private extentsAreSimilar(
        extent1: [number, number, number, number] | null,
        extent2: [number, number, number, number] | null
    ): boolean {
        if (!extent1 || !extent2) return false;
        
        const width1 = extent1[2] - extent1[0];
        const height1 = extent1[3] - extent1[1];
        const width2 = extent2[2] - extent2[0];
        const height2 = extent2[3] - extent2[1];
        
        // Calculate size of each extent
        const size1 = width1 * height1;
        const size2 = width2 * height2;
        
        if (size1 === 0 || size2 === 0) return false;
        
        // Check if size change is within threshold
        const sizeRatio = Math.abs(size1 - size2) / Math.max(size1, size2);
        if (sizeRatio > this.EXTENT_CHANGE_THRESHOLD) return false;
        
        // Check if center moved significantly relative to extent size
        const center1X = (extent1[0] + extent1[2]) / 2;
        const center1Y = (extent1[1] + extent1[3]) / 2;
        const center2X = (extent2[0] + extent2[2]) / 2;
        const center2Y = (extent2[1] + extent2[3]) / 2;
        
        const avgWidth = (width1 + width2) / 2;
        const avgHeight = (height1 + height2) / 2;
        
        const centerShiftX = Math.abs(center1X - center2X) / avgWidth;
        const centerShiftY = Math.abs(center1Y - center2Y) / avgHeight;
        
        if (centerShiftX > this.EXTENT_CHANGE_THRESHOLD || centerShiftY > this.EXTENT_CHANGE_THRESHOLD) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Fits the map to the given extent, but only if it differs significantly
     * from the last fitted extent.
     */
    private fitToExtentIfChanged(map: OLMap, extent: [number, number, number, number]): boolean {
        // Skip if extent is similar to last fitted extent
        if (this.extentsAreSimilar(extent, this.lastFittedExtent)) {
            return false;
        }
        
        this.lastFittedExtent = extent;
        this.hasFittedExtent = true;
        
        map.getView().fit(extent, {
            duration: 0,
            padding: [50, 50, 50, 50],
            maxZoom: 18
        });
        
        return true;
    }

    /**
     * Style function for vector tile features.
     * Maps feature ID to color using the lookup table and color scale.
     * Only features that have matching data are styled; unmatched features are hidden.
     */
    private styleFeature(feature: FeatureLike): Style | undefined {
        if (!this.isActive) return undefined;

        // Get the feature ID from the specified field
        const id = feature.get(this.options.idField);
        if (id === undefined || id === null) {
            return undefined; // No ID field - don't render
        }

        const idStr = String(id);
        
        // Check if this feature has data - if not, don't render it at all
        // This ensures only matched features are visible
        if (!this.valueLookup.has(idStr)) {
            return undefined; // Not in our data - hide completely
        }
        
        const value = this.valueLookup.get(idStr);
        
        // Determine fill color
        let fillColor: string;
        if (this.options.isHighContrast && this.options.highContrastColors) {
            fillColor = this.options.highContrastColors.foreground;
        } else if (value === undefined || value === null || !Number.isFinite(value)) {
            fillColor = NO_DATA_COLOR;
        } else {
            fillColor = this.colorScaleFn(value);
        }

        // Apply selection opacity if there are selected items
        let opacity = this.options.fillOpacity;
        if (this.selectedIds.length > 0) {
            const selectionId = this.selectionIdLookup.get(idStr);
            const isSelected = selectionId && this.selectedIds.some(
                sel => (sel as any).key === (selectionId as any).key
            );
            opacity = isSelected ? this.options.fillOpacity : this.options.fillOpacity * 0.3;
        }

        // Convert hex color to rgba with opacity
        const rgbaFill = this.hexToRgba(fillColor, opacity);

        return new Style({
            fill: new Fill({ color: rgbaFill }),
            stroke: new Stroke({
                color: this.options.strokeColor,
                width: this.options.strokeWidth
            })
        });
    }

    /**
     * Sets up tooltip and selection interaction handlers.
     */
    private setupInteractions(): void {
        const map = this.attachedMap;
        if (!map) return;
        
        const { host, selectionManager, allowInteractions } = this.options;

        // Tooltip on pointer move (throttled for performance)
        this.pointerMoveHandler = (evt: MapBrowserEvent<PointerEvent>) => {
            // Throttle tooltip updates for performance
            const now = Date.now();
            if (now - this.lastTooltipTime < this.TOOLTIP_THROTTLE_MS) {
                return;
            }
            this.lastTooltipTime = now;

            const features = map.getFeaturesAtPixel(evt.pixel, {
                layerFilter: (layer) => layer === this,
                hitTolerance: 2 // Small hit tolerance for better performance
            });

            if (features.length > 0) {
                const feature = features[0];
                const id = String(feature.get(this.options.idField) ?? '');
                const tooltipData = this.tooltipLookup.get(id);

                if (tooltipData && tooltipData.length > 0) {
                    const selectionId = this.selectionIdLookup.get(id);
                    host.tooltipService.show({
                        coordinates: [evt.originalEvent.clientX, evt.originalEvent.clientY],
                        isTouchEvent: false,
                        dataItems: tooltipData,
                        identities: selectionId ? [selectionId] : []
                    });
                } else {
                    host.tooltipService.hide({ immediately: false, isTouchEvent: false });
                }
            } else {
                host.tooltipService.hide({ immediately: false, isTouchEvent: false });
            }
        };
        map.on('pointermove', this.pointerMoveHandler);

        // Selection on click (only if interactions allowed)
        if (allowInteractions !== false) {
            this.clickHandler = (evt: MapBrowserEvent<PointerEvent>) => {
                const features = map.getFeaturesAtPixel(evt.pixel, {
                    layerFilter: (layer) => layer === this,
                    hitTolerance: 2
                });

                if (features.length > 0) {
                    const feature = features[0];
                    const id = String(feature.get(this.options.idField) ?? '');
                    const selectionId = this.selectionIdLookup.get(id);

                    if (selectionId) {
                        const additive = evt.originalEvent.ctrlKey || evt.originalEvent.metaKey;
                        selectionManager.select(selectionId as any, additive)
                            .then((selectedIds: ISelectionId[]) => {
                                this.selectedIds = selectedIds;
                                this.changed(); // Trigger re-render with new selection
                            })
                            .catch(() => {});
                    } else {
                        return;
                    }
                } else {
                    // Click on empty area - clear selection
                    selectionManager.clear().then(() => {
                        this.selectedIds = [];
                        this.changed();
                    });
                }
            };
            map.on('click', this.clickHandler);

            // Context menu (right-click)
            this.contextMenuHandler = (event: MouseEvent) => {
                event.preventDefault();
                const pixel = map.getEventPixel(event);
                const features = map.getFeaturesAtPixel(pixel, {
                    layerFilter: (layer) => layer === this
                });

                if (features.length > 0) {
                    const feature = features[0];
                    const id = String(feature.get(this.options.idField) ?? '');
                    const selectionId = this.selectionIdLookup.get(id);

                    selectionManager.showContextMenu(
                        selectionId ? selectionId : {},
                        { x: event.clientX, y: event.clientY }
                    );
                } else {
                    selectionManager.showContextMenu({}, { x: event.clientX, y: event.clientY });
                }
            };
            map.getTargetElement()?.addEventListener('contextmenu', this.contextMenuHandler);
        }
    }

    /**
     * Updates the data points and refreshes lookups.
     * Triggers a re-fit to extent when data changes significantly.
     */
    public updateData(
        categoryValues: string[],
        measureValues: Array<number | null | undefined>,
        dataPoints: ChoroplethDataPoint[]
    ): void {
        const previousCount = this.valueLookup.size;
        
        this.valueLookup.clear();
        this.tooltipLookup.clear();
        this.selectionIdLookup.clear();

        categoryValues.forEach((pcode, index) => {
            this.valueLookup.set(pcode, measureValues[index]);
        });

        for (const dp of dataPoints) {
            this.tooltipLookup.set(dp.pcode, dp.tooltip);
            this.selectionIdLookup.set(dp.pcode, dp.selectionId);
        }

        this.changed();
        
        // If data count changed significantly, re-fit to extent
        const newCount = this.valueLookup.size;
        if (previousCount !== newCount && this.attachedMap) {
            this.refitToExtent();
        }
    }
    
    /**
     * Triggers a re-fit to the data extent.
     * Call this after data updates to zoom to the new extent.
     * Only fits if the new extent differs significantly from the current extent.
     */
    public refitToExtent(): void {
        if (!this.attachedMap) return;
        
        const map = this.attachedMap;
        
        // Try immediately - tiles should already be loaded
        const extent = this.calculateFilteredExtent();
        if (extent) {
            // Only fit if extent changed significantly
            this.fitToExtentIfChanged(map, extent);
        } else {
            // If no extent found, reset and wait for tiles
            this.hasFittedExtent = false;
            this.waitForTilesAndFit(map);
        }
    }
    
    /**
     * Sets the selected IDs for highlighting.
     * Pass empty array to clear selection.
     */
    public setSelectedIds(ids: ISelectionId[]): void {
        this.selectedIds = ids || [];
        this.changed();
    }

    /**
     * Sets whether the layer is active (visible).
     */
    public setActive(active: boolean): void {
        this.isActive = active;
        this.setVisible(active);
    }

    /**
     * Disposes of the layer and removes event handlers.
     */
    public dispose(): void {
        const map = this.attachedMap;
        if (!map) return;

        if (this.pointerMoveHandler) {
            map.un('pointermove', this.pointerMoveHandler);
            this.pointerMoveHandler = null;
        }

        if (this.clickHandler) {
            map.un('click', this.clickHandler);
            this.clickHandler = null;
        }

        if (this.contextMenuHandler) {
            map.getTargetElement()?.removeEventListener('contextmenu', this.contextMenuHandler);
            this.contextMenuHandler = null;
        }

        // Hide any remaining tooltip
        this.options.host.tooltipService.hide({ immediately: true, isTouchEvent: false });
    }

    /**
     * Converts a hex color to rgba string with opacity.
     */
    private hexToRgba(hex: string, opacity: number): string {
        // Handle rgba already
        if (hex.startsWith('rgba')) return hex;
        if (hex.startsWith('rgb')) {
            // Convert rgb to rgba
            return hex.replace('rgb', 'rgba').replace(')', `, ${opacity})`);
        }
        
        // Handle transparent
        if (hex === 'transparent' || hex === NO_DATA_COLOR) return hex;

        // Parse hex
        let r = 0, g = 0, b = 0;
        if (hex.length === 4) {
            r = parseInt(hex[1] + hex[1], 16);
            g = parseInt(hex[2] + hex[2], 16);
            b = parseInt(hex[3] + hex[3], 16);
        } else if (hex.length === 7) {
            r = parseInt(hex.slice(1, 3), 16);
            g = parseInt(hex.slice(3, 5), 16);
            b = parseInt(hex.slice(5, 7), 16);
        } else {
            return hex; // Return as-is if not recognized
        }

        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
}
