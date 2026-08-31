"use client";

import maplibregl, { type Map as MaplibreMap, type StyleSpecification } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import type { BasemapProvider } from "@/components/map/gl/basemapProviders";
import {
  add3dBuildings,
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
  /**
   * Ordered basemap providers. The map opens on the first one and walks down
   * the chain as providers fail (rejected MapTiler key, spent credits, an
   * unreachable tile host), reusing the same map instance and camera.
   */
  providers: BasemapProvider[];
  minZoom: number;
  /** Called when every provider in the chain has failed. */
  onUnavailable: (reason: string) => void;
  /**
   * Frame these [[west, south], [east, north]] bounds at creation instead of
   * the MAP_CENTER default. Passed to the constructor (not fitBounds after
   * load) so the first tile requests are already for the framed view.
   */
  initialBounds?: [[number, number], [number, number]];
  initialBoundsPadding?: { top: number; right: number; bottom: number; left: number };
};

type UseMaplibreMapResult = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  map: MaplibreMap | null;
  /** True once a basemap style has loaded and the map can take layers. */
  ready: boolean;
  /**
   * Increments every time a stylesheet finishes loading — the initial one and
   * each provider swap. `setStyle` discards all layers and sources, so anything
   * that adds them must key on this, not on `ready` (which never goes back to
   * false once the map is up).
   */
  styleEpoch: number;
  view: MapView;
  /** The provider currently painting the basemap. */
  provider: BasemapProvider;
};

// If a style never loads and never errors (a hung request), move on anyway.
const LOAD_TIMEOUT_MS = 12_000;

// HTTP statuses that mean "stop trying this provider" — a bad or expired key,
// or an exhausted quota. Exactly the "credits ran out" case.
const FATAL_TILE_STATUSES = new Set([401, 402, 403, 429]);

export function useMaplibreMap({
  providers,
  minZoom,
  onUnavailable,
  initialBounds,
  initialBoundsPadding,
}: UseMaplibreMapParams): UseMaplibreMapResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const [map, setMap] = useState<MaplibreMap | null>(null);
  const [styleEpoch, setStyleEpoch] = useState(0);
  const [providerIndex, setProviderIndex] = useState(0);
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

  // The chain is fixed for the lifetime of a mounted map; read it through a ref
  // so a fresh array identity from the host never recreates the map.
  const providersRef = useRef(providers);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const chain = providersRef.current;
    let disposed = false;
    let index = 0;
    // Set once the active stylesheet has been parsed; until then any error is
    // read as "this provider cannot serve us" rather than a stray tile miss.
    let styleReady = false;
    // A dead provider emits one error per in-flight request. Record which tier
    // we have already given up on so that burst causes a single hop, not a
    // cascade all the way down the chain.
    let abandoned = -1;
    let loadTimeout = 0;

    const instance = new maplibregl.Map({
      container: containerRef.current,
      style: chain[0].style as string | StyleSpecification,
      center: MAP_CENTER_LNGLAT,
      zoom: MAP_DEFAULT_ZOOM,
      // `bounds` wins over center/zoom when provided, and clamps to minZoom.
      ...(initialBounds
        ? { bounds: initialBounds, fitBoundsOptions: { padding: initialBoundsPadding } }
        : {}),
      minZoom,
      maxPitch: MAX_PITCH,
      // Don't repeat the world horizontally at low zoom — each copy re-requests
      // the same tiles, inflating provider usage for no real benefit here.
      renderWorldCopies: false,
      attributionControl: { compact: true },
      // Smooth scroll-zoom feels better with a tilted 3D camera.
      cooperativeGestures: false,
      dragRotate: true,
      pitchWithRotate: true,
    });

    mapRef.current = instance;
    setMap(instance);

    const syncView = () => {
      const center = instance.getCenter();
      setView({
        zoom: instance.getZoom(),
        center: [center.lat, center.lng],
        pitch: instance.getPitch(),
        bearing: instance.getBearing(),
      });
    };

    /**
     * Give up on the current provider and swap in the next one. `setStyle`
     * keeps the map instance and camera (MapLibre's `Style#_load` never touches
     * the camera) but discards every layer and source, so the marker/cluster
     * layers rebuild on the next `styleEpoch`, with the new provider's fonts.
     */
    const advance = (reason: string) => {
      if (disposed || abandoned === index) {
        return;
      }
      abandoned = index;
      window.clearTimeout(loadTimeout);

      const failed = chain[index];
      const next = chain[index + 1];
      if (!next) {
        // Nothing left below us — the host drops to the list-only view.
        console.warn(`[map] ${failed.label} basemap failed (${reason}); no backup left.`);
        onUnavailableRef.current(reason);
        return;
      }

      index += 1;
      styleReady = false;
      console.warn(
        `[map] ${failed.label} basemap failed (${reason}); switching to ${next.label}.`
      );
      setProviderIndex(index);
      instance.setStyle(next.style as string | StyleSpecification, { diff: false });
      armLoadTimeout();
    };

    function armLoadTimeout() {
      window.clearTimeout(loadTimeout);
      loadTimeout = window.setTimeout(() => {
        if (!styleReady) {
          advance("style-timeout");
        }
      }, LOAD_TIMEOUT_MS);
    }

    const onStyleReady = () => {
      if (disposed || styleReady || !instance.style) {
        return;
      }
      styleReady = true;
      window.clearTimeout(loadTimeout);
      add3dBuildings(instance);
      syncView();
      setStyleEpoch((epoch) => epoch + 1);
    };

    armLoadTimeout();
    // `style.load` bubbles from the Style to the Map once a stylesheet is
    // parsed and its layers exist — for the initial style and for every
    // `setStyle` alike, unlike `load`, which only ever fires once. Waiting for
    // `load`/`isStyleLoaded()` instead would also wait on the first tiles,
    // which is exactly what a failing provider never delivers.
    instance.on("style.load", onStyleReady);

    instance.on("moveend", syncView);
    instance.on("zoomend", syncView);
    instance.on("pitchend", syncView);
    instance.on("rotateend", syncView);

    instance.on("error", (event) => {
      const status = (event?.error as { status?: number } | undefined)?.status;
      if (status && FATAL_TILE_STATUSES.has(status)) {
        // A key/quota rejection will not fix itself at another zoom level.
        advance(`tile-${status}`);
        return;
      }
      if (!styleReady) {
        // The stylesheet itself never arrived (network error, 404, CORS) — this
        // provider cannot serve the map at all.
        advance(status ? `style-${status}` : "style-error");
      }
    });

    return () => {
      disposed = true;
      window.clearTimeout(loadTimeout);
      instance.remove();
      mapRef.current = null;
      setMap(null);
      setStyleEpoch(0);
    };
    // Create the map exactly once; the chain and minZoom are stable for a
    // mounted engine, and provider swaps happen in place via setStyle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    containerRef,
    map,
    ready: styleEpoch > 0,
    styleEpoch,
    view,
    provider: providers[providerIndex] ?? providers[providers.length - 1],
  };
}
