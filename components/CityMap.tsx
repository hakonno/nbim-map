"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import MapSkeleton from "@/components/MapSkeleton";
import { isWebglSupported } from "@/components/map/gl/mapGlConstants";
import type { InitialFocus } from "@/components/map/mapTypes";
import type { CityNode } from "@/types/cities";

const LoadingScreen = <MapSkeleton />;

const CityMapInner = dynamic(() => import("./CityMapInner"), {
  ssr: false,
  loading: () => LoadingScreen,
});

const CityMapGL = dynamic(() => import("./CityMapGL"), {
  ssr: false,
  loading: () => LoadingScreen,
});

type MapEngine = "gl" | "leaflet";

// WebGL support never changes for a session, so detect it at most once.
let webglEngineCache: MapEngine | null = null;
const noopSubscribe = () => () => {};

type CityMapProps = {
  initialCities?: CityNode[];
  googleMapsEmbedApiKey?: string;
  maptilerApiKey?: string;
  initialFocus?: InitialFocus;
};

export default function CityMap({
  initialCities,
  googleMapsEmbedApiKey = "",
  maptilerApiKey = "",
  initialFocus,
}: CityMapProps) {
  const [cities, setCities] = useState<CityNode[] | null>(initialCities ?? null);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  // Runtime fallback flag: flipped on if MapTiler rejects the key or the monthly
  // quota is exhausted ("tokens run out").
  const [forcedLeaflet, setForcedLeaflet] = useState(false);

  // Decide the render engine without a setState-in-effect or hydration mismatch:
  // the server snapshot is always "leaflet"; the client adds the MapTiler 3D
  // engine when both a key and WebGL are available.
  const detectedEngine = useSyncExternalStore<MapEngine>(
    noopSubscribe,
    () => {
      if (!maptilerApiKey) {
        return "leaflet";
      }
      if (webglEngineCache === null) {
        webglEngineCache = isWebglSupported() ? "gl" : "leaflet";
      }
      return webglEngineCache;
    },
    () => "leaflet"
  );

  const engine: MapEngine = forcedLeaflet ? "leaflet" : detectedEngine;

  const handleEngineFallback = useCallback((reason: string) => {
    console.warn(
      `[maps] MapTiler 3D map unavailable (${reason}); falling back to OpenStreetMap/Leaflet.`
    );
    setForcedLeaflet(true);
  }, []);

  useEffect(() => {
    if (cities) {
      return;
    }

    const abortController = new AbortController();

    async function loadCities() {
      try {
        const response = await fetch("/api/cities", {
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to load cities (${response.status})`);
        }

        const payload = (await response.json()) as CityNode[];
        setCities(payload);
      } catch (caughtError) {
        if (abortController.signal.aborted) {
          return;
        }

        const message =
          caughtError instanceof Error ? caughtError.message : "Failed to load map data";
        setError(message);
      }
    }

    loadCities();

    return () => {
      abortController.abort();
    };
  }, [cities, reloadCount]);

  if (error) {
    return (
      <div className="flex h-[100svh] w-full items-center justify-center bg-rose-50 px-6 text-center text-rose-800">
        <div>
          <p className="text-base font-semibold">Unable to load city investment map data.</p>
          <p className="mt-2 text-sm opacity-80">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setReloadCount((current) => current + 1);
            }}
            className="mt-4 rounded-md border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-800 transition hover:bg-rose-100"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!cities) {
    return LoadingScreen;
  }

  if (engine === "gl") {
    return (
      <CityMapGL
        cities={cities}
        googleMapsEmbedApiKey={googleMapsEmbedApiKey}
        maptilerApiKey={maptilerApiKey}
        initialFocus={initialFocus}
        onEngineFallback={handleEngineFallback}
      />
    );
  }

  return (
    <CityMapInner
      cities={cities}
      googleMapsEmbedApiKey={googleMapsEmbedApiKey}
      maptilerApiKey={maptilerApiKey}
      initialFocus={initialFocus}
    />
  );
}
