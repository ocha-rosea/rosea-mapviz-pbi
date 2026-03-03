# Map Types and Configuration Guide

This guide explains how to configure each Rosea MapViz map type in Power BI.

## Before you start

Add Rosea MapViz to your report and confirm you have the required fields:

- `Boundary ID` for choropleth joins
- `Latitude` and `Longitude` for point-based maps
- `Size` (1–2 measures) for circles
- `Color` for choropleth shading

## 1) Choropleth map

Use this when you want to color regions by a numeric value.

### Required fields

- `Boundary ID`
- `Color`

### Format settings

- **Choropleth → Display**: enable layer
- **Choropleth → Classification**: choose method and number of classes
- **Choropleth → Boundary**:
  - Source: `GeoBoundaries`, `Custom URL`, or `Mapbox Tileset`
  - Join field: match your `Boundary ID` values to boundary properties
- **Choropleth → Styling**: stroke, opacity, color ramp

### Tips

- If features do not appear, verify that your boundary join field values match exactly.
- For TopoJSON with multiple objects, set **TopoJSON Object Name**.

## 2) Scaled circles

Use this when you want marker size to represent one or two measures.

### Required fields

- `Latitude`
- `Longitude`
- `Size` (at least one measure)

### Format settings

- **Proportional Circles → Display**: enable layer
- **Chart Type**:
  - `simple-circle`
  - `nested-circle`
  - `pie-chart`
  - `donut-chart`
- **Scaling method**: linear, logarithmic, square root, quantile
- **Legend**: show/hide and style
- **Labels**: optional labels and offsets

### Tips

- Use quantile/log scaling for skewed values.
- Use two `Size` measures for nested/pie/donut modes.

## 3) H3 Hexbin

Use this for spatial aggregation when you have many points.

### Required fields

- `Latitude`
- `Longitude`

### Format settings

- **Proportional Circles → Display → Chart Type**: `h3-hexbin`
- **H3 settings**:
  - resolution (0–15)
  - color ramp and opacity

### Tips

- Lower resolution creates larger cells; higher resolution creates finer detail.
- Labels are hidden for aggregated map types by design.

## 4) Hotspot map

Use this to show concentration/density of points.

### Required fields

- `Latitude`
- `Longitude`

### Format settings

- **Proportional Circles → Display → Chart Type**: `hotspot`
- **Hotspot settings**:
  - blur / radius
  - glow intensity
  - hotspot color style

### Tips

- Start with moderate blur/radius and tune for your data density.

## 5) Combined maps (choropleth + circles)

You can enable both layers at the same time.

### Behavior

- The visual fits to the combined extent of active layers when map extent lock is off.
- Legends can be shown for one or both layers.
- Circle markers appear above region fills for readability.

## Basemap and credentials

### Basemap choices

- OpenStreetMap
- Mapbox
- MapTiler
- None

### Credentials

- Bind `Mapbox Access Token` / `MapTiler API Key` data roles when needed.
- Data-role credentials override format-pane values.

## Troubleshooting checklist

- No map output:
  - confirm required fields are bound
  - verify coordinate fields are numeric
  - verify `Boundary ID` matches boundary property values
- Slow rendering:
  - switch render engine to `Canvas`
  - reduce class count or increase simplification
- Wrong map extent:
  - disable **Lock Map Extent** for auto-fit behavior
