/**
 * Map Controls Settings Groups
 * 
 * Contains settings for map tools (render engine, zoom controls) and
 * legend container positioning and styling.
 */

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import { LegendPositions } from "../../constants/strings";

import DropDown = formattingSettings.ItemDropdown;

/**
 * Settings group for map tools configuration.
 */
export class MapToolsSettingsGroup extends formattingSettings.SimpleCard {
    renderEngine: DropDown = new DropDown({
        name: "renderEngine",
        displayName: "Render Engine",
        value: { value: 'svg', displayName: 'SVG' },
        items: [
            { value: 'svg', displayName: 'SVG' },
            { value: 'canvas', displayName: 'Canvas' },
            { value: 'webgl', displayName: 'WebGL (preview)' }
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
        value: 0
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
        value: 0
    });

    mapFitPaddingLeft: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "mapFitPaddingLeft",
        displayName: "Fit Padding Left",
        description: "Padding in pixels from the left edge when auto-fitting to features",
        value: 30
    });

    name: string = "mapToolsSettingsGroup";
    displayName: string = "Map Tools";
    collapsible: boolean = true;
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
        this.lockedMapExtent.visible = false;
        this.lockedMapZoom.visible = false;

        if (this.lockMapExtent.value) {
            this.showZoomControl.visible = false;
            this.showZoomControl.value = false;
        } else {
            this.showZoomControl.visible = true;
        }
    }
}

/**
 * Settings group for legend container positioning and styling.
 */
export class LegendContainerSettingsGroup extends formattingSettings.SimpleCard {
    legendPosition: DropDown = new DropDown({
        name: "legendPosition",
        displayName: "Position",
        value: {
            value: LegendPositions.TopRight,
            displayName: "Top Right"
        },
        items: [
            { value: LegendPositions.TopRight, displayName: "Top Right" },
            { value: LegendPositions.TopLeft, displayName: "Top Left" },
            { value: LegendPositions.TopCenter, displayName: "Top Center" },
            { value: LegendPositions.BottomRight, displayName: "Bottom Right" },
            { value: LegendPositions.BottomLeft, displayName: "Bottom Left" },
            { value: LegendPositions.BottomCenter, displayName: "Bottom Center" }
        ]
    });

    legendBorderWidth: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "legendBorderWidth",
        displayName: "Border Width",
        value: 1
    });

    legendBorderRadius: formattingSettings.NumUpDown = new formattingSettings.Slider({
        name: "legendBorderRadius",
        displayName: "Rounded Corners",
        value: 5,
        options: {
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 30
            },
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            }
        }
    });

    legendBorderColor: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "legendBorderColor",
        displayName: "Border Color",
        value: { value: "#ffffff" }
    });

    legendBackgroundColor: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "legendBackgroundColor",
        displayName: "Background Color",
        value: { value: "#ffffff" }
    });

    legendBackgroundOpacity: formattingSettings.NumUpDown = new formattingSettings.Slider({
        name: "legendBackgroundOpacity",
        displayName: "Background Opacity",
        value: 90,
        options: {
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 100
            },
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            }
        }
    });

    legendBottomMargin: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "legendBottomMargin",
        displayName: "Bottom Margin",
        value: 25,
        options: {
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 80
            },
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 10
            }
        }
    });

    legendTopMargin: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "legendTopMargin",
        displayName: "Top Margin",
        value: 0,
        options: {
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 80
            },
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            }
        }
    });

    legendLeftMargin: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "legendLeftMargin",
        displayName: "Left Margin",
        value: 25,
        options: {
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 80
            },
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            }
        }
    });

    legendRightMargin: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "legendRightMargin",
        displayName: "Right Margin",
        value: 0,
        options: {
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 80
            },
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            }
        }
    });

    name: string = "legendContainerSettingsGroup";
    displayName: string = "Legend Container";
    collapsible: boolean = true;
    slices: formattingSettings.Slice[] = [
        this.legendPosition,
        this.legendBorderWidth,
        this.legendBorderRadius,
        this.legendBorderColor,
        this.legendBackgroundColor,
        this.legendBackgroundOpacity,
        this.legendTopMargin,
        this.legendBottomMargin,
        this.legendLeftMargin,
        this.legendRightMargin
    ];

    public applyConditionalDisplayRules(): void {
        const position = this.legendPosition.value?.value;

        if (position === "top-center") {
            this.legendLeftMargin.visible = false;
            this.legendRightMargin.visible = false;
            this.legendBottomMargin.visible = false;
        }

        if (position === "top-right") {
            this.legendLeftMargin.visible = false;
            this.legendBottomMargin.visible = false;
        }

        if (position === "top-left") {
            this.legendRightMargin.visible = false;
            this.legendBottomMargin.visible = false;
        }

        if (position === "bottom-center") {
            this.legendLeftMargin.visible = false;
            this.legendRightMargin.visible = false;
            this.legendTopMargin.visible = false;
        }

        if (position === "bottom-left") {
            this.legendLeftMargin.value = 0;
            this.legendRightMargin.visible = false;
            this.legendTopMargin.visible = false;
        }

        if (position === "bottom-right") {
            this.legendLeftMargin.visible = false;
            this.legendTopMargin.visible = false;
        }
    }
}
