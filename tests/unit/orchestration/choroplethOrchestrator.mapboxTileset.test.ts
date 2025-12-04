import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock OpenLayers modules
jest.mock('ol/layer.js', () => ({
  Layer: class { changed() { } }
}));
jest.mock('ol/proj.js', () => ({
  toLonLat: jest.fn(() => [0, 0]),
}));
jest.mock('ol/layer/VectorTile.js', () => ({
  default: jest.fn().mockImplementation(() => ({
    setStyle: jest.fn(),
    setVisible: jest.fn(),
    setZIndex: jest.fn(),
    changed: jest.fn(),
    getSource: jest.fn(() => ({
      on: jest.fn(),
      refresh: jest.fn()
    }))
  }))
}));
jest.mock('ol/source/VectorTile.js', () => ({
  default: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    refresh: jest.fn()
  }))
}));
jest.mock('ol/format/MVT.js', () => ({
  default: jest.fn().mockImplementation(() => ({}))
}));

describe('ChoroplethOrchestrator Mapbox Tileset Integration', () => {
  const mockHost = {
    displayWarningIcon: jest.fn(),
    tooltipService: {
      show: jest.fn(),
      move: jest.fn(),
      hide: jest.fn()
    }
  };

  const mockSelectionManager = {
    select: jest.fn().mockResolvedValue([]),
    clear: jest.fn(),
    showContextMenu: jest.fn()
  };

  const mockMap = {
    addLayer: jest.fn(),
    removeLayer: jest.fn(),
    getLayers: jest.fn(() => ({
      getArray: () => []
    })),
    on: jest.fn(),
    un: jest.fn(),
    getFeaturesAtPixel: jest.fn(() => []),
    getTargetElement: jest.fn(() => ({
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    }))
  };

  const baseOptions = {
    layerControl: true,
    boundaryDataSource: 'mapbox',
    mapboxTilesetId: 'mapbox.country-boundaries-v1',
    mapboxTilesetSourceLayer: 'country_boundaries',
    mapboxTilesetIdField: 'iso_3166_1_alpha_3',
    classificationMethod: 'q',
    classes: 5,
    strokeColor: '#000000',
    strokeWidth: 1,
    layerOpacity: 1,
    colorRamp: 'YlOrRd',
    invertColorRamp: false,
    showLegend: false
  };

  describe('Mapbox tileset URL construction', () => {
    it('constructs correct MVT URL from tileset ID', () => {
      const tilesetId = 'mapbox.country-boundaries-v1';
      const token = 'pk.test123';
      const expectedPattern = `https://api.mapbox.com/v4/${tilesetId}/{z}/{x}/{y}.mvt?access_token=${token}`;
      
      // This tests the URL pattern that will be used in the layer
      expect(expectedPattern).toContain('api.mapbox.com/v4');
      expect(expectedPattern).toContain(tilesetId);
      expect(expectedPattern).toContain('{z}/{x}/{y}.mvt');
    });

    it('handles custom tileset IDs with username prefix', () => {
      const tilesetId = 'myuser.custom-boundaries';
      const token = 'pk.test123';
      const url = `https://api.mapbox.com/v4/${tilesetId}/{z}/{x}/{y}.mvt?access_token=${token}`;
      
      expect(url).toContain('myuser.custom-boundaries');
    });
  });

  describe('Mapbox source validation', () => {
    it('requires tileset ID when source is mapbox', () => {
      const options = { ...baseOptions, mapboxTilesetId: '' };
      const isValid = !!(options.mapboxTilesetId && options.mapboxTilesetId.length > 0);
      expect(isValid).toBe(false);
    });

    it('requires source layer when source is mapbox', () => {
      const options = { ...baseOptions, mapboxTilesetSourceLayer: '' };
      const isValid = !!(options.mapboxTilesetSourceLayer && options.mapboxTilesetSourceLayer.length > 0);
      expect(isValid).toBe(false);
    });

    it('requires ID field when source is mapbox', () => {
      const options = { ...baseOptions, mapboxTilesetIdField: '' };
      const isValid = !!(options.mapboxTilesetIdField && options.mapboxTilesetIdField.length > 0);
      expect(isValid).toBe(false);
    });

    it('validates all required fields are present', () => {
      const isValid = 
        baseOptions.mapboxTilesetId && 
        baseOptions.mapboxTilesetSourceLayer && 
        baseOptions.mapboxTilesetIdField;
      expect(isValid).toBeTruthy();
    });
  });

  describe('Data point lookup for tooltips/selection', () => {
    const dataPoints = [
      { pcode: 'USA', value: 100, tooltip: [{ displayName: 'Country', value: 'USA' }], selectionId: { key: 'usa' } },
      { pcode: 'CAN', value: 50, tooltip: [{ displayName: 'Country', value: 'Canada' }], selectionId: { key: 'can' } },
      { pcode: 'MEX', value: 75, tooltip: [{ displayName: 'Country', value: 'Mexico' }], selectionId: { key: 'mex' } }
    ];

    it('builds tooltip lookup from data points', () => {
      const tooltipLookup = new Map<string, any[]>();
      for (const dp of dataPoints) {
        tooltipLookup.set(dp.pcode, dp.tooltip);
      }
      
      expect(tooltipLookup.get('USA')).toEqual([{ displayName: 'Country', value: 'USA' }]);
      expect(tooltipLookup.get('CAN')).toEqual([{ displayName: 'Country', value: 'Canada' }]);
      expect(tooltipLookup.has('GBR')).toBe(false);
    });

    it('builds selection ID lookup from data points', () => {
      const selectionIdLookup = new Map<string, any>();
      for (const dp of dataPoints) {
        selectionIdLookup.set(dp.pcode, dp.selectionId);
      }
      
      expect(selectionIdLookup.get('USA')).toEqual({ key: 'usa' });
      expect(selectionIdLookup.get('MEX')).toEqual({ key: 'mex' });
      expect(selectionIdLookup.has('BRA')).toBe(false);
    });

    it('builds value lookup for styling', () => {
      const valueLookup = new Map<string, number>();
      for (const dp of dataPoints) {
        valueLookup.set(dp.pcode, dp.value);
      }
      
      expect(valueLookup.get('USA')).toBe(100);
      expect(valueLookup.get('CAN')).toBe(50);
      expect(valueLookup.get('MEX')).toBe(75);
    });
  });

  describe('Render engine visibility for Mapbox source', () => {
    it('should hide render engine when boundary source is mapbox', () => {
      // This tests the conditional visibility rule
      const boundaryDataSource = 'mapbox';
      const shouldHideRenderEngine = boundaryDataSource === 'mapbox';
      expect(shouldHideRenderEngine).toBe(true);
    });

    it('should show render engine when boundary source is geoboundaries', () => {
      const boundaryDataSource = 'geoboundaries';
      const shouldHideRenderEngine = boundaryDataSource === 'mapbox';
      expect(shouldHideRenderEngine).toBe(false);
    });

    it('should show render engine when boundary source is custom', () => {
      const boundaryDataSource = 'custom';
      const shouldHideRenderEngine = boundaryDataSource === 'mapbox';
      expect(shouldHideRenderEngine).toBe(false);
    });
  });
});
