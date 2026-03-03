# Developer Guide

This page contains setup and release instructions for contributors and maintainers.

## Local development

### Prerequisites

- Node.js 18+
- npm
- Power BI Desktop (Developer Mode)

### Commands

- Install dependencies: `npm install`
- Start dev visual: `npm start`
- Run tests: `npm test`
- Run lint: `npm run lint`
- Build package: `npm run build`

## Packaging

- Direct package command: `npx pbiviz package`
- Output file: `dist/*.pbiviz`

## Release workflow

Release automation is managed in `.github/workflows/build.yml`.

### Trigger types

- Push to `main` / `develop`
- Tag push `v*`
- Manual dispatch from Actions UI

### Manual dispatch options

- `publish_release` (boolean)
- `version_bump` (dropdown): `none`, `patch`, `minor`, `major`

### Versioning behavior

- Semantic bumps use `npm run version:auto` with `SEMVER_BUMP`.
- Build-only bumps increment the 4th version segment.
- Semantic tags use `vX.Y.Z`.
- Release assets are uploaded as versioned filenames.

See [docs/versioning.md](versioning.md) for policy and examples.

## Security notes

- External boundary URLs are HTTPS-only.
- Open-redirect query patterns are blocked.
- Ensure WebAccess privileges in `capabilities.json` cover required hosts.

## Related docs

- Contribution process: [../CONTRIBUTING.md](../CONTRIBUTING.md)
- Versioning policy: [versioning.md](versioning.md)
- Simplification tuning: [simplification.md](simplification.md)
- Product spec: [../spec/main.md](../spec/main.md)
