"use strict";

/**
 * Barrel export for services module.
 * Provides centralized access to all visual services.
 * 
 * @example
 * ```typescript
 * import { MapService, LegendService, CacheService } from './services';
 * ```
 */

export { CacheService } from "./CacheService";
export { ChoroplethDataService } from "./ChoroplethDataService";
export { ColorRampHelper } from "./ColorRampHelper";
export { ColorRampManager } from "./ColorRampManager";
export { DataRoleService } from "./DataRoleService";
export { GeoBoundariesCatalogService } from "./GeoBoundariesCatalogService";
export { GeoBoundariesService } from "./GeoBoundariesService";
export type { GeoBoundariesMetadata } from "./GeoBoundariesService";
export { CircleLayerOptionsBuilder, ChoroplethLayerOptionsBuilder } from "./LayerOptionBuilders";
export { LegendService } from "./LegendService";
export type { CircleMeasureLegendEntry } from "./LegendService";
export { MapService } from "./MapService";
export { MessageService } from "./MessageService";
export { OptionsService } from "./OptionsService";
export { ZoomControlManager } from "./ZoomControlManager";
export { DOMManager } from "./DOMManager";
export type { DOMElements, LegendPositionConfig } from "./DOMManager";
export { StateManager } from "./StateManager";
export type { StateManagerConfig } from "./StateManager";
export { UniqueClassificationService } from "./UniqueClassificationService";
export type { UniqueClassificationResult, UniqueClassificationConfig } from "./UniqueClassificationService";
export { LocalizationService } from "./LocalizationService";
