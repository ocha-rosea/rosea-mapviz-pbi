import { LegendService } from "../../../src/services/LegendService";
import {
    ClassificationMethods,
    LegendLabelPositions,
    LegendOrientations,
} from "../../../src/constants/strings";

describe("LegendService createChoroplethLegend ordering", () => {
    let container: HTMLElement;
    let service: LegendService;

    const baseOptions = {
        legendTitle: "Legend",
        legendTitleColor: "#222222",
        legendLabelsColor: "#111111",
        legendItemMargin: 4,
        legendOrientation: LegendOrientations.Vertical,
        legendLabelPosition: LegendLabelPositions.Right,
        layerOpacity: 1,
        classes: 7,
    } as any;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        service = new LegendService(container);
    });

    afterEach(() => {
        container.remove();
    });

    function extractLegendItems(): HTMLElement[] {
        const legendRoot = service.getChoroplethLegendContainer();
        expect(legendRoot).toBeTruthy();
        const itemsWrapper = legendRoot!.children[0] as HTMLElement;
        const itemsContainer = itemsWrapper.children[1] as HTMLElement;
        return Array.from(itemsContainer.children) as HTMLElement[];
    }

    it("maintains class order for unique categories and preserves colors", () => {
        const options = {
            ...baseOptions,
            classificationMethod: ClassificationMethods.Unique,
        };

        // Class breaks are provided in class order (Class 1, Class 2, Class 3)
        // Legend should maintain this order, not sort by value
        service.createChoroplethLegend(
            [3, 1, 2],
            [3, 1, 2],  // Class 1 = 3, Class 2 = 1, Class 3 = 2
            ["#ff0000", "#00ff00", "#0000ff"],  // Colors assigned to classes in order
            options,
        );

        const items = extractLegendItems();
        const labels = items.map((item) => item.getAttribute("data-legend-label"));
        // Should maintain class order (3, 1, 2) not sorted order (1, 2, 3)
        expect(labels).toEqual(["3", "1", "2"]);

        const backgrounds = items.map((item) => {
            const swatch = item.children[0] as HTMLElement;
            return swatch.style.backgroundColor;
        });
        // Colors match class order: Class 1 = red, Class 2 = green, Class 3 = blue
        expect(backgrounds).toEqual([
            "rgb(255, 0, 0)",
            "rgb(0, 255, 0)",
            "rgb(0, 0, 255)",
        ]);
    });

    it("maintains class order for textual unique categories and keeps assigned colors", () => {
        const options = {
            ...baseOptions,
            classificationMethod: ClassificationMethods.Unique,
        };

        // Class breaks in class order: Class 1 = delta, Class 2 = Alpha, etc.
        service.createChoroplethLegend(
            [1, 2, 3, 4],
            ["delta", "Alpha", "charlie", "bravo"] as any,
            ["#111111", "#222222", "#333333", "#444444"],
            options,
        );

        const items = extractLegendItems();
        const labels = items.map((item) => item.getAttribute("data-legend-label"));
        // Should maintain class order, not alphabetical order
        expect(labels).toEqual(["delta", "Alpha", "charlie", "bravo"]);

        const backgrounds = items.map((item) => {
            const swatch = item.children[0] as HTMLElement;
            return swatch.style.backgroundColor;
        });
        // Colors match class order
        expect(backgrounds).toEqual([
            "rgb(17, 17, 17)",
            "rgb(34, 34, 34)",
            "rgb(51, 51, 51)",
            "rgb(68, 68, 68)",
        ]);
    });
});
