"use client";

import maplibregl from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { buildPropertyFeatureCollection, buildSelectedFeatureCollection } from "@/components/map/gl/glPropertyFeatures";
import { FOCUS_PITCH } from "@/components/map/gl/mapGlConstants";
import { useMaplibreMap } from "@/components/map/gl/useMaplibreMap";
import { usePropertyClusterLayer } from "@/components/map/gl/usePropertyClusterLayer";
import { ZOOM_PROPERTY_FOCUS } from "@/components/map/mapConstants";
import type { FlatProperty } from "@/components/map/mapTypes";
import { prefersReducedMotion } from "@/components/explore/useSheetDrag";
import type { ExploreProperty } from "@/components/explore/types";

// The reused map stack (useMaplibreMap + usePropertyClusterLayer) speaks the
// app's FlatProperty shape, so adapt each filtered property to it. The map
// colours markers by ownership only — the value fields are unused here.
function toFlat(property: ExploreProperty): FlatProperty {
  return {
    id: property.id,
    name: property.name,
    address: property.address,
    partnership: property.partner,
    sector: property.sector,
    lat: property.lat,
    lng: property.lng,
    ownership_percent: property.ownership,
    value_nok: null,
    value_usd: null,
    cityId: property.citySlug,
    cityName: property.city,
    country: property.country,
  };
}

type ExploreMapProps = {
  /** The filtered set currently shown in the list. */
  properties: ExploreProperty[];
  selected: ExploreProperty | null;
  maptilerApiKey: string;
  onSelect: (id: string) => void;
  onUnavailable: (reason: string) => void;
  /** Padding (px) the camera should keep clear on each side (panels/sheets). */
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
};

// 1.0 (not 1.4) so a phone can frame the US-to-Europe core in one view; with
// renderWorldCopies off this costs only a handful of extra low-zoom tiles.
const MIN_ZOOM = 1;
// Above this zoom, an on-screen selection is panned to rather than zoomed to.
const NEARBY_ZOOM = 11;

type Padding = { top?: number; right?: number; bottom?: number; left?: number };

// MapLibre's PaddingOptions wants all four sides as concrete numbers.
function fullPadding(padding: Padding | undefined, base = 0) {
  return {
    top: padding?.top ?? base,
    right: padding?.right ?? base,
    bottom: padding?.bottom ?? base,
    left: padding?.left ?? base,
  };
}

// Extra breathing room around the portfolio when framing it at load, so edge
// clusters don't sit under the floating pills.
const INITIAL_FIT_EXTRA_PX = 32;

function boundsOf(
  properties: ExploreProperty[]
): [[number, number], [number, number]] | undefined {
  if (properties.length === 0) return undefined;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const property of properties) {
    if (property.lng < west) west = property.lng;
    if (property.lng > east) east = property.lng;
    if (property.lat < south) south = property.lat;
    if (property.lat > north) north = property.lat;
  }
  return [
    [west, south],
    [east, north],
  ];
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  return next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base]);
}

// A phone can't fit the portfolio's full ~260° longitude span above minZoom,
// so fitBounds would silently center on the bounds midpoint — an empty
// Atlantic/Africa view with every marker off-screen. Frame the dense 5–95%
// core (US + Europe, ~95% of holdings) instead; the outliers are a swipe away.
function coreBounds(
  properties: ExploreProperty[]
): [[number, number], [number, number]] | undefined {
  if (properties.length < 20) return boundsOf(properties);
  const lngs = properties.map((p) => p.lng).sort((a, b) => a - b);
  const lats = properties.map((p) => p.lat).sort((a, b) => a - b);
  return [
    [quantile(lngs, 0.1), quantile(lats, 0.1)],
    [quantile(lngs, 0.9), quantile(lats, 0.9)],
  ];
}

export default function ExploreMap({
  properties,
  selected,
  maptilerApiKey,
  onSelect,
  onUnavailable,
  padding,
}: ExploreMapProps) {
  // Frozen at mount: the map should open framing the (initially unfiltered)
  // portfolio, not the hardcoded world default — and framing via the
  // constructor means no tiles are ever requested for the wrong view.
  // Wide screens can fit everything; narrow ones get the dense 10–90% core,
  // with slim horizontal padding so the US→Europe span fits above MIN_ZOOM.
  // With a selection already present at mount (e.g. dismissing the panel
  // after arriving from a content page remounts the app), open on the
  // property's neighbourhood instead of zooming out to the world.
  const [initial] = useState(() => {
    const wide =
      typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;
    const base = fullPadding(padding, 24);
    const bounds = selected
      ? ([
          [selected.lng - 0.02, selected.lat - 0.015],
          [selected.lng + 0.02, selected.lat + 0.015],
        ] as [[number, number], [number, number]])
      : wide
        ? boundsOf(properties)
        : coreBounds(properties);
    return {
      bounds,
      boundsPadding: {
        top: base.top + INITIAL_FIT_EXTRA_PX,
        right: wide ? base.right + INITIAL_FIT_EXTRA_PX : 16,
        bottom: base.bottom + INITIAL_FIT_EXTRA_PX,
        left: wide ? base.left + INITIAL_FIT_EXTRA_PX : 16,
      },
    };
  });

  const { containerRef, map, ready, view } = useMaplibreMap({
    maptilerApiKey,
    minZoom: MIN_ZOOM,
    onUnavailable,
    initialBounds: initial.bounds,
    initialBoundsPadding: initial.boundsPadding,
  });

  const features = useMemo(
    () => buildPropertyFeatureCollection(properties.map(toFlat)),
    [properties]
  );
  const selectedFeatures = useMemo(
    () => buildSelectedFeatureCollection(selected ? toFlat(selected) : null),
    [selected]
  );

  usePropertyClusterLayer({ map, ready, features, selectedFeatures, onSelectProperty: onSelect });

  // MapLibre measures its container once at creation. When the pane changes size
  // (desktop view toggle, list show/hide, mobile rotate) the canvas must be told
  // to re-measure or it renders at a stale width.
  useEffect(() => {
    if (!map) return;
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") {
      map.resize();
      return;
    }
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map, containerRef]);

  const paddingRef = useRef(padding);
  useEffect(() => {
    paddingRef.current = padding;
  }, [padding]);

  // Focus the selected property (selection is URL-driven — cards, markers and
  // compare chips all navigate to /property/[id]). If it's already on screen
  // and we're zoomed in, just pan — don't zoom. Only fly (with a zoom change)
  // when the target is off-screen or we're zoomed out.
  useEffect(() => {
    if (!map || !ready || !selected) return;
    const center: [number, number] = [selected.lng, selected.lat];
    const reduce = prefersReducedMotion();
    const padding = fullPadding(paddingRef.current);
    const onScreen = map.getBounds().contains(center);
    const zoom = map.getZoom();

    if (onScreen && zoom >= NEARBY_ZOOM) {
      map.easeTo({ center, duration: reduce ? 0 : 500, padding, essential: true });
    } else {
      map.flyTo({
        center,
        zoom: Math.max(zoom, ZOOM_PROPERTY_FOCUS),
        duration: reduce ? 0 : 900,
        padding,
        essential: true,
      });
    }
  }, [selected, map, ready]);

  // Frame all currently-filtered results.
  const frameResults = useCallback(() => {
    if (!map || properties.length === 0) return;
    const reduce = prefersReducedMotion();
    if (properties.length === 1) {
      map.flyTo({
        center: [properties[0].lng, properties[0].lat],
        zoom: ZOOM_PROPERTY_FOCUS,
        duration: reduce ? 0 : 700,
      });
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    for (const property of properties) {
      bounds.extend([property.lng, property.lat]);
    }
    map.fitBounds(bounds, {
      padding: fullPadding(paddingRef.current, 64),
      maxZoom: 13,
      duration: reduce ? 0 : 800,
    });
  }, [map, properties]);

  const tilted = view.pitch > 10;

  const toggleTilt = useCallback(() => {
    if (!map) return;
    map.easeTo({ pitch: tilted ? 0 : FOCUS_PITCH, duration: prefersReducedMotion() ? 0 : 500 });
  }, [map, tilted]);

  return (
    <div className="explore-map absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />

      {/* Map controls — bottom-left so they clear the list pane / bottom sheet. */}
      <div className="pointer-events-none absolute bottom-4 left-3 z-[15] flex flex-col gap-2 md:left-4">
        {/* Zoom buttons are desktop-only — pinch covers it on touch, and the
            bottom edge on phones is already busy (pill, attribution, tray). */}
        <div className="pointer-events-auto hidden flex-col overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-lg ring-1 ring-black/[0.03] backdrop-blur md:flex">
          <button
            type="button"
            onClick={() => map?.zoomIn({ duration: 200 })}
            className="flex h-10 w-10 items-center justify-center text-lg text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
            aria-label="Zoom in"
          >
            +
          </button>
          <div className="h-px bg-slate-200" />
          <button
            type="button"
            onClick={() => map?.zoomOut({ duration: 200 })}
            className="flex h-10 w-10 items-center justify-center text-lg text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
            aria-label="Zoom out"
          >
            −
          </button>
        </div>
        <button
          type="button"
          onClick={frameResults}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/95 text-slate-700 shadow-lg ring-1 ring-black/[0.03] backdrop-blur transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          aria-label="Frame all results"
          title="Frame all results"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4">
            <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
          </svg>
        </button>
        <button
          type="button"
          onClick={toggleTilt}
          aria-pressed={tilted}
          className={`pointer-events-auto flex h-10 w-10 items-center justify-center rounded-xl border text-xs font-semibold shadow-lg ring-1 ring-black/[0.03] backdrop-blur transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
            tilted
              ? "border-emerald-500 bg-emerald-600 text-white"
              : "border-slate-200 bg-white/95 text-slate-700 hover:bg-slate-100"
          }`}
          aria-label={tilted ? "Reset to flat view" : "Tilt for 3D buildings"}
          title="3D tilt"
        >
          3D
        </button>
      </div>
    </div>
  );
}
