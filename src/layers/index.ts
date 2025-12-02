"use strict";

/**
 * Barrel export for layers module.
 * Contains OpenLayers layer implementations for different visualization types and rendering engines.
 * 
 * @example
 * ```typescript
 * import { CircleLayer, ChoroplethLayer } from './layers';
 * import { CircleCanvasLayer } from './layers/canvas';
 * import { ChoroplethWebGLLayer } from './layers/webgl';
 * ```
 */

// SVG-based layers
export { CircleSvgLayer, CircleLayer } from "./svg/circleSvgLayer";
export { ChoroplethSvgLayer, ChoroplethLayer } from "./svg/choroplethSvgLayer";

// Canvas-based layers
export { CircleCanvasLayer } from "./canvas/circleCanvasLayer";
export { ChoroplethCanvasLayer } from "./canvas/choroplethCanvasLayer";
export * from "./canvas/canvasUtils";

// WebGL-based layers
export { CircleWebGLLayer } from "./webgl/circleWebGLLayer";
export { ChoroplethWebGLLayer } from "./webgl/choroplethWebGLLayer";
