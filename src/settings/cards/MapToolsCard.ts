/**
 * Map Tools Visual Card Settings
 *
 * Card for map tools configuration including render engine, zoom controls,
 * lock extent, and fit padding options.
 */

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import DropDown = formattingSettings.ItemDropdown;

/**
 * Card for map tools configuration in the formatting pane.
 * Contains render engine, zoom controls, lock extent, and fit padding settings.
 * Properties are directly on the card (no nested groups).
 */
export class MapToolsVisualCardSettings extends formattingSettings.SimpleCard {
    renderEngine: DropDown = new DropDown({
        name: "renderEngine",
        displayName: "Render Engine",
        value: { value: 'svg', displayName: 'SVG' },
        items: [
            { value: 'svg', displayName: 'SVG' },
            { value: 'canvas', displayName: 'Canvas' }
        ]
    });

    lockMapExtent: formattingSettings.ToggleSwitch = new formattingSettings.ToggleSwitch({
        name: "lockMapExtent",
        displayName: "Lock Map Extent",
        value: false
    });

    showZoomControl: formattingSettings.ToggleSwitch = new formattingSettings.ToggleSwitch({
        name: "showZoomControl",
        displayName: "Show Zoom Control",
        value: true
    });

    lockedMapExtent: formattingSettings.TextInput = new formattingSettings.TextInput({
        name: "lockedMapExtent",
        displayName: "Locked Map Extent",
        value: "",
        placeholder: "minX,minY,maxX,maxY"
    });

    lockedMapZoom: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "lockedMapZoom",
        displayName: "Locked Map Zoom",
        value: null
    });

    mapFitPaddingTop: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "mapFitPaddingTop",
        displayName: "Fit Padding Top",
        description: "Padding in pixels from the top edge when auto-fitting to features",
        value: 20
    });

    mapFitPaddingRight: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "mapFitPaddingRight",
        displayName: "Fit Padding Right",
        description: "Padding in pixels from the right edge when auto-fitting to features",
        value: 30
    });

    mapFitPaddingBottom: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "mapFitPaddingBottom",
        displayName: "Fit Padding Bottom",
        description: "Padding in pixels from the bottom edge when auto-fitting to features",
        value: 20
    });

    mapFitPaddingLeft: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "mapFitPaddingLeft",
        displayName: "Fit Padding Left",
        description: "Padding in pixels from the left edge when auto-fitting to features",
        value: 30
    });

    name: string = "mapToolsVisualCardSettings";
    displayName: string = "Map Tools";
    slices: formattingSettings.Slice[] = [
        this.renderEngine,
        this.lockMapExtent,
        this.showZoomControl,
        this.lockedMapExtent,
        this.lockedMapZoom,
        this.mapFitPaddingTop,
        this.mapFitPaddingRight,
        this.mapFitPaddingBottom,
        this.mapFitPaddingLeft
    ];

    public applyConditionalDisplayRules(): void {
        // Always hide the internal storage fields from the UI
        this.lockedMapExtent.visible = false;
        this.lockedMapZoom.visible = false;

        // When map extent is locked, keep zoom control toggle visible
        // so users can choose whether to show/hide zoom controls on locked map
    }
}
