"use strict";

// Centralized data role names used across the visual
export const RoleNames = {
    AdminPCodeNameID: "AdminPCodeNameID",
    Longitude: "Longitude",
    Latitude: "Latitude",
    Size: "Size",
    Color: "Color",
    Tooltips: "Tooltips",
    MapboxAccessToken: "MapboxAccessToken",
    MaptilerApiKey: "MaptilerApiKey",
    CircleLabel: "CircleLabel",
} as const;

export type RoleName = typeof RoleNames[keyof typeof RoleNames];
