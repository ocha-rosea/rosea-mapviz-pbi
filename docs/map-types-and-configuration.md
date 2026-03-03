<!-- markdownlint-disable MD032 -->
# Map Types and Configuration Guide

This is a complete user-facing guide to all Rosea MapViz configuration sections in Power BI.

## Data roles (what you bind in Visualizations pane)

- `Boundary ID`: join key for choropleth boundaries
- `Latitude`, `Longitude`: coordinates for point-based displays (circles, hotspot, H3)
- `Size` (up to 2 measures): circle size values
- `Color` (1 measure): choropleth shading value
- `Tooltips`: optional extra hover fields
- `Mapbox Access Token`, `MapTiler API Key`: optional credential roles (override format-pane credentials when provided)

## A) Global configuration (applies to all map types)

### A1) Basemap card

- **Select Basemap**: OpenStreetMap, Mapbox, MapTiler, or No Basemap
- **Extra Attribution**: append custom attribution text

**Mapbox settings** (shown only when basemap = Mapbox):
- **Access Token**: Mapbox token
- **Select Map Style**: built-in styles or custom
- **Custom Style URL**: used when style = custom
- **Declutter Labels**: reduce overlapping labels

**MapTiler settings** (shown only when basemap = MapTiler):
- **API Key**
- **Select Map Style**

### A2) Map Tools card

- **Render Engine**: `SVG` (quality) or `Canvas` (performance)
- **Lock Map Extent**: preserves/locks map view behavior
- **Show Zoom Control**: show/hide zoom UI
- **Fit Padding Top/Right/Bottom/Left**: auto-fit margins in pixels

### A3) Legend Container card

- **Position**: top/bottom + left/center/right
- **Border Width / Rounded Corners / Border Color**
- **Background Color / Background Opacity**
- **Top/Bottom/Left/Right Margin** (available margins vary by selected position)

## B) Choropleth configuration

Use choropleth when you want region fills by value.

### B1) Required fields

- `Boundary ID`
- `Color`

### B2) Choropleth → Boundary group

- **Boundary Source**:
  - `GeoBoundaries`
  - `Custom`
  - `Mapbox Tileset`

**If source = GeoBoundaries**:
- **Country/Region**
- **Source Tag**
- **Release Type** (hidden when Country = All Countries)
- **Administrative Level** (hidden when Country = All Countries)
- **Boundary ID Field** (dropdown, auto-populated when possible)

**If source = Custom**:
- **TopoJSON/GeoJSON URL**
- **TopoJSON Object Name (optional)**
- **Boundary ID Field (custom)**

**If source = Mapbox Tileset**:
- **Tileset ID**
- **Source Layer**
- **ID Field**
- **Tileset Access Token**

### B3) Choropleth → Classification and Display group

- **Method**: Categorical/Ordinal (Unique), Quantile, Equal Interval, Logarithmic, K-means, Jenks
- **Classes**: class count (up to 7)

**Unique/Categorical method settings**:
- **Class 1..7 value inputs**
- **Class 1..7 colors**
- **Others Color** for overflow categories

**Non-unique method settings**:
- **Color Ramp**
- **Custom Color Ramp** (shown when ramp = custom)
- **Invert Color Ramp**
- **Color Mode** (LAB/RGB/HSL/HSV/LCH)

**Common display settings**:
- **Stroke Color / Stroke Width**
- **Layer Opacity**
- **Simplification Strength**
- **Use Feature Color**
- **Color Property Name** (shown when Use Feature Color = on)

### B4) Choropleth → Legend group

- **Show Legend**
- **Legend Title Alignment**
- **Legend Orientation**
- **Legend Label Position**
- **Legend Title Color**
- **Legend Labels Color**
- **Legend Item Margin**

### B5) Choropleth → Nested Geometries group

For GeometryCollection data where points/lines are included:

- **Show Points**
  - Point Radius
  - Point Color
  - Point Stroke Color
  - Point Stroke Width
- **Show Lines**
  - Line Color
  - Line Width

## C) Scaled Circles configuration

Use circles when marker size (and optionally split composition) represents values.

### C1) Required fields

- `Latitude`
- `Longitude`
- `Size` (at least one measure)

### C2) Scaled Circles → Display group

- **Display Type**:
  - `Nested Circle`
  - `Donut Chart`
  - `Pie Chart`
  - `Hotspot (Heat Points)`
  - `H3 Hexbin Aggregation`

**Circle style settings** (for nested/donut/pie):
- Circles 1 Color
- Circles 2 Color (shown only when second size measure exists and chart type uses it)
- Minimum Radius / Maximum Radius
- Stroke Color / Stroke Width
- Circles 1 Opacity / Circles 2 Opacity

**Visual effects** (for circles + hotspot):
- Enable Blur / Blur Radius
- Enable Glow / Glow Color / Glow Intensity

### C3) H3 Hexbin settings (shown only when Display Type = H3 Hexbin)

- **H3 Resolution** (0–15)
- **Aggregation**: sum/count/average/min/max
- **Value Scaling**: linear/logarithmic/square root/quantile
- **Color Ramp**
- **Custom Gradient colors**: low/middle/high (shown when Color Ramp = custom)
- **Stroke Color / Stroke Width**
- **Min Opacity / Max Opacity**

### C4) Hotspot settings (shown only when Display Type = Hotspot)

- **Hotspot Intensity**
- **Hotspot Radius**
- **Hotspot Color / Glow Color**
- **Blur Amount**
- **Min Opacity / Max Opacity**
- **Scale by Value**
- **Value Scaling** (shown when Scale by Value = on)

### C5) Scaled Circles → Legend group

- **Show Legend**
- **Legend Title Color**
- **Legend Item Stroke Color / Width** (hidden for hotspot/h3)
- **Leader Line Color** (hidden for hotspot/h3)
- **Label Text Color**
- **Label Spacing** (hidden for hotspot/h3)
- **Round Legend Values** (hidden for hotspot/h3)
- **Hide Min Circle** + thresholds (hidden for hotspot/h3)
- **X Padding / Y Padding** (hidden for hotspot/h3)

### C6) Scaled Circles → Labels group

Labels are hidden for `Hotspot` and `H3 Hexbin`.

- **Show Labels**
- **Label Source**: label field/location ID/size/size2/first tooltip
- **Display Units**
- **Decimal Places**
- **Font Size / Color / Family**
- **Position**
- **Label Offset**
- **Background settings**: show, color, opacity, padding, radius
- **Border settings**: show, color, width
- **Halo settings**: show, color, width

## D) Combined map setup (choropleth + circles)

When both layers are enabled:

- Auto-fit uses the combined extent of active layers (if map extent lock is off)
- Both legends can be enabled
- Global legend container settings style both legend sections
- Circle layer is rendered on top of polygons for readability

## E) Practical setup recipes

### E1) Choropleth only

1. Bind `Boundary ID` + `Color`
2. Enable Choropleth
3. Configure Boundary source + join field
4. Choose Classification method, classes, and colors
5. Turn on Choropleth legend (optional)

### E2) Circles only

1. Bind `Latitude` + `Longitude` + `Size`
2. Enable Scaled Circles
3. Choose display type (nested/pie/donut)
4. Set radius range, stroke, opacity
5. Enable circle legend/labels if needed

### E3) Hotspot only

1. Bind `Latitude` + `Longitude` (and optional value measure)
2. Set Display Type = Hotspot
3. Tune intensity/radius/blur/colors
4. Use Scale by Value for value-weighted hotspots

### E4) H3 Hexbin only

1. Bind `Latitude` + `Longitude` (and optional value measure)
2. Set Display Type = H3 Hexbin
3. Set resolution and aggregation
4. Configure color ramp and opacity range

## F) Troubleshooting

- **No map output**:
  - required fields missing for selected layer
  - join field mismatch (`Boundary ID` vs source property)
  - invalid/blocked boundary URL
- **Unexpected colors**:
  - check method (`Unique` vs numeric methods)
  - verify custom ramp format and invert toggle
  - check feature-color override toggles
- **Performance issues**:
  - switch render engine to `Canvas`
  - increase simplification strength for heavy polygons
  - use H3/Hotspot for dense point data
- **Extent behavior not as expected**:
  - disable `Lock Map Extent` for auto-fit
  - adjust fit padding values in Map Tools
