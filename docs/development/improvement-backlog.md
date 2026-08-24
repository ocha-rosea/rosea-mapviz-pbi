# Improvement Backlog

This backlog tracks implementation candidates from security, compliance, performance, and maintainability reviews. Items should be implemented incrementally and validated with targeted tests so current visual behavior stays stable.

## Status Legend

- `todo`: Not started.
- `in-progress`: Actively being implemented.
- `done`: Implemented and validated.
- `deferred`: Intentionally postponed with rationale.

## Power BI Compliance And Security

| ID | Priority | Status | Item | Notes |
| --- | --- | --- | --- | --- |
| SEC-001 | High | todo | Narrow `WebAccess` privileges | Replace broad wildcard hosts with an audited allowlist for actual basemap, boundary, and vector tile sources. Keep external access HTTPS-only. |
| SEC-002 | High | in-progress | Review visual privileges | `ExportContent` is now used for Phase 1 map export and declared as nonessential. Reassess `LocalStorage` after cache/debug usage is clarified. |
| SEC-003 | High | todo | Centralize outbound URL policy | Ensure all dynamic URLs pass one allowlist validator aligned with `capabilities.json`, including GeoBoundaries manifest entries and custom boundary URLs. |
| SEC-004 | Medium | todo | Validate map service credentials consistently | Apply public-token checks for Mapbox basemaps and vector tiles, avoid logging URLs containing tokens, and document that visual settings/data roles are not secret storage. |
| SEC-005 | Medium | todo | Review client-side cache storage | Clarify whether IndexedDB/local storage behavior is necessary in Power BI sandboxed runtime. Keep fallback behavior harmless when storage is unavailable. |
| SEC-006 | Medium | done | Resolve runtime audit finding | Resolved by in-range dependency updates. `npm audit --omit=dev` now reports zero vulnerabilities for shipped code. Remaining advisories are dev-only (`webpack-dev-server` via `powerbi-visuals-tools`) and require a major tooling upgrade. |

## Performance And Reliability

| ID | Priority | Status | Item | Notes |
| --- | --- | --- | --- | --- |
| PERF-001 | High | todo | Define large-data performance budgets | Document expected behavior for 5k, 10k, and 30k rows across SVG, Canvas, H3, hotspot, and vector tile modes. |
| PERF-002 | High | todo | Prefer Canvas for high-volume rendering | Keep existing render-engine behavior stable, then add guidance or automatic safeguards for large datasets where SVG hit layers are costly. |
| PERF-003 | Medium | in-progress | Reuse overlay elements where safe | Overlay clears are now scoped to the groups this visual owns (`DOMManager.clearOverlayGroups`) instead of wiping the whole overlay. Keyed per-feature updates remain outstanding. |
| PERF-004 | Medium | todo | Dispose vector tile timers/listeners fully | Track timer IDs and temporary tile listeners in vector tile layers so tests and runtime teardown do not leak handles. |
| PERF-005 | Medium | todo | Add benchmark fixtures | Add repeatable fixtures for large choropleth and circle datasets to measure render time, memory pressure, and interaction latency. |
| PERF-006 | High | in-progress | Implement phased map export | Phase 1 exports map state JSON through the Power BI download service. Next phases evaluate SVG/XML, PDF, and raster snapshot output. See [map-export.md](map-export.md). |

## Codebase Organization

| ID | Priority | Status | Item | Notes |
| --- | --- | --- | --- | --- |
| ORG-001 | High | todo | Split oversized modules by responsibility | Start with settings groups, legend rendering, circle SVG rendering, and choropleth orchestration. Keep public formatting names and behavior stable. |
| ORG-002 | High | todo | Introduce shared layer interfaces | Replace repeated `any` casts with interfaces for disposable, selectable, extent-aware map layers. |
| ORG-003 | Medium | todo | Separate URL resolution from rendering orchestration | Move GeoBoundaries/custom source resolution into a dedicated service to simplify `ChoroplethOrchestrator`. |
| ORG-004 | Medium | in-progress | Consolidate duplicated layer cleanup | SVG group and hit-layer removal is centralised in `DOMManager.clearOverlayGroups`. Canvas element and OpenLayers layer teardown in `visual.ts` is still inline. |
| ORG-005 | Medium | todo | Keep docs aligned with implementation | Update developer docs when privileges, URL policies, performance limits, or rendering defaults change. |

## Tooling And Dependency Hygiene

| ID | Priority | Status | Item | Notes |
| --- | --- | --- | --- | --- |
| TOOL-001 | High | done | Ignore generated coverage in lint | `npm run lint` now ignores generated coverage report assets. |
| TOOL-002 | High | done | Remove unused runtime dependencies | Removed unused Turf packages and accidental local `visual` dependency. Added `d3-geo` explicitly because source imports it directly. |
| TOOL-003 | Medium | todo | Modernize Jest transform config | Move deprecated `ts-jest` globals config into the transform entry. |
| TOOL-004 | Medium | todo | Address TypeScript 7 deprecations | Migrate or explicitly suppress deprecation warnings for `moduleResolution=node10` and `baseUrl` after confirming Power BI tooling compatibility. |
| TOOL-005 | Medium | todo | Investigate test open handles | Use targeted open-handle diagnostics for map/timer tests and tighten teardown. |
| TOOL-006 | Medium | done | Import OpenLayers modules directly | Layer subclasses imported the `ol/layer.js` barrel, which pulled `Heatmap` and the whole WebGL renderer into the bundle. They now import `ol/layer/Layer.js` directly. |

## Current Implementation Batch

This batch started with low-risk hygiene that should not alter visual rendering behavior:

- Done: TOOL-001 ignored generated coverage files during lint.
- Done: TOOL-002 removed unused dependency entries and made `d3-geo` explicit.
- In progress: SEC-002 keeps `ExportContent` as nonessential for Phase 1 map export; `LocalStorage` remains pending cache/debug review.
- In progress: PERF-006 implemented Phase 1 map state JSON export; richer visual output formats remain planned.

## Rendering Correctness Batch (v1.0.2.0)

- Done: restored SVG rendering. The export button's inline icon was being adopted as the shared SVG overlay, so all D3 output was drawn into a 24x24 icon coordinate space. Overlay creation no longer reuses arbitrary `svg` elements.
- Done: selection highlighting now compares Power BI selection ids with `equals()` instead of object reference, so selections arriving from slicers, bookmarks, and other visuals highlight correctly across every render engine.
- Done: PERF-003/ORG-004 partial - overlay clears are scoped to owned groups.
- Done: TOOL-006 narrowed OpenLayers imports.
- Done: SEC-006 shipped dependency updates clear the runtime audit.
- Done: landing page rewritten - localized instruction sentences and tips are now rendered (previously computed then discarded in favour of hardcoded English), sizing scales with the visual, and forced-colors themes are honoured.
