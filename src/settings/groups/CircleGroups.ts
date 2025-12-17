/**
 * Proportional Circles Settings Groups
 * 
 * Contains settings for scaled circle visualization including display styling
 * and legend configuration.
 */

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import DropDown = formattingSettings.ItemDropdown;

/**
 * Settings group for proportional circles display styling.
 */
export class ProportionalCirclesDisplaySettingsGroup extends formattingSettings.SimpleCard {
    chartType: DropDown = new DropDown({
        name: "chartType",
        displayName: "Chart Type",
        value: {
            value: "nested-circle",
            displayName: "Nested Circle"
        },
        items: [
            { value: "nested-circle", displayName: "Nested Circle" },
            { value: "donut-chart", displayName: "Donut Chart" },
            { value: "pie-chart", displayName: "Pie Chart" }
        ]
    });

    proportionalCircles1Color: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "proportionalCircles1Color",
        displayName: "Circels 1 Color",
        value: { value: "#f58220" }
    });

    proportionalCircles2Color: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "proportionalCircles2Color",
        displayName: "Circles 2 Color",
        value: { value: "#ffc800" }
    });

    proportionalCirclesMinimumRadius: formattingSettings.NumUpDown = new formattingSettings.Slider({
        name: "proportionalCirclesMinimumRadius",
        displayName: "Mininum Radius",
        value: 3,
        options: {
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 50
            },
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            }
        }
    });

    proportionalCirclesMaximumRadius: formattingSettings.NumUpDown = new formattingSettings.Slider({
        name: "proportionalCirclesMaximumRadius",
        displayName: "Maximum Radius",
        value: 30,
        options: {
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 50
            },
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            }
        }
    });

    proportionalCirclesStrokeColor: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "proportionalCirclesStrokeColor",
        displayName: "Stroke Color",
        value: { value: "#ffffff" }
    });

    proportionalCirclesStrokeWidth: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "proportionalCirclesStrokeWidth",
        displayName: "Stroke Width",
        value: 1
    });

    proportionalCircles1LayerOpacity: formattingSettings.NumUpDown = new formattingSettings.Slider({
        name: "proportionalCircles1LayerOpacity",
        displayName: "Circles 1 Opacity",
        value: 100,
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

    proportionalCircles2LayerOpacity: formattingSettings.NumUpDown = new formattingSettings.Slider({
        name: "proportionalCircles2LayerOpacity",
        displayName: "Circles 2 Opacity",
        value: 100,
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

    enableBlur: formattingSettings.ToggleSwitch = new formattingSettings.ToggleSwitch({
        name: "enableBlur",
        displayName: "Enable Blur (Firefly)",
        description: "Apply a soft blur effect to circles for a firefly-like appearance (SVG/Canvas only)",
        value: false
    });

    blurRadius: formattingSettings.NumUpDown = new formattingSettings.Slider({
        name: "blurRadius",
        displayName: "Blur Radius",
        description: "Strength of the blur effect in pixels",
        value: 5,
        options: {
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 30
            },
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 1
            }
        }
    });

    enableGlow: formattingSettings.ToggleSwitch = new formattingSettings.ToggleSwitch({
        name: "enableGlow",
        displayName: "Enable Glow",
        description: "Apply a colored glow effect around circles (SVG/Canvas only)",
        value: false
    });

    glowColor: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "glowColor",
        displayName: "Glow Color",
        description: "Color of the glow effect (defaults to circle color if empty)",
        value: { value: "" }
    });

    glowIntensity: formattingSettings.NumUpDown = new formattingSettings.Slider({
        name: "glowIntensity",
        displayName: "Glow Intensity",
        description: "Strength of the glow effect",
        value: 10,
        options: {
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 50
            },
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 1
            }
        }
    });

    name: string = "proportionalCirclesDisplaySettingsGroup";
    displayName: string = "Display";
    collapsible: boolean = true;
    slices: formattingSettings.Slice[] = [
        this.chartType,
        this.proportionalCircles1Color,
        this.proportionalCircles2Color,
        this.proportionalCirclesMinimumRadius,
        this.proportionalCirclesMaximumRadius,
        this.proportionalCirclesStrokeColor,
        this.proportionalCirclesStrokeWidth,
        this.proportionalCircles1LayerOpacity,
        this.proportionalCircles2LayerOpacity,
        this.enableBlur,
        this.blurRadius,
        this.enableGlow,
        this.glowColor,
        this.glowIntensity
    ];

    public applyConditionalDisplayRules(): void {
        // Show blur radius only when blur is enabled
        this.blurRadius.visible = this.enableBlur.value === true;
        
        // Show glow options only when glow is enabled
        this.glowColor.visible = this.enableGlow.value === true;
        this.glowIntensity.visible = this.enableGlow.value === true;
    }
}

/**
 * Settings group for proportional circles legend configuration.
 */
export class ProportionalCirclesLegendSettingsGroup extends formattingSettings.SimpleCard {
    showLegend: formattingSettings.ToggleSwitch = new formattingSettings.ToggleSwitch({
        name: "showLegend",
        displayName: "Show Legend",
        value: false
    });

    legendTitleColor: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "legendTitleColor",
        displayName: "Legend Title Color",
        value: { value: "#000000" }
    });

    legendItemStrokeColor: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "legendItemStrokeColor",
        displayName: "Legend Item Stroke Color",
        value: { value: "#ffffff" }
    });

    legendItemStrokeWidth: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "legendItemStrokeWidth",
        displayName: "Legend Item Stroke Width",
        value: 1,
        options: {
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 5
            },
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            }
        }
    });

    leaderLineColor: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "leaderLineColor",
        displayName: "Leader Line Color",
        value: { value: "#000000" }
    });

    leaderLineStrokeWidth: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "leaderLineStrokeWidth",
        displayName: "Stroke Width",
        value: 1
    });

    labelTextColor: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "labelTextColor",
        displayName: "Label Text Color",
        value: { value: "#000000" }
    });

    labelSpacing: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "labelSpacing",
        displayName: "Label Spacing",
        value: 15,
        options: {
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 20
            },
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 5
            }
        }
    });

    roundOffLegendValues: formattingSettings.ToggleSwitch = new formattingSettings.ToggleSwitch({
        name: "roundOffLegendValues",
        displayName: "Round Legend Values",
        value: false
    });

    hideMinIfBelowThreshold: formattingSettings.ToggleSwitch = new formattingSettings.ToggleSwitch({
        name: "hideMinIfBelowThreshold",
        displayName: "Hide Min Circle",
        value: false
    });

    minValueThreshold: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "minValueThreshold",
        displayName: "Min Value Threshold",
        value: 10
    });

    minRadiusThreshold: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "minRadiusThreshold",
        displayName: "Min Radius Threshold",
        value: 5,
        options: {
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 5
            },
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            }
        }
    });

    xPadding: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "xPadding",
        displayName: "X Padding",
        value: 15,
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

    yPadding: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "yPadding",
        displayName: "Y Padding",
        value: 5,
        options: {
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 15
            },
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            }
        }
    });

    name: string = "proportionalCirclesLegendSettingsGroup";
    displayName: string = "Legend";
    collapsible: boolean = true;
    slices: formattingSettings.Slice[] = [
        this.showLegend,
        this.legendTitleColor,
        this.legendItemStrokeColor,
        this.legendItemStrokeWidth,
        this.leaderLineColor,
        this.labelTextColor,
        this.roundOffLegendValues,
        this.hideMinIfBelowThreshold,
        this.minValueThreshold,
        this.minRadiusThreshold,
        this.xPadding,
        this.yPadding
    ];
}

/**
 * Settings group for circle label display and formatting.
 */
export class CircleLabelSettingsGroup extends formattingSettings.SimpleCard {
    showLabels: formattingSettings.ToggleSwitch = new formattingSettings.ToggleSwitch({
        name: "showLabels",
        displayName: "Show Labels",
        value: false
    });

    labelSource: DropDown = new DropDown({
        name: "labelSource",
        displayName: "Label Source",
        value: {
            value: "field",
            displayName: "Label Field"
        },
        items: [
            { value: "field", displayName: "Label Field" },
            { value: "location", displayName: "Location ID" },
            { value: "size", displayName: "Circle Size Value" },
            { value: "size2", displayName: "Circle Size 2 Value" },
            { value: "tooltip", displayName: "First Tooltip Value" }
        ]
    });

    labelDisplayUnits: DropDown = new DropDown({
        name: "labelDisplayUnits",
        displayName: "Display Units",
        value: {
            value: "auto",
            displayName: "Auto"
        },
        items: [
            { value: "auto", displayName: "Auto" },
            { value: "none", displayName: "None" },
            { value: "thousands", displayName: "Thousands" },
            { value: "millions", displayName: "Millions" },
            { value: "billions", displayName: "Billions" },
            { value: "trillions", displayName: "Trillions" }
        ]
    });

    labelDecimalPlaces: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "labelDecimalPlaces",
        displayName: "Decimal Places",
        value: 0,
        options: {
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 10
            },
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            }
        }
    });

    labelFontSize: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "labelFontSize",
        displayName: "Font Size",
        value: 12,
        options: {
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 48
            },
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 6
            }
        }
    });

    labelFontColor: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "labelFontColor",
        displayName: "Font Color",
        value: { value: "#333333" }
    });

    labelFontFamily: DropDown = new DropDown({
        name: "labelFontFamily",
        displayName: "Font Family",
        value: {
            value: "sans-serif",
            displayName: "Sans-serif"
        },
        items: [
            { value: "sans-serif", displayName: "Sans-serif" },
            { value: "serif", displayName: "Serif" },
            { value: "Arial", displayName: "Arial" },
            { value: "Helvetica", displayName: "Helvetica" },
            { value: "Verdana", displayName: "Verdana" },
            { value: "Tahoma", displayName: "Tahoma" },
            { value: "Trebuchet MS", displayName: "Trebuchet MS" },
            { value: "Times New Roman", displayName: "Times New Roman" },
            { value: "Georgia", displayName: "Georgia" },
            { value: "Courier New", displayName: "Courier New" },
            { value: "monospace", displayName: "Monospace" }
        ]
    });

    labelPosition: DropDown = new DropDown({
        name: "labelPosition",
        displayName: "Position",
        value: {
            value: "center",
            displayName: "Center"
        },
        items: [
            { value: "center", displayName: "Center" },
            { value: "above", displayName: "Above" },
            { value: "below", displayName: "Below" },
            { value: "left", displayName: "Left" },
            { value: "right", displayName: "Right" }
        ]
    });

    showLabelBackground: formattingSettings.ToggleSwitch = new formattingSettings.ToggleSwitch({
        name: "showLabelBackground",
        displayName: "Show Background",
        value: false
    });

    labelBackgroundColor: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "labelBackgroundColor",
        displayName: "Background Color",
        value: { value: "#ffffff" }
    });

    labelBackgroundOpacity: formattingSettings.NumUpDown = new formattingSettings.Slider({
        name: "labelBackgroundOpacity",
        displayName: "Background Opacity",
        value: 80,
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

    labelBackgroundPadding: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "labelBackgroundPadding",
        displayName: "Background Padding",
        value: 4,
        options: {
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 20
            },
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            }
        }
    });

    labelBackgroundBorderRadius: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "labelBackgroundBorderRadius",
        displayName: "Border Radius",
        value: 0,
        options: {
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 20
            },
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            }
        }
    });

    showLabelBorder: formattingSettings.ToggleSwitch = new formattingSettings.ToggleSwitch({
        name: "showLabelBorder",
        displayName: "Show Border",
        value: false
    });

    labelBorderColor: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "labelBorderColor",
        displayName: "Border Color",
        value: { value: "#cccccc" }
    });

    labelBorderWidth: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "labelBorderWidth",
        displayName: "Border Width",
        value: 1,
        options: {
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 5
            },
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            }
        }
    });

    showLabelHalo: formattingSettings.ToggleSwitch = new formattingSettings.ToggleSwitch({
        name: "showLabelHalo",
        displayName: "Show Halo",
        value: true
    });

    labelHaloColor: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "labelHaloColor",
        displayName: "Halo Color",
        value: { value: "#ffffff" }
    });

    labelHaloWidth: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "labelHaloWidth",
        displayName: "Halo Width",
        value: 2,
        options: {
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 10
            },
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            }
        }
    });

    name: string = "circleLabelSettingsGroup";
    displayName: string = "Labels";
    collapsible: boolean = true;
    slices: formattingSettings.Slice[] = [
        this.showLabels,
        this.labelSource,
        this.labelDisplayUnits,
        this.labelDecimalPlaces,
        this.labelFontSize,
        this.labelFontColor,
        this.labelFontFamily,
        this.labelPosition,
        this.showLabelBackground,
        this.labelBackgroundColor,
        this.labelBackgroundOpacity,
        this.labelBackgroundPadding,
        this.labelBackgroundBorderRadius,
        this.showLabelBorder,
        this.labelBorderColor,
        this.labelBorderWidth,
        this.showLabelHalo,
        this.labelHaloColor,
        this.labelHaloWidth
    ];
}
