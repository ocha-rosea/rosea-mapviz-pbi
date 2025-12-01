"use strict";

import type powerbi from "powerbi-visuals-api";
import { RoleNames } from "../constants/roles";

/**
 * Service for working with Power BI data roles and categorical data.
 * Provides utilities for checking role presence, extracting values,
 * and computing auto-toggle states for layers.
 * 
 * @example
 * ```typescript
 * const hasLatLon = DataRoleService.hasRoleWithValues(categorical, 'Latitude');
 * const token = DataRoleService.getFirstStringValueForRole(categorical, 'MapboxAccessToken');
 * const toggles = DataRoleService.computeAutoToggles(categorical);
 * ```
 */
export class DataRoleService {
    /**
     * Checks if a value is non-null, non-undefined, and non-empty.
     * @param v - Value to check
     * @returns true if the value is considered "present"
     */
    static hasNonEmptyValue(v: any): boolean {
        if (v === null || v === undefined) return false;
        if (typeof v === "string") return v.trim().length > 0;
        if (typeof v === "number") return !isNaN(v);
        return true;
    }

    /**
     * Checks if a data role has any non-empty values in the categorical data.
     * @param categorical - Power BI categorical data view
     * @param roleName - Name of the data role to check
     * @returns true if the role exists and has at least one non-empty value
     */
    static hasRoleWithValues(categorical: powerbi.DataViewCategorical, roleName: string): boolean {
        const cat = categorical.categories?.find(c => c.source?.roles && (c.source.roles as any)[roleName]);
        return !!(cat && Array.isArray(cat.values) && cat.values.length > 0 && cat.values.some(this.hasNonEmptyValue));
    }

    /**
     * Extracts the first non-empty string value for a given data role.
     * Searches both categories and values columns.
     * @param categorical - Power BI categorical data view
     * @param roleName - Name of the data role to search
     * @returns The first non-empty trimmed string value, or undefined
     */
    static getFirstStringValueForRole(categorical: powerbi.DataViewCategorical | undefined, roleName: string): string | undefined {
        if (!categorical) {
            return undefined;
        }

        const categoryColumn = categorical.categories?.find(col => col.source?.roles && (col.source.roles as any)[roleName]);
        const valueColumn = categorical.values?.find(col => col.source?.roles && (col.source.roles as any)[roleName]);

        const candidates: any[][] = [];
        if (categoryColumn?.values) {
            candidates.push(categoryColumn.values as any[]);
        }
        if (valueColumn?.values) {
            candidates.push(valueColumn.values as any[]);
        }

        for (const arr of candidates) {
            if (!Array.isArray(arr)) {
                continue;
            }
            for (const raw of arr) {
                if (!this.hasNonEmptyValue(raw)) {
                    continue;
                }
                const asString = typeof raw === "string" ? raw : String(raw);
                const trimmed = asString.trim();
                if (trimmed.length > 0) {
                    return trimmed;
                }
            }
        }

        return undefined;
    }

    /**
     * Computes auto-toggle states for layers based on standard role names.
     * Returns { circle, choropleth } booleans where:
     *  - circle => Latitude AND Longitude present with values
     *  - choropleth => AdminPCodeNameID present with values
     */
    static computeAutoToggles(categorical: powerbi.DataViewCategorical): { circle: boolean; choropleth: boolean } {
        const hasLat = this.hasRoleWithValues(categorical, RoleNames.Latitude);
        const hasLon = this.hasRoleWithValues(categorical, RoleNames.Longitude);
        const hasBoundary = this.hasRoleWithValues(categorical, RoleNames.AdminPCodeNameID);
        return { circle: hasLat && hasLon, choropleth: hasBoundary };
    }
}
