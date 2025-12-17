/**
 * Basemap Settings Groups
 * 
 * Contains settings for basemap selection (OpenStreetMap, Mapbox, MapTiler)
 * and their provider-specific configuration options.
 */

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import { BasemapNames } from "../../constants/strings";

import TextInput = formattingSettings.TextInput;
import DropDown = formattingSettings.ItemDropdown;

/**
 * Settings group for basemap type selection and custom attribution.
 */
export class BasemapSelectSettingsGroup extends formattingSettings.SimpleCard {
    selectedBasemap: DropDown = new DropDown({
        name: "selectedBasemap",
        displayName: "Select Basemap",
        value: {
            value: BasemapNames.OpenStreetMap,
            displayName: "OpenStreetMap"
        },
        items: [
            { value: BasemapNames.OpenStreetMap, displayName: "OpenStreetMap" },
            { value: BasemapNames.Mapbox, displayName: "Mapbox" },
            { value: BasemapNames.MapTiler, displayName: "MapTiler" },
            { value: BasemapNames.None, displayName: "No Basemap" }
        ]
    });

    customMapAttribution: TextInput = new TextInput({
        name: "customMapAttribution",
        displayName: "Extra Attribution",
        value: "",
        placeholder: "Enter Custom Attribution"
    });

    name: string = "basemapSelectSettingsGroup";
    collapsible: boolean = true;
    slices: formattingSettings.Slice[] = [this.selectedBasemap, this.customMapAttribution];
}

/**
 * Settings group for Mapbox-specific configuration.
 */
export class MapboxSettingsGroup extends formattingSettings.SimpleCard {
    mapboxAccessToken: TextInput = new TextInput({
        name: "mapboxAccessToken",
        displayName: "Access Token",
        value: "",
        placeholder: "Enter Access Token"
    });

    mapboxStyle: DropDown = new DropDown({
        name: "mapboxStyle",
        displayName: "Select Map Style",
        value: {
            value: "mapbox://styles/mapbox/light-v10?optimize=true",
            displayName: "Light"
        },
        items: [
            { value: "mapbox://styles/mapbox/light-v10?optimize=true", displayName: "Light" },
            { value: "mapbox://styles/mapbox/dark-v10?optimize=true", displayName: "Dark" },
            { value: "mapbox://styles/mapbox/streets-v11?optimize=true", displayName: "Streets" },
            { value: "custom", displayName: "Custom" }
        ]
    });

    mapboxCustomStyleUrl: TextInput = new TextInput({
        name: "mapboxCustomStyleUrl",
        displayName: "Custom Style Url",
        value: "",
        placeholder: "mapbox://styles/..."
    });

    declutterLabels: formattingSettings.ToggleSwitch = new formattingSettings.ToggleSwitch({
        name: "declutterLabels",
        displayName: "Declutter Labels",
        value: true
    });

    name: string = "mapBoxSettingsGroup";
    displayName: string = "Mapbox Settings";
    collapsible: boolean = true;
    slices: formattingSettings.Slice[] = [
        this.mapboxAccessToken,
        this.mapboxStyle,
        this.mapboxCustomStyleUrl,
        this.declutterLabels
    ];
}

/**
 * Settings group for MapTiler-specific configuration.
 */
export class MaptilerSettingsGroup extends formattingSettings.SimpleCard {
    maptilerApiKey: TextInput = new TextInput({
        name: "maptilerApiKey",
        displayName: "API Key",
        value: "",
        placeholder: "Enter API Key"
    });

    maptilerStyle: DropDown = new DropDown({
        name: "maptilerStyle",
        displayName: "Select Map Style",
        value: {
            value: "dataviz",
            displayName: "Dataviz"
        },
        items: [
            { value: "aquarelle", displayName: "Aquarelle" },
            { value: "backdrop", displayName: "Backdrop" },
            { value: "basic", displayName: "Basic" },
            { value: "bright", displayName: "Bright" },
            { value: "dataviz", displayName: "Dataviz" },
            { value: "landscape", displayName: "Landscape" },
            { value: "ocean", displayName: "Ocean" },
            { value: "openstreetmap", displayName: "OpenStreetMap" },
            { value: "outdoor", displayName: "Outdoor" },
            { value: "satellite", displayName: "Satellite" },
            { value: "streets", displayName: "Streets" },
            { value: "toner", displayName: "Toner" },
            { value: "topo", displayName: "Topo" },
            { value: "winter", displayName: "Winter" }
        ]
    });

    name: string = "maptilerSettingsGroup";
    displayName: string = "Maptiler Settings";
    collapsible: boolean = true;
    slices: formattingSettings.Slice[] = [this.maptilerApiKey, this.maptilerStyle];
}
