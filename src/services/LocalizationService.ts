"use strict";

import powerbi from "powerbi-visuals-api";
import ILocalizationManager = powerbi.extensibility.ILocalizationManager;

/**
 * Service for handling localized strings in the visual.
 * Wraps Power BI's ILocalizationManager to provide localized strings
 * based on the user's language settings.
 * 
 * @example
 * ```typescript
 * const localization = new LocalizationService(host.createLocalizationManager());
 * const title = localization.get("Landing_Title");
 * const message = localization.format("Warning_GeoTopoFetchStatus_Message", status);
 * ```
 */
export class LocalizationService {
    private localizationManager: ILocalizationManager;

    /**
     * Creates a new LocalizationService instance.
     * @param localizationManager - Power BI's localization manager
     */
    constructor(localizationManager: ILocalizationManager) {
        this.localizationManager = localizationManager;
    }

    /**
     * Gets a localized string by its key.
     * @param key - The resource key from resources.resjson
     * @returns The localized string, or the key itself if not found
     */
    public get(key: string): string {
        return this.localizationManager.getDisplayName(key);
    }

    /**
     * Gets a localized string and replaces placeholders with values.
     * Placeholders are in the format {0}, {1}, etc.
     * @param key - The resource key from resources.resjson
     * @param args - Values to substitute into placeholders
     * @returns The formatted localized string
     */
    public format(key: string, ...args: (string | number)[]): string {
        let result = this.get(key);
        args.forEach((arg, index) => {
            result = result.replace(new RegExp(`\\{${index}\\}`, 'g'), String(arg));
        });
        return result;
    }

    // ========================================================================
    // Landing Page Strings
    // ========================================================================

    public getLandingTitle(): string {
        return this.get("Landing_Title");
    }

    public getLandingDescription(): string {
        return this.get("Landing_Description");
    }

    public getLandingGettingStarted(): string {
        return this.get("Landing_GettingStarted");
    }

    public getLandingChoroplethMap(): string {
        return this.get("Landing_ChoroplethMap");
    }

    public getLandingChoroplethInstructions(): string {
        return this.get("Landing_ChoroplethInstructions");
    }

    public getLandingScaledCircles(): string {
        return this.get("Landing_ScaledCircles");
    }

    public getLandingScaledCirclesInstructions(): string {
        return this.get("Landing_ScaledCirclesInstructions");
    }

    public getLandingTip(): string {
        return this.get("Landing_Tip");
    }

    // ========================================================================
    // Warning Message Strings
    // ========================================================================

    public getWarningMissingMeasures(): { title: string; message: string } {
        return {
            title: this.get("Warning_MissingMeasures_Title"),
            message: this.get("Warning_MissingMeasures_Message")
        };
    }

    public getWarningMissingLonLat(): { title: string; message: string } {
        return {
            title: this.get("Warning_MissingLonLat_Title"),
            message: this.get("Warning_MissingLonLat_Message")
        };
    }

    public getWarningLonLatLengthMismatch(): { title: string; message: string } {
        return {
            title: this.get("Warning_LonLatLengthMismatch_Title"),
            message: this.get("Warning_LonLatLengthMismatch_Message")
        };
    }

    public getWarningNoValidPCodes(): { title: string; message: string } {
        return {
            title: this.get("Warning_NoValidPCodes_Title"),
            message: this.get("Warning_NoValidPCodes_Message")
        };
    }

    public getWarningAdminPcodeMissing(): { title: string; message: string } {
        return {
            title: this.get("Warning_AdminPcodeMissing_Title"),
            message: this.get("Warning_AdminPcodeMissing_Message")
        };
    }

    public getWarningColorMeasureMissing(): { title: string; message: string } {
        return {
            title: this.get("Warning_ColorMeasureMissing_Title"),
            message: this.get("Warning_ColorMeasureMissing_Message")
        };
    }

    public getWarningTooManyUniqueValues(): { title: string; message: string } {
        return {
            title: this.get("Warning_TooManyUniqueValues_Title"),
            message: this.get("Warning_TooManyUniqueValues_Message")
        };
    }

    public getWarningInvalidColorRamp(): { title: string; message: string } {
        return {
            title: this.get("Warning_InvalidColorRamp_Title"),
            message: this.get("Warning_InvalidColorRamp_Message")
        };
    }

    public getWarningGeoBoundariesConfig(msg: string): { title: string; message: string } {
        return {
            title: this.get("Warning_GeoBoundariesConfig_Title"),
            message: msg
        };
    }

    public getWarningGeoBoundariesMetadata(): { title: string; message: string } {
        return {
            title: this.get("Warning_GeoBoundariesMetadata_Title"),
            message: this.get("Warning_GeoBoundariesMetadata_Message")
        };
    }

    public getWarningGeoBoundariesConnection(): { title: string; message: string } {
        return {
            title: this.get("Warning_GeoBoundariesConnection_Title"),
            message: this.get("Warning_GeoBoundariesConnection_Message")
        };
    }

    public getWarningInvalidGeoTopoUrl(): { title: string; message: string } {
        return {
            title: this.get("Warning_InvalidGeoTopoUrl_Title"),
            message: this.get("Warning_InvalidGeoTopoUrl_Message")
        };
    }

    public getWarningGeoTopoFetchNetwork(): { title: string; message: string } {
        return {
            title: this.get("Warning_GeoTopoFetchNetwork_Title"),
            message: this.get("Warning_GeoTopoFetchNetwork_Message")
        };
    }

    public getWarningGeoTopoFetchStatus(status: number): { title: string; message: string } {
        return {
            title: this.get("Warning_GeoTopoFetchStatus_Title"),
            message: this.format("Warning_GeoTopoFetchStatus_Message", status)
        };
    }

    public getWarningInvalidGeoTopoData(): { title: string; message: string } {
        return {
            title: this.get("Warning_InvalidGeoTopoData_Title"),
            message: this.get("Warning_InvalidGeoTopoData_Message")
        };
    }

    public getWarningChoroplethFetchError(): { title: string; message: string } {
        return {
            title: this.get("Warning_ChoroplethFetchError_Title"),
            message: this.get("Warning_ChoroplethFetchError_Message")
        };
    }

    public getWarningAutoSelectedBoundary(chosen: string, matches: number, original: string): { title: string; message: string } {
        return {
            title: this.get("Warning_AutoSelectedBoundary_Title"),
            message: this.format("Warning_AutoSelectedBoundary_Message", chosen, matches, original)
        };
    }
}
