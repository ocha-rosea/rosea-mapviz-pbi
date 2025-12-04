/**
 * Color utility functions for validating and extracting CSS colors from feature properties.
 * Supports hex (#RGB, #RRGGBB, #RRGGBBAA), rgb(), and rgba() formats.
 */

/**
 * Validates if a string is a valid CSS color value.
 * Supports: #RGB, #RRGGBB, #RRGGBBAA, rgb(), rgba()
 * 
 * @param value - Value to validate
 * @returns true if valid CSS color format
 * 
 * @example
 * isValidCssColor('#fff')           // true
 * isValidCssColor('#ffffff')        // true
 * isValidCssColor('#ffffffaa')      // true
 * isValidCssColor('rgb(255,0,0)')   // true
 * isValidCssColor('rgba(255,0,0,0.5)') // true
 * isValidCssColor('red')            // false (named colors not supported)
 * isValidCssColor('not-a-color')    // false
 */
export function isValidCssColor(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const s = value.trim();
    
    // Hex: #RGB, #RRGGBB, #RRGGBBAA
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(s)) {
        return true;
    }
    
    // RGB: rgb(0-255, 0-255, 0-255)
    if (/^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i.test(s)) {
        return true;
    }
    
    // RGBA: rgba(0-255, 0-255, 0-255, 0-1)
    if (/^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*[\d.]+\s*\)$/i.test(s)) {
        return true;
    }
    
    return false;
}

/**
 * Extracts a valid color from feature properties using the specified property name.
 * Performs case-insensitive matching as a fallback if exact match not found.
 * 
 * @param properties - Feature properties object (from GeoJSON feature.properties)
 * @param propertyName - The property name to look for (default: "color")
 * @returns Valid CSS color string or null if not found/invalid
 * 
 * @example
 * getFeatureColor({ color: '#ff0000' }, 'color')       // '#ff0000'
 * getFeatureColor({ Color: '#ff0000' }, 'color')       // '#ff0000' (case-insensitive)
 * getFeatureColor({ fill: '#00ff00' }, 'fill')         // '#00ff00'
 * getFeatureColor({ color: 'invalid' }, 'color')       // null
 * getFeatureColor(null, 'color')                       // null
 */
export function getFeatureColor(
    properties: Record<string, unknown> | null | undefined,
    propertyName: string = 'color'
): string | null {
    if (!properties || !propertyName) return null;
    
    // Try exact property name first
    let colorValue = properties[propertyName];
    
    // Fallback: try case-insensitive match
    if (colorValue === undefined) {
        const lowerName = propertyName.toLowerCase();
        for (const key of Object.keys(properties)) {
            if (key.toLowerCase() === lowerName) {
                colorValue = properties[key];
                break;
            }
        }
    }
    
    if (isValidCssColor(colorValue)) {
        return (colorValue as string).trim();
    }
    
    return null;
}
