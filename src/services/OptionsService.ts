"use strict";

import { RoseaMapVizFormattingSettingsModel } from "../settings";
import { BasemapOptions, ChoroplethOptions, CircleOptions, MapToolsOptions } from "../types";

/**
 * Service that converts Power BI formatting settings model into typed option objects.
 * Acts as an adapter between the Power BI formatting pane and the visual's internal APIs.
 * 
 * @example
 * ```typescript
 * const basemapOpts = OptionsService.getBasemapOptions(formattingModel);
 * const circleOpts = OptionsService.getCircleOptions(formattingModel);
 * ```
 */
export class OptionsService {
    private static toString(value: unknown, trim: boolean = false): string {
        if (value === null || value === undefined) {
            return "";
        }
        const asString = typeof value === "string" ? value : String(value);
        return trim ? asString.trim() : asString;
    }

    private static preferCredential(overrideValue: unknown, fallbackValue: unknown): string {
        const override = this.toString(overrideValue, true);
        if (override.length > 0) {
            return override;
        }
        return this.toString(fallbackValue, true);
    }

    /**
     * Extracts basemap configuration from the formatting model.
     * @param model - The Power BI formatting settings model
     * @param overrides - Optional credential overrides from data roles
     * @returns Typed BasemapOptions for MapService consumption
     */
    static getBasemapOptions(
        model: RoseaMapVizFormattingSettingsModel,
        overrides?: Partial<Pick<BasemapOptions, "mapboxAccessToken" | "maptilerApiKey">>
    ): BasemapOptions {
        const basemapSettings = model.BasemapVisualCardSettings;
        return {
            selectedBasemap: this.toString(basemapSettings.basemapSelectSettingsGroup.selectedBasemap.value?.value, true),
            customMapAttribution: this.toString(basemapSettings.basemapSelectSettingsGroup.customMapAttribution.value, true),
            mapboxCustomStyleUrl: this.toString(basemapSettings.mapBoxSettingsGroup.mapboxCustomStyleUrl.value, true),
            mapboxStyle: this.toString(basemapSettings.mapBoxSettingsGroup.mapboxStyle.value?.value, true),
            mapboxAccessToken: this.preferCredential(overrides?.mapboxAccessToken, basemapSettings.mapBoxSettingsGroup.mapboxAccessToken.value),
            declutterLabels: !!basemapSettings.mapBoxSettingsGroup.declutterLabels.value,
            maptilerApiKey: this.preferCredential(overrides?.maptilerApiKey, basemapSettings.maptilerSettingsGroup.maptilerApiKey.value),
            maptilerStyle: this.toString(basemapSettings.maptilerSettingsGroup.maptilerStyle.value?.value, true)
        };
    }

    /**
     * Extracts map controls configuration from the formatting model.
     * Includes render engine, zoom controls, and legend container settings.
     * @param model - The Power BI formatting settings model
     * @returns Typed MapToolsOptions for visual configuration
     */
    static getMapToolsOptions(model: RoseaMapVizFormattingSettingsModel): MapToolsOptions {
        const maptoolsSettings = model.mapControlsVisualCardSettings;
        return {
            renderEngine: maptoolsSettings.mapToolsSettingsGroup.renderEngine.value.value as any,
            lockMapExtent: maptoolsSettings.mapToolsSettingsGroup.lockMapExtent.value,
            showZoomControl: maptoolsSettings.mapToolsSettingsGroup.showZoomControl.value,
            lockedMapExtent: maptoolsSettings.mapToolsSettingsGroup.lockedMapExtent.value,
            lockedMapZoom: maptoolsSettings.mapToolsSettingsGroup.lockedMapZoom.value,
            legendPosition: maptoolsSettings.legendContainerSettingsGroup.legendPosition.value.value.toString(),
            legendBorderWidth: maptoolsSettings.legendContainerSettingsGroup.legendBorderWidth.value,
            legendBorderColor: maptoolsSettings.legendContainerSettingsGroup.legendBorderColor.value.value,
            legendBackgroundColor: maptoolsSettings.legendContainerSettingsGroup.legendBackgroundColor.value.value,
            legendBackgroundOpacity: maptoolsSettings.legendContainerSettingsGroup.legendBackgroundOpacity.value / 100,
            legendBorderRadius: maptoolsSettings.legendContainerSettingsGroup.legendBorderRadius.value,
            legendBottomMargin: maptoolsSettings.legendContainerSettingsGroup.legendBottomMargin.value,
            legendTopMargin: maptoolsSettings.legendContainerSettingsGroup.legendTopMargin.value,
            legendLeftMargin: maptoolsSettings.legendContainerSettingsGroup.legendLeftMargin.value,
            legendRightMargin: maptoolsSettings.legendContainerSettingsGroup.legendRightMargin.value
        };
    }

    /**
     * Extracts scaled/proportional circles configuration from the formatting model.
     * Includes display settings, legend options, and scaling parameters.
     * @param model - The Power BI formatting settings model
     * @returns Typed CircleOptions for CircleOrchestrator consumption
     */
    static getCircleOptions(model: RoseaMapVizFormattingSettingsModel): CircleOptions {
        const circleSettings = model.ProportionalCirclesVisualCardSettings;
        return {
            layerControl: circleSettings.topLevelSlice.value,
            color1: circleSettings.proportionalCirclesDisplaySettingsGroup.proportionalCircles1Color.value.value,
            color2: circleSettings.proportionalCirclesDisplaySettingsGroup.proportionalCircles2Color.value.value,
            minRadius: circleSettings.proportionalCirclesDisplaySettingsGroup.proportionalCirclesMinimumRadius.value,
            maxRadius: circleSettings.proportionalCirclesDisplaySettingsGroup.proportionalCirclesMaximumRadius.value,
            strokeColor: circleSettings.proportionalCirclesDisplaySettingsGroup.proportionalCirclesStrokeColor.value.value,
            strokeWidth: circleSettings.proportionalCirclesDisplaySettingsGroup.proportionalCirclesStrokeWidth.value,
            layer1Opacity: circleSettings.proportionalCirclesDisplaySettingsGroup.proportionalCircles1LayerOpacity.value / 100,
            layer2Opacity: circleSettings.proportionalCirclesDisplaySettingsGroup.proportionalCircles2LayerOpacity.value / 100,
            showLegend: circleSettings.proportionalCirclesLegendSettingsGroup.showLegend.value,
            legendTitle: '', // Set dynamically from data role display name
            legendTitleColor: circleSettings.proportionalCirclesLegendSettingsGroup.legendTitleColor.value.value,
            legendItemStrokeColor: circleSettings.proportionalCirclesLegendSettingsGroup.legendItemStrokeColor.value.value,
            legendItemStrokeWidth: circleSettings.proportionalCirclesLegendSettingsGroup.legendItemStrokeWidth.value,
            leaderLineStrokeWidth: circleSettings.proportionalCirclesLegendSettingsGroup.leaderLineStrokeWidth.value,
            leaderLineColor: circleSettings.proportionalCirclesLegendSettingsGroup.leaderLineColor.value.value,
            labelTextColor: circleSettings.proportionalCirclesLegendSettingsGroup.labelTextColor.value.value,
            roundOffLegendValues: circleSettings.proportionalCirclesLegendSettingsGroup.roundOffLegendValues.value,
            hideMinIfBelowThreshold: circleSettings.proportionalCirclesLegendSettingsGroup.hideMinIfBelowThreshold.value,
            minValueThreshold: circleSettings.proportionalCirclesLegendSettingsGroup.minValueThreshold.value,
            minRadiusThreshold: circleSettings.proportionalCirclesDisplaySettingsGroup.proportionalCirclesMinimumRadius.value,
            labelSpacing: circleSettings.proportionalCirclesLegendSettingsGroup.labelSpacing.value,
            yPadding: circleSettings.proportionalCirclesLegendSettingsGroup.yPadding.value,
            xPadding: circleSettings.proportionalCirclesLegendSettingsGroup.xPadding.value,
            chartType: circleSettings.proportionalCirclesDisplaySettingsGroup.chartType.value.value.toString(),
            scalingMethod: 'square-root'
        };
    }

    /**
     * Extracts choropleth map configuration from the formatting model.
     * Includes boundary source, classification method, color ramp, and legend settings.
     * @param model - The Power BI formatting settings model
     * @returns Typed ChoroplethOptions for ChoroplethOrchestrator consumption
     */
    static getChoroplethOptions(model: RoseaMapVizFormattingSettingsModel): ChoroplethOptions {
        const choroplethSettings = model.ChoroplethVisualCardSettings;
        const choroplethDisplaySettings = choroplethSettings.choroplethDisplaySettingsGroup;
        const choroplethLocationSettings = choroplethSettings.choroplethLocationBoundarySettingsGroup;
        const choroplethClassificationSettings = choroplethSettings.choroplethClassificationSettingsGroup;
        const choroplethLegendSettings = choroplethSettings.choroplethLegendSettingsGroup;

        return {
            layerControl: choroplethSettings.topLevelSlice.value,
            boundaryDataSource: choroplethLocationSettings.boundaryDataSource.value.value.toString(),
            geoBoundariesReleaseType: choroplethLocationSettings.geoBoundariesReleaseType.value.value.toString(),
            geoBoundariesCountry: choroplethLocationSettings.geoBoundariesCountry.value.value.toString(),
            geoBoundariesSourceTag: choroplethLocationSettings.geoBoundariesSourceTag.value.value.toString(),
            geoBoundariesAdminLevel: choroplethLocationSettings.geoBoundariesAdminLevel.value.value.toString(),
            sourceFieldID: choroplethLocationSettings.boundaryDataSource.value.value === "custom"
                ? choroplethLocationSettings.customBoundaryIdField.value
                : choroplethLocationSettings.boundaryIdField.value.value.toString(),
            locationPcodeNameId: choroplethLocationSettings.boundaryDataSource.value.value === "custom"
                ? choroplethLocationSettings.customBoundaryIdField.value
                : choroplethLocationSettings.boundaryIdField.value.value.toString(),
            topoJSON_geoJSON_FileUrl: choroplethLocationSettings.topoJSON_geoJSON_FileUrl.value,
            invertColorRamp: choroplethDisplaySettings.invertColorRamp.value,
            colorMode: choroplethDisplaySettings.colorMode.value.value.toString(),
            colorRamp: choroplethDisplaySettings.colorRamp.value.value.toString(),
            customColorRamp: choroplethDisplaySettings.customColorRamp.value,
            classes: choroplethClassificationSettings.numClasses.value,
            classificationMethod: choroplethClassificationSettings.classificationMethod.value.value as import("../types").ClassificationMethod,
            strokeColor: choroplethDisplaySettings.strokeColor.value.value,
            strokeWidth: choroplethDisplaySettings.strokeWidth.value,
            layerOpacity: choroplethDisplaySettings.layerOpacity.value / 100,
            simplificationStrength: choroplethDisplaySettings.simplificationStrength.value,
            showLegend: choroplethLegendSettings.showLegend.value,
            legendTitle: '', // Set dynamically from data role display name
            legendTitleAlignment: choroplethLegendSettings.legendTitleAlignment.value.value.toString(),
            legendOrientation: choroplethLegendSettings.legendOrientation.value.value as import("../types").LegendOrientation,
            legendLabelPosition: choroplethLegendSettings.legendLabelPosition.value.value as import("../types").LegendLabelPosition,
            legendTitleColor: choroplethLegendSettings.legendTitleColor.value.value,
            legendLabelsColor: choroplethLegendSettings.legendLabelsColor.value.value,
            legendItemMargin: choroplethLegendSettings.legendItemMargin.value,
        };
    }
}
