/**
 * Unique Classification Service
 * 
 * Handles stable color mapping for unique/categorical classification methods.
 * Maintains persistent category-to-color mappings across filtering operations
 * to ensure visual consistency when data subsets change.
 * 
 * Key responsibilities:
 * - Maintain stable ordering of categorical values
 * - Map numeric values to fixed color ranges
 * - Support text-based categorical values with persistent colors
 * - Handle dynamic palette application across filter changes
 */

import { ClassificationMethods } from "../constants/strings";

/**
 * Configuration for unique classification color mapping.
 */
export interface UniqueClassificationConfig {
    /** Current classification method being used */
    classificationMethod: string;
    /** Number of classification classes/buckets */
    classes?: number;
    /** Query name of the measure being classified */
    measureQueryName?: string;
}

/**
 * Result of applying unique classification to data.
 */
export interface UniqueClassificationResult {
    /** Class breaks (unique values) for legend */
    classBreaks: any[];
    /** Color scale array matching the class breaks */
    colorScale: string[];
    /** Whether stable ordering was applied */
    stableOrderingApplied: boolean;
}

/**
 * Numeric range configuration for ordinal/integer-based unique values.
 */
interface NumericPlaceholderRange {
    /** Starting value of the range */
    start: number;
    /** Number of slots in the range */
    slots: number;
}

/**
 * Service for managing stable unique/categorical color mappings.
 * 
 * This service ensures that when data is filtered, the colors assigned to
 * categorical values remain consistent. For example, if "Category A" is blue
 * in the full dataset, it should remain blue when filtered to show only
 * categories A and C.
 * 
 * @example
 * ```typescript
 * const service = new UniqueClassificationService();
 * const result = service.applyStableMapping(
 *   colorValues,
 *   baseColorScale,
 *   { classificationMethod: 'unique', classes: 7 }
 * );
 * ```
 */
export class UniqueClassificationService {
    /** Map of category values to their assigned colors */
    private categoricalColorMap: Map<any, string> = new Map();
    
    /** Stable ordering of first N categories (persists across filtering) */
    private categoricalStableOrder: any[] = [];
    
    /** Range configuration for numeric unique values */
    private numericPlaceholderRange: NumericPlaceholderRange | undefined;
    
    /** Last classification method used (for detecting method changes) */
    private lastClassificationMethod: string | undefined;
    
    /** Last measure query name (for detecting measure changes) */
    private lastMeasureQueryName: string | undefined;

    /**
     * Applies stable color mapping to unique classification values.
     * 
     * @param colorValues - Array of values to classify
     * @param baseColorScale - Base color palette to use
     * @param config - Classification configuration
     * @returns Classification result with stable class breaks and colors
     */
    public applyStableMapping(
        colorValues: number[],
        baseColorScale: any,
        config: UniqueClassificationConfig
    ): UniqueClassificationResult {
        if (config.classificationMethod !== ClassificationMethods.Unique) {
            // Not unique classification - clear state and return empty
            this.clearState();
            return {
                classBreaks: [],
                colorScale: [],
                stableOrderingApplied: false
            };
        }

        try {
            const enteringUnique = this.lastClassificationMethod !== ClassificationMethods.Unique;
            const measureChanged = config.measureQueryName && 
                config.measureQueryName !== this.lastMeasureQueryName;

            // Extract unique non-null values
            const currentUnique = Array.from(new Set(
                colorValues.filter(v => v !== null && v !== undefined && !Number.isNaN(v))
            ));

            // Determine if values are numeric or text
            const allNumeric = currentUnique.every(v => typeof v === "number");

            // Sort values appropriately
            const sortedCurrent = allNumeric
                ? [...currentUnique].sort((a, b) => (a as number) - (b as number))
                : [...currentUnique].sort((a, b) => 
                    String(a).localeCompare(String(b), undefined, { sensitivity: "base" })
                  );

            // Calculate max legend items
            const requestedClasses = config.classes && config.classes > 0
                ? config.classes
                : sortedCurrent.length;
            const maxLegendItems = Math.min(requestedClasses || sortedCurrent.length || 0, 7);

            // Ensure palette has enough colors
            const palette = this.ensurePaletteArray(baseColorScale, maxLegendItems);

            if (maxLegendItems === 0) {
                this.clearState();
                return { classBreaks: [], colorScale: [], stableOrderingApplied: false };
            }

            // Apply appropriate palette strategy
            if (allNumeric) {
                this.applyNumericPalette(
                    sortedCurrent as number[],
                    palette,
                    maxLegendItems,
                    enteringUnique || measureChanged
                );
            } else {
                this.applyTextPalette(
                    sortedCurrent,
                    palette,
                    maxLegendItems,
                    enteringUnique || measureChanged
                );
            }

            // Build result using only currently-present values
            const presentStable = this.categoricalStableOrder.filter(c => currentUnique.includes(c));
            const classBreaks = presentStable;
            const colorScale = presentStable.map(c => this.categoricalColorMap.get(c) || "#000000");

            // Update tracking
            this.lastClassificationMethod = config.classificationMethod;
            this.lastMeasureQueryName = config.measureQueryName;

            return {
                classBreaks,
                colorScale,
                stableOrderingApplied: true
            };
        } catch (e) {
            this.clearState();
            return { classBreaks: [], colorScale: [], stableOrderingApplied: false };
        }
    }

    /**
     * Clears classification state when switching away from unique classification.
     * Should be called when classification method changes.
     */
    public clearStateIfNotUnique(classificationMethod: string): void {
        if (this.lastClassificationMethod === ClassificationMethods.Unique &&
            classificationMethod !== ClassificationMethods.Unique) {
            this.clearState();
        }
    }

    /**
     * Gets the color for a specific categorical value.
     */
    public getColor(value: any): string | undefined {
        return this.categoricalColorMap.get(value);
    }

    /**
     * Checks if a value exists in the stable ordering.
     */
    public hasValue(value: any): boolean {
        return this.categoricalColorMap.has(value);
    }

    /**
     * Clears all classification state.
     */
    private clearState(): void {
        this.categoricalColorMap.clear();
        this.categoricalStableOrder = [];
        this.numericPlaceholderRange = undefined;
    }

    /**
     * Ensures the palette array has the required number of colors.
     */
    private ensurePaletteArray(colorScale: any, length: number): string[] {
        const source = Array.isArray(colorScale)
            ? (colorScale as string[])
            : Object.values(colorScale ?? {}) as string[];
        const result = source.slice(0, Math.max(length, 0));
        while (result.length < length) {
            result.push("#000000");
        }
        return result;
    }

    /**
     * Applies palette to numeric unique values with stable range mapping.
     */
    private applyNumericPalette(
        values: number[],
        palette: string[],
        maxSlots: number,
        forceRebuild: boolean
    ): void {
        if (values.length === 0) {
            this.clearState();
            return;
        }

        const start = this.computeNumericRangeStart(values, maxSlots, forceRebuild);
        const needsRebuild = forceRebuild
            || !this.numericPlaceholderRange
            || this.numericPlaceholderRange.start !== start
            || this.numericPlaceholderRange.slots !== maxSlots;

        if (needsRebuild) {
            this.initializeNumericRange(start, maxSlots, palette);
        } else {
            this.refreshNumericRangeColors(palette);
        }

        // Map each value to its color
        const range = this.numericPlaceholderRange!;
        values.forEach(value => {
            if (value >= range.start && value < range.start + range.slots) {
                const offset = value - range.start;
                this.categoricalColorMap.set(value, palette[offset] || "#000000");
            } else {
                this.categoricalColorMap.set(value, "#000000");
            }
        });
    }

    /**
     * Computes the starting value for a numeric range.
     */
    private computeNumericRangeStart(
        values: number[],
        maxSlots: number,
        forceRebuild: boolean
    ): number {
        const newMin = values[0];
        const newMax = values[values.length - 1];

        if (maxSlots <= 0) {
            return newMin;
        }

        const previous = this.numericPlaceholderRange;
        const ordinalLock = this.shouldPreferOrdinalBase(values, maxSlots) || 
            (previous?.start === 1 && previous.slots === maxSlots);

        if (!previous || forceRebuild) {
            return ordinalLock ? 1 : this.clampRangeStart(newMin, newMax, maxSlots, newMin);
        }

        if (ordinalLock) {
            return 1;
        }

        let desiredStart = previous.start;
        const previousEnd = previous.start + previous.slots - 1;

        if (previous.slots !== maxSlots) {
            desiredStart = previous.start;
        }

        if (newMin < previous.start) {
            desiredStart = newMin;
        } else if (newMax > previousEnd) {
            desiredStart = newMax - maxSlots + 1;
        }

        return this.clampRangeStart(newMin, newMax, maxSlots, desiredStart);
    }

    /**
     * Clamps the range start to valid bounds.
     */
    private clampRangeStart(
        newMin: number,
        newMax: number,
        maxSlots: number,
        desiredStart: number
    ): number {
        if (maxSlots <= 0) {
            return newMin;
        }
        const minPossible = newMin;
        let maxPossible = newMax - maxSlots + 1;
        if (maxPossible < minPossible) {
            maxPossible = minPossible;
        }

        if (desiredStart < minPossible) {
            return minPossible;
        }
        if (desiredStart > maxPossible) {
            return maxPossible;
        }
        return desiredStart;
    }

    /**
     * Checks if values should use ordinal (1-based) range.
     */
    private shouldPreferOrdinalBase(values: number[], maxSlots: number): boolean {
        if (maxSlots <= 0 || values.length === 0) {
            return false;
        }
        const allIntegers = values.every(v => Number.isFinite(v) && Number.isInteger(v));
        if (!allIntegers) {
            return false;
        }
        const minValue = values[0];
        const maxValue = values[values.length - 1];
        return minValue >= 1 && maxValue <= maxSlots;
    }

    /**
     * Initializes a new numeric placeholder range.
     */
    private initializeNumericRange(start: number, slots: number, palette: string[]): void {
        this.numericPlaceholderRange = { start, slots };
        this.categoricalColorMap.clear();
        this.categoricalStableOrder = [];
        for (let i = 0; i < slots; i++) {
            const value = start + i;
            this.categoricalStableOrder.push(value);
            this.categoricalColorMap.set(value, palette[i] || "#000000");
        }
    }

    /**
     * Refreshes colors for existing numeric range.
     */
    private refreshNumericRangeColors(palette: string[]): void {
        if (!this.numericPlaceholderRange) {
            return;
        }
        const { start, slots } = this.numericPlaceholderRange;
        this.categoricalColorMap.clear();
        this.categoricalStableOrder = [];
        for (let i = 0; i < slots; i++) {
            const value = start + i;
            this.categoricalStableOrder.push(value);
            this.categoricalColorMap.set(value, palette[i] || "#000000");
        }
    }

    /**
     * Applies palette to text-based categorical values.
     */
    private applyTextPalette(
        sortedValues: any[],
        palette: string[],
        maxSlots: number,
        forceReset: boolean
    ): void {
        if (forceReset) {
            this.categoricalColorMap.clear();
            this.categoricalStableOrder = [];
        }

        this.numericPlaceholderRange = undefined;

        // Add new values to stable order if space available
        for (const value of sortedValues) {
            if (!this.categoricalStableOrder.includes(value) && 
                this.categoricalStableOrder.length < maxSlots) {
                this.categoricalStableOrder.push(value);
            }
        }

        // Trim to max slots
        if (this.categoricalStableOrder.length > maxSlots) {
            this.categoricalStableOrder = this.categoricalStableOrder.slice(0, maxSlots);
        }

        // Assign colors
        this.categoricalStableOrder.forEach((value, index) => {
            this.categoricalColorMap.set(value, palette[index] || "#000000");
        });
    }
}
