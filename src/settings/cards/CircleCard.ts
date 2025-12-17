/**
 * Proportional Circles Visual Card Settings
 * 
 * Composite card that combines all scaled circles settings groups.
 */

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import {
    ProportionalCirclesDisplaySettingsGroup,
    ProportionalCirclesLegendSettingsGroup,
    CircleLabelSettingsGroup
} from "../groups";

/**
 * Composite card for scaled circles configuration in the formatting pane.
 * Contains display styling and legend settings.
 */
export class ProportionalCirclesVisualCardSettings extends formattingSettings.CompositeCard {
    showLayerControl: formattingSettings.ToggleSwitch = new formattingSettings.ToggleSwitch({
        name: "showLayerControl",
        value: true
    });

    public proportionalCirclesDisplaySettingsGroup = new ProportionalCirclesDisplaySettingsGroup();
    public proportionalCirclesLegendSettingsGroup = new ProportionalCirclesLegendSettingsGroup();
    public circleLabelSettingsGroup = new CircleLabelSettingsGroup();

    topLevelSlice: formattingSettings.ToggleSwitch = this.showLayerControl;
    name: string = "proportionalCirclesVisualCardSettings";
    displayName: string = "Scaled Circles";
    groups: formattingSettings.Group[] = [
        this.proportionalCirclesDisplaySettingsGroup,
        this.proportionalCirclesLegendSettingsGroup,
        this.circleLabelSettingsGroup
    ];
}
