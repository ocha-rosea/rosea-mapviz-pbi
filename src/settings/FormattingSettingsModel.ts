/**
 * ROSEA MapViz Formatting Settings Model
 * 
 * Main entry point for the Power BI formatting pane settings.
 * This file consolidates all settings cards and provides the formatting model
 * that Power BI uses to render the formatting pane.
 * 
 * @module settings
 */

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import FormattingSettingsModel = formattingSettings.Model;

import {
    BasemapVisualCardSettings,
    ProportionalCirclesVisualCardSettings,
    ChoroplethVisualCardSettings,
    MapToolsVisualCardSettings,
    LegendContainerVisualCardSettings
} from "./cards";

/**
 * Main formatting settings model for the ROSEA MapViz visual.
 * 
 * Contains all formatting cards that appear in the Power BI formatting pane:
 * - Map Tools (render engine, zoom controls, lock extent, fit padding)
 * - Legend Container (position, border, background, margins)
 * - Basemap (provider selection, styles)
 * - Scaled Circles (proportional circles display and legend)
 * - Choropleth (boundary, classification, display, legend)
 */
export class RoseaMapVizFormattingSettingsModel extends FormattingSettingsModel {
    // Create formatting settings model formatting cards
    BasemapVisualCardSettings = new BasemapVisualCardSettings();
    ProportionalCirclesVisualCardSettings = new ProportionalCirclesVisualCardSettings();
    ChoroplethVisualCardSettings = new ChoroplethVisualCardSettings();
    mapToolsVisualCardSettings = new MapToolsVisualCardSettings();
    legendContainerVisualCardSettings = new LegendContainerVisualCardSettings();

    cards = [
        this.mapToolsVisualCardSettings,
        this.legendContainerVisualCardSettings,
        this.BasemapVisualCardSettings,
        this.ProportionalCirclesVisualCardSettings,
        this.ChoroplethVisualCardSettings
    ];
}
