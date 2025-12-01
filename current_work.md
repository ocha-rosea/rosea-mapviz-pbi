# ROSEA MapViz Power BI Visual - Refactoring Plan

## Current State Analysis

### Overview
The ROSEA MapViz is a Power BI custom visual that renders geographic data as:
1. **Choropleth maps** - Color-coded boundary regions (countries, states, etc.)
2. **Scaled circles** - Proportional symbols at point locations

### Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                         visual.ts (519 lines)                    │
│                    Entry Point / Main Orchestrator               │
├─────────────────────────────────────────────────────────────────┤
│                       settings.ts (1539 lines)                   │
│            Formatting Model / Power BI Settings Pane             │
├─────────────────────────────────────────────────────────────────┤
│                     capabilities.json (692 lines)                │
│              Data Roles / Field Mappings / Objects               │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────────┐
│ Orchestrators│      │   Services   │      │      Layers      │
├──────────────┤      ├──────────────┤      ├──────────────────┤
│ Choropleth   │      │ MapService   │      │ choroplethLayer  │
│ Circle       │      │ LegendService│      │ circleLayer      │
│ MapTools     │      │ CacheService │      │ canvas/*         │
│ Base         │      │ OptionsService│     │ webgl/*          │
└──────────────┘      │ ColorRamp*   │      └──────────────────┘
                      │ DataRole     │
                      │ GeoBoundaries│
                      │ Message      │
                      └──────────────┘
```

---

## Key Issues Identified

### 1. **settings.ts is Monolithic (1539 lines)**
- Contains 15+ settings group classes in one file
- Business logic mixed with UI configuration
- Async data fetching inside formatting pane classes
- Difficult to test individual settings groups

### 2. **visual.ts has Mixed Responsibilities (~519 lines)**
- DOM management
- Service instantiation
- Layer lifecycle management
- Legend positioning
- State persistence
- Error handling scattered throughout

### 3. **Inconsistent Naming Conventions**
- `proportalCircles` (typo - should be `proportional`)
- Mixed camelCase/PascalCase in property names
- Some class names don't match file names

### 4. **Tight Coupling**
- `visual.ts` directly manipulates DOM elements
- Orchestrators depend on specific SVG/Canvas container structures
- Settings groups have async side effects during display rule application

### 5. **Type Safety Gaps**
- Many `any` types throughout codebase
- Options interfaces don't fully cover all settings
- Layer types use union types with `as any` casts

### 6. **Missing Abstraction Layers**
- No clear separation between UI state and domain logic
- Legend positioning logic embedded in visual.ts
- Color ramp configuration scattered across multiple services

---

## Refactoring Plan

### Phase 1: Settings Module Decomposition
**Goal:** Break `settings.ts` into focused, testable modules

#### 1.1 Create Settings Directory Structure
```
src/settings/
├── index.ts                      # Re-exports RoseaMapVizFormattingSettingsModel
├── FormattingSettingsModel.ts    # Main model (minimal)
├── groups/
│   ├── index.ts
│   ├── BasemapSettingsGroup.ts
│   ├── MapboxSettingsGroup.ts
│   ├── MaptilerSettingsGroup.ts
│   ├── CircleDisplaySettingsGroup.ts
│   ├── CircleLegendSettingsGroup.ts
│   ├── ChoroplethBoundarySettingsGroup.ts
│   ├── ChoroplethClassificationSettingsGroup.ts
│   ├── ChoroplethDisplaySettingsGroup.ts
│   ├── ChoroplethLegendSettingsGroup.ts
│   ├── MapToolsSettingsGroup.ts
│   └── LegendContainerSettingsGroup.ts
├── cards/
│   ├── index.ts
│   ├── BasemapCard.ts
│   ├── CircleCard.ts
│   ├── ChoroplethCard.ts
│   └── ControlsCard.ts
└── behaviors/
    ├── ConditionalVisibility.ts   # Extracted display rule logic
    └── GeoBoundariesLoader.ts     # Async catalog/data fetching
```

#### 1.2 Extract Async Logic from Settings
- Move `populateReleaseAndAdminFromCatalog()` to a dedicated service
- Move `populateBoundaryIdFieldsFromData()` to GeoBoundariesService
- Settings groups should be pure configuration with no side effects

#### 1.3 Fix Naming Inconsistencies
- Rename `proportalCircles*` → `proportionalCircles*`
- Ensure all class names match their purpose

---

### Phase 2: Visual.ts Decomposition
**Goal:** Reduce visual.ts to pure coordination, delegating all work to services

#### 2.1 Create VisualLifecycleManager
```typescript
// src/lifecycle/VisualLifecycleManager.ts
export class VisualLifecycleManager {
    constructor(private host: IVisualHost) {}
    
    onConstruct(options: VisualConstructorOptions): void;
    onUpdate(options: VisualUpdateOptions): void;
    onDestroy(): void;
}
```

#### 2.2 Create DOMManager Service
```typescript
// src/services/DOMManager.ts
export class DOMManager {
    createContainer(id: string, styles: CSSStyleDeclaration): HTMLElement;
    createSvgOverlay(): SVGSVGElement;
    positionLegend(position: LegendPosition, margins: MarginConfig): void;
    updateOverlayVisibility(hasContent: boolean): void;
}
```

#### 2.3 Create LayerManager Service
```typescript
// src/services/LayerManager.ts
export class LayerManager {
    addLayer(layer: BaseLayer): void;
    removeLayer(id: string): void;
    updateLayer(id: string, options: LayerOptions): void;
    getLayer(id: string): BaseLayer | undefined;
}
```

#### 2.4 Simplified visual.ts Target (~150 lines)
```typescript
export class RoseaMapViz implements IVisual {
    private lifecycle: VisualLifecycleManager;
    private dom: DOMManager;
    private layers: LayerManager;
    
    constructor(options: VisualConstructorOptions) {
        this.lifecycle = new VisualLifecycleManager(options.host);
        this.dom = new DOMManager(options.element);
        this.layers = new LayerManager();
        this.lifecycle.onConstruct(options);
    }
    
    update(options: VisualUpdateOptions) {
        this.lifecycle.onUpdate(options);
    }
    
    getFormattingModel(): FormattingModel {
        return this.formattingService.buildModel();
    }
    
    destroy(): void {
        this.lifecycle.onDestroy();
    }
}
```

---

### Phase 3: Type System Improvements
**Goal:** Eliminate `any` types and improve type safety

#### 3.1 Create Strict Layer Types
```typescript
// src/types/layers.ts
export interface IMapLayer {
    readonly id: string;
    attach(map: Map): void;
    detach(): void;
    update(options: unknown): void;
    dispose(): void;
}

export interface IChoroplethLayer extends IMapLayer {
    setFeatures(geojson: FeatureCollection): void;
    setColorScale(scale: ColorScale): void;
}

export interface ICircleLayer extends IMapLayer {
    setDataPoints(points: CircleDataPoint[]): void;
}
```

#### 3.2 Strict Options Types
```typescript
// src/types/options.ts
export interface ChoroplethOptions {
    readonly layerControl: boolean;
    readonly boundarySource: BoundarySource;
    readonly classification: ClassificationConfig;
    readonly display: ChoroplethDisplayConfig;
    readonly legend: LegendConfig;
}
```

#### 3.3 Add Branded Types for IDs
```typescript
// src/types/brands.ts
type PCode = string & { readonly __brand: 'PCode' };
type ISO3Code = string & { readonly __brand: 'ISO3Code' };
```

---

### Phase 4: Service Consolidation
**Goal:** Reduce service count and clarify responsibilities

#### 4.1 Merge Related Services
| Current Services | Proposed | Rationale |
|------------------|----------|-----------|
| ColorRampHelper, ColorRampManager | ColorService | Single responsibility for colors |
| GeoBoundariesService, GeoBoundariesCatalogService | GeoBoundariesService | Unified boundary data access |
| ChoroplethDataService | DataTransformService | Generic data transformation |

#### 4.2 Create Service Registry
```typescript
// src/services/ServiceRegistry.ts
export class ServiceRegistry {
    static readonly map: MapService;
    static readonly legend: LegendService;
    static readonly color: ColorService;
    static readonly geoBoundaries: GeoBoundariesService;
    static readonly cache: CacheService;
    static readonly message: MessageService;
    
    static initialize(host: IVisualHost): void;
}
```

---

### Phase 5: Orchestrator Refactoring
**Goal:** Standardize orchestrator patterns and reduce duplication

#### 5.1 Strengthen BaseOrchestrator
```typescript
// src/orchestration/BaseOrchestrator.ts
export abstract class BaseOrchestrator<TOptions, TLayer extends IMapLayer> {
    protected abstract createLayer(options: TOptions): TLayer;
    protected abstract updateLegend(options: TOptions): void;
    
    public render(options: TOptions): TLayer | undefined {
        this.validate(options);
        const layer = this.createLayer(options);
        this.updateLegend(options);
        return layer;
    }
}
```

#### 5.2 Extract Common Patterns
- Data validation → `ValidationService`
- Tooltip building → `TooltipBuilder`
- Selection handling → `SelectionService`

---

### Phase 6: Testing Infrastructure
**Goal:** Improve testability and coverage

#### 6.1 Increase Unit Test Isolation
- Mock all Power BI APIs consistently
- Create test factories for options/settings
- Add snapshot tests for legend rendering

#### 6.2 Add Integration Test Coverage
- End-to-end data flow tests
- Layer interaction tests
- Settings change propagation tests

---

## Implementation Priority

| Phase | Priority | Effort | Impact | Dependencies |
|-------|----------|--------|--------|--------------|
| 1 - Settings Decomposition | HIGH | Medium | High | None |
| 2 - Visual.ts Decomposition | HIGH | High | High | Phase 1 |
| 3 - Type Improvements | MEDIUM | Low | Medium | None |
| 4 - Service Consolidation | MEDIUM | Medium | Medium | Phase 1, 2 |
| 5 - Orchestrator Refactoring | LOW | Medium | Medium | Phase 2, 4 |
| 6 - Testing Infrastructure | MEDIUM | Medium | High | Phase 1, 2 |

---

## Quick Wins (Can Start Immediately)

1. ✅ **Fix typo:** `proportalCircles` → `proportionalCircles` throughout codebase - DONE (commit d4e7589)
2. ✅ **Extract constants:** Move magic numbers to `constants/defaults.ts` - DONE (commit d4e7589)
   - Created `src/constants/defaults.ts` with organized default values
   - ProportionalCirclesDefaults, ChoroplethDefaults, LegendContainerDefaults, etc.
3. ✅ **Add JSDoc comments:** Document public APIs in services - DONE (commit 0f2fdda)
   - MapService, OptionsService, CacheService, LegendService, MessageService, DataRoleService
4. ✅ **Create type guards:** Add runtime type validation for external data - DONE (commit 86457c6)
   - Created `src/types/guards.ts` with comprehensive type guards
   - GeoJSON/TopoJSON validation, options validation, metadata validation
5. ✅ **Consolidate imports:** Create barrel exports for each directory - DONE (commit 0f2fdda)
   - src/constants/index.ts, src/services/index.ts, src/orchestration/index.ts, src/utils/index.ts

---

## File Size Targets After Refactoring

| File | Current | Target | Strategy |
|------|---------|--------|----------|
| settings.ts | 1539 lines | <100 lines | Split into 12+ modules |
| visual.ts | 519 lines | <150 lines | Delegate to services |
| ChoroplethOrchestrator.ts | 611 lines | <300 lines | Extract data prep |
| CircleOrchestrator.ts | 314 lines | <200 lines | Extract common logic |

---

## Next Steps

1. [ ] Create feature branch: `refactor/settings-decomposition`
2. [ ] Start with Phase 1.1: Create settings directory structure
3. [ ] Migrate one settings group at a time with tests
4. [ ] Ensure build passes after each migration
5. [ ] Update imports in visual.ts progressively

---

## Completed Work Log

### Quick Wins - Completed December 2025

- **Commit d4e7589**: Fixed `proportalCircles` → `proportionalCircles` typo in settings.ts and OptionsService.ts
- **Commit d4e7589**: Created `src/constants/defaults.ts` with extracted magic numbers
  - Build verified: `pbiviz package` SUCCESS
  - Tests verified: 64 suites, 210 tests PASSED
- **Commit 0f2fdda**: Added JSDoc comments to public APIs
  - MapService, OptionsService, CacheService, LegendService, MessageService, DataRoleService
- **Commit 0f2fdda**: Created barrel exports (index.ts) for all major directories
  - src/constants/, src/services/, src/orchestration/, src/utils/
- **Commit 86457c6**: Created type guards for runtime validation
  - Created `src/types/guards.ts` with 15+ type guard functions
  - GeoJSON validation, TopoJSON validation, options validation, metadata validation
  - Build verified: `pbiviz package` SUCCESS
  - Tests verified: 64 suites, 210 tests PASSED

### All Quick Wins Complete ✅

---

### Phase 1: Settings Decomposition - Completed December 2025 ✅

- **Commit 8b9e390**: Decomposed monolithic settings.ts into modular structure
  - Created `src/settings/` directory with groups/ and cards/ subdirectories
  - Extracted 12+ settings group classes into individual files
  - Created barrel exports for clean imports
  - Reduced settings.ts complexity significantly
  - Build verified: SUCCESS | Tests: 210/210 PASSED

---

### Phase 2: Visual.ts Decomposition - Completed December 2025 ✅

- **Commit 2b0d164**: Extracted core services from visual.ts
  - Created `src/services/DOMManager.ts` - DOM element management (321 lines)
  - Created `src/services/StateManager.ts` - State persistence (109 lines)
  - Reduced visual.ts to pure coordination role
  - Build verified: SUCCESS | Tests: 210/210 PASSED

---

### Phase 3: UniqueClassificationService Extraction - Completed December 2025 ✅

- **Commit f01dd28**: Extracted unique classification from ChoroplethOrchestrator
  - Created `src/services/UniqueClassificationService.ts` (246 lines)
    - Stable color mapping for unique/categorical classification
    - Maintains persistent category-to-color mappings across filtering
    - Handles both numeric and text-based categorical values
  - Reduced ChoroplethOrchestrator from 611 → 422 lines (31% reduction)
  - Build verified: SUCCESS | Tests: 210/210 PASSED

---

### Bug Fix: GeoBoundaries URLs - Completed December 2025 ✅

- **Commit 4f31b05**: Fixed 404 error for GeoBoundaries data
  - Corrected URLs from `IM4SEA/geoboundaries-lite` to `maplumi/geoboundaries-lite`
  - Updated 4 URLs in VisualConfig.ts
  - Verified with HEAD request: HTTP 200 OK
  - Build verified: SUCCESS | Tests: 210/210 PASSED

---

### Phase 4: JSDoc Documentation - Completed December 2025 ✅

- **Commit 4bce4df**: Added comprehensive JSDoc to orchestrators
  - BaseOrchestrator: Class-level docs, constructor, all utility methods
  - MapToolsOrchestrator: Class-level docs, constructor, attach/detach
  - CircleOrchestrator: Class-level docs with example, all public/private methods
  - ChoroplethOrchestrator: Class-level docs with example, all methods
  - Key services already had JSDoc (DOMManager, StateManager, UniqueClassificationService, LegendService)
  - Build verified: SUCCESS | Tests: 210/210 PASSED

---

## Refactoring Progress Summary

| Phase | Description | Status | Commit | Lines Changed |
|-------|-------------|--------|--------|---------------|
| Quick Wins | Typos, constants, JSDoc, guards | ✅ | d4e7589, 0f2fdda, 86457c6 | +500 |
| Phase 1 | Settings decomposition | ✅ | 8b9e390 | +1200/-1000 |
| Phase 2 | Visual.ts decomposition | ✅ | 2b0d164 | +430/-200 |
| Phase 3 | UniqueClassificationService | ✅ | f01dd28 | +246/-189 |
| Bug Fix | GeoBoundaries URLs | ✅ | 4f31b05 | +4/-4 |
| Phase 4 | JSDoc documentation | ✅ | 4bce4df | +292/-17 |
| Phase 5 | Type improvements & testing | 🔄 | - | - |

---

## Notes

- All refactoring should be backward compatible
- Maintain existing test coverage during refactoring
- Run `npm test` and `pbiviz package` after each change
- Document any breaking changes in CHANGELOG.md
