# ROSEA MapViz - Feature Color Property Support

## Overview

Enable choropleth features to use a color property from the GeoJSON/TopoJSON data for styling, with fallback to visual settings. Ensure all geometry types (Point, MultiPoint, LineString, MultiLineString, Polygon, MultiPolygon, GeometryCollection) render correctly across all three render engines (SVG, Canvas, WebGL).

---

## Key Concepts: FeatureCollection vs GeometryCollection

### FeatureCollection (Multiple Features)

A **FeatureCollection** contains multiple separate features, each with its **own properties object**. Each feature can have a different color.

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "id": "A", "color": "#ff0000" },
      "geometry": { "type": "Point", "coordinates": [100, 0] }
    },
    {
      "type": "Feature",
      "properties": { "id": "B", "color": "#00ff00" },
      "geometry": { "type": "Polygon", "coordinates": [[[100, 0], [101, 0], [101, 1], [100, 1], [100, 0]]] }
    }
  ]
}
```

**Color Behavior:**
- Feature A (Point) → Uses `#ff0000`
- Feature B (Polygon) → Uses `#00ff00`
- Each feature styled independently

### GeometryCollection (Nested Geometries)

A **GeometryCollection** is a **single feature** with multiple geometries that **share one properties object**. All geometries in the collection get the same base color.

```json
{
  "type": "Feature",
  "properties": { "id": "C", "color": "#0000ff" },
  "geometry": {
    "type": "GeometryCollection",
    "geometries": [
      { "type": "Point", "coordinates": [102, 0] },
      { "type": "LineString", "coordinates": [[100, 0], [101, 1]] },
      { "type": "Polygon", "coordinates": [[[100, 0], [101, 0], [101, 1], [100, 1], [100, 0]]] }
    ]
  }
}
```

**Color Behavior:**
- All geometries (Point, Line, Polygon) share `#0000ff` as base color
- Nested style overrides (from settings) may apply different colors for points/lines within the collection

### Styling Matrix

| Structure | Geometry | Feature Color | Nested Style Override | Final Color |
|-----------|----------|---------------|----------------------|-------------|
| FeatureCollection | Point (Feature A) | `#ff0000` | N/A | `#ff0000` |
| FeatureCollection | Polygon (Feature B) | `#00ff00` | N/A | `#00ff00` |
| GeometryCollection | Polygon | `#0000ff` | N/A | `#0000ff` (fill) |
| GeometryCollection | LineString | `#0000ff` | `showLines=true`, `lineColor=#ffff00` | `#ffff00` (override) |
| GeometryCollection | Point | `#0000ff` | `showPoints=true`, `pointColor=#ff00ff` | `#ff00ff` (override) |
| Any | Any | (none) | N/A | Color scale value |

---

## Requirements

1. **Toggle Setting**: Add a toggle in Display settings to enable/disable feature color property usage
2. **Color Property Name**: Add a text field to specify the property name (default: "color")
3. **Color Property Detection**: Check if a feature has the specified color property in its `properties` object
4. **Color Format Validation**: Support hex (`#RGB`, `#RRGGBB`, `#RRGGBBAA`), RGB (`rgb(r,g,b)`), and RGBA (`rgba(r,g,b,a)`) formats
5. **Fallback Behavior**: If toggle is off or no valid color property exists, use the existing color scale from visual settings
6. **All Geometry Types**: Ensure Points, Lines, and Polygons all render with correct colors
7. **Cross-Engine Consistency**: Same behavior in SVG, Canvas, and WebGL layers
8. **GeometryCollection Handling**: All nested geometries share the parent feature's color property

---

## Implementation Design

### 1. Visual Settings

Add new settings to `ChoroplethDisplaySettingsGroup` in `src/settings/groups/ChoroplethGroups.ts`:

```typescript
/**
 * Toggle to enable using color property from feature properties
 */
useFeatureColor: formattingSettings.ToggleSwitch = new formattingSettings.ToggleSwitch({
    name: "useFeatureColor",
    displayName: "Use Feature Color",
    description: "When enabled, uses the color property from GeoJSON/TopoJSON feature properties if available",
    value: false
});

/**
 * Property name to look for color values in feature properties
 */
featureColorProperty: formattingSettings.TextInput = new formattingSettings.TextInput({
    name: "featureColorProperty",
    displayName: "Color Property Name",
    description: "The property name in feature properties that contains the color value (e.g., 'color', 'fill', 'style_color')",
    value: "color",
    placeholder: "color"
});
```

Add to slices array and conditional visibility:

```typescript
slices: formattingSettings.Slice[] = [
    // ... existing slices
    this.useFeatureColor,
    this.featureColorProperty,
];

public applyConditionalDisplayRules(): void {
    // Show color property name only when feature color is enabled
    this.featureColorProperty.visible = this.useFeatureColor.value === true;
    // ... other rules
}
```

Update `ChoroplethOptions` interface in `src/types/index.ts`:

```typescript
export interface ChoroplethOptions {
    // ... existing properties
    
    /** Whether to use color property from feature properties */
    useFeatureColor: boolean;
    
    /** Property name to look for color values (default: "color") */
    featureColorProperty: string;
}
```

Update `OptionsService.ts` to include new options:

```typescript
// In getChoroplethOptions()
return {
    // ... existing options
    useFeatureColor: choroplethDisplaySettings.useFeatureColor.value,
    featureColorProperty: choroplethDisplaySettings.featureColorProperty.value || 'color',
};
```

### 2. Color Utility Functions

Create `src/utils/color.ts`:

```typescript
/**
 * Validates if a string is a valid CSS color value.
 * Supports: #RGB, #RRGGBB, #RRGGBBAA, rgb(), rgba()
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
 * @param properties - Feature properties object
 * @param propertyName - The property name to look for (default: "color")
 * @returns Valid CSS color string or null
 */
export function getFeatureColor(
  properties: Record<string, unknown> | null,
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
```

### 3. SVG Layer Modifications

Update `src/layers/svg/choroplethSvgLayer.ts`:

```typescript
import { getFeatureColor } from '../../utils/color';

// In render method, for each feature:
// Only check feature color if enabled in options
const featureColor = this.options.useFeatureColor 
  ? getFeatureColor(feature.properties, this.options.featureColorProperty)
  : null;

// Determine fill color with priority:
// 1. Feature's color property (if enabled and valid)
// 2. Color scale based on data value (existing logic)
// 3. NO_DATA_COLOR for missing values
let fillColor: string;
if (featureColor) {
  fillColor = featureColor;
} else if (pCode === undefined || isNoDataValue(valueRaw)) {
  fillColor = NO_DATA_COLOR;
} else {
  fillColor = this.options.colorScale(valueRaw);
}

// Apply to ALL geometry types from extractGeometries():
// - Polygons: fill with fillColor
// - Lines: stroke with nestedStyle.lineColor (NOT feature color)
// - Points: fill with nestedStyle.pointColor (NOT feature color)
//
// Note: GeometryCollection nested geometries share the parent feature's properties,
// so featureColor is determined once per feature, then applied consistently.
```

### 4. Canvas Layer Modifications

Update `src/layers/canvas/choroplethCanvasLayer.ts`:

```typescript
import { getFeatureColor } from '../../utils/color';

// In render loop:
for (const feature of this.geojson.features as GeoJSONFeature[]) {
  const pCode = feature.properties[this.options.dataKey];
  const value = this.valueLookup[pCode];
  
  // Check for feature-level color override (only if enabled)
  // This color applies to ALL geometries in this feature (including GeometryCollection)
  const featureColor = this.options.useFeatureColor
    ? getFeatureColor(feature.properties, this.options.featureColorProperty)
    : null;
  
  // Determine fill color - shared by all geometries in this feature
  const fill = featureColor 
    ?? ((pCode === undefined || isNoDataValue(value)) ? NO_DATA_COLOR : this.options.colorScale(value));
  
  // drawFeature handles all geometry types including GeometryCollections
  // collectGeometries() recursively extracts all nested geometries
  // All share the same fill color from the parent feature's properties
  drawFeature(ctx, feature, project, fill, strokeColor, strokeWidth, opacity, nestedStyle);
}
```

### 5. WebGL Layer Modifications

Update `src/layers/webgl/choroplethWebGLLayer.ts`:

```typescript
import { getFeatureColor } from '../../utils/color';

// In constructor, when building OL features:
for (const f of (options.geojson.features as GeoJSONFeature[])) {
  const pCode = f.properties?.[options.dataKey];
  const dp = (options.dataPoints || []).find((x: any) => x.pcode === pCode);
  
  // Check for feature-level color override (only if enabled)
  const featureColor = options.useFeatureColor
    ? getFeatureColor(f.properties, options.featureColorProperty)
    : null;
  
  // Determine fill color
  let fill: string;
  if (featureColor) {
    fill = featureColor;
  } else if (pCode === undefined || isNoDataValue(dp?.value)) {
    fill = NO_DATA_COLOR;
  } else {
    fill = options.colorScale(dp?.value);
  }
  
  // OL GeoJSON reader handles GeometryCollections - all geometries share same properties
  const feat = reader.readFeature(f, { featureProjection: 'EPSG:3857' });
  feat.set('fillSelected', fill);
  feat.set('fillDim', dimColor(fill));
  // ... rest of feature setup
}
```

---

## Color Priority Rules

### For FeatureCollection (Separate Features)

Each feature is styled independently:

```
Priority 1: feature.properties[colorPropertyName] (if valid hex/rgb/rgba)
Priority 2: Visual settings color scale (based on measure value)
Priority 3: NO_DATA_COLOR (transparent) for unmatched/null values
```

### For GeometryCollection (Nested Geometries)

All geometries share the parent feature's color:

```
Base Color: feature.properties[colorPropertyName] OR color scale OR NO_DATA_COLOR

Then for nested geometries:
- Polygons → Use base color for fill
- Lines → Use nestedStyle.lineColor (if showLines=true), else not rendered
- Points → Use nestedStyle.pointColor (if showPoints=true), else not rendered
```

### Color Override Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│ Feature (properties: { color: "#ff0000", pCode: "ABC" })           │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Is useFeatureColor enabled?                                        │
│       │                                                             │
│       ├── YES ─► Is properties[colorPropertyName] valid?            │
│       │              │                                              │
│       │              ├── YES ─► Use feature color "#ff0000"         │
│       │              │                                              │
│       │              └── NO ──► Fall through to color scale         │
│       │                                                             │
│       └── NO ──► Use color scale (existing behavior)               │
│                                                                     │
│  Final Color Applied To:                                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Polygons: fillColor = finalColor                            │   │
│  │ Lines:    strokeColor = nestedStyle.lineColor (if shown)    │   │
│  │ Points:   fillColor = nestedStyle.pointColor (if shown)     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## Geometry Type Rendering & Visual Layering

### Geometry Type Support Matrix

| Geometry Type | SVG | Canvas | WebGL | Notes |
|---------------|-----|--------|-------|-------|
| Point | ✅ Circle | ✅ Arc | ✅ Circle path | Uses nested point settings |
| MultiPoint | ✅ Multiple circles | ✅ Multiple arcs | ✅ Multiple paths | Uses nested point settings |
| LineString | ✅ Path stroke | ✅ Stroke | ✅ Stroke style | Uses nested line settings |
| MultiLineString | ✅ Multiple paths | ✅ Multiple strokes | ✅ Stroke style | Uses nested line settings |
| Polygon | ✅ Path fill | ✅ Fill | ✅ Fill style | Uses feature/scale color |
| MultiPolygon | ✅ Multiple paths | ✅ Multiple fills | ✅ Fill style | Uses feature/scale color |
| GeometryCollection | ✅ Recursive | ✅ Recursive | ✅ Recursive | Shared properties |

### Visual Layering Order (Bottom to Top)

Correct visual layering ensures proper z-order rendering:

```
┌─────────────────────────────────────────────────────────────────┐
│                       VISUAL LAYERS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 3 (Top):     Points  ●●●                                 │
│                     - Always visible above other geometries      │
│                     - Settings: pointRadius, pointColor          │
│                                                                  │
│  Layer 2 (Middle):  Lines   ───                                 │
│                     - Rendered above polygons, below points      │
│                     - Settings: lineWidth, lineColor             │
│                                                                  │
│  Layer 1 (Base):    Polygons ▢▢▢                                │
│                     - Base layer (filled areas)                  │
│                     - Settings: fillColor, strokeWidth           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Engine Implementation Details

| Engine | Layering Method | Status |
|--------|-----------------|--------|
| **SVG** | Separate `<g>` groups: `polygonGroup`, `lineGroup`, `pointGroup` | ✅ Correct |
| **Canvas** | Multi-pass rendering: Pass 1 (polygons) → Pass 2 (lines) → Pass 3 (points) | ✅ Correct |
| **WebGL** | OpenLayers flat rendering | ⚠️ Needs enhancement |

### Existing Nested Geometry Settings

The following settings **already exist** in `ChoroplethNestedGeometrySettingsGroup`:

| Setting | Type | Range | Default | Description |
|---------|------|-------|---------|-------------|
| `showNestedPoints` | Toggle | - | `true` | Show/hide point geometries |
| `nestedPointRadius` | NumUpDown | 1-20 | `4` | Point radius in pixels |
| `nestedPointColor` | ColorPicker | - | `#000000` | Point fill color |
| `nestedPointStrokeColor` | ColorPicker | - | `#ffffff` | Point border color |
| `nestedPointStrokeWidth` | NumUpDown | 0-5 | `1` | Point border width |
| `showNestedLines` | Toggle | - | `true` | Show/hide line geometries |
| `nestedLineColor` | ColorPicker | - | `#333333` | Line stroke color |
| `nestedLineWidth` | NumUpDown | 1-10 | `2` | Line width in pixels |

### WebGL Layer Enhancement Needed

The WebGL layer currently has **hardcoded point radius** (4px). It needs to read from nested geometry settings:

```typescript
// Current (hardcoded):
const r = 4; // radius in pixels

// Needed (from settings):
const r = this.options.nestedPointRadius || 4;
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/utils/color.ts` | **NEW** - Color validation utilities |
| `src/settings/groups/ChoroplethGroups.ts` | Add `useFeatureColor` toggle and `featureColorProperty` text input |
| `src/types/index.ts` | Add options to `ChoroplethOptions` interface |
| `src/services/OptionsService.ts` | Pass new options to choropleth layers |
| `src/layers/svg/choroplethSvgLayer.ts` | Add feature color detection |
| `src/layers/canvas/choroplethCanvasLayer.ts` | Add feature color detection |
| `src/layers/webgl/choroplethWebGLLayer.ts` | Add feature color detection + use nested style settings for point radius |

---

## Testing Plan

```typescript
describe('Feature Color Property Support', () => {
  describe('isValidCssColor()', () => {
    it('should validate hex colors', () => {
      expect(isValidCssColor('#fff')).toBe(true);
      expect(isValidCssColor('#ffffff')).toBe(true);
      expect(isValidCssColor('#ffffffaa')).toBe(true);
      expect(isValidCssColor('#gggggg')).toBe(false);
    });
    
    it('should validate rgb/rgba colors', () => {
      expect(isValidCssColor('rgb(255,0,0)')).toBe(true);
      expect(isValidCssColor('rgba(255,0,0,0.5)')).toBe(true);
    });
    
    it('should reject invalid colors', () => {
      expect(isValidCssColor('red')).toBe(false); // Named colors not supported
      expect(isValidCssColor('not-a-color')).toBe(false);
      expect(isValidCssColor(123)).toBe(false);
    });
  });
  
  describe('getFeatureColor()', () => {
    it('should extract color from properties with exact match', () => {
      expect(getFeatureColor({ color: '#ff0000' }, 'color')).toBe('#ff0000');
    });
    
    it('should support case-insensitive fallback', () => {
      expect(getFeatureColor({ Color: '#ff0000' }, 'color')).toBe('#ff0000');
      expect(getFeatureColor({ COLOR: '#ff0000' }, 'color')).toBe('#ff0000');
    });
    
    it('should support custom property names', () => {
      expect(getFeatureColor({ fill: '#00ff00' }, 'fill')).toBe('#00ff00');
      expect(getFeatureColor({ style_color: '#0000ff' }, 'style_color')).toBe('#0000ff');
    });
    
    it('should return null for invalid colors', () => {
      expect(getFeatureColor({ color: 'not-a-color' }, 'color')).toBe(null);
      expect(getFeatureColor({ color: 123 }, 'color')).toBe(null);
      expect(getFeatureColor(null, 'color')).toBe(null);
    });
  });
  
  describe('FeatureCollection styling', () => {
    it('should style each feature independently', () => {
      const fc = {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', properties: { color: '#ff0000' }, geometry: { type: 'Point', coordinates: [0, 0] } },
          { type: 'Feature', properties: { color: '#00ff00' }, geometry: { type: 'Point', coordinates: [1, 1] } }
        ]
      };
      
      const colors = fc.features.map(f => getFeatureColor(f.properties, 'color'));
      expect(colors).toEqual(['#ff0000', '#00ff00']);
    });
  });
  
  describe('GeometryCollection styling', () => {
    it('should use same color for all nested geometries', () => {
      const feature = {
        type: 'Feature',
        properties: { color: '#0000ff' },
        geometry: {
          type: 'GeometryCollection',
          geometries: [
            { type: 'Point', coordinates: [0, 0] },
            { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }
          ]
        }
      };
      
      // Color is extracted from feature.properties once
      const color = getFeatureColor(feature.properties, 'color');
      expect(color).toBe('#0000ff');
      
      // All geometries in the collection share this color
      // (actual rendering tested in integration tests)
    });
  });
});
```

---

## Estimated Effort

| Task | Hours |
|------|-------|
| Create color utilities (`src/utils/color.ts`) | 1h |
| Add settings to ChoroplethGroups.ts | 1h |
| Update types and OptionsService | 0.5h |
| Update SVG layer | 1.5h |
| Update Canvas layer | 1h |
| Update WebGL layer | 1.5h |
| Unit tests for color utilities | 1h |
| Integration testing (all engines) | 1.5h |
| **Total** | **9h** |

---

## Summary

| Aspect | Description |
|--------|-------------|
| **New Settings** | `useFeatureColor` toggle, `featureColorProperty` text field |
| **Color Formats** | `#RGB`, `#RRGGBB`, `#RRGGBBAA`, `rgb()`, `rgba()` |
| **FeatureCollection** | Each feature can have unique color |
| **GeometryCollection** | All nested geometries share parent's color |
| **Fallback** | Color scale → NO_DATA_COLOR |
| **Engines** | SVG, Canvas, WebGL (consistent behavior) |
| **Nested Styles** | Points/Lines use dedicated settings when shown |

---

# Mapbox Tileset as Choropleth Boundary Source

## Investigation Summary (December 2024)

### Current Architecture Analysis

The current choropleth boundary data pipeline supports two sources:

1. **GeoBoundaries** - Pre-packaged administrative boundary datasets via API/manifest
2. **Custom** - User-provided TopoJSON/GeoJSON URL

**Data Flow (GeoJSON Sources):**

```text
Boundary Source → HTTP Fetch → TopoJSON/GeoJSON → processGeoData() → FeatureCollection
                                                                            ↓
                                                              ┌─────────────┼─────────────┐
                                                              ▼             ▼             ▼
                                                           SVG Layer   Canvas Layer  WebGL Layer
```

### Render Engine Impact Analysis

#### Current Render Engines (for GeoJSON/TopoJSON)

| Engine | Layer Class | How It Works |
|--------|-------------|--------------|
| **SVG** | `ChoroplethSvgLayer` | D3.js `geoPath()` → SVG `<path>` elements |
| **Canvas** | `ChoroplethCanvasLayer` | Canvas 2D context path drawing |
| **WebGL** | `ChoroplethWebGLLayer` | OpenLayers WebGL with custom shaders |

**All three expect pre-processed GeoJSON FeatureCollection as input.**

#### Vector Tiles Are Fundamentally Different

OpenLayers `VectorTileLayer`:

- **Renders via OpenLayers' internal pipeline** — not through our custom layer classes
- Tiles stream in progressively as user pans/zooms
- Style function called per-feature as tiles load
- **Bypasses D3-based SVG and our custom Canvas/WebGL layers entirely**

#### Implication: Render Engine Selection is Irrelevant for Tilesets

| Source Type | Render Engine Dropdown | Why |
|-------------|------------------------|-----|
| GeoBoundaries | ✅ Relevant | User chooses SVG/Canvas/WebGL |
| Custom (GeoJSON) | ✅ Relevant | User chooses SVG/Canvas/WebGL |
| **Mapbox Tileset** | ❌ **Irrelevant** | OpenLayers handles rendering internally |

**Recommendation:** Hide the render engine selector when Mapbox Tileset is selected.

---

### Key Findings

1. **OpenLayers Vector Tile Support Available**
   - Package `ol/source/VectorTile` already imported in `MapService.ts`
   - `ol-mapbox-style` (v12.4.0) provides `MapboxVectorLayer`
   - OpenLayers natively supports MVT (Mapbox Vector Tile) format

2. **Mapbox Access Token Already Configurable**
   - Token available via data role `MapboxAccessToken`
   - Token also in Basemap settings (`mapboxAccessToken`)
   - Same token reusable for tileset boundary source

3. **Classification Does NOT Require Full Tileset**
   - Class breaks computed from **Power BI data values** (not tileset properties)
   - We pre-build `Map<pcode, color>` lookup from data
   - Apply colors dynamically as tiles stream in

4. **Performance Comparison**

   | Approach | Load Time | Memory | LOD | Complexity |
   |----------|-----------|--------|-----|------------|
   | Fetch tileset → GeoJSON | ❌ Slow (full download) | ❌ High | ❌ None | Low |
   | Native MVT rendering | ✅ Fast (streaming) | ✅ Low | ✅ Built-in | Medium |

---

### Recommended Approach: Native Vector Tile Rendering

Skip GeoJSON conversion. Use OpenLayers `VectorTileLayer` directly.

**Why This Works:**

```typescript
// Classification is computed from Power BI data, NOT from tileset
const colorValues = [45, 78, 23, 91, ...];  // From Power BI measure
const classBreaks = ss.ckmeans(colorValues, numClasses);  // Already computed
const colorScale = chroma.scale(['#fff', '#00f']).classes(classBreaks);

// Build lookup: pcode → color
const colorLookup = new Map<string, string>();
pcodes.forEach((pcode, i) => {
    colorLookup.set(pcode, colorScale(colorValues[i]).hex());
});

// Apply to tiles as they load (no need to fetch all features upfront)
const styleFunction = (feature: FeatureLike) => {
    const pcode = feature.get('pcode');
    const color = colorLookup.get(pcode) || '#cccccc';
    return new Style({ fill: new Fill({ color }) });
};
```

---

## Implementation Plan (Native MVT)

### Architecture for Mapbox Tileset Source

```text
Power BI Data ──────────────────────────────────────────────────────────┐
     │                                                                   │
     ▼                                                                   │
┌────────────────────┐                                                   │
│ Compute classBreaks│ ← From measure values (colorValues array)        │
│ Build colorLookup  │ ← Map<pcode, color>                              │
└─────────┬──────────┘                                                   │
          │                                                              │
          │    ┌─────────────────────────────────────────────────────────┘
          │    │
          ▼    ▼
┌─────────────────────────────────────────────────────────┐
│              VectorTileLayer (OpenLayers)               │
│  ┌───────────────────────────────────────────────────┐  │
│  │ VectorTileSource                                  │  │
│  │   url: mapbox://v4/{tilesetId}/{z}/{x}/{y}.mvt    │  │
│  │   format: MVT                                     │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │ styleFunction(feature)                            │  │
│  │   → lookup color by feature.pcode                 │  │
│  │   → return Style with fill color                  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
          │
          ▼
   OpenLayers internal Canvas/WebGL rendering
   (No SVG option — OL uses Canvas by default)
```

---

### Phase 1: Settings & Types

#### 1.1 Update Boundary Source Dropdown

```typescript
// In ChoroplethLocationBoundarySettingsGroup
boundaryDataSource: DropDown = new DropDown({
    name: "boundaryDataSource",
    displayName: "Boundary Source",
    value: { value: "geoboundaries", displayName: "GeoBoundaries" },
    items: [
        { value: "geoboundaries", displayName: "GeoBoundaries" },
        { value: "mapbox", displayName: "Mapbox Tileset" },
        { value: "custom", displayName: "Custom" }
    ]
});
```

#### 1.2 New Mapbox Tileset Settings

```typescript
mapboxTilesetId: TextInput = new TextInput({
    name: "mapboxTilesetId",
    displayName: "Tileset ID",
    description: "Mapbox Tileset ID (e.g., mapbox.country-boundaries-v1)",
    value: "",
    placeholder: "mapbox.country-boundaries-v1"
});

mapboxTilesetSourceLayer: TextInput = new TextInput({
    name: "mapboxTilesetSourceLayer",
    displayName: "Source Layer",
    description: "Layer name within tileset containing boundaries",
    value: "",
    placeholder: "country_boundaries"
});

mapboxTilesetIdField: TextInput = new TextInput({
    name: "mapboxTilesetIdField",
    displayName: "ID Property",
    description: "Property name in tileset features to match with data (e.g., iso_3166_1)",
    value: "",
    placeholder: "iso_3166_1"
});
```

#### 1.3 Types Update

```typescript
// In ChoroplethOptions
export interface ChoroplethOptions {
    // ... existing ...
    
    // Mapbox Tileset
    mapboxTilesetId?: string;
    mapboxTilesetSourceLayer?: string;
    mapboxTilesetIdField?: string;
}
```

---

### Phase 2: Vector Tile Layer Implementation

#### 2.1 Create ChoroplethVectorTileLayer

```typescript
// src/layers/ChoroplethVectorTileLayer.ts
import VectorTileLayer from 'ol/layer/VectorTile';
import VectorTileSource from 'ol/source/VectorTile';
import MVT from 'ol/format/MVT';
import { Style, Fill, Stroke } from 'ol/style';

export interface ChoroplethVectorTileOptions {
    tilesetId: string;
    accessToken: string;
    sourceLayer: string;
    idField: string;
    colorLookup: Map<string, string>;
    strokeColor: string;
    strokeWidth: number;
    opacity: number;
}

export class ChoroplethVectorTileLayer extends VectorTileLayer {
    private colorLookup: Map<string, string>;
    private idField: string;
    private strokeColor: string;
    private strokeWidth: number;
    
    constructor(options: ChoroplethVectorTileOptions) {
        const source = new VectorTileSource({
            format: new MVT(),
            url: `https://api.mapbox.com/v4/${options.tilesetId}/{z}/{x}/{y}.mvt?access_token=${options.accessToken}`,
        });
        
        super({
            source,
            opacity: options.opacity,
            declutter: false,
        });
        
        this.colorLookup = options.colorLookup;
        this.idField = options.idField;
        this.strokeColor = options.strokeColor;
        this.strokeWidth = options.strokeWidth;
        
        this.setStyle(this.createStyleFunction());
    }
    
    private createStyleFunction() {
        return (feature: FeatureLike) => {
            const id = feature.get(this.idField);
            const color = this.colorLookup.get(String(id)) || 'rgba(200,200,200,0.5)';
            
            return new Style({
                fill: new Fill({ color }),
                stroke: new Stroke({
                    color: this.strokeColor,
                    width: this.strokeWidth
                })
            });
        };
    }
    
    public updateColorLookup(colorLookup: Map<string, string>) {
        this.colorLookup = colorLookup;
        this.changed(); // Trigger re-render
    }
}
```

#### 2.2 Update ChoroplethOrchestrator

```typescript
// In fetchAndRenderChoroplethLayer
if (choroplethOptions.boundaryDataSource === "mapbox") {
    // Validate
    if (!choroplethOptions.mapboxTilesetId) {
        this.host.displayWarningIcon("Config Error", "Mapbox Tileset ID is required");
        return;
    }
    
    const accessToken = basemapOptions.mapboxAccessToken;
    if (!accessToken) {
        this.host.displayWarningIcon("Config Error", "Mapbox Access Token is required");
        return;
    }
    
    // Build color lookup from Power BI data
    const colorLookup = new Map<string, string>();
    dataPoints.forEach(dp => {
        const color = dataService.getColorFromClassBreaks(dp.value, classBreaks, colorScale);
        colorLookup.set(dp.pcode, color);
    });
    
    // Create vector tile layer (bypasses our SVG/Canvas/WebGL layers)
    this.choroplethLayer = new ChoroplethVectorTileLayer({
        tilesetId: choroplethOptions.mapboxTilesetId,
        accessToken,
        sourceLayer: choroplethOptions.mapboxTilesetSourceLayer || '',
        idField: choroplethOptions.mapboxTilesetIdField || 'id',
        colorLookup,
        strokeColor: choroplethOptions.strokeColor,
        strokeWidth: choroplethOptions.strokeWidth,
        opacity: choroplethOptions.layerOpacity
    });
    
    this.map.addLayer(this.choroplethLayer);
    return; // Skip normal GeoJSON rendering path
}
```

---

### Phase 3: Feature Parity Considerations

| Feature | GeoJSON Layers | Vector Tile Layer | Notes |
|---------|----------------|-------------------|-------|
| **Fill colors** | ✅ Full control | ✅ Style function | Same result |
| **Stroke styling** | ✅ Per-feature | ✅ Style function | Same result |
| **Opacity** | ✅ Layer-level | ✅ Layer-level | Same |
| **Tooltips** | ✅ D3/custom events | ⚠️ OL forEachFeatureAtPixel | Different API |
| **Selection** | ✅ Custom handlers | ⚠️ OL click events | Different API |
| **Legend** | ✅ From data | ✅ From data | Same (data-driven) |
| **Zoom-to-extent** | ✅ From GeoJSON bounds | ⚠️ Not automatic | Need viewport fitting |
| **Render engine choice** | ✅ SVG/Canvas/WebGL | ❌ N/A (OL internal) | Hide dropdown |

#### Tooltip & Selection Parity for Vector Tiles

**Current Approach (GeoJSON Layers)**:
- Uses `powerbi-visuals-utils-tooltiputils` `ITooltipServiceWrapper.addTooltip()`
- Attaches to D3 selections via pointer events
- Gets tooltip data via `getTooltipInfoDelegate(datapoint) → VisualTooltipDataItem[]`
- Gets selection ID via `getDataPointIdentity(datapoint) → ISelectionId`
- Uses `event.clientX/clientY` for tooltip positioning
- Calls `selectionManager.select(selectionId, ctrlKey)` on click

**Challenge with Vector Tiles**:
- Vector tile features are rendered internally by OpenLayers
- No D3 selection to attach `addTooltip()` to
- Feature data comes from tile, not our `ChoroplethDataPoint[]`
- Need to bridge OL feature → Power BI dataPoint lookup

**Solution: Manual Power BI Tooltip Service Integration**

```typescript
// In ChoroplethVectorTileLayer class
private tooltipLookup: Map<string, VisualTooltipDataItem[]>;
private selectionIdLookup: Map<string, ISelectionId>;

// Build lookup tables from dataPoints
public setDataPoints(dataPoints: ChoroplethDataPoint[]) {
    this.tooltipLookup = new Map();
    this.selectionIdLookup = new Map();
    for (const dp of dataPoints) {
        this.tooltipLookup.set(dp.pcode, dp.tooltip);
        this.selectionIdLookup.set(dp.pcode, dp.selectionId);
    }
}

// Tooltip via direct host.tooltipService call
private setupTooltipHandling() {
    // Show tooltip on pointer move
    this.map.on('pointermove', (evt: MapBrowserEvent<PointerEvent>) => {
        const features = this.map.getFeaturesAtPixel(evt.pixel, {
            layerFilter: (layer) => layer === this.vectorTileLayer
        });
        
        if (features.length > 0) {
            const feature = features[0];
            const pcode = feature.get(this.options.idField);
            const tooltipData = this.tooltipLookup.get(pcode);
            
            if (tooltipData) {
                // Call Power BI tooltip service directly (same as tooltiputils internally does)
                this.options.host.tooltipService.show({
                    coordinates: [evt.originalEvent.clientX, evt.originalEvent.clientY],
                    isTouchEvent: false,
                    dataItems: tooltipData,
                    identities: [this.selectionIdLookup.get(pcode)]
                });
            }
        } else {
            this.options.host.tooltipService.hide({
                immediately: false,
                isTouchEvent: false
            });
        }
    });
    
    // Hide tooltip on pointer leave
    this.map.getTargetElement().addEventListener('pointerout', () => {
        this.options.host.tooltipService.hide({
            immediately: true,
            isTouchEvent: false
        });
    });
}

// Selection via OpenLayers click
private setupSelectionHandling() {
    this.map.on('click', (evt: MapBrowserEvent<PointerEvent>) => {
        const features = this.map.getFeaturesAtPixel(evt.pixel, {
            layerFilter: (layer) => layer === this.vectorTileLayer
        });
        
        if (features.length > 0) {
            const feature = features[0];
            const pcode = feature.get(this.options.idField);
            const selectionId = this.selectionIdLookup.get(pcode);
            
            if (selectionId) {
                const additive = evt.originalEvent.ctrlKey || evt.originalEvent.metaKey;
                this.options.selectionManager.select(selectionId as any, additive)
                    .then((selectedIds: ISelectionId[]) => {
                        this.selectedIds = selectedIds;
                        this.updateStyles(); // Re-style for selection highlighting
                    });
            }
        } else {
            // Click on empty area - clear selection
            this.options.selectionManager.clear();
        }
    });
    
    // Context menu (right-click) for Power BI menu
    this.map.getTargetElement().addEventListener('contextmenu', (event: MouseEvent) => {
        event.preventDefault();
        const pixel = this.map.getEventPixel(event);
        const features = this.map.getFeaturesAtPixel(pixel, {
            layerFilter: (layer) => layer === this.vectorTileLayer
        });
        
        if (features.length > 0) {
            const feature = features[0];
            const pcode = feature.get(this.options.idField);
            const selectionId = this.selectionIdLookup.get(pcode);
            
            this.options.selectionManager.showContextMenu(
                selectionId ? selectionId : {},
                { x: event.clientX, y: event.clientY }
            );
        }
    });
}
```

**Key Parity Points**:

| Aspect | GeoJSON Layers | Vector Tile Layer | Parity |
|--------|----------------|-------------------|--------|
| Tooltip source | Power BI tooltips | Power BI tooltips | ✅ Same |
| Tooltip positioning | clientX/clientY | clientX/clientY | ✅ Same |
| Tooltip data | ChoroplethDataPoint.tooltip | Lookup by pcode | ✅ Same data |
| Selection API | selectionManager.select() | selectionManager.select() | ✅ Same |
| Ctrl+click multi-select | ✅ Supported | ✅ Supported | ✅ Same |
| Context menu | selectionManager.showContextMenu() | selectionManager.showContextMenu() | ✅ Same |
| Selection highlighting | Re-render with opacity | Style function update | ✅ Same visual |

**Dependencies**:
- Need `IVisualHost` passed to layer for `host.tooltipService` access
- Need `ISelectionManager` for selection handling
- Need `ChoroplethDataPoint[]` to build lookup tables

---

### Conditional UI Updates

```typescript
// In applyConditionalDisplayRules()
const isMapbox = this.boundaryDataSource.value?.value === "mapbox";

// Mapbox-specific settings
this.mapboxTilesetId.visible = isMapbox;
this.mapboxTilesetSourceLayer.visible = isMapbox;
this.mapboxTilesetIdField.visible = isMapbox;

// Hide render engine when using Mapbox (OL handles it)
// This would be in MapToolsSettingsGroup
// renderEngine.visible = !isMapbox;
```

---

## Estimated Effort (Native MVT)

| Task | Hours |
|------|-------|
| Settings update (dropdown, 3 new fields) | 1h |
| Types and OptionsService update | 0.5h |
| ChoroplethVectorTileLayer class | 2h |
| Orchestrator integration | 1.5h |
| Tooltip/Selection for vector tiles | 2h |
| Conditional visibility rules | 0.5h |
| Hide render engine for Mapbox source | 0.5h |
| Unit tests | 1.5h |
| Integration testing | 1.5h |
| **Total** | **11h** |

---

## API Reference

### Mapbox MVT Tile URL

```text
https://api.mapbox.com/v4/{tileset_id}/{z}/{x}/{y}.mvt?access_token={token}
```

### Example Tilesets

| Tileset ID | Description |
|------------|-------------|
| `mapbox.country-boundaries-v1` | Country boundaries |
| `mapbox.mapbox-streets-v8` | Streets with admin boundaries |
| `{username}.{tileset_name}` | Custom uploaded tileset |

---

## Open Questions

1. **Tileset Discovery**: How will users find their tileset ID and source layer name?
   - *Mitigation*: Provide examples in tooltip/placeholder text
2. ~~**Tooltip/Selection Parity**: Ensure Power BI tooltips and selection work~~ ✅ **Solved** - Use `host.tooltipService` directly
3. **Fallback**: Show message if tileset fails to load
4. **Caching**: OL handles tile caching, but token expiry?
5. **Multiple source layers**: Support filtering if tileset has multiple layers?

---

## Next Steps

1. [ ] Add "Mapbox Tileset" to boundary source dropdown
2. [ ] Add Tileset ID, Source Layer, ID Field settings
3. [ ] Create `ChoroplethVectorTileLayer` class
4. [ ] Update `ChoroplethOrchestrator` for "mapbox" source
5. [ ] Implement tooltip/selection for vector tiles
6. [ ] Hide render engine dropdown when Mapbox selected
7. [ ] Write unit tests
8. [ ] Test with `mapbox.country-boundaries-v1`
