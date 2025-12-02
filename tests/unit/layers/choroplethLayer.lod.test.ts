import * as d3 from 'd3';

jest.mock('ol/layer.js', () => ({ Layer: class { changed(){} } }));
jest.mock('ol/proj.js', () => ({ toLonLat: jest.fn(() => [0,0]) }));

import { ChoroplethSvgLayer } from '../../../src/layers/svg/choroplethSvgLayer';
import type { ChoroplethLayerOptions, GeoJSON } from '../../../src/types';

function makeGeoJSON(): GeoJSON {
  // a few simple polygons so simplification has something to work with
  return {
    type: 'FeatureCollection',
    features: Array.from({length:4}).map((_,i) => ({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[i,0],[i+0.9,0],[i+0.9,0.9],[i,0.9],[i,0]]] },
      properties: { code: String.fromCharCode(65+i) }
    })) as any
  } as any;
}

function makeOptions(partial?: Partial<ChoroplethLayerOptions>): ChoroplethLayerOptions {
  const container = document.createElement('div');
  const svg = d3.select(document.body).append('svg') as any;
  const geojson = makeGeoJSON();
  return {
    svg,
    svgContainer: container,
    zIndex: 5,
    geojson,
    strokeColor: '#000',
    strokeWidth: 1,
    fillOpacity: 1,
    colorScale: () => '#123456',
    dataKey: 'code',
    categoryValues: ['A','B','C','D'],
    measureValues: [1,2,3,4],
    selectionManager: { select: jest.fn().mockResolvedValue([]) } as any,
    tooltipServiceWrapper: { addTooltip: jest.fn() } as any,
    // preparedGeometry provided by orchestrator - internal LOD is skipped
    preparedGeometry: {
      geojson: geojson as any,
      wasSimplified: true,
      level: 'light',
      tolerance: 0.0001,
      metrics: { featureCount: 4, totalVertices: 20, avgVerticesPerFeature: 5, geometryTypes: new Set(['Polygon']) },
      sourceType: 'geojson'
    },
    ...(partial as any),
  };
}

function frameState(resolution: number): any {
  return {
    size: [400, 300],
    viewState: { center: [0,0], resolution, projection: { code_: 'EPSG:3857'} },
  };
}

describe('ChoroplethSvgLayer simplification (Phase 3 - orchestrator-based)', () => {
  it('uses geojson directly without internal LOD caching', () => {
    const layer = new ChoroplethSvgLayer(makeOptions());
    const resolutions = [8000, 6000, 3000, 1500, 800]; // various zoom levels
    resolutions.forEach(r => layer.render(frameState(r)));
    // No internal simplifiedCache since LOD is removed
    const cache = (layer as any).simplifiedCache;
    expect(cache).toBeUndefined();
  });

  it('getSimplifiedGeoJsonForResolution returns geojson directly', () => {
    const layer = new ChoroplethSvgLayer(makeOptions());
    const original = (layer as any).geojson;
    // At any resolution, should return the same geojson (pre-simplified by orchestrator)
    const geo1 = (layer as any).getSimplifiedGeoJsonForResolution(8000);
    const geo2 = (layer as any).getSimplifiedGeoJsonForResolution(800);
    expect(geo1).toBe(original);
    expect(geo2).toBe(original);
  });

  it('renders correctly at different resolutions', () => {
    const layer = new ChoroplethSvgLayer(makeOptions());
    const fs = frameState(3200);
    // Should not throw when rendering
    expect(() => layer.render(fs)).not.toThrow();
    // Second render at same resolution should also work
    expect(() => layer.render(fs)).not.toThrow();
  });
});
