"use strict";
import { RoleNames } from "../constants/roles";
import { DataViewMeasure } from "../types";
import { valueFormatter } from "powerbi-visuals-utils-formattingutils";

/**
 * Result of parsing circle categorical data.
 */
export interface CircleParseResult {
    /** Array of longitude values */
    longitudes?: number[];
    /** Array of latitude values */
    latitudes?: number[];
    /** Array of size measure objects */
    circleSizeValuesObjects: DataViewMeasure[];
    /** Whether longitude data role is present */
    hasLon?: boolean;
    /** Whether latitude data role is present */
    hasLat?: boolean;
    /** Array of location ID values (AdminPCodeNameID role) */
    locationIds?: string[];
    /** Array of tooltip values (first tooltip measure, formatted) */
    tooltipValues?: (string | number | null)[];
    /** Format string for tooltip values */
    tooltipFormat?: string;
    /** Array of circle label values from the CircleLabel data role */
    circleLabelValues?: (string | number | null)[];
    /** Format string for circle label values */
    circleLabelFormat?: string;
}

/**
 * Parses Power BI categorical data to extract circle-specific fields.
 * @param categorical - Power BI categorical data
 * @returns Parsed circle data with coordinates and size measures
 */
export function parseCircleCategorical(categorical: powerbi.DataViewCategorical | undefined): CircleParseResult {
    const lonCategory = categorical?.categories?.find(
        (c) => c.source?.roles?.[RoleNames.Longitude]
    );
    const latCategory = categorical?.categories?.find(
        (c) => c.source?.roles?.[RoleNames.Latitude]
    );
    const locationIdCategory = categorical?.categories?.find(
        (c) => c.source?.roles?.[RoleNames.AdminPCodeNameID]
    );
    const circleSizeValuesObjects = (categorical?.values?.filter(
        (c) => c.source?.roles?.[RoleNames.Size]
    ) || []) as DataViewMeasure[];
    
    // Extract first tooltip measure for label source option
    const tooltipMeasure = categorical?.values?.find(
        (c) => c.source?.roles?.[RoleNames.Tooltips]
    );

    // Extract circle label measure for dedicated label field
    const circleLabelMeasure = categorical?.values?.find(
        (c) => c.source?.roles?.[RoleNames.CircleLabel]
    );

    const formatStringProp = { objectName: "general", propertyName: "formatString" } as any;
    const getEffectiveFormatString = (column: any): string | undefined => {
        if (!column) {
            return undefined;
        }

        // Prefer per-visual field formatting when present
        const fromObjects = valueFormatter.getFormatString(column, formatStringProp, true);
        return fromObjects ?? column.format;
    };

    return {
        longitudes: lonCategory?.values as number[] | undefined,
        latitudes: latCategory?.values as number[] | undefined,
        circleSizeValuesObjects,
        hasLon: !!lonCategory,
        hasLat: !!latCategory,
        locationIds: locationIdCategory?.values?.map(v => 
            v === null || v === undefined ? '' : String(v)
        ) as string[] | undefined,
        tooltipValues: tooltipMeasure?.values as (string | number | null)[] | undefined,
        tooltipFormat: getEffectiveFormatString(tooltipMeasure?.source),
        circleLabelValues: circleLabelMeasure?.values as (string | number | null)[] | undefined,
        circleLabelFormat: getEffectiveFormatString(circleLabelMeasure?.source),
    };
}
