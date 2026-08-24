import type { Options as OlLayerOptions } from 'ol/layer/Layer';
import type { LayerOptions } from '../types/index';

const DEFAULT_OVERLAY_Z_INDEX = 10;

/**
 * Narrows visual layer options down to the keys OpenLayers understands.
 *
 * Spreading the full options object into `super()` would push large payloads
 * (geojson, data points, color scales, Power BI services) into the layer's
 * observable property bag, where every entry becomes a change-event source and
 * is retained for the lifetime of the layer.
 */
export function toOlLayerOptions(options: LayerOptions): OlLayerOptions {
    return {
        className: options.className,
        opacity: options.opacity,
        visible: options.visible,
        extent: options.extent,
        zIndex: options.zIndex || DEFAULT_OVERLAY_Z_INDEX,
        minResolution: options.minResolution,
        maxResolution: options.maxResolution,
        minZoom: options.minZoom,
        maxZoom: options.maxZoom
    };
}
