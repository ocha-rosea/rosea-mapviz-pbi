"use strict";

import { RoseaMapVizFormattingSettingsModel } from "../settings";
import { BasemapOptions, ChoroplethOptions, CircleLabelOptions, CircleOptions, MapToolsOptions } from "../types";

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
            mapFitPaddingTop: maptoolsSettings.mapToolsSettingsGroup.mapFitPaddingTop.value ?? 0,
            mapFitPaddingRight: maptoolsSettings.mapToolsSettingsGroup.mapFitPaddingRight.value ?? 30,
            mapFitPaddingBottom: maptoolsSettings.mapToolsSettingsGroup.mapFitPaddingBottom.value ?? 0,
            mapFitPaddingLeft: maptoolsSettings.mapToolsSettingsGroup.mapFitPaddingLeft.value ?? 30,
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
            scalingMethod: 'square-root',
            enableBlur: circleSettings.proportionalCirclesDisplaySettingsGroup.enableBlur.value,
            blurRadius: circleSettings.proportionalCirclesDisplaySettingsGroup.blurRadius.value,
            enableGlow: circleSettings.proportionalCirclesDisplaySettingsGroup.enableGlow.value,
            glowColor: circleSettings.proportionalCirclesDisplaySettingsGroup.glowColor.value?.value || '',
            glowIntensity: circleSettings.proportionalCirclesDisplaySettingsGroup.glowIntensity.value
        };
    }

    /**
     * Extracts circle label configuration from the formatting model.
     * @param model - The Power BI formatting settings model
     * @returns Typed CircleLabelOptions for label rendering
     */
    static getCircleLabelOptions(model: RoseaMapVizFormattingSettingsModel): CircleLabelOptions {
        const labelSettings = model.ProportionalCirclesVisualCardSettings.circleLabelSettingsGroup;
        return {
            showLabels: labelSettings.showLabels.value,
            labelSource: labelSettings.labelSource.value.value.toString() as "field" | "location" | "size" | "size2" | "tooltip",
            displayUnits: labelSettings.labelDisplayUnits.value.value.toString() as "auto" | "none" | "thousands" | "millions" | "billions" | "trillions",
            decimalPlaces: labelSettings.labelDecimalPlaces.value,
            fontSize: labelSettings.labelFontSize.value,
            fontColor: labelSettings.labelFontColor.value.value,
            fontFamily: labelSettings.labelFontFamily.value.value.toString(),
            position: labelSettings.labelPosition.value.value.toString() as "center" | "above" | "below" | "left" | "right",
            showBackground: labelSettings.showLabelBackground.value,
            backgroundColor: labelSettings.labelBackgroundColor.value.value,
            backgroundOpacity: labelSettings.labelBackgroundOpacity.value,
            backgroundPadding: labelSettings.labelBackgroundPadding.value,
            backgroundBorderRadius: labelSettings.labelBackgroundBorderRadius.value,
            showBorder: labelSettings.showLabelBorder.value,
            borderColor: labelSettings.labelBorderColor.value.value,
            borderWidth: labelSettings.labelBorderWidth.value,
            showHalo: labelSettings.showLabelHalo.value,
            haloColor: labelSettings.labelHaloColor.value.value,
            haloWidth: labelSettings.labelHaloWidth.value
        };
    }

    /**
     * Extracts choropleth map configuration from the formatting model.
     * Includes boundary source, classification method, color ramp, and legend settings.
     * @param model - The Power BI formatting settings model
     * @returns Typed ChoroplethOptions for ChoroplethOrchestrator consumption
     */
    static getChoroplethOptions(
        model: RoseaMapVizFormattingSettingsModel,
        overrides?: { mapboxAccessToken?: string }
    ): ChoroplethOptions {
        const choroplethSettings = model.ChoroplethVisualCardSettings;
        const choroplethLocationSettings = choroplethSettings.choroplethLocationBoundarySettingsGroup;
        const choroplethClassificationSettings = choroplethSettings.choroplethClassificationSettingsGroup;
        const choroplethLegendSettings = choroplethSettings.choroplethLegendSettingsGroup;
        const nestedGeometrySettings = choroplethSettings.choroplethNestedGeometrySettingsGroup;
        
        // Mapbox access token priority: 1) tileset-specific token, 2) basemap token, 3) data role override
        const basemapSettings = model.BasemapVisualCardSettings;
        const tilesetAccessToken = this.toString(choroplethLocationSettings.mapboxTilesetAccessToken.value, true);
        const basemapToken = this.toString(basemapSettings.mapBoxSettingsGroup.mapboxAccessToken.value, true);
        const dataRoleToken = this.toString(overrides?.mapboxAccessToken, true);
        
        // Priority: tileset token > basemap token > data role token
        const mapboxAccessToken = tilesetAccessToken.length > 0 
            ? tilesetAccessToken 
            : basemapToken.length > 0 
                ? basemapToken 
                : dataRoleToken;

        return {
            layerControl: choroplethSettings.topLevelSlice.value,
            boundaryDataSource: choroplethLocationSettings.boundaryDataSource.value.value.toString(),
            geoBoundariesReleaseType: choroplethLocationSettings.geoBoundariesReleaseType.value.value.toString(),
            geoBoundariesCountry: choroplethLocationSettings.geoBoundariesCountry.value.value.toString(),
            geoBoundariesSourceTag: choroplethLocationSettings.geoBoundariesSourceTag.value.value.toString(),
            geoBoundariesAdminLevel: choroplethLocationSettings.geoBoundariesAdminLevel.value.value.toString(),
            sourceFieldID: choroplethLocationSettings.boundaryDataSource.value.value === "custom"
                ? choroplethLocationSettings.customBoundaryIdField.value
                : choroplethLocationSettings.boundaryDataSource.value.value === "mapbox"
                    ? choroplethLocationSettings.mapboxTilesetIdField.value
                    : choroplethLocationSettings.boundaryIdField.value.value.toString(),
            locationPcodeNameId: choroplethLocationSettings.boundaryDataSource.value.value === "custom"
                ? choroplethLocationSettings.customBoundaryIdField.value
                : choroplethLocationSettings.boundaryDataSource.value.value === "mapbox"
                    ? choroplethLocationSettings.mapboxTilesetIdField.value
                    : choroplethLocationSettings.boundaryIdField.value.value.toString(),
            topoJSON_geoJSON_FileUrl: choroplethLocationSettings.topoJSON_geoJSON_FileUrl.value,
            // Mapbox Tileset settings
            mapboxTilesetId: choroplethLocationSettings.mapboxTilesetId.value,
            mapboxTilesetSourceLayer: choroplethLocationSettings.mapboxTilesetSourceLayer.value,
            mapboxTilesetIdField: choroplethLocationSettings.mapboxTilesetIdField.value,
            // Mapbox access token: resolved with priority (tileset > basemap > data role)
            mapboxAccessToken,
            // Dedicated tileset access token (stored for reference)
            mapboxTilesetAccessToken: tilesetAccessToken || undefined,
            // Display settings now in classification group
            invertColorRamp: choroplethClassificationSettings.invertColorRamp.value,
            colorMode: choroplethClassificationSettings.colorMode.value.value.toString(),
            colorRamp: choroplethClassificationSettings.colorRamp.value.value.toString(),
            customColorRamp: choroplethClassificationSettings.customColorRamp.value,
            classes: choroplethClassificationSettings.numClasses.value,
            classificationMethod: choroplethClassificationSettings.classificationMethod.value.value as import("../types").ClassificationMethod,
            // Category colors for unique classification
            categoryColors: choroplethClassificationSettings.getCategoryColors(),
            categoryValues: choroplethClassificationSettings.getEffectiveCategoryValues(),
            othersColor: choroplethClassificationSettings.getOthersColor(),
            strokeColor: choroplethClassificationSettings.strokeColor.value.value,
            strokeWidth: choroplethClassificationSettings.strokeWidth.value,
            layerOpacity: choroplethClassificationSettings.layerOpacity.value / 100,
            simplificationStrength: choroplethClassificationSettings.simplificationStrength.value,
            // Feature color property support
            useFeatureColor: choroplethClassificationSettings.useFeatureColor.value,
            featureColorProperty: choroplethClassificationSettings.featureColorProperty.value || 'color',
            // Nested geometry styling
            showNestedPoints: nestedGeometrySettings.showNestedPoints.value,
            nestedPointRadius: nestedGeometrySettings.nestedPointRadius.value,
            nestedPointColor: nestedGeometrySettings.nestedPointColor.value.value,
            nestedPointStrokeColor: nestedGeometrySettings.nestedPointStrokeColor.value.value,
            nestedPointStrokeWidth: nestedGeometrySettings.nestedPointStrokeWidth.value,
            showNestedLines: nestedGeometrySettings.showNestedLines.value,
            nestedLineColor: nestedGeometrySettings.nestedLineColor.value.value,
            nestedLineWidth: nestedGeometrySettings.nestedLineWidth.value,
            // Legend settings
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
