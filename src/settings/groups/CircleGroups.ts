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
    // Flag to track if Circle 2 data is available (set by visual.ts)
    private _hasCircle2Data: boolean = false;

    chartType: DropDown = new DropDown({
        name: "chartType",
        displayName: "Display Type",
        value: {
            value: "nested-circle",
            displayName: "Nested Circle"
        },
        items: [
            { value: "nested-circle", displayName: "Nested Circle" },
            { value: "donut-chart", displayName: "Donut Chart" },
            { value: "pie-chart", displayName: "Pie Chart" },
            { value: "hotspot", displayName: "Hotspot (Heat Points)" },
            { value: "h3-hexbin", displayName: "H3 Hexbin Aggregation" }
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

    // H3 Hexbin settings
    h3Resolution: formattingSettings.NumUpDown = new formattingSettings.Slider({
        name: "h3Resolution",
        displayName: "H3 Resolution",
        description: "H3 hexbin resolution (0=largest, 15=smallest). Lower values create larger hexbins.",
        value: 4,
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

    h3AggregationType: DropDown = new DropDown({
        name: "h3AggregationType",
        displayName: "Aggregation",
        description: "How to aggregate values within each hexbin",
        value: {
            value: "sum",
            displayName: "Sum"
        },
        items: [
            { value: "sum", displayName: "Sum" },
            { value: "count", displayName: "Count" },
            { value: "average", displayName: "Average" },
            { value: "min", displayName: "Minimum" },
            { value: "max", displayName: "Maximum" }
        ]
    });

    h3ColorRamp: DropDown = new DropDown({
        name: "h3ColorRamp",
        displayName: "Color Ramp",
        description: "Color gradient for hexbin values",
        value: {
            value: "viridis",
            displayName: "Viridis (Blue-Green-Yellow)"
        },
        items: [
            { value: "viridis", displayName: "Viridis (Blue-Green-Yellow)" },
            { value: "plasma", displayName: "Plasma (Purple-Orange-Yellow)" },
            { value: "inferno", displayName: "Inferno (Black-Red-Yellow)" },
            { value: "magma", displayName: "Magma (Black-Purple-White)" },
            { value: "warm", displayName: "Warm (Red-Yellow)" },
            { value: "cool", displayName: "Cool (Blue-Cyan)" },
            { value: "blues", displayName: "Blues" },
            { value: "greens", displayName: "Greens" },
            { value: "reds", displayName: "Reds" },
            { value: "oranges", displayName: "Oranges" },
            { value: "custom", displayName: "Custom (Single Color)" }
        ]
    });

    h3FillColor: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "h3FillColor",
        displayName: "Custom Fill Color",
        description: "Base fill color when using custom color mode",
        value: { value: "#3182bd" }
    });

    h3StrokeColor: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "h3StrokeColor",
        displayName: "Stroke Color",
        description: "Border color for hexbins",
        value: { value: "#ffffff" }
    });

    h3StrokeWidth: formattingSettings.NumUpDown = new formattingSettings.Slider({
        name: "h3StrokeWidth",
        displayName: "Stroke Width",
        description: "Border width for hexbins in pixels",
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

    h3MinOpacity: formattingSettings.NumUpDown = new formattingSettings.Slider({
        name: "h3MinOpacity",
        displayName: "Min Opacity",
        description: "Minimum opacity for lowest values (0-100%)",
        value: 30,
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

    h3MaxOpacity: formattingSettings.NumUpDown = new formattingSettings.Slider({
        name: "h3MaxOpacity",
        displayName: "Max Opacity",
        description: "Maximum opacity for highest values (0-100%)",
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

    // Hotspot settings
    hotspotIntensity: formattingSettings.NumUpDown = new formattingSettings.Slider({
        name: "hotspotIntensity",
        displayName: "Hotspot Intensity",
        description: "Base intensity multiplier for heat points",
        value: 1,
        options: {
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 10
            },
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0.1
            }
        }
    });

    hotspotRadius: formattingSettings.NumUpDown = new formattingSettings.Slider({
        name: "hotspotRadius",
        displayName: "Hotspot Radius",
        description: "Radius of influence for each heat point in pixels",
        value: 20,
        options: {
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 100
            },
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 5
            }
        }
    });

    hotspotColor: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "hotspotColor",
        displayName: "Hotspot Color",
        description: "Core color for heat points",
        value: { value: "#ff6600" }
    });

    hotspotGlowColor: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "hotspotGlowColor",
        displayName: "Glow Color",
        description: "Outer glow color for heat points",
        value: { value: "#ffcc00" }
    });

    hotspotBlurAmount: formattingSettings.NumUpDown = new formattingSettings.Slider({
        name: "hotspotBlurAmount",
        displayName: "Blur Amount",
        description: "Amount of blur/spread for the heat effect (pixels)",
        value: 15,
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

    hotspotMinOpacity: formattingSettings.NumUpDown = new formattingSettings.Slider({
        name: "hotspotMinOpacity",
        displayName: "Min Opacity",
        description: "Minimum opacity for hotspot points (0-100%)",
        value: 40,
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

    hotspotMaxOpacity: formattingSettings.NumUpDown = new formattingSettings.Slider({
        name: "hotspotMaxOpacity",
        displayName: "Max Opacity",
        description: "Maximum opacity for hotspot points (0-100%)",
        value: 95,
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

    hotspotScaleByValue: formattingSettings.ToggleSwitch = new formattingSettings.ToggleSwitch({
        name: "hotspotScaleByValue",
        displayName: "Scale by Value",
        description: "Scale hotspot size based on data values",
        value: true
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
        this.glowIntensity,
        // H3 hexbin settings
        this.h3Resolution,
        this.h3AggregationType,
        this.h3ColorRamp,
        this.h3FillColor,
        this.h3StrokeColor,
        this.h3StrokeWidth,
        this.h3MinOpacity,
        this.h3MaxOpacity,
        // Hotspot settings
        this.hotspotIntensity,
        this.hotspotRadius,
        this.hotspotColor,
        this.hotspotGlowColor,
        this.hotspotBlurAmount,
        this.hotspotMinOpacity,
        this.hotspotMaxOpacity,
        this.hotspotScaleByValue
    ];

    /**
     * Set whether Circle 2 data is available in the current data view.
     * Call this from visual.ts before applying conditional display rules.
     */
    public setCircle2DataAvailable(hasData: boolean): void {
        this._hasCircle2Data = hasData;
    }

    public applyConditionalDisplayRules(): void {
        const displayType = this.chartType.value?.value || 'nested-circle';
        const isHotspot = displayType === 'hotspot';
        const isH3Hexbin = displayType === 'h3-hexbin';
        const isCircleChart = !isHotspot && !isH3Hexbin;
        const requiresCircle2 = displayType === 'nested-circle' || displayType === 'donut-chart' || displayType === 'pie-chart';

        // Circle 2 settings only shown for chart types that use them AND when Circle 2 data is present
        const showCircle2Settings = requiresCircle2 && this._hasCircle2Data;
        this.proportionalCircles2Color.visible = showCircle2Settings;
        this.proportionalCircles2LayerOpacity.visible = showCircle2Settings;

        // Standard circle settings visible for circle charts only
        this.proportionalCircles1Color.visible = isCircleChart;
        this.proportionalCirclesMinimumRadius.visible = isCircleChart;
        this.proportionalCirclesMaximumRadius.visible = isCircleChart;
        this.proportionalCirclesStrokeColor.visible = isCircleChart;
        this.proportionalCirclesStrokeWidth.visible = isCircleChart;
        this.proportionalCircles1LayerOpacity.visible = isCircleChart;

        // Blur/glow effects for circles and hotspot (not H3)
        const showEffects = isCircleChart || isHotspot;
        this.enableBlur.visible = showEffects;
        this.blurRadius.visible = showEffects && this.enableBlur.value === true;
        this.enableGlow.visible = showEffects;
        this.glowColor.visible = showEffects && this.enableGlow.value === true;
        this.glowIntensity.visible = showEffects && this.enableGlow.value === true;

        // H3 hexbin settings only for H3 display type
        this.h3Resolution.visible = isH3Hexbin;
        this.h3AggregationType.visible = isH3Hexbin;
        this.h3ColorRamp.visible = isH3Hexbin;
        // Show custom fill color only when color ramp is 'custom'
        const isCustomColorRamp = this.h3ColorRamp.value?.value === 'custom';
        this.h3FillColor.visible = isH3Hexbin && isCustomColorRamp;
        this.h3StrokeColor.visible = isH3Hexbin;
        this.h3StrokeWidth.visible = isH3Hexbin;
        this.h3MinOpacity.visible = isH3Hexbin;
        this.h3MaxOpacity.visible = isH3Hexbin;

        // Hotspot settings only for hotspot display type
        this.hotspotIntensity.visible = isHotspot;
        this.hotspotRadius.visible = isHotspot;
        this.hotspotColor.visible = isHotspot;
        this.hotspotGlowColor.visible = isHotspot;
        this.hotspotBlurAmount.visible = isHotspot;
        this.hotspotMinOpacity.visible = isHotspot;
        this.hotspotMaxOpacity.visible = isHotspot;
        this.hotspotScaleByValue.visible = isHotspot;
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
