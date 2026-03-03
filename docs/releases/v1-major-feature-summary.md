# v1.0.0 Major Release Feature Summary

This document summarizes the core capabilities delivered for the first major release of Rosea MapViz.

## Core map capabilities

- Choropleth mapping with multiple statistical classification methods
- Scaled circles with single- and dual-measure display support
- H3 hexbin aggregation for dense point datasets
- Hotspot density visualization for concentration analysis
- Combined choropleth + circles rendering in a single visual

## Data and styling capabilities

- Flexible boundary source options:
  - GeoBoundaries
  - Custom TopoJSON/GeoJSON URL
  - Mapbox vector tileset source
- Unique/categorical and numeric classification workflows
- Custom color ramps and interpolation color modes
- Feature-property-driven color support for boundary data
- Nested geometry styling (point/line elements in geometry collections)

## Basemap and map interaction capabilities

- Basemap support:
  - OpenStreetMap
  - Mapbox
  - MapTiler
  - No basemap mode
- SVG and Canvas render engine options for quality/performance tradeoffs
- Auto-fit behavior with configurable map fit padding
- Lock map extent behavior with persisted extent/zoom support
- Optional zoom controls and interaction management

## Legend and labeling capabilities

- Choropleth legend configuration (orientation, labels, title alignment)
- Proportional circle legend configuration and thresholds
- Shared legend container styling and positioning controls
- Circle label system with source selection, formatting, and styling
- Conditional label/legend behavior for aggregated chart types

## Reliability and UX improvements

- Immediate response to formatting and data updates
- Stale async render protection for choropleth workflows
- Coordinated combined auto-fit when multiple layers are enabled
- Defensive error handling for data and boundary fetch/render paths
- High-contrast mode handling for accessibility consistency

## Security and governance

- HTTPS enforcement for external boundary URL sources
- Open redirect guardrails for custom URL workflows
- Scoped AI maintainer governance instructions for project alignment

## Testing and quality

- Broad unit/integration test coverage across rendering, orchestration, settings, and helpers
- Focused tests for autofit behavior and edge-case orchestration flows
- CI release workflow improvements for semantic dispatch and cleaner release notes
