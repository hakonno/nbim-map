"use client";

import { useEffect, useReducer } from "react";

export type FootprintCoordinates = [number, number][];
export type FootprintStatus = "idle" | "loading" | "loaded";

type OverpassPoint = { lat: number; lon: number };
type OverpassWay = {
  type: "way";
  id: number;
  geometry?: OverpassPoint[];
  tags?: Record<string, string>;
};
type OverpassResponse = { elements?: OverpassWay[] };

// Public Overpass mirrors with permissive CORS. Requests are raced — the first
// one to respond wins; the stragglers are ignored (the abort on unmount/change
// cancels anything still in flight). lz4/z are load-balancer aliases of the
// main endpoint; racing them smooths over per-server backlog in the pool.
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
];
const SEARCH_RADIUS_METERS = 40;
const SERVER_TIMEOUT_SECONDS = 5;
const STORAGE_KEY_PREFIX = "nbim-footprint:v1:";

type CachedEntry = FootprintCoordinates | null;

const memoryCache = new Map<string, CachedEntry>();

function readFromStorage(propertyId: string): CachedEntry | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PREFIX + propertyId);
    if (raw === null) return undefined;
    if (raw === "null") return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as FootprintCoordinates;
    return undefined;
  } catch {
    return undefined;
  }
}

function writeToStorage(propertyId: string, value: CachedEntry): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY_PREFIX + propertyId,
      value === null ? "null" : JSON.stringify(value)
    );
  } catch {
    // quota exceeded / private mode — fine, memory cache still works.
  }
}

function resolveCached(propertyId: string): CachedEntry | undefined {
  if (memoryCache.has(propertyId)) return memoryCache.get(propertyId);
  const stored = readFromStorage(propertyId);
  if (stored !== undefined) {
    memoryCache.set(propertyId, stored);
    return stored;
  }
  return undefined;
}

function pickClosestBuilding(
  elements: OverpassWay[],
  lat: number,
  lng: number
): OverpassWay | null {
  let best: OverpassWay | null = null;
  let bestScore = Infinity;
  for (const element of elements) {
    if (element.type !== "way" || !element.geometry || element.geometry.length < 3) {
      continue;
    }
    const { geometry } = element;
    let sumLat = 0;
    let sumLng = 0;
    for (const point of geometry) {
      sumLat += point.lat;
      sumLng += point.lon;
    }
    const centerLat = sumLat / geometry.length;
    const centerLng = sumLng / geometry.length;
    const dLat = centerLat - lat;
    const dLng = centerLng - lng;
    const score = dLat * dLat + dLng * dLng;
    if (score < bestScore) {
      bestScore = score;
      best = element;
    }
  }
  return best;
}

function toCoordinates(way: OverpassWay): FootprintCoordinates | null {
  if (!way.geometry || way.geometry.length < 3) return null;
  return way.geometry.map((point) => [point.lat, point.lon] as [number, number]);
}

async function fetchFromEndpoint(
  endpoint: string,
  lat: number,
  lng: number,
  signal: AbortSignal
): Promise<CachedEntry> {
  const query = `[out:json][timeout:${SERVER_TIMEOUT_SECONDS}];way(around:${SEARCH_RADIUS_METERS},${lat},${lng})["building"];out geom;`;
  const url = `${endpoint}?data=${encodeURIComponent(query)}`;
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Overpass ${response.status}`);
  }
  const data = (await response.json()) as OverpassResponse;
  if (!data?.elements?.length) return null;
  const building = pickClosestBuilding(data.elements, lat, lng);
  return building ? toCoordinates(building) : null;
}

async function fetchFootprintRaced(
  lat: number,
  lng: number,
  signal: AbortSignal
): Promise<CachedEntry> {
  const attempts = OVERPASS_ENDPOINTS.map((endpoint) =>
    fetchFromEndpoint(endpoint, lat, lng, signal)
  );
  try {
    return await Promise.any(attempts);
  } catch {
    // All endpoints failed — treat as miss rather than bubbling.
    return null;
  }
}

type UseBuildingFootprintParams = {
  propertyId: string | null;
  lat: number | null;
  lng: number | null;
  enabled: boolean;
};

export type UseBuildingFootprintResult = {
  coordinates: FootprintCoordinates | null;
  status: FootprintStatus;
};

export function useBuildingFootprint({
  propertyId,
  lat,
  lng,
  enabled,
}: UseBuildingFootprintParams): UseBuildingFootprintResult {
  const [, rerender] = useReducer((version: number) => version + 1, 0);

  useEffect(() => {
    if (!enabled || !propertyId || typeof lat !== "number" || typeof lng !== "number") {
      return;
    }
    if (resolveCached(propertyId) !== undefined) {
      return;
    }

    const controller = new AbortController();
    fetchFootprintRaced(lat, lng, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        memoryCache.set(propertyId, result);
        writeToStorage(propertyId, result);
        rerender();
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        memoryCache.set(propertyId, null);
        writeToStorage(propertyId, null);
        rerender();
      });

    return () => {
      controller.abort();
    };
  }, [enabled, propertyId, lat, lng]);

  if (!enabled || !propertyId || typeof lat !== "number" || typeof lng !== "number") {
    return { coordinates: null, status: "idle" };
  }

  const cached = resolveCached(propertyId);
  if (cached === undefined) {
    return { coordinates: null, status: "loading" };
  }
  return { coordinates: cached, status: "loaded" };
}
