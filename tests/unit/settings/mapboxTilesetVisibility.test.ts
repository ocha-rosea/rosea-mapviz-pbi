import { describe, it, expect, beforeEach } from '@jest/globals';
// @ts-ignore internal import
import { RoseaMapVizFormattingSettingsModel } from '../../../src/settings';

function createChoroplethLocationBoundaryGroup() {
  const model = new RoseaMapVizFormattingSettingsModel();
  return model.ChoroplethVisualCardSettings.choroplethLocationBoundarySettingsGroup;
}

describe('Mapbox Tileset boundary source visibility rules', () => {
  let group: any;
  beforeEach(() => { group = createChoroplethLocationBoundaryGroup(); });

  function setSource(source: 'geoboundaries' | 'custom' | 'mapbox') {
    group.boundaryDataSource.value = { value: source, displayName: source };
  }

  it('has mapbox as a boundary source option', () => {
    const items = group.boundaryDataSource.items;
    const mapboxItem = items.find((i: any) => i.value === 'mapbox');
    expect(mapboxItem).toBeDefined();
    expect(mapboxItem.displayName).toBe('Mapbox Tileset');
  });

  it('shows mapbox tileset settings when source = mapbox', () => {
    setSource('mapbox');
    group.applyConditionalDisplayRules();
    
    expect(group.mapboxTilesetId.visible).toBe(true);
    expect(group.mapboxTilesetSourceLayer.visible).toBe(true);
    expect(group.mapboxTilesetIdField.visible).toBe(true);
  });

  it('hides mapbox tileset settings when source = geoboundaries', () => {
    setSource('geoboundaries');
    group.applyConditionalDisplayRules();
    
    expect(group.mapboxTilesetId.visible).toBe(false);
    expect(group.mapboxTilesetSourceLayer.visible).toBe(false);
    expect(group.mapboxTilesetIdField.visible).toBe(false);
  });

  it('hides mapbox tileset settings when source = custom', () => {
    setSource('custom');
    group.applyConditionalDisplayRules();
    
    expect(group.mapboxTilesetId.visible).toBe(false);
    expect(group.mapboxTilesetSourceLayer.visible).toBe(false);
    expect(group.mapboxTilesetIdField.visible).toBe(false);
  });

  it('hides geoboundaries controls when source = mapbox', () => {
    setSource('mapbox');
    group.applyConditionalDisplayRules();
    
    expect(group.geoBoundariesCountry.visible).toBe(false);
    expect(group.geoBoundariesReleaseType.visible).toBe(false);
    expect(group.geoBoundariesAdminLevel.visible).toBe(false);
    expect(group.boundaryIdField.visible).toBe(false);
  });

  it('hides custom controls when source = mapbox', () => {
    setSource('mapbox');
    group.applyConditionalDisplayRules();
    
    expect(group.topoJSON_geoJSON_FileUrl.visible).toBe(false);
    expect(group.topojsonObjectName.visible).toBe(false);
    expect(group.customBoundaryIdField.visible).toBe(false);
  });

  it('includes mapbox settings in slices when source = mapbox', () => {
    setSource('mapbox');
    group.applyConditionalDisplayRules();
    
    const sliceNames = group.slices.map((s: any) => s.name);
    expect(sliceNames).toContain('mapboxTilesetId');
    expect(sliceNames).toContain('mapboxTilesetSourceLayer');
    expect(sliceNames).toContain('mapboxTilesetIdField');
  });

  it('excludes mapbox settings from slices when source != mapbox', () => {
    setSource('geoboundaries');
    group.applyConditionalDisplayRules();
    
    const sliceNames = group.slices.map((s: any) => s.name);
    expect(sliceNames).not.toContain('mapboxTilesetId');
    expect(sliceNames).not.toContain('mapboxTilesetSourceLayer');
    expect(sliceNames).not.toContain('mapboxTilesetIdField');
  });
});

describe('Mapbox Tileset settings defaults', () => {
  let group: any;
  beforeEach(() => { group = createChoroplethLocationBoundaryGroup(); });

  it('mapboxTilesetId has correct default placeholder', () => {
    // Uses direct tileset ID approach (works with public tokens for public tilesets)
    expect(group.mapboxTilesetId.placeholder).toContain('ocha-rosea-1.rosea-ipc-combined-areas');
  });

  it('mapboxTilesetSourceLayer has correct default placeholder', () => {
    expect(group.mapboxTilesetSourceLayer.placeholder).toContain('ipc_areas');
  });

  it('mapboxTilesetIdField has correct default placeholder', () => {
    expect(group.mapboxTilesetIdField.placeholder).toContain('iso_3166_1');
  });
});
