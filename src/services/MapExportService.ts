import Map from "ol/Map";
import type { MapToolsOptions } from "../types";

export interface MapStateExportArgs {
    map: Map;
    container: HTMLElement;
    svgOverlay: SVGSVGElement;
    svgContainer: HTMLElement;
    legendContainer: HTMLElement;
    mapToolsOptions?: MapToolsOptions;
    choroplethLayer?: unknown;
    circleLayer?: unknown;
    exportedAt?: Date;
}

export interface MapStateExportPayload {
    schemaVersion: "1.0";
    visual: "Rosea MapViz";
    exportedAt: string;
    viewport: {
        width: number;
        height: number;
    };
    map: {
        center: [number, number] | null;
        zoom: number | null;
        rotation: number | null;
        extent: [number, number, number, number] | null;
    };
    layers: {
        choroplethVisible: boolean;
        circlesVisible: boolean;
        svgOverlayVisible: boolean;
        legendVisible: boolean;
        canvasOverlayIds: string[];
    };
    mapTools: {
        renderEngine: string | null;
        lockMapExtent: boolean | null;
        lockedMapExtent: string | null;
        lockedMapZoom: number | null;
    };
    warnings: string[];
}

export class MapExportService {
    public static buildMapStatePayload(args: MapStateExportArgs): MapStateExportPayload {
        const view = args.map.getView();
        const size = args.map.getSize();
        const warnings: string[] = [
            "This Phase 1 export contains map state and metadata only. Image, SVG, and PDF export are planned for later phases."
        ];

        const extent = view && size
            ? view.calculateExtent(size) as [number, number, number, number]
            : null;
        const center = view?.getCenter?.() as [number, number] | undefined;
        const canvasOverlayIds = Array.from(args.svgContainer.querySelectorAll("canvas"))
            .map(canvas => canvas.id)
            .filter(id => id.length > 0);

        return {
            schemaVersion: "1.0",
            visual: "Rosea MapViz",
            exportedAt: (args.exportedAt ?? new Date()).toISOString(),
            viewport: {
                width: args.container.clientWidth,
                height: args.container.clientHeight
            },
            map: {
                center: center ? [center[0], center[1]] : null,
                zoom: view?.getZoom?.() ?? null,
                rotation: view?.getRotation?.() ?? null,
                extent: extent ? [extent[0], extent[1], extent[2], extent[3]] : null
            },
            layers: {
                choroplethVisible: Boolean(args.choroplethLayer),
                circlesVisible: Boolean(args.circleLayer),
                svgOverlayVisible: args.svgOverlay.style.display !== "none",
                legendVisible: args.legendContainer.style.display !== "none",
                canvasOverlayIds
            },
            mapTools: {
                renderEngine: args.mapToolsOptions?.renderEngine ?? null,
                lockMapExtent: args.mapToolsOptions?.lockMapExtent ?? null,
                lockedMapExtent: args.mapToolsOptions?.lockedMapExtent ?? null,
                lockedMapZoom: args.mapToolsOptions?.lockedMapZoom ?? null
            },
            warnings
        };
    }

    public static serializePayload(payload: MapStateExportPayload): string {
        return JSON.stringify(payload, null, 2);
    }

    public static createFileName(exportedAt: Date = new Date()): string {
        const timestamp = exportedAt.toISOString().replace(/[:.]/g, "-");
        return `rosea-mapviz-map-state-${timestamp}.json`;
    }
}