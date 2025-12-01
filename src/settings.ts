/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

/**
 * Settings Module - Main Entry Point
 * 
 * This file serves as the backward-compatible entry point for settings.
 * All settings classes have been decomposed into modular components under
 * the src/settings/ directory for better maintainability.
 * 
 * Directory Structure:
 * - src/settings/
 *   - FormattingSettingsModel.ts  - Main model class
 *   - groups/                      - Individual settings groups
 *     - BasemapGroups.ts
 *     - CircleGroups.ts
 *     - ChoroplethGroups.ts
 *     - ControlsGroups.ts
 *   - cards/                       - Composite card classes
 *     - BasemapCard.ts
 *     - CircleCard.ts
 *     - ChoroplethCard.ts
 *     - ControlsCard.ts
 */

"use strict";

// Re-export the main formatting settings model for backward compatibility
export { RoseaMapVizFormattingSettingsModel } from "./settings/FormattingSettingsModel";

// Re-export all card classes for direct access if needed
export {
    BasemapVisualCardSettings,
    ProportionalCirclesVisualCardSettings,
    ChoroplethVisualCardSettings,
    MapControlsVisualCardSettings
} from "./settings/cards";

// Re-export all settings groups for direct access if needed
export {
    // Basemap groups
    BasemapSelectSettingsGroup,
    MapboxSettingsGroup,
    MaptilerSettingsGroup,
    // Circle groups
    ProportionalCirclesDisplaySettingsGroup,
    ProportionalCirclesLegendSettingsGroup,
    // Choropleth groups
    ChoroplethLocationBoundarySettingsGroup,
    ChoroplethClassificationSettingsGroup,
    ChoroplethDisplaySettingsGroup,
    ChoroplethLegendSettingsGroup,
    // Controls groups
    MapToolsSettingsGroup,
    LegendContainerSettingsGroup
} from "./settings/groups";
