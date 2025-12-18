import { describe, it, expect, beforeEach } from '@jest/globals';
import { MapToolsOrchestrator } from '../../../src/orchestration/MapToolsOrchestrator';

// Minimal Map + View mocks to exercise attach/detach logic
class MockView {
  private zoom = 5;
  private center = [50, 50];
  calculateExtent() { return [0,0,100,100]; }
  getZoom() { return this.zoom; }
  setZoom(z: number) { this.zoom = z; }
  getCenter() { return this.center; }
  setCenter(c: any) { this.center = c; }
}
class MockMap {
  view = new MockView();
  getView(){ return this.view as any; }
  getSize(){ return [800,600]; }
}

class MockMapService {
  zoomVisible: boolean | undefined;
  setZoomControlVisible(v: boolean){ this.zoomVisible = v; }
}

describe('MapToolsOrchestrator', () => {
  let map: MockMap; let svc: MockMapService; let orch: MapToolsOrchestrator; let persistCalls: any[];
  beforeEach(() => { map = new MockMap(); svc = new MockMapService(); orch = new MapToolsOrchestrator(map as any, svc as any); persistCalls = []; });

  it('restores saved position when lockMapExtent is true with stored extent', () => {
    orch.attach({
      renderEngine: 'canvas', lockMapExtent: true, showZoomControl: true,
      lockedMapExtent: '10,20,30,40', lockedMapZoom: 7,
      legendPosition: 'bottom-left', legendBorderWidth: 1, legendBorderColor: '#000', legendBackgroundColor: '#fff', legendBackgroundOpacity: .5,
      legendBorderRadius: 2, legendBottomMargin: 0, legendTopMargin: 0, legendLeftMargin: 0, legendRightMargin: 0
    } as any, (ext, zoom) => persistCalls.push({ext, zoom}));
    
    expect(svc.zoomVisible).toBe(true); // zoom control independent of lock state
    expect(map.view.getZoom()).toBe(7); // zoom restored to saved value
    expect(map.view.getCenter()).toEqual([20, 30]); // center restored to center of extent
    expect(persistCalls.length).toBe(0); // should NOT persist - just restore
  });

  it('captures current position ONCE when locking for the first time (empty lockedMapExtent)', () => {
    orch.attach({
      renderEngine: 'canvas', lockMapExtent: true, showZoomControl: true,
      lockedMapExtent: '', lockedMapZoom: undefined,
      legendPosition: 'bottom-left', legendBorderWidth: 1, legendBorderColor: '#000', legendBackgroundColor: '#fff', legendBackgroundOpacity: .5,
      legendBorderRadius: 2, legendBottomMargin: 0, legendTopMargin: 0, legendLeftMargin: 0, legendRightMargin: 0
    } as any, (ext, zoom) => persistCalls.push({ext, zoom}));
    
    expect(svc.zoomVisible).toBe(true);
    expect(persistCalls.length).toBe(1); // should have persisted current position ONCE
    expect(persistCalls[0].ext).toBe('0,0,100,100'); // current extent from mock
    expect(persistCalls[0].zoom).toBe(5); // current zoom from mock
  });

  it('does not persist changes when lock is disabled', () => {
    orch.attach({
      renderEngine: 'canvas', lockMapExtent: false, showZoomControl: true,
      lockedMapExtent: '', lockedMapZoom: undefined,
      legendPosition: 'bottom-left', legendBorderWidth: 1, legendBorderColor: '#000', legendBackgroundColor: '#fff', legendBackgroundOpacity: .5,
      legendBorderRadius: 2, legendBottomMargin: 0, legendTopMargin: 0, legendLeftMargin: 0, legendRightMargin: 0
    } as any, (ext, zoom) => persistCalls.push({ext, zoom}));
    
    expect(svc.zoomVisible).toBe(true);
    expect(persistCalls.length).toBe(0); // should NOT persist when lock is disabled
  });

  it('shows zoom controls when showZoomControl is true regardless of lock state', () => {
    orch.attach({
      renderEngine: 'canvas', lockMapExtent: true, showZoomControl: true,
      lockedMapExtent: '0,0,100,100', lockedMapZoom: 5,
      legendPosition: 'bottom-left', legendBorderWidth: 1, legendBorderColor: '#000', legendBackgroundColor: '#fff', legendBackgroundOpacity: .5,
      legendBorderRadius: 2, legendBottomMargin: 0, legendTopMargin: 0, legendLeftMargin: 0, legendRightMargin: 0
    } as any, () => {});
    expect(svc.zoomVisible).toBe(true);
  });

  it('hides zoom controls when showZoomControl is false', () => {
    orch.attach({
      renderEngine: 'canvas', lockMapExtent: true, showZoomControl: false,
      lockedMapExtent: '0,0,100,100', lockedMapZoom: 5,
      legendPosition: 'bottom-left', legendBorderWidth: 1, legendBorderColor: '#000', legendBackgroundColor: '#fff', legendBackgroundOpacity: .5,
      legendBorderRadius: 2, legendBottomMargin: 0, legendTopMargin: 0, legendLeftMargin: 0, legendRightMargin: 0
    } as any, () => {});
    expect(svc.zoomVisible).toBe(false);
  });
});
