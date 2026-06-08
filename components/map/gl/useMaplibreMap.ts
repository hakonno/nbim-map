"use client";

import maplibregl, { type Map as MaplibreMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import {
  add3dBuildings,
  getMaptilerStyleUrl,
  MAP_CENTER_LNGLAT,
  MAX_PITCH,
} from "@/components/map/gl/mapGlConstants";
import { MAP_DEFAULT_ZOOM } from "@/components/map/mapConstants";

export type MapView = {
  zoom: number;
  center: [number, number]; // [lat, lng] to stay compatible with the rest of the app
  pitch: number;
  bearing: number;
};

type UseMaplibreMapParams = {
  maptilerApiKey: string;
  minZoom: number;
  /** Called when the style/tiles fail in a way that should drop us to Leaflet. */
  onUnavailable: (reason: string) => void;
};

type UseMaplibreMapResult = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  map: MaplibreMap | null;
  ready: boolean;
  view: MapView;
};

// If the style never loads (e.g. the key is rejected before a tile error fires)
// we still need to bail out to the fallback engine.
const LOAD_TIMEOUT_MS = 12_000;

// HTTP statuses from MapTiler that mean "stop trying" (bad/expired key or the
// monthly quota is exhausted) — exactly the "tokens ran out" fallback case.
const FATAL_TILE_STATUSES = new Set([401, 402, 403, 429]);

export function useMaplibreMap({
  maptilerApiKey,
  minZoom,
  onUnavailable,
}: UseMaplibreMapParams): UseMaplibreMapResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const [map, setMap] = useState<MaplibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<MapView>({
    zoom: MAP_DEFAULT_ZOOM,
    center: [MAP_CENTER_LNGLAT[1], MAP_CENTER_LNGLAT[0]],
    pitch: 0,
    bearing: 0,
  });

  // Keep the latest callback without re-running the create-once effect.
  const onUnavailableRef = useRef(onUnavailable);
  useEffect(() => {
    onUnavailableRef.current = onUnavailable;
  }, [onUnavailable]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    let disposed = false;
    let fellBack = false;
    const fallback = (reason: string) => {
      if (fellBack || disposed) {
        return;
      }
      fellBack = true;
      onUnavailableRef.current(reason);
    };

    const instance = new maplibregl.Map({
      container: containerRef.current,
      style: getMaptilerStyleUrl(maptilerApiKey),
      center: MAP_CENTER_LNGLAT,
      zoom: MAP_DEFAULT_ZOOM,
      minZoom,
      maxPitch: MAX_PITCH,
      attributionControl: { compact: true },
      // Smooth scroll-zoom feels better with a tilted 3D camera.
      cooperativeGestures: false,
      dragRotate: true,
      pitchWithRotate: true,
    });

    mapRef.current = instance;
    setMap(instance);

    const loadTimeout = window.setTimeout(() => {
      if (!instance.isStyleLoaded()) {
        fallback("style-timeout");
      }
    }, LOAD_TIMEOUT_MS);

    const syncView = () => {
      const center = instance.getCenter();
      setView({
        zoom: instance.getZoom(),
        center: [center.lat, center.lng],
        pitch: instance.getPitch(),
        bearing: instance.getBearing(),
      });
    };

    instance.on("load", () => {
      if (disposed) {
        return;
      }
      window.clearTimeout(loadTimeout);
      add3dBuildings(instance);
      syncView();
      setReady(true);
    });

    instance.on("moveend", syncView);
    instance.on("zoomend", syncView);
    instance.on("pitchend", syncView);
    instance.on("rotateend", syncView);

    instance.on("error", (event) => {
      const status = (event?.error as { status?: number } | undefined)?.status;
      if (status && FATAL_TILE_STATUSES.has(status)) {
        window.clearTimeout(loadTimeout);
        fallback(`tile-${status}`);
      }
    });

    return () => {
      disposed = true;
      window.clearTimeout(loadTimeout);
      instance.remove();
      mapRef.current = null;
      setMap(null);
      setReady(false);
    };
    // Create the map exactly once; key/minZoom are stable for a mounted engine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { containerRef, map, ready, view };
}
