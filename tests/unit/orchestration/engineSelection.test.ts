// Engine selection tests for SVG vs Canvas
jest.mock("../../../src/layers/canvas/circleCanvasLayer", () => ({ CircleCanvasLayer: jest.fn().mockImplementation(() => ({ setSelectedIds: jest.fn(), setActive: jest.fn(), getFeaturesExtent: jest.fn().mockReturnValue([0,0,1,1]), dispose: jest.fn() })) }));
jest.mock("../../../src/layers/svg/circleSvgLayer", () => ({ CircleSvgLayer: jest.fn().mockImplementation(() => ({ setSelectedIds: jest.fn(), setActive: jest.fn(), getFeaturesExtent: jest.fn().mockReturnValue([0,0,1,1]), dispose: jest.fn() })), CircleLayer: jest.fn() }));
jest.mock("../../../src/layers/canvas/choroplethCanvasLayer", () => ({ ChoroplethCanvasLayer: jest.fn().mockImplementation(() => ({ setSelectedIds: jest.fn(), setActive: jest.fn(), getFeaturesExtent: jest.fn().mockReturnValue([0,0,1,1]), dispose: jest.fn() })) }));

import { CircleOrchestrator } from "../../../src/orchestration/CircleOrchestrator";
import { ChoroplethOrchestrator } from "../../../src/orchestration/ChoroplethOrchestrator";
import { LegendService } from "../../../src/services/LegendService";
import { CacheService } from "../../../src/services/CacheService";

function createStubSelection() { return { select: (_: string) => ({ selectAll: () => ({ remove: () => {} }) }), append: (_: string) => ({ attr: () => ({}) }), attr: () => ({}) } as any; }
const { CircleCanvasLayer: MockCircleCanvasLayer } = require("../../../src/layers/canvas/circleCanvasLayer");
const { CircleSvgLayer: MockCircleSvgLayer } = require("../../../src/layers/svg/circleSvgLayer");
const { ChoroplethCanvasLayer: MockChoroplethCanvasLayer } = require("../../../src/layers/canvas/choroplethCanvasLayer");

const mockHost: any = { displayWarningIcon: jest.fn(), createSelectionIdBuilder: () => ({ withCategory: () => ({ withMeasure: () => ({ createSelectionId: () => ({}) }) }) }) };
const mockMap: any = { addLayer: jest.fn(), removeLayer: jest.fn(), getView: () => ({ fit: jest.fn() }) };
const mockSelMgr: any = { registerOnSelectCallback: jest.fn() };
const mockTooltip: any = {};

describe("Engine selection behavior", () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test("CircleOrchestrator uses Canvas layer when renderEngine=canvas", () => {
    const svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const svg = createStubSelection();
    const svgContainer = global.document.createElement('div');
    const legendService = new LegendService(svgContainer);
    const orch = new CircleOrchestrator({ svg, svgOverlay, svgContainer, legendService, host: mockHost, map: mockMap, selectionManager: mockSelMgr, tooltipServiceWrapper: mockTooltip } as any);
    (orch as any)["renderCircleLayerOnMap"]({} as any, { renderEngine: 'canvas', lockMapExtent: false } as any, false);
    expect(MockCircleCanvasLayer).toHaveBeenCalledTimes(1);
    expect(mockMap.addLayer).toHaveBeenCalled();
  });

  test("CircleOrchestrator uses SVG layer when renderEngine=svg", () => {
    const svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const svg = createStubSelection();
    const svgContainer = global.document.createElement('div');
    const legendService = new LegendService(svgContainer);
    const orch = new CircleOrchestrator({ svg, svgOverlay, svgContainer, legendService, host: mockHost, map: mockMap, selectionManager: mockSelMgr, tooltipServiceWrapper: mockTooltip } as any);
    (orch as any)["renderCircleLayerOnMap"]({} as any, { renderEngine: 'svg', lockMapExtent: false } as any, false);
    expect(MockCircleSvgLayer).toHaveBeenCalledTimes(1);
    expect(mockMap.addLayer).toHaveBeenCalled();
  });

  test("ChoroplethOrchestrator uses Canvas when renderEngine=canvas", () => {
    const svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const svg = createStubSelection();
    const svgContainer = global.document.createElement('div');
    const legendService = new LegendService(svgContainer);
    const cacheService = new CacheService();
    const orch = new ChoroplethOrchestrator({ svg, svgOverlay, svgContainer, legendService, host: mockHost, map: mockMap, selectionManager: mockSelMgr, tooltipServiceWrapper: mockTooltip, cacheService } as any);
    (orch as any)["renderChoroplethLayerOnMap"]({} as any, { renderEngine: 'canvas', lockMapExtent: false } as any);
    expect(MockChoroplethCanvasLayer).toHaveBeenCalledTimes(1);
    expect(mockMap.addLayer).toHaveBeenCalled();
  });
});
