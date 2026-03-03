# Copilot Instructions for AI Maintainers

These instructions are mandatory for any AI agent contributing to this repository.

## Project purpose (do not drift)

This project builds and maintains **Rosea MapViz**, a Power BI custom visual focused primarily on humanitarian maps including these map types:

- Choropleth mapping
- Scaled circles
- H3 hexbin aggregation
- Hotspot density visualization
- Reliable map interaction, fitting, legends, and formatting behavior in Power BI

All changes must directly support this purpose. Avoid adding unrelated product ideas or experimental scope.

While scope drift must be avoided, new map types are allowed when they clearly align with the project objective (Power BI map visualization capabilities) and are implemented in a backward-compatible, maintainable way.

## Scope guardrails

- Do not introduce unrelated feature domains (auth systems, dashboards, backend APIs, unrelated UI modules).
- Do not rebrand or rename core product artifacts unless explicitly requested by maintainers.
- Do not break compatibility with existing Power BI data roles and formatting model names unless explicitly required.
- Prefer incremental, backward-compatible changes.

## Change discipline

- Fix root causes, not temporary patches.
- Keep diffs small and targeted to the user request.
- Do not refactor large areas unless necessary for correctness.
- Preserve existing APIs, settings names, and visual behavior contracts where possible.
- Update docs when behavior/configuration changes.

## Code quality rules

- Follow existing TypeScript, formatting, and architecture patterns used in `src/`.
- Avoid one-letter variable names and avoid unnecessary comments.
- Keep rendering performant for large datasets.
- Preserve high-contrast/accessibility behavior where present.
- Keep security constraints intact (HTTPS-only external URLs, no unsafe redirect behavior).

## Testing and validation

Before completing substantial changes:

- Run targeted tests for changed areas.
- Run broader tests when risk is medium/high.
- Do not claim success without validating results.
- If tests fail, fix relevant regressions introduced by the change.

## Documentation rules

- Root `README.md` is user-focused.
- Developer/maintainer details belong in `docs/` and `CONTRIBUTING.md`.
- Keep docs concise, accurate, and aligned with actual behavior in code.

## Release/versioning rules

- Respect semantic versioning strategy documented in `docs/versioning.md`.
- Do not alter release automation behavior casually.
- Keep release assets and workflow changes consistent with repository conventions.

## Forbidden actions unless explicitly requested

- Massive structural rewrites
- Introducing new external services or telemetry
- Removing existing capabilities
- Changing licensing
- Force-pushing or rewriting git history

## Decision policy for ambiguous requests

When requirements are unclear:

1. Choose the simplest interpretation that preserves project purpose.
2. Prefer minimal implementation over speculative enhancements.
3. Ask for clarification only when it materially changes behavior.

## Handoff checklist

For every meaningful change, provide:

- What changed
- Why it changed
- Validation performed
- Any follow-up recommendation
