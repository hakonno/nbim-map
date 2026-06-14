import type {
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
  Map as MaplibreMap,
} from "maplibre-gl";

import { MAP_CENTER, MAPTILER_STYLE } from "@/components/map/mapConstants";

// Leaflet stores coordinates as [lat, lng]; MapLibre uses [lng, lat]. Convert once here.
export const MAP_CENTER_LNGLAT: [number, number] = [MAP_CENTER[1], MAP_CENTER[0]];

// Pitch (camera tilt) applied when the user focuses a property/city so the
// extruded buildings actually read as 3D. The world view stays flat.
export const FOCUS_PITCH = 52;
export const MAX_PITCH = 75;
// Buildings only carry useful height data at close zoom; extruding earlier just
// adds noise and cost.
export const BUILDINGS_MIN_ZOOM = 14;

/**
 * MapTiler vector style URL. The key is intentionally embedded — any
 * browser-rendered map exposes it in network requests, so MapTiler protects it
 * with origin restrictions, not secrecy (same rationale as the raster fallback).
 */
export function getMaptilerStyleUrl(maptilerApiKey: string): string {
  return `https://api.maptiler.com/maps/${MAPTILER_STYLE}/style.json?key=${maptilerApiKey.trim()}`;
}

/**
 * WebGL is required for MapLibre. Detect it defensively so we can fall back to
 * the Leaflet raster map on machines/browsers without a usable WebGL context.
 */
export function isWebglSupported(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    return Boolean(gl);
  } catch {
    return false;
  }
}

/**
 * Finds the vector source + source-layer that holds building polygons in the
 * loaded style. MapTiler/OpenMapTiles call it `building`, but we look it up
 * dynamically so a future style change does not silently drop the 3D layer.
 */
function findBuildingSource(
  map: MaplibreMap
): { sourceId: string; sourceLayer: string } | null {
  const style = map.getStyle();
  if (!style?.layers) {
    return null;
  }

  for (const layer of style.layers) {
    if (
      "source-layer" in layer &&
      layer["source-layer"] === "building" &&
      typeof layer.source === "string"
    ) {
      return { sourceId: layer.source, sourceLayer: "building" };
    }
  }

  // Fallback: assume the conventional OpenMapTiles source/layer names.
  if (style.sources && "openmaptiles" in style.sources) {
    return { sourceId: "openmaptiles", sourceLayer: "building" };
  }

  return null;
}

/** Returns the id of the first symbol (label) layer so 3D buildings sit beneath labels. */
function firstSymbolLayerId(map: MaplibreMap): string | undefined {
  const layers = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    if (layer.type === "symbol") {
      return layer.id;
    }
  }
  return undefined;
}

const BUILDING_3D_LAYER_ID = "nbim-3d-buildings";

/**
 * Adds an extruded-building layer to a loaded style. Idempotent and defensive:
 * if the building source cannot be found, or the layer already exists, it does
 * nothing rather than throwing (which would otherwise crash the map).
 */
export function add3dBuildings(map: MaplibreMap): void {
  if (map.getLayer(BUILDING_3D_LAYER_ID)) {
    return;
  }

  // If the style already renders extruded buildings (most MapTiler 3D styles
  // do), adding our own creates a second overlapping volume that z-fights and
  // looks glitchy. In that case, leave the style's 3D buildings alone.
  const existingLayers = map.getStyle()?.layers ?? [];
  if (existingLayers.some((layer) => layer.type === "fill-extrusion")) {
    return;
  }

  const building = findBuildingSource(map);
  if (!building) {
    return;
  }

  // Subtle height-based shading so taller buildings read clearly when tilted.
  const heightColor: ExpressionSpecification = [
    "interpolate",
    ["linear"],
    ["coalesce", ["get", "render_height"], 0],
    0,
    "#d7dde6",
    40,
    "#c2cad6",
    120,
    "#aab4c4",
    260,
    "#94a0b3",
  ];

  try {
    map.addLayer(
      {
        id: BUILDING_3D_LAYER_ID,
        type: "fill-extrusion",
        source: building.sourceId,
        "source-layer": building.sourceLayer,
        minzoom: BUILDINGS_MIN_ZOOM,
        filter: ["!=", ["get", "hide_3d"], true],
        paint: {
          "fill-extrusion-color": heightColor,
          // Grow the extrusion in as you zoom past the threshold so buildings
          // rise smoothly instead of popping up.
          "fill-extrusion-height": [
            "interpolate",
            ["linear"],
            ["zoom"],
            BUILDINGS_MIN_ZOOM,
            0,
            BUILDINGS_MIN_ZOOM + 1.5,
            ["coalesce", ["get", "render_height"], 0],
          ] as ExpressionSpecification,
          "fill-extrusion-base": [
            "interpolate",
            ["linear"],
            ["zoom"],
            BUILDINGS_MIN_ZOOM,
            0,
            BUILDINGS_MIN_ZOOM + 1.5,
            ["coalesce", ["get", "render_min_height"], 0],
          ] as ExpressionSpecification,
          "fill-extrusion-opacity": 0.82,
        },
      },
      firstSymbolLayerId(map)
    );
  } catch {
    // Style without the expected building schema — skip silently; the base map
    // still works, just without 3D extrusions.
  }
}

/**
 * Cluster bubble fill. Office-heavy clusters read amber; otherwise the colour
 * tracks average ownership from slate (low/unknown) to green (high) — matching
 * the single-marker palette in `mapConstants`.
 */
export const CLUSTER_FILL_COLOR: DataDrivenPropertyValueSpecification<string> = [
  "case",
  [">", ["get", "officeCount"], ["get", "investmentCount"]],
  "#fbbf24",
  [
    "interpolate",
    ["linear"],
    ["/", ["get", "ownershipSum"], ["max", 1, ["get", "ownershipCount"]]],
    0,
    "#cbd5e1",
    40,
    "#86efac",
    70,
    "#4ade80",
    100,
    "#22c55e",
  ],
];

export const CLUSTER_RADIUS: DataDrivenPropertyValueSpecification<number> = [
  "step",
  ["get", "point_count"],
  16,
  10,
  20,
  50,
  25,
  200,
  30,
];
