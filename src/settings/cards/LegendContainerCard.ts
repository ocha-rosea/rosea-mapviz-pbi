/**
 * Legend Container Visual Card Settings
 *
 * Card for legend container positioning and styling options.
 * Properties are directly on the card (no nested groups).
 */

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import { LegendPositions } from "../../constants/strings";

import DropDown = formattingSettings.ItemDropdown;

/**
 * Card for legend container configuration in the formatting pane.
 * Contains position, border, background, and margin settings.
 */
export class LegendContainerVisualCardSettings extends formattingSettings.SimpleCard {
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

    name: string = "legendContainerVisualCardSettings";
    displayName: string = "Legend Container";
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

        // Reset visibility
        this.legendLeftMargin.visible = true;
        this.legendRightMargin.visible = true;
        this.legendTopMargin.visible = true;
        this.legendBottomMargin.visible = true;

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
