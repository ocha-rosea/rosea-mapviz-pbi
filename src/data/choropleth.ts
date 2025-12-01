"use strict";

import { ChoroplethData, DataViewCategory, DataViewMeasure } from "../types";
import { RoleNames } from "../constants/roles";

/**
 * Validation result for choropleth input data.
 */
export interface ValidationResult {
    ok: boolean;
    reason?: string;
}

/**
 * Validates that choropleth categorical data has required measures.
 * @param categorical - Power BI categorical data
 * @returns Validation result indicating if data is valid
 */
export function validateChoroplethInput(categorical: powerbi.DataViewCategorical | undefined): ValidationResult {
    if (!categorical?.values || categorical.values.length === 0) {
        return { ok: false, reason: "Measures not found" };
    }
    return { ok: true };
}

/**
 * Parses Power BI categorical data to extract choropleth-specific fields.
 * @param categorical - Power BI categorical data
 * @returns Parsed choropleth data with category, measure, and P-Codes
 */
export function parseChoroplethCategorical(categorical: powerbi.DataViewCategorical | undefined): ChoroplethData {
    const AdminPCodeNameIDCategory = categorical?.categories?.find(
        (c) => c.source?.roles && c.source.roles[RoleNames.AdminPCodeNameID]
    ) as DataViewCategory | undefined;
    
    const colorMeasure = categorical?.values?.find(
        (c) => c.source?.roles && c.source.roles[RoleNames.Color]
    ) as DataViewMeasure | undefined;
    
    const pCodes = AdminPCodeNameIDCategory?.values as string[] | undefined;
    
    return { AdminPCodeNameIDCategory, colorMeasure, pCodes };
}

/**
 * Filters out null/undefined/empty P-Code values.
 * @param pCodes - Array of P-Code strings (may contain nulls)
 * @returns Filtered array of valid P-Codes
 */
export function filterValidPCodes(pCodes: string[] | undefined): string[] {
    if (!pCodes) return [];
    return pCodes.filter((p) => !!p);
}
