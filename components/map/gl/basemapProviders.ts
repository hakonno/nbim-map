import type { StyleSpecification } from "maplibre-gl";

/**
 * Base map providers.
 *
 * MapTiler is the primary basemap, but it is a metered service: once the
 * monthly credits are spent every style/tile request comes back 401/402/403/429
 * and the map goes blank. So the basemap is not one hard-wired style but an
 * ordered chain of interchangeable providers — `useMaplibreMap` walks down it
 * whenever the current one fails, and the app keeps its map instead of
 * degrading to the list.
 *
 * Every provider is rendered by the same MapLibre GL engine, so the entire
 * feature set (clustering, callouts, hover labels, tilt, camera framing,
 * selection halo) is identical across them — only the pixels underneath the
 * markers change. A separate Leaflet renderer would have been a second,
 * divergent implementation of all of that, and could not do 3D at all.
 */
export type BasemapProviderId = "maptiler" | "openfreemap" | "osm";

export type BasemapFontStacks = {
  /** Stack for regular-weight symbol layers (property labels). */
  regular: string[];
  /** Stack for bold symbol layers (cluster counts). */
  bold: string[];
};

export type BasemapProvider = {
  id: BasemapProviderId;
  /** Human-readable name, used in log lines and the "backup map" notice. */
  label: string;
  /** A style URL, or an inline style for providers that need no round trip. */
  style: string | StyleSpecification;
  /**
   * Glyph availability differs per provider, and a font stack the provider
   * cannot serve renders as *no text at all* (missing cluster counts). Each
   * provider therefore declares stacks it is known to have.
   */
  fonts: BasemapFontStacks;
  /**
   * Whether the style carries OpenMapTiles building polygons, i.e. whether the
   * 3D tilt shows extruded buildings (raster basemaps tilt, but stay flat).
   */
  has3dBuildings: boolean;
};

// MapTiler base map style (https://docs.maptiler.com/cloud/api/maps/).
export const MAPTILER_STYLE = "streets-v2";

/**
 * OpenFreeMap serves OpenMapTiles-schema vector tiles, styles, glyphs and
 * sprites with no API key, no quota and no signup (https://openfreemap.org).
 * That makes it a true drop-in for MapTiler: same schema, so 3D buildings,
 * labels and the whole GL feature set keep working unchanged.
 */
const OPENFREEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const OPENFREEMAP_GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

/**
 * Last resort: raw OpenStreetMap raster tiles in an inline style. No style
 * round trip, no key, no vector schema — if this fails there is no map to be
 * had. Raster tiles carry no building geometry, so this is the one tier that
 * tilts without extrusions.
 */
const OSM_RASTER_STYLE: StyleSpecification = {
  version: 8,
  glyphs: OPENFREEMAP_GLYPHS,
  sources: {
    "osm-raster": {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    // Painted under the tiles so gaps (and the moment before the first tile
    // lands) read as map canvas rather than as a hole.
    { id: "background", type: "background", paint: { "background-color": "#eef1f4" } },
    { id: "osm-raster", type: "raster", source: "osm-raster" },
  ],
};

// MapTiler serves composite font stacks, so "Roboto Bold,Noto Sans Bold"
// resolves in one request. OpenFreeMap serves Noto Sans as discrete stacks,
// so asking for Roboto there would 404 and silently drop every label.
const MAPTILER_FONTS: BasemapFontStacks = {
  regular: ["Roboto Regular", "Noto Sans Regular"],
  bold: ["Roboto Bold", "Noto Sans Bold"],
};

const NOTO_FONTS: BasemapFontStacks = {
  regular: ["Noto Sans Regular"],
  bold: ["Noto Sans Bold"],
};

/**
 * MapTiler vector style URL. The key is intentionally embedded — any
 * browser-rendered map exposes it in network requests, so MapTiler protects it
 * with origin restrictions, not secrecy.
 */
export function getMaptilerStyleUrl(maptilerApiKey: string): string {
  return `https://api.maptiler.com/maps/${MAPTILER_STYLE}/style.json?key=${maptilerApiKey.trim()}`;
}

function maptilerProvider(maptilerApiKey: string): BasemapProvider {
  return {
    id: "maptiler",
    label: "MapTiler",
    style: getMaptilerStyleUrl(maptilerApiKey),
    fonts: MAPTILER_FONTS,
    has3dBuildings: true,
  };
}

export const OPENFREEMAP_PROVIDER: BasemapProvider = {
  id: "openfreemap",
  label: "OpenFreeMap",
  style: OPENFREEMAP_STYLE_URL,
  fonts: NOTO_FONTS,
  has3dBuildings: true,
};

export const OSM_RASTER_PROVIDER: BasemapProvider = {
  id: "osm",
  label: "OpenStreetMap",
  style: OSM_RASTER_STYLE,
  fonts: NOTO_FONTS,
  has3dBuildings: false,
};

/** Value of the `MAP_PROVIDER` env var; anything else is treated as `auto`. */
export type BasemapPreference = "auto" | BasemapProviderId;

export function parseBasemapPreference(value: string | undefined): BasemapPreference {
  switch (value?.trim().toLowerCase()) {
    case "maptiler":
      return "maptiler";
    case "openfreemap":
      return "openfreemap";
    case "osm":
      return "osm";
    default:
      return "auto";
  }
}

/**
 * The ordered chain the map walks down as providers fail.
 *
 * `auto` (the default) leads with MapTiler when a key is configured and skips
 * it entirely when there is none — so "credits ran out" can be handled either
 * by pinning `MAP_PROVIDER=openfreemap` or simply by dropping the key.
 * A pinned provider still keeps the tiers below it as a safety net; only the
 * bottom tier has nothing left to fall back to.
 */
export function resolveBasemapChain(
  maptilerApiKey: string | undefined,
  preference: BasemapPreference = "auto"
): BasemapProvider[] {
  const key = maptilerApiKey?.trim() ?? "";
  const withKey = key ? [maptilerProvider(key)] : [];
  const chain = [...withKey, OPENFREEMAP_PROVIDER, OSM_RASTER_PROVIDER];

  if (preference === "auto") {
    return chain;
  }

  // Drop the tiers above the pinned one, keeping it and everything below.
  const start = chain.findIndex((provider) => provider.id === preference);
  return start === -1 ? chain : chain.slice(start);
}
