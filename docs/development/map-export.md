# Map Export Plan

This document tracks the planned export capability for Rosea MapViz. The goal is to let report users export useful map output without changing existing rendering behavior or relying on unsupported browser download behavior inside the Power BI sandbox.

## Platform Notes

Power BI has two different export paths that matter for Rosea MapViz:

- Power BI report export to PDF or PowerPoint is handled by the host. Noncertified custom visuals generally do not render in that export path; certified visuals are the supported exception.
- Visual-initiated file download is handled by the custom visual file download API. This requires the `ExportContent` privilege in `capabilities.json`, user confirmation, and the tenant setting that allows downloads from custom visuals.

The visual can call `selectionManager.showContextMenu()` to display the standard Power BI right-click context menu. However, custom commands in the report visual context menu are configured by Power BI embed/report command extensions, not by the custom visual package itself. For a packaged Rosea visual, the dependable implementation path is an in-visual export control or a host-provided command in embedded scenarios.

## Export Privilege

Map export should restore `ExportContent` as a nonessential privilege:

```json
{
  "name": "ExportContent",
  "essential": false
}
```

Nonessential keeps the visual usable when downloads are blocked by tenant policy or unsupported in the current host. Export code must check `downloadService.exportStatus()` before attempting a download.

## Phase Plan

### Phase 1: Export Map State JSON

Status: implemented.

Ship a low-risk export that downloads a JSON document containing map state and rendering metadata:

- visual name and export schema version
- export timestamp
- viewport size
- map center, zoom, rotation, and extent
- visible layer flags
- render engine setting
- legend visibility
- warning when download permission is unavailable

This verifies the privilege, host API, UX, and tests without attempting fragile image capture.

Implementation notes:

- `ExportContent` is declared as nonessential in `capabilities.json`.
- The visual checks `downloadService.exportStatus()` before download.
- The visual exports `rosea-mapviz-map-state-*.json` through `exportVisualsContentExtended()`.
- The export entry point is an in-visual map export button. Embedded host applications can additionally add their own context-menu command and route it to host-side behavior.

### Phase 2: Export Overlay SVG/XML

Add an export that serializes the SVG overlay and selected legend metadata. This should include generated choropleth/circle SVG marks when SVG rendering is active. Canvas-rendered overlays should report that SVG overlay export is unavailable for those layers.

### Phase 3: Export PDF Layout

Generate a PDF-friendly export containing the available map snapshot pieces, title/metadata, legend, attribution, and fallback messages. This phase should keep the generated file below the 30 MB file download API limit.

### Phase 4: Full Raster Snapshot Research

Investigate whether OpenLayers map canvas, external basemap tiles, vector tiles, canvas overlays, SVG overlays, and legends can be safely composited into a raster image. This depends on CORS behavior of basemap/tile sources and may not be reliable for every provider.

## Testing Strategy

- Unit test export payload creation independently from Power BI host services.
- Mock `downloadService.exportStatus()` for allowed, not declared, not supported, and disabled-by-admin statuses.
- Verify that blocked export attempts show a warning and do not throw.
- Validate Phase 1 with `npm run lint` and targeted Jest tests.
- Manually test in Power BI Desktop or Service because the download confirmation prompt is host behavior.

## Open Decisions

- Whether to expose export only as an on-map control, a formatting-controlled control, or both.
- Whether embedded customers need documented command-extension examples for adding an export item to the host visual context menu.
- Whether image/PDF export should include external basemaps, omit them, or provide a clear unsupported-provider warning.
