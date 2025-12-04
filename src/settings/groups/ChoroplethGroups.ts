/**
 * Choropleth Settings Groups
 * 
 * Contains settings for choropleth map visualization including boundary source,
 * classification method, display styling, and legend configuration.
 */

import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import { VisualConfig } from "../../config/VisualConfig";
import { GeoBoundariesCatalogService } from "../../services/GeoBoundariesCatalogService";
import * as requestHelpers from "../../utils/requestHelpers";
import * as topojsonClient from "topojson-client";
import {
    ClassificationMethods,
    LegendOrientations,
    LegendLabelPositions,
    TitleAlignments
} from "../../constants/strings";

import TextInput = formattingSettings.TextInput;
import DropDown = formattingSettings.ItemDropdown;

/**
 * Settings group for choropleth boundary data source configuration.
 * Handles GeoBoundaries, custom TopoJSON/GeoJSON, and Mapbox Tileset sources.
 */
export class ChoroplethLocationBoundarySettingsGroup extends formattingSettings.SimpleCard {
    boundaryDataSource: DropDown = new DropDown({
        name: "boundaryDataSource",
        displayName: "Boundary Source",
        value: {
            value: "geoboundaries",
            displayName: "GeoBoundaries"
        },
        items: [
            { value: "geoboundaries", displayName: "GeoBoundaries" },
            { value: "custom", displayName: "Custom" },
            { value: "mapbox", displayName: "Mapbox Tileset" }
        ]
    });

    geoBoundariesCountry: DropDown = new DropDown({
        name: "geoBoundariesCountry",
        displayName: "Country/Region",
        value: {
            value: "ALL",
            displayName: "All Countries"
        },
        items: VisualConfig.GEOBOUNDARIES.COUNTRIES
    });

    geoBoundariesReleaseType: DropDown = new DropDown({
        name: "geoBoundariesReleaseType",
        displayName: "Release Type",
        value: {
            value: "gbOpen",
            displayName: "gbOpen (CC-BY 4.0)"
        },
        items: [
            { value: "gbOpen", displayName: "gbOpen (CC-BY 4.0)" },
            { value: "gbHumanitarian", displayName: "gbHumanitarian (UN OCHA)" },
            { value: "gbAuthoritative", displayName: "gbAuthoritative (UN SALB)" }
        ]
    });

    geoBoundariesSourceTag: DropDown = new DropDown({
        name: "geoBoundariesSourceTag",
        displayName: "Source Tag",
        value: {
            value: "v2025-11",
            displayName: "v2025-11"
        },
        items: [
            { value: "v2025-11", displayName: "v2025-11" },
            { value: "v2025-10", displayName: "v2025-10" },
            { value: "v2025-09", displayName: "v2025-09" }
        ]
    });

    geoBoundariesAdminLevel: DropDown = new DropDown({
        name: "geoBoundariesAdminLevel",
        displayName: "Administrative Level",
        value: {
            value: "ADM0",
            displayName: "ADM0 (Country Borders)"
        },
        items: [
            { value: "ADM0", displayName: "ADM0 (Country Borders)" },
            { value: "ADM1", displayName: "ADM1 (States/Provinces)" },
            { value: "ADM2", displayName: "ADM2 (Counties/Districts)" },
            { value: "ADM3", displayName: "ADM3 (Municipalities)" }
        ]
    });

    private sourceFieldOptions = VisualConfig.GEOBOUNDARIES.SOURCE_FIELD_OPTIONS;
    private boundaryIdUserSelected: boolean = false;
    private lastBoundaryIdValue: string | null = null;

    boundaryIdField: DropDown = new DropDown({
        name: "boundaryIdField",
        displayName: "Boundary ID Field",
        value: {
            value: "shapeName",
            displayName: "shapeName"
        },
        items: [
            { value: "shapeName", displayName: "shapeName" },
            { value: "shapeID", displayName: "shapeID" },
            { value: "shapeGroup", displayName: "shapeGroup" },
            { value: "hdx_pcode", displayName: "hdx_pcode" },
            { value: "hdx_name", displayName: "hdx_name" }
        ] as any
    });

    customBoundaryIdField: TextInput = new TextInput({
        name: "customBoundaryIdField",
        displayName: "Boundary ID Field (custom)",
        value: "",
        placeholder: "Enter field name"
    });

    topoJSON_geoJSON_FileUrl: TextInput = new TextInput({
        name: "topoJSON_geoJSON_FileUrl",
        displayName: "TopoJSON/GeoJSON Url",
        value: "",
        placeholder: ""
    });

    topojsonObjectName: TextInput = new TextInput({
        name: "topojsonObjectName",
        displayName: "TopoJSON Object Name (optional)",
        value: "",
        placeholder: "e.g. ADM1, polygons, boundaries",
        description: "If your TopoJSON has multiple objects, specify the object name to use. Leave blank to auto-detect the polygon layer."
    });

    // Mapbox Tileset settings - direct v4 API access works with public tokens for public tilesets
    mapboxTilesetId: TextInput = new TextInput({
        name: "mapboxTilesetId",
        displayName: "Tileset ID",
        value: "",
        placeholder: "e.g. ocha-rosea-1.rosea-ipc-combined-areas",
        description: "The Mapbox tileset ID in format username.tileset-name. Public tilesets work with public tokens (pk.*). Find the ID in Mapbox Studio > Tilesets."
    });

    mapboxTilesetSourceLayer: TextInput = new TextInput({
        name: "mapboxTilesetSourceLayer",
        displayName: "Source Layer",
        value: "",
        placeholder: "e.g. ipc_areas",
        description: "The vector layer name within the tileset. View the tileset's TileJSON to find available layer names."
    });

    mapboxTilesetIdField: TextInput = new TextInput({
        name: "mapboxTilesetIdField",
        displayName: "ID Field",
        value: "",
        placeholder: "e.g. iso_3166_1_alpha_3",
        description: "The property name in the tileset features to match with your data's location/pcode field."
    });

    name: string = "choroplethLocationBoundarySettingsGroup";
    displayName: string = "Boundary";
    collapsible: boolean = false;
    slices: formattingSettings.Slice[] = [
        this.boundaryDataSource,
        this.geoBoundariesCountry,
        this.geoBoundariesSourceTag,
        this.geoBoundariesReleaseType,
        this.geoBoundariesAdminLevel,
        this.topoJSON_geoJSON_FileUrl,
        this.topojsonObjectName,
        this.boundaryIdField,
        this.customBoundaryIdField,
        this.mapboxTilesetId,
        this.mapboxTilesetSourceLayer,
        this.mapboxTilesetIdField
    ];

    public applyConditionalDisplayRules(): void {
        const selectedSource = this.boundaryDataSource.value?.value;

        // Track user selection of boundaryIdField
        try {
            const currentBoundary = String(this.boundaryIdField.value?.value || '');
            if (currentBoundary && currentBoundary !== this.lastBoundaryIdValue) {
                this.boundaryIdUserSelected = true;
                this.lastBoundaryIdValue = currentBoundary;
            } else if (!currentBoundary) {
                this.boundaryIdUserSelected = false;
                this.lastBoundaryIdValue = null;
            }
        } catch (e) {
            // ignore
        }

        const isGeoBoundaries = selectedSource === "geoboundaries";
        this.geoBoundariesCountry.visible = isGeoBoundaries;

        if (isGeoBoundaries) {
            const newCountryItems = GeoBoundariesCatalogService.getCountryItemsSync();
            this.geoBoundariesCountry.items = newCountryItems;
            const countryValues = newCountryItems.map(i => i.value);
            if (!countryValues.includes(String(this.geoBoundariesCountry.value?.value))) {
                const all = newCountryItems.find(i => i.value === "ALL");
                this.geoBoundariesCountry.value = all ?? { ...newCountryItems[0] };
            }
            void this.populateReleaseAndAdminFromCatalog(String(this.geoBoundariesCountry.value?.value));
            try {
                const release = String(this.geoBoundariesReleaseType.value?.value || 'gbOpen');
                const iso3 = String(this.geoBoundariesCountry.value?.value || '');
                const admin = String(this.geoBoundariesAdminLevel.value?.value || 'ADM0');
                const tag = String(this.geoBoundariesSourceTag.value?.value || 'v2025-11');
                void this.populateBoundaryIdFieldsFromData(release, iso3, admin, tag);
            } catch (e) {
                // ignore
            }
            void (async () => {
                try {
                    const tags = await GeoBoundariesCatalogService.getTags();
                    if (!tags || !tags.length) return;
                    const allowed = ['v2025-11', 'v2025-10', 'v2025-09'];
                    const filtered = tags.filter(t => allowed.includes(String(t)));
                    if (!filtered.length) return;
                    const items = Array.from(new Set(filtered)).sort().reverse().map(t => ({ value: t, displayName: t }));
                    this.geoBoundariesSourceTag.items = items;
                    const cur = String(this.geoBoundariesSourceTag.value?.value);
                    if (!items.some(i => String(i.value) === cur)) {
                        this.geoBoundariesSourceTag.value = { ...items[0] };
                    }
                } catch (e) {
                    // ignore
                }
            })();
        }
        this.geoBoundariesAdminLevel.visible = isGeoBoundaries;

        const selectedIso3 = this.geoBoundariesCountry.value?.value?.toString();
        const isAllCountries = isGeoBoundaries && selectedIso3 === "ALL";

        this.geoBoundariesReleaseType.visible = isGeoBoundaries && !isAllCountries;
        this.geoBoundariesAdminLevel.visible = isGeoBoundaries && !isAllCountries;

        if (isGeoBoundaries && !isAllCountries) {
            const newLevelItems = GeoBoundariesCatalogService.getAdminLevelItemsSync(selectedIso3);
            this.geoBoundariesAdminLevel.items = newLevelItems;
            const levelValues = newLevelItems.map(i => i.value);
            if (!levelValues.includes(String(this.geoBoundariesAdminLevel.value?.value))) {
                this.geoBoundariesAdminLevel.value = { ...newLevelItems[0] };
            }
            void this.populateReleaseAndAdminFromCatalog(String(selectedIso3));
        }

        const isCustomSource = selectedSource === "custom";
        const isMapboxSource = selectedSource === "mapbox";

        this.topoJSON_geoJSON_FileUrl.visible = isCustomSource;
        this.topojsonObjectName.visible = isCustomSource;

        // Mapbox Tileset settings visibility
        this.mapboxTilesetId.visible = isMapboxSource;
        this.mapboxTilesetSourceLayer.visible = isMapboxSource;
        this.mapboxTilesetIdField.visible = isMapboxSource;

        const showGeoDropdown = selectedSource === "geoboundaries";
        const showCustomInput = selectedSource === "custom";
        this.boundaryIdField.visible = showGeoDropdown;
        this.customBoundaryIdField.visible = showCustomInput;

        const newSlices: formattingSettings.Slice[] = [];
        newSlices.push(this.boundaryDataSource);

        if (isGeoBoundaries) {
            newSlices.push(this.geoBoundariesCountry);
            newSlices.push(this.geoBoundariesSourceTag);
            if (this.geoBoundariesReleaseType.visible) newSlices.push(this.geoBoundariesReleaseType);
            if (this.geoBoundariesAdminLevel.visible) newSlices.push(this.geoBoundariesAdminLevel);
            if (showGeoDropdown) newSlices.push(this.boundaryIdField);
        }

        if (isCustomSource) {
            newSlices.push(this.topoJSON_geoJSON_FileUrl);
            newSlices.push(this.topojsonObjectName);
            newSlices.push(this.customBoundaryIdField);
        }

        if (isMapboxSource) {
            newSlices.push(this.mapboxTilesetId);
            newSlices.push(this.mapboxTilesetSourceLayer);
            newSlices.push(this.mapboxTilesetIdField);
        }

        try { this.slices = newSlices; } catch (e) { }

        if (!isCustomSource) {
            this.customBoundaryIdField.value = "";
        }
    }

    private async populateReleaseAndAdminFromCatalog(selectedIso3?: string) {
        if (!selectedIso3 || selectedIso3 === 'ALL') return;
        try {
            const tag = String(this.geoBoundariesSourceTag.value?.value || 'v2025-11');
            const catalog: any = await GeoBoundariesCatalogService.getCatalog(tag);
            if (!catalog) return;

            const entries = (catalog as any).entries || (catalog as any).index || (catalog as any).files || (catalog as any).data || [];
            const countryEntries = entries.filter((e: any) => (e.iso3 || '').toUpperCase() === String(selectedIso3).toUpperCase());
            if (!countryEntries || countryEntries.length === 0) return;

            const releases = Array.from(new Set(countryEntries.map((e: any) => (e.release || '').toLowerCase()))).filter(Boolean);
            const levelsRaw = Array.from(new Set(countryEntries.map((e: any) => (e.level || '').toString()))).filter(Boolean);

            const releaseItems = (releases as string[]).map((r: string) => {
                switch (r.toLowerCase()) {
                    case 'gbopen': return { value: 'gbOpen', displayName: 'gbOpen (CC-BY 4.0)' };
                    case 'gbhumanitarian': return { value: 'gbHumanitarian', displayName: 'gbHumanitarian (UN OCHA)' };
                    case 'gbauthoritative': return { value: 'gbAuthoritative', displayName: 'gbAuthoritative (UN SALB)' };
                    default: return { value: r, displayName: r };
                }
            });

            const levelItems = (levelsRaw as string[]).map((lvl: string) => {
                const m = lvl.toLowerCase().replace(/^admin/, '');
                const upper = `ADM${m.toUpperCase()}`;
                const label = (() => {
                    switch (upper) {
                        case 'ADM0': return 'ADM0 (Country Borders)';
                        case 'ADM1': return 'ADM1 (States/Provinces)';
                        case 'ADM2': return 'ADM2 (Counties/Districts)';
                        case 'ADM3': return 'ADM3 (Municipalities)';
                        default: return upper;
                    }
                })();
                return { value: upper, displayName: label };
            });

            if (releaseItems.length > 0) {
                this.geoBoundariesReleaseType.items = releaseItems;
                const cur = String(this.geoBoundariesReleaseType.value?.value);
                if (!releaseItems.some((it: any) => String(it.value) === cur)) {
                    this.geoBoundariesReleaseType.value = { ...releaseItems[0] };
                }
            }

            if (levelItems.length > 0) {
                this.geoBoundariesAdminLevel.items = levelItems;
                const curL = String(this.geoBoundariesAdminLevel.value?.value);
                if (!levelItems.some((it: any) => String(it.value) === curL)) {
                    this.geoBoundariesAdminLevel.value = { ...levelItems[0] };
                }
            }

            void this.populateBoundaryIdFieldsFromData(
                String(this.geoBoundariesReleaseType.value?.value),
                String(selectedIso3),
                String(this.geoBoundariesAdminLevel.value?.value),
                tag
            );
        } catch (e) {
            // ignore errors silently in the formatting pane
        }
    }

    private async populateBoundaryIdFieldsFromData(release?: string, iso3?: string, adminLevel?: string, tag?: string) {
        if (!release || !iso3 || !adminLevel) return;
        try {
            let url = GeoBoundariesCatalogService.resolveTopoJsonUrlSync(release, iso3, adminLevel);
            if (!url) url = await GeoBoundariesCatalogService.resolveTopoJsonUrl(release, iso3, adminLevel, tag) as any;
            if (!url) return;

            const resp = await requestHelpers.fetchWithTimeout(url, VisualConfig.NETWORK.FETCH_TIMEOUT_MS);
            if (!resp.ok) return;
            const json = await resp.json();

            let features: any[] = [];
            if (json && json.type === 'Topology' && json.objects) {
                const objectNames = Object.keys(json.objects);
                const first = objectNames.length > 0 ? objectNames[0] : null;
                if (first) {
                    const fc: any = topojsonClient.feature(json as any, json.objects[first]);
                    features = fc?.features || [];
                }
            } else if (json && json.type === 'FeatureCollection' && Array.isArray(json.features)) {
                features = json.features;
            }

            if (!features.length) return;

            const propKeys = Object.keys(features[0].properties || {});
            if (!propKeys.length) return;

            const releaseNorm = String(release || '').toLowerCase();
            const includeHdx = releaseNorm === 'gbhumanitarian';

            const staticOrdered: string[] = ['shapeName', 'shapeID', 'shapeGroup'];
            if (includeHdx) {
                staticOrdered.push('hdx_pcode');
                staticOrdered.push('hdx_name');
            }

            const items: any[] = [];
            for (const k of staticOrdered) {
                items.push({ value: k, displayName: `${k}` });
            }

            for (const k of propKeys) {
                if (k === 'shapeISO' || k === 'shapeType') continue;
                if (!items.some(i => i.value === k)) items.push({ value: k, displayName: k });
            }

            if (items.length > 0) {
                const nextItems = items.map(item => ({ value: item.value, displayName: item.displayName ?? item.value }));
                const currentValue = String(this.boundaryIdField.value?.value ?? "");
                const hasCurrent = currentValue.length > 0 && nextItems.some(it => String(it.value) === currentValue);
                const userSelected = this.boundaryIdUserSelected && hasCurrent;

                this.boundaryIdField.items = nextItems as any;

                let selection: { value: string; displayName: string } | null;
                if (userSelected) {
                    selection = nextItems.find(it => String(it.value) === currentValue) || null;
                } else if (hasCurrent) {
                    selection = nextItems.find(it => String(it.value) === currentValue) || null;
                } else {
                    selection = nextItems[0] || null;
                    this.boundaryIdUserSelected = false;
                }

                if (selection) {
                    this.boundaryIdField.value = { ...selection };
                    this.lastBoundaryIdValue = String(selection.value);
                }
            }
        } catch (e) {
            // ignore
        }
    }
}

/**
 * Settings group for choropleth classification method configuration.
 * Includes category value + color assignments for unique value classification.
 */
export class ChoroplethClassificationSettingsGroup extends formattingSettings.SimpleCard {
    numClasses: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "numClasses",
        displayName: "Classes",
        value: 5,
        options: {
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 7
            },
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            }
        }
    });

    classificationMethod: DropDown = new DropDown({
        name: "classificationMethod",
        displayName: "Method",
        value: {
            value: ClassificationMethods.Quantile,
            displayName: "Quantile"
        },
        items: [
            { value: ClassificationMethods.Unique, displayName: "Categorical/Ordinal" },
            { value: ClassificationMethods.Quantile, displayName: "Quantile" },
            { value: ClassificationMethods.EqualInterval, displayName: "Equal Interval" },
            { value: ClassificationMethods.Logarithmic, displayName: "Logarithmic" },
            { value: ClassificationMethods.KMeans, displayName: "K-means" },
            { value: ClassificationMethods.Jenks, displayName: "Jenks Natural Breaks" }
        ]
    });

    // Class value + color assignments for unique value classification
    // These are shown only when classification method is "Unique"
    // Each class has a value input (auto-populated from data) and a color picker
    
    // Class 1
    category1Value: formattingSettings.TextInput = new formattingSettings.TextInput({
        name: "category1Value",
        displayName: "Class 1",
        description: "Value for class 1 (auto-detected from data or set manually)",
        value: "",
        placeholder: "(auto)"
    });
    category1Color: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "category1Color",
        displayName: "    Color",
        description: "Color for class 1",
        value: { value: "#009edb" }
    });

    // Class 2
    category2Value: formattingSettings.TextInput = new formattingSettings.TextInput({
        name: "category2Value",
        displayName: "Class 2",
        description: "Value for class 2 (auto-detected from data or set manually)",
        value: "",
        placeholder: "(auto)"
    });
    category2Color: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "category2Color",
        displayName: "    Color",
        description: "Color for class 2",
        value: { value: "#64beeb" }
    });

    // Class 3
    category3Value: formattingSettings.TextInput = new formattingSettings.TextInput({
        name: "category3Value",
        displayName: "Class 3",
        description: "Value for class 3 (auto-detected from data or set manually)",
        value: "",
        placeholder: "(auto)"
    });
    category3Color: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "category3Color",
        displayName: "    Color",
        description: "Color for class 3",
        value: { value: "#c7e1f5" }
    });

    // Class 4
    category4Value: formattingSettings.TextInput = new formattingSettings.TextInput({
        name: "category4Value",
        displayName: "Class 4",
        description: "Value for class 4 (auto-detected from data or set manually)",
        value: "",
        placeholder: "(auto)"
    });
    category4Color: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "category4Color",
        displayName: "    Color",
        description: "Color for class 4",
        value: { value: "#e1eef9" }
    });

    // Class 5
    category5Value: formattingSettings.TextInput = new formattingSettings.TextInput({
        name: "category5Value",
        displayName: "Class 5",
        description: "Value for class 5 (auto-detected from data or set manually)",
        value: "",
        placeholder: "(auto)"
    });
    category5Color: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "category5Color",
        displayName: "    Color",
        description: "Color for class 5",
        value: { value: "#ffd966" }
    });

    // Class 6
    category6Value: formattingSettings.TextInput = new formattingSettings.TextInput({
        name: "category6Value",
        displayName: "Class 6",
        description: "Value for class 6 (auto-detected from data or set manually)",
        value: "",
        placeholder: "(auto)"
    });
    category6Color: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "category6Color",
        displayName: "    Color",
        description: "Color for class 6",
        value: { value: "#f6b26b" }
    });

    // Class 7
    category7Value: formattingSettings.TextInput = new formattingSettings.TextInput({
        name: "category7Value",
        displayName: "Class 7",
        description: "Value for class 7 (auto-detected from data or set manually)",
        value: "",
        placeholder: "(auto)"
    });
    category7Color: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "category7Color",
        displayName: "    Color",
        description: "Color for class 7",
        value: { value: "#e06666" }
    });

    // Others color for overflow
    othersColor: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "othersColor",
        displayName: "Others Color",
        description: "Color for class values beyond the configured classes",
        value: { value: "#999999" }
    });

    // Display settings (merged from ChoroplethDisplaySettingsGroup)
    colorRamp: DropDown = new DropDown({
        name: "colorRamp",
        displayName: "Color Ramp",
        value: {
            value: "blue",
            displayName: "Blue"
        },
        items: [
            { value: "custom", displayName: "Custom" },
            { value: "blue", displayName: "Blue" },
            { value: "red", displayName: "Red" },
            { value: "green", displayName: "Green" },
            { value: "orange", displayName: "Orange" },
            { value: "purple", displayName: "Purple" },
            { value: "yellow", displayName: "Yellow" },
            { value: "slateGrey", displayName: "Slate Grey" },
            { value: "neutralGrey", displayName: "Neutral Grey" },
            { value: "azurecascade", displayName: "Azure Cascade" },
            { value: "ipc", displayName: "IPC" },
            { value: "sdgred", displayName: "SDG Red" },
            { value: "sdgyellow", displayName: "SDG Yellow" },
            { value: "sdgorange", displayName: "SDG Orange" },
            { value: "sdggreen", displayName: "SDG Green" },
            { value: "sdgdarkgreen", displayName: "SDG Dark Green" },
            { value: "sdgnavyblue", displayName: "SDG Navy Blue" }
        ]
    });

    customColorRamp: formattingSettings.TextInput = new formattingSettings.TextInput({
        name: "customColorRamp",
        displayName: "Custom Color Ramp",
        value: " #e1eef9, #c7e1f5, #64beeb, #009edb",
        placeholder: " #e1eef9, #c7e1f5, #64beeb, #009edb"
    });

    invertColorRamp: formattingSettings.ToggleSwitch = new formattingSettings.ToggleSwitch({
        name: "invertColorRamp",
        displayName: "Invert Color Ramp",
        value: false
    });

    colorMode: DropDown = new DropDown({
        name: "colorMode",
        displayName: "Color Mode",
        value: {
            value: "lab",
            displayName: "Lab"
        },
        items: [
            { value: "lab", displayName: "LAB" },
            { value: "rgb", displayName: "RGB" },
            { value: "hsl", displayName: "HSL" },
            { value: "hsv", displayName: "HSV" },
            { value: "lch", displayName: "LCH" }
        ]
    });

    strokeColor: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "strokeColor",
        displayName: "Stroke Color",
        value: { value: "#ffffff" }
    });

    strokeWidth: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "strokeWidth",
        displayName: "Stroke Width",
        value: 1
    });

    layerOpacity: formattingSettings.NumUpDown = new formattingSettings.Slider({
        name: "layerOpacity",
        displayName: "Layer Opacity",
        value: 100,
        options: {
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 100
            },
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            }
        }
    });

    simplificationStrength: formattingSettings.NumUpDown = new formattingSettings.Slider({
        name: "simplificationStrength",
        displayName: "Simplification Strength",
        value: 50,
        options: {
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 100
            },
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            }
        }
    });

    useFeatureColor: formattingSettings.ToggleSwitch = new formattingSettings.ToggleSwitch({
        name: "useFeatureColor",
        displayName: "Use Feature Color",
        description: "When enabled, uses the color property from GeoJSON/TopoJSON feature properties if available",
        value: false
    });

    featureColorProperty: formattingSettings.TextInput = new formattingSettings.TextInput({
        name: "featureColorProperty",
        displayName: "Color Property Name",
        description: "The property name in feature properties that contains the color value (e.g., 'color', 'fill', 'style_color')",
        value: "color",
        placeholder: "color"
    });

    name: string = "choroplethClassificationSettingsGroup";
    displayName: string = "Classification and Display";
    slices: formattingSettings.Slice[] = [
        this.classificationMethod, 
        this.numClasses,
        // Class 1 - value and color
        this.category1Value,
        this.category1Color,
        // Class 2 - value and color
        this.category2Value,
        this.category2Color,
        // Class 3 - value and color
        this.category3Value,
        this.category3Color,
        // Class 4 - value and color
        this.category4Value,
        this.category4Color,
        // Class 5 - value and color
        this.category5Value,
        this.category5Color,
        // Class 6 - value and color
        this.category6Value,
        this.category6Color,
        // Class 7 - value and color
        this.category7Value,
        this.category7Color,
        // Others
        this.othersColor,
        // Display settings (for non-unique classification)
        this.colorRamp,
        this.customColorRamp,
        this.invertColorRamp,
        this.colorMode,
        // Common display settings
        this.strokeColor,
        this.strokeWidth,
        this.layerOpacity,
        this.simplificationStrength,
        this.useFeatureColor,
        this.featureColorProperty
    ];

    /**
     * Cached class labels from data for dynamic display names.
     * Set by the orchestrator when processing unique classification.
     */
    private _dataDetectedValues: string[] = [];

    /**
     * Stable master list of all unique values ever seen (persists across filtering).
     * New values are added but existing values are never removed.
     */
    private _stableMasterValues: string[] = [];

    /**
     * Number of unique values detected in data (caps numClasses).
     */
    private _dataValueCount: number = 0;

    /**
     * Last measure query name - used to detect when measure changes.
     */
    private _lastMeasureQueryName: string | undefined;

    /**
     * Sets the class values detected from data.
     * Maintains a stable master list - new values are added, existing values persist.
     * @param values Array of unique values from data, sorted ascending
     * @param count Total count of unique values in data
     * @param measureQueryName Optional measure query name to detect measure changes
     */
    public setDataDetectedValues(values: string[], count: number, measureQueryName?: string): void {
        // If measure changed, reset the stable list
        if (measureQueryName && measureQueryName !== this._lastMeasureQueryName) {
            this._stableMasterValues = [];
            this._lastMeasureQueryName = measureQueryName;
        }
        
        // Add any new values to the stable master list (preserving order)
        for (const value of values) {
            if (!this._stableMasterValues.includes(value)) {
                this._stableMasterValues.push(value);
            }
        }
        
        // Limit to top 7 in the stable list
        this._stableMasterValues = this._stableMasterValues.slice(0, 7);
        
        // Use the stable master list for display
        this._dataDetectedValues = this._stableMasterValues;
        this._dataValueCount = Math.max(count, this._stableMasterValues.length);
        this.updateCategoryValuePlaceholders();
    }

    /**
     * Resets the stable value tracking (call when measure changes).
     */
    public resetStableValues(): void {
        this._stableMasterValues = [];
        this._dataDetectedValues = [];
        this._dataValueCount = 0;
        this._lastMeasureQueryName = undefined;
    }

    /**
     * Gets the number of unique values detected in data.
     */
    public getDataValueCount(): number {
        return this._dataValueCount;
    }

    /**
     * Updates class value input placeholders with detected values.
     */
    private updateCategoryValuePlaceholders(): void {
        const valueInputs = [
            this.category1Value,
            this.category2Value,
            this.category3Value,
            this.category4Value,
            this.category5Value,
            this.category6Value,
            this.category7Value
        ];

        for (let i = 0; i < 7; i++) {
            if (i < this._dataDetectedValues.length) {
                valueInputs[i].placeholder = this._dataDetectedValues[i];
            } else {
                valueInputs[i].placeholder = "(no data)";
            }
        }
    }

    /**
     * Gets the effective class values (user-set or auto-detected).
     * Returns array of values in order, with empty strings for unused slots.
     */
    public getEffectiveCategoryValues(): string[] {
        const valueInputs = [
            this.category1Value,
            this.category2Value,
            this.category3Value,
            this.category4Value,
            this.category5Value,
            this.category6Value,
            this.category7Value
        ];

        return valueInputs.map((input, i) => {
            // Use user-set value if provided, otherwise use auto-detected
            const userValue = input.value?.trim();
            if (userValue && userValue.length > 0) {
                return userValue;
            }
            return this._dataDetectedValues[i] || "";
        });
    }

    /**
     * Applies conditional display rules for classification settings.
     * Class value+color pairs are always visible when classification method is Unique.
     * This ensures users can pre-configure colors for values that may appear when filters change.
     * Color ramp settings are only visible when classification method is NOT Unique.
     */
    public applyConditionalDisplayRules(): void {
        const isUnique = this.classificationMethod.value?.value === ClassificationMethods.Unique;
        const requestedClasses = this.numClasses.value || 7;
        
        // All 7 class value+color pairs visible when using unique classification
        // This allows users to set colors for values that may appear when filters change
        this.category1Value.visible = isUnique && requestedClasses >= 1;
        this.category1Color.visible = isUnique && requestedClasses >= 1;
        
        this.category2Value.visible = isUnique && requestedClasses >= 2;
        this.category2Color.visible = isUnique && requestedClasses >= 2;
        
        this.category3Value.visible = isUnique && requestedClasses >= 3;
        this.category3Color.visible = isUnique && requestedClasses >= 3;
        
        this.category4Value.visible = isUnique && requestedClasses >= 4;
        this.category4Color.visible = isUnique && requestedClasses >= 4;
        
        this.category5Value.visible = isUnique && requestedClasses >= 5;
        this.category5Color.visible = isUnique && requestedClasses >= 5;
        
        this.category6Value.visible = isUnique && requestedClasses >= 6;
        this.category6Color.visible = isUnique && requestedClasses >= 6;
        
        this.category7Value.visible = isUnique && requestedClasses >= 7;
        this.category7Color.visible = isUnique && requestedClasses >= 7;
        
        // Others color always visible for unique classification (for overflow values)
        this.othersColor.visible = isUnique;

        // Color ramp settings only visible when NOT using unique classification
        this.colorRamp.visible = !isUnique;
        this.invertColorRamp.visible = !isUnique;
        this.colorMode.visible = !isUnique;
        
        // Custom color ramp only visible when color ramp is "custom" AND not unique classification
        const isCustomRamp = this.colorRamp.value?.value === "custom";
        this.customColorRamp.visible = !isUnique && isCustomRamp;
        
        // Show color property name only when feature color is enabled
        this.featureColorProperty.visible = this.useFeatureColor.value === true;
    }

    /**
     * Gets the array of class colors for unique classification.
     * Returns colors in order from class 1 to 7.
     */
    public getCategoryColors(): string[] {
        return [
            this.category1Color.value?.value || "#009edb",
            this.category2Color.value?.value || "#64beeb",
            this.category3Color.value?.value || "#c7e1f5",
            this.category4Color.value?.value || "#e1eef9",
            this.category5Color.value?.value || "#ffd966",
            this.category6Color.value?.value || "#f6b26b",
            this.category7Color.value?.value || "#e06666"
        ];
    }

    /**
     * Gets a map of class value -> color for unique classification.
     * Uses effective values (user-set or auto-detected).
     */
    public getCategoryValueColorMap(): Map<string, string> {
        const values = this.getEffectiveCategoryValues();
        const colors = this.getCategoryColors();
        const map = new Map<string, string>();
        
        for (let i = 0; i < 7; i++) {
            if (values[i] && values[i].length > 0) {
                map.set(values[i], colors[i]);
            }
        }
        
        return map;
    }

    /**
     * Gets the "others" color for values beyond configured classes.
     */
    public getOthersColor(): string {
        return this.othersColor.value?.value || "#999999";
    }

    /**
     * Gets the effective number of classes (capped to data count).
     */
    public getEffectiveClassCount(): number {
        const requested = this.numClasses.value || 7;
        if (this._dataValueCount > 0) {
            return Math.min(requested, this._dataValueCount, 7);
        }
        return Math.min(requested, 7);
    }
}

/**
 * Settings group for choropleth legend configuration.
 */
export class ChoroplethLegendSettingsGroup extends formattingSettings.SimpleCard {
    showLegend: formattingSettings.ToggleSwitch = new formattingSettings.ToggleSwitch({
        name: "showLegend",
        displayName: "Show Legend",
        value: false
    });

    legendTitleAlignment: DropDown = new DropDown({
        name: "legendTitleAlignment",
        displayName: "Legend Title Alignment",
        value: {
            value: TitleAlignments.Left,
            displayName: "Left"
        },
        items: [
            { value: TitleAlignments.Left, displayName: "Left" },
            { value: TitleAlignments.Center, displayName: "Center" },
            { value: TitleAlignments.Right, displayName: "Right" }
        ]
    });

    legendTitleColor: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "legendTitleColor",
        displayName: "Legend Title Color",
        value: { value: "#000000" }
    });

    legendLabelsColor: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "legendLabelsColor",
        displayName: "Legend Labels Color",
        value: { value: "#000000" }
    });

    legendLabelPosition: DropDown = new DropDown({
        name: "legendLabelPosition",
        displayName: "Legend Label Position",
        value: {
            value: LegendLabelPositions.Top,
            displayName: "Top"
        },
        items: [
            { value: LegendLabelPositions.Top, displayName: "Top" },
            { value: LegendLabelPositions.Center, displayName: "Center" },
            { value: LegendLabelPositions.Bottom, displayName: "Bottom" },
            { value: LegendLabelPositions.Right, displayName: "Right" },
            { value: LegendLabelPositions.Left, displayName: "Left" }
        ]
    });

    legendOrientation: DropDown = new DropDown({
        name: "legendOrientation",
        displayName: "Legend Orientation",
        value: {
            value: LegendOrientations.Horizontal,
            displayName: "Horizontal"
        },
        items: [
            { value: LegendOrientations.Horizontal, displayName: "Horizontal" },
            { value: LegendOrientations.Vertical, displayName: "Vertical" }
        ]
    });

    legendItemMargin: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "legendItemMargin",
        displayName: "Legdend Item Margin",
        value: 2.5,
        options: {
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 5
            },
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            }
        }
    });

    name: string = "choroplethLegendSettingsGroup";
    displayName: string = "Legend";
    slices: formattingSettings.Slice[] = [
        this.showLegend,
        this.legendTitleAlignment,
        this.legendOrientation,
        this.legendLabelPosition,
        this.legendTitleColor,
        this.legendLabelsColor,
        this.legendItemMargin
    ];
}

/**
 * Settings group for nested geometry styling in GeometryCollections.
 * Useful for IPC-style data where polygons represent areas and points show exact locations.
 */
export class ChoroplethNestedGeometrySettingsGroup extends formattingSettings.SimpleCard {
    showNestedPoints: formattingSettings.ToggleSwitch = new formattingSettings.ToggleSwitch({
        name: "showNestedPoints",
        displayName: "Show Points",
        value: true
    });

    nestedPointRadius: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "nestedPointRadius",
        displayName: "Point Radius",
        value: 4,
        options: {
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 20
            },
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 1
            }
        }
    });

    nestedPointColor: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "nestedPointColor",
        displayName: "Point Color",
        value: { value: "#000000" },
        description: "Fill color for point geometries. Set to match polygon for inherited coloring."
    });

    nestedPointStrokeColor: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "nestedPointStrokeColor",
        displayName: "Point Stroke Color",
        value: { value: "#ffffff" }
    });

    nestedPointStrokeWidth: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "nestedPointStrokeWidth",
        displayName: "Point Stroke Width",
        value: 1,
        options: {
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 5
            },
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 0
            }
        }
    });

    showNestedLines: formattingSettings.ToggleSwitch = new formattingSettings.ToggleSwitch({
        name: "showNestedLines",
        displayName: "Show Lines",
        value: true
    });

    nestedLineColor: formattingSettings.ColorPicker = new formattingSettings.ColorPicker({
        name: "nestedLineColor",
        displayName: "Line Color",
        value: { value: "#333333" }
    });

    nestedLineWidth: formattingSettings.NumUpDown = new formattingSettings.NumUpDown({
        name: "nestedLineWidth",
        displayName: "Line Width",
        value: 2,
        options: {
            maxValue: {
                type: powerbi.visuals.ValidatorType.Max,
                value: 10
            },
            minValue: {
                type: powerbi.visuals.ValidatorType.Min,
                value: 1
            }
        }
    });

    name: string = "choroplethNestedGeometrySettingsGroup";
    displayName: string = "Nested Geometries";
    description: string = "Style settings for point and line geometries within GeometryCollections (e.g., IPC area data with location markers)";
    slices: formattingSettings.Slice[] = [
        this.showNestedPoints,
        this.nestedPointRadius,
        this.nestedPointColor,
        this.nestedPointStrokeColor,
        this.nestedPointStrokeWidth,
        this.showNestedLines,
        this.nestedLineColor,
        this.nestedLineWidth
    ];

    public applyConditionalDisplayRules(): void {
        // Show point styling options only if points are enabled
        const showPoints = this.showNestedPoints.value === true;
        this.nestedPointRadius.visible = showPoints;
        this.nestedPointColor.visible = showPoints;
        this.nestedPointStrokeColor.visible = showPoints;
        this.nestedPointStrokeWidth.visible = showPoints;

        // Show line styling options only if lines are enabled
        const showLines = this.showNestedLines.value === true;
        this.nestedLineColor.visible = showLines;
        this.nestedLineWidth.visible = showLines;
    }
}
