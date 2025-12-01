/**
 * Choropleth Visual Card Settings
 * 
 * Composite card that combines all choropleth map settings groups.
 */

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import {
    ChoroplethLocationBoundarySettingsGroup,
    ChoroplethClassificationSettingsGroup,
    ChoroplethDisplaySettingsGroup,
    ChoroplethLegendSettingsGroup
} from "../groups";

/**
 * Composite card for choropleth map configuration in the formatting pane.
 * Contains boundary source, classification, display styling, and legend settings.
 */
export class ChoroplethVisualCardSettings extends formattingSettings.CompositeCard {
    showLayerControl: formattingSettings.ToggleSwitch = new formattingSettings.ToggleSwitch({
        name: "showLayerControl",
        value: false
    });

    public choroplethLocationBoundarySettingsGroup = new ChoroplethLocationBoundarySettingsGroup();
    public choroplethClassificationSettingsGroup = new ChoroplethClassificationSettingsGroup();
    public choroplethDisplaySettingsGroup = new ChoroplethDisplaySettingsGroup();
    public choroplethLegendSettingsGroup = new ChoroplethLegendSettingsGroup();

    topLevelSlice: formattingSettings.ToggleSwitch = this.showLayerControl;
    name: string = "choroplethVisualCardSettings";
    displayName: string = "Choropleth";
    groups: formattingSettings.Group[] = [
        this.choroplethLocationBoundarySettingsGroup,
        this.choroplethClassificationSettingsGroup,
        this.choroplethDisplaySettingsGroup,
        this.choroplethLegendSettingsGroup
    ];
}
