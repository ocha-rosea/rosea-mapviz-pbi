// Mock problematic dependency before importing visual
jest.mock('ol-mapbox-style', () => ({ MapboxVectorLayer: class MockMapboxVectorLayer {} }));

import { describe, it, expect, jest } from '@jest/globals';
import { RoseaMapViz } from '../../../src/visual';

describe('RoseaMapViz combined auto-fit', () => {
  it('fits to union extent when choropleth and circle extents are available', () => {
    const fit = jest.fn();
    const visual = Object.create(RoseaMapViz.prototype) as any;

    visual.mapToolsOptions = {
      lockMapExtent: false,
      mapFitPaddingTop: 11,
      mapFitPaddingRight: 22,
      mapFitPaddingBottom: 33,
      mapFitPaddingLeft: 44
    };
    visual.map = { getView: () => ({ fit }) };
    visual.choroplethLayer = { getFeaturesExtent: () => [0, 1, 10, 11] };
    visual.circleLayer = { getFeaturesExtent: () => [-5, -2, 8, 20] };

    visual.fitActiveLayersCombined();

    expect(fit).toHaveBeenCalledWith(
      [-5, -2, 10, 20],
      { padding: [11, 22, 33, 44], duration: 0 }
    );
  });

  it('does not fit when map extent is locked', () => {
    const fit = jest.fn();
    const visual = Object.create(RoseaMapViz.prototype) as any;

    visual.mapToolsOptions = {
      lockMapExtent: true,
      mapFitPaddingTop: 11,
      mapFitPaddingRight: 22,
      mapFitPaddingBottom: 33,
      mapFitPaddingLeft: 44
    };
    visual.map = { getView: () => ({ fit }) };
    visual.choroplethLayer = { getFeaturesExtent: () => [0, 1, 10, 11] };
    visual.circleLayer = { getFeaturesExtent: () => [-5, -2, 8, 20] };

    visual.fitActiveLayersCombined();

    expect(fit).not.toHaveBeenCalled();
  });
});
