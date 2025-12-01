/**
 * Basemap Visual Card Settings
 * 
 * Composite card that combines all basemap-related settings groups.
 */

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import { BasemapNames } from "../../constants/strings";
import {
    BasemapSelectSettingsGroup,
    MapboxSettingsGroup,
    MaptilerSettingsGroup
} from "../groups";

/**
 * Composite card for basemap configuration in the formatting pane.
 * Contains settings for basemap selection and provider-specific options.
 */
export class BasemapVisualCardSettings extends formattingSettings.CompositeCard {
    public basemapSelectSettingsGroup = new BasemapSelectSettingsGroup();
    public mapBoxSettingsGroup = new MapboxSettingsGroup();
    public maptilerSettingsGroup = new MaptilerSettingsGroup();

    name: string = "basemapVisualCardSettings";
    displayName: string = "Basemap";
    groups: formattingSettings.Group[] = [
        this.basemapSelectSettingsGroup,
        this.mapBoxSettingsGroup,
        this.maptilerSettingsGroup
    ];

    /**
     * Applies conditional visibility rules based on selected basemap type.
     * - Shows Mapbox settings only when Mapbox is selected
     * - Shows MapTiler settings only when MapTiler is selected
     */
    public applyConditionalDisplayRules(): void {
        const selectedBasemap = this.basemapSelectSettingsGroup.selectedBasemap.value?.value;

        // Show Mapbox settings only if Mapbox is selected
        const isMapbox = selectedBasemap === BasemapNames.Mapbox;
        this.mapBoxSettingsGroup.visible = isMapbox;

        // Show MapTiler settings only if MapTiler is selected
        const isMaptiler = selectedBasemap === BasemapNames.MapTiler;
        this.maptilerSettingsGroup.visible = isMaptiler;
    }
}
