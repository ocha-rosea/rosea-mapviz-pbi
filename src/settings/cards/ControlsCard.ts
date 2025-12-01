/**
 * Map Controls Visual Card Settings
 * 
 * Composite card that combines map tools and legend container settings.
 */

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import {
    MapToolsSettingsGroup,
    LegendContainerSettingsGroup
} from "../groups";

/**
 * Composite card for map controls configuration in the formatting pane.
 * Contains render engine, zoom controls, and legend container settings.
 */
export class MapControlsVisualCardSettings extends formattingSettings.CompositeCard {
    public mapToolsSettingsGroup = new MapToolsSettingsGroup();
    public legendContainerSettingsGroup = new LegendContainerSettingsGroup();

    name: string = "mapControlsVisualCardSettings";
    displayName: string = "Controls";
    groups: formattingSettings.Group[] = [
        this.mapToolsSettingsGroup,
        this.legendContainerSettingsGroup
    ];
}
