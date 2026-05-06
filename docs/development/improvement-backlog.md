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
| SEC-002 | High | in-progress | Remove unused visual privileges | Removed unused `ExportContent`. Reassess `LocalStorage` after cache/debug usage is clarified. |
| SEC-003 | High | todo | Centralize outbound URL policy | Ensure all dynamic URLs pass one allowlist validator aligned with `capabilities.json`, including GeoBoundaries manifest entries and custom boundary URLs. |
| SEC-004 | Medium | todo | Validate map service credentials consistently | Apply public-token checks for Mapbox basemaps and vector tiles, avoid logging URLs containing tokens, and document that visual settings/data roles are not secret storage. |
| SEC-005 | Medium | todo | Review client-side cache storage | Clarify whether IndexedDB/local storage behavior is necessary in Power BI sandboxed runtime. Keep fallback behavior harmless when storage is unavailable. |
| SEC-006 | Medium | todo | Resolve runtime audit finding | Address the moderate `protocol-buffers-schema` vulnerability inherited through OpenLayers/pbf when a compatible update path is available. |

## Performance And Reliability

| ID | Priority | Status | Item | Notes |
| --- | --- | --- | --- | --- |
| PERF-001 | High | todo | Define large-data performance budgets | Document expected behavior for 5k, 10k, and 30k rows across SVG, Canvas, H3, hotspot, and vector tile modes. |
| PERF-002 | High | todo | Prefer Canvas for high-volume rendering | Keep existing render-engine behavior stable, then add guidance or automatic safeguards for large datasets where SVG hit layers are costly. |
| PERF-003 | Medium | todo | Reuse overlay elements where safe | Replace full SVG overlay clears with keyed updates in hot paths after behavior tests are in place. |
| PERF-004 | Medium | todo | Dispose vector tile timers/listeners fully | Track timer IDs and temporary tile listeners in vector tile layers so tests and runtime teardown do not leak handles. |
| PERF-005 | Medium | todo | Add benchmark fixtures | Add repeatable fixtures for large choropleth and circle datasets to measure render time, memory pressure, and interaction latency. |

## Codebase Organization

| ID | Priority | Status | Item | Notes |
| --- | --- | --- | --- | --- |
| ORG-001 | High | todo | Split oversized modules by responsibility | Start with settings groups, legend rendering, circle SVG rendering, and choropleth orchestration. Keep public formatting names and behavior stable. |
| ORG-002 | High | todo | Introduce shared layer interfaces | Replace repeated `any` casts with interfaces for disposable, selectable, extent-aware map layers. |
| ORG-003 | Medium | todo | Separate URL resolution from rendering orchestration | Move GeoBoundaries/custom source resolution into a dedicated service to simplify `ChoroplethOrchestrator`. |
| ORG-004 | Medium | todo | Consolidate duplicated layer cleanup | Use shared helpers for removing SVG groups, hit layers, canvas elements, and OpenLayers layers. |
| ORG-005 | Medium | todo | Keep docs aligned with implementation | Update developer docs when privileges, URL policies, performance limits, or rendering defaults change. |

## Tooling And Dependency Hygiene

| ID | Priority | Status | Item | Notes |
| --- | --- | --- | --- | --- |
| TOOL-001 | High | done | Ignore generated coverage in lint | `npm run lint` now ignores generated coverage report assets. |
| TOOL-002 | High | done | Remove unused runtime dependencies | Removed unused Turf packages and accidental local `visual` dependency. Added `d3-geo` explicitly because source imports it directly. |
| TOOL-003 | Medium | todo | Modernize Jest transform config | Move deprecated `ts-jest` globals config into the transform entry. |
| TOOL-004 | Medium | todo | Address TypeScript 7 deprecations | Migrate or explicitly suppress deprecation warnings for `moduleResolution=node10` and `baseUrl` after confirming Power BI tooling compatibility. |
| TOOL-005 | Medium | todo | Investigate test open handles | Use targeted open-handle diagnostics for map/timer tests and tighten teardown. |

## Current Implementation Batch

This batch started with low-risk hygiene that should not alter visual rendering behavior:

- Done: TOOL-001 ignored generated coverage files during lint.
- Done: TOOL-002 removed unused dependency entries and made `d3-geo` explicit.
- In progress: SEC-002 removed unused `ExportContent`; `LocalStorage` remains pending cache/debug review.
