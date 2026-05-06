import { describe, expect, it } from '@jest/globals';
import { MapExportService } from '../../../src/services/MapExportService';

class MockView {
    calculateExtent() { return [1, 2, 3, 4]; }
    getCenter() { return [10, 20]; }
    getZoom() { return 6; }
    getRotation() { return 0.25; }
}

class MockMap {
    private view = new MockView();
    getView() { return this.view as any; }
    getSize() { return [800, 600]; }
}

describe('MapExportService', () => {
    it('builds a map state payload from map and DOM state', () => {
        const container = document.createElement('div');
        Object.defineProperty(container, 'clientWidth', { value: 800 });
        Object.defineProperty(container, 'clientHeight', { value: 600 });

        const svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgOverlay.style.display = 'block';

        const svgContainer = document.createElement('div');
        const canvas = document.createElement('canvas');
        canvas.id = 'circles-canvas';
        svgContainer.appendChild(canvas);

        const legendContainer = document.createElement('div');
        legendContainer.style.display = 'block';

        const exportedAt = new Date('2026-05-06T12:34:56.000Z');
        const payload = MapExportService.buildMapStatePayload({
            map: new MockMap() as any,
            container,
            svgOverlay,
            svgContainer,
            legendContainer,
            mapToolsOptions: {
                renderEngine: 'canvas',
                lockMapExtent: true,
                showZoomControl: true,
                lockedMapExtent: '1,2,3,4',
                lockedMapZoom: 6,
                mapFitPaddingTop: 0,
                mapFitPaddingRight: 0,
                mapFitPaddingBottom: 0,
                mapFitPaddingLeft: 0,
                legendPosition: 'top-right',
                legendBorderWidth: 1,
                legendBorderRadius: 2,
                legendBorderColor: '#000000',
                legendBackgroundColor: '#ffffff',
                legendBackgroundOpacity: 0.8,
                legendBottomMargin: 0,
                legendTopMargin: 0,
                legendLeftMargin: 0,
                legendRightMargin: 0
            },
            choroplethLayer: {},
            circleLayer: {},
            exportedAt
        });

        expect(payload.schemaVersion).toBe('1.0');
        expect(payload.visual).toBe('Rosea MapViz');
        expect(payload.exportedAt).toBe('2026-05-06T12:34:56.000Z');
        expect(payload.viewport).toEqual({ width: 800, height: 600 });
        expect(payload.map.center).toEqual([10, 20]);
        expect(payload.map.zoom).toBe(6);
        expect(payload.map.rotation).toBe(0.25);
        expect(payload.map.extent).toEqual([1, 2, 3, 4]);
        expect(payload.layers).toMatchObject({
            choroplethVisible: true,
            circlesVisible: true,
            svgOverlayVisible: true,
            legendVisible: true,
            canvasOverlayIds: ['circles-canvas']
        });
        expect(payload.mapTools).toMatchObject({
            renderEngine: 'canvas',
            lockMapExtent: true,
            lockedMapExtent: '1,2,3,4',
            lockedMapZoom: 6
        });
    });

    it('serializes payload as pretty JSON', () => {
        const content = MapExportService.serializePayload({
            schemaVersion: '1.0',
            visual: 'Rosea MapViz',
            exportedAt: '2026-05-06T12:34:56.000Z',
            viewport: { width: 1, height: 2 },
            map: { center: null, zoom: null, rotation: null, extent: null },
            layers: {
                choroplethVisible: false,
                circlesVisible: false,
                svgOverlayVisible: false,
                legendVisible: false,
                canvasOverlayIds: []
            },
            mapTools: {
                renderEngine: null,
                lockMapExtent: null,
                lockedMapExtent: null,
                lockedMapZoom: null
            },
            warnings: []
        });

        expect(content).toContain('\n  "schemaVersion": "1.0"');
    });

    it('creates filesystem-safe json filenames', () => {
        const fileName = MapExportService.createFileName(new Date('2026-05-06T12:34:56.789Z'));
        expect(fileName).toBe('rosea-mapviz-map-state-2026-05-06T12-34-56-789Z.json');
    });
});
