import { describe, it, expect, beforeEach, jest } from '@jest/globals';
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
  private listeners: Map<string, Function[]> = new Map();
  
  getView(){ return this.view as any; }
  getSize(){ return [800,600]; }
  
  on(event: string, handler: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }
  
  un(event: string, handler: Function) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx >= 0) handlers.splice(idx, 1);
    }
  }
  
  // Helper to simulate map movement (triggers moveend)
  simulateMoveEnd() {
    const handlers = this.listeners.get('moveend') || [];
    handlers.forEach(h => h());
  }
}

class MockMapService {
  zoomVisible: boolean | undefined;
  setZoomControlVisible(v: boolean){ this.zoomVisible = v; }
}

describe('MapToolsOrchestrator', () => {
  let map: MockMap; let svc: MockMapService; let orch: MapToolsOrchestrator; let persistCalls: any[];
  beforeEach(() => { map = new MockMap(); svc = new MockMapService(); orch = new MapToolsOrchestrator(map as any, svc as any); persistCalls = []; });

  describe('position tracking', () => {
    it('starts tracking position and captures initial position', () => {
      orch.startTrackingPosition();
      const pos = orch.getTrackedPosition();
      expect(pos).not.toBeNull();
      expect(pos!.extent).toBe('0,0,100,100');
      expect(pos!.zoom).toBe(5);
    });
    
    it('updates tracked position on moveend', () => {
      orch.startTrackingPosition();
      
      // Simulate user panning to new position
      map.view.setCenter([100, 100]);
      map.view.setZoom(8);
      (map.view as any).calculateExtent = () => [50, 50, 150, 150]; // New extent
      
      map.simulateMoveEnd();
      
      const pos = orch.getTrackedPosition();
      expect(pos!.extent).toBe('50,50,150,150');
      expect(pos!.zoom).toBe(8);
    });
    
    it('stops tracking when stopTrackingPosition is called', () => {
      orch.startTrackingPosition();
      orch.stopTrackingPosition();
      
      // Position should still be available (last tracked)
      const pos = orch.getTrackedPosition();
      expect(pos).not.toBeNull();
    });
  });

  describe('lock extent behavior', () => {
    it('restores saved position when lockMapExtent is true with stored extent', () => {
      orch.startTrackingPosition();
      
      orch.attach({
        renderEngine: 'canvas', lockMapExtent: true, showZoomControl: true,
        lockedMapExtent: '10,20,30,40', lockedMapZoom: 7,
        legendPosition: 'bottom-left', legendBorderWidth: 1, legendBorderColor: '#000', legendBackgroundColor: '#fff', legendBackgroundOpacity: .5,
        legendBorderRadius: 2, legendBottomMargin: 0, legendTopMargin: 0, legendLeftMargin: 0, legendRightMargin: 0
      } as any, (ext, zoom) => persistCalls.push({ext, zoom}));
      
      expect(svc.zoomVisible).toBe(true);
      expect(map.view.getZoom()).toBe(7);
      expect(map.view.getCenter()).toEqual([20, 30]); // center of extent [10,20,30,40]
      expect(persistCalls.length).toBe(0); // should NOT persist - just restore
    });

    it('uses tracked position when locking for the first time (empty lockedMapExtent)', () => {
      orch.startTrackingPosition();
      
      // Simulate user moving map before enabling lock
      map.view.setCenter([200, 200]);
      map.view.setZoom(10);
      (map.view as any).calculateExtent = () => [100, 100, 300, 300];
      map.simulateMoveEnd();
      
      // Now enable lock - should use the TRACKED position
      orch.attach({
        renderEngine: 'canvas', lockMapExtent: true, showZoomControl: true,
        lockedMapExtent: '', lockedMapZoom: undefined,
        legendPosition: 'bottom-left', legendBorderWidth: 1, legendBorderColor: '#000', legendBackgroundColor: '#fff', legendBackgroundOpacity: .5,
        legendBorderRadius: 2, legendBottomMargin: 0, legendTopMargin: 0, legendLeftMargin: 0, legendRightMargin: 0
      } as any, (ext, zoom) => persistCalls.push({ext, zoom}));
      
      expect(svc.zoomVisible).toBe(true);
      expect(persistCalls.length).toBe(1);
      expect(persistCalls[0].ext).toBe('100,100,300,300'); // tracked extent
      expect(persistCalls[0].zoom).toBe(10); // tracked zoom
    });

    it('does not persist changes when lock is disabled', () => {
      orch.startTrackingPosition();
      
      orch.attach({
        renderEngine: 'canvas', lockMapExtent: false, showZoomControl: true,
        lockedMapExtent: '', lockedMapZoom: undefined,
        legendPosition: 'bottom-left', legendBorderWidth: 1, legendBorderColor: '#000', legendBackgroundColor: '#fff', legendBackgroundOpacity: .5,
        legendBorderRadius: 2, legendBottomMargin: 0, legendTopMargin: 0, legendLeftMargin: 0, legendRightMargin: 0
      } as any, (ext, zoom) => persistCalls.push({ext, zoom}));
      
      expect(svc.zoomVisible).toBe(true);
      expect(persistCalls.length).toBe(0);
    });
  });

  describe('zoom control visibility', () => {
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
});
