"use client";

import maplibregl from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { buildPropertyFeatureCollection, buildSelectedFeatureCollection } from "@/components/map/gl/glPropertyFeatures";
import { FOCUS_PITCH } from "@/components/map/gl/mapGlConstants";
import { useMaplibreMap } from "@/components/map/gl/useMaplibreMap";
import {
  PROPERTY_CLUSTER_LAYER,
  PROPERTY_POINT_LAYER,
  usePropertyClusterLayer,
} from "@/components/map/gl/usePropertyClusterLayer";
import { ZOOM_PROPERTY_FOCUS } from "@/components/map/mapConstants";
import type { FlatProperty } from "@/components/map/mapTypes";
import { sectorStyle } from "@/components/explore/sectorStyles";
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
  /** Marker click — the host decides whether that peeks (callout only) or
   * opens the panel. Clicking the callout card always calls onSelect. */
  onPeek: (id: string) => void;
  /** Click on empty basemap — dismisses a peek callout. */
  onClearPeek: () => void;
  onUnavailable: (reason: string) => void;
  /** Padding (px) the camera should keep clear on each side (panels/sheets). */
  padding?: { top?: number; right?: number; bottom?: number; left?: number };
  /** True when the detail panel overlays the map's left edge (map view):
   * the control stack slides right so it isn't buried under the panel. */
  panelInset?: boolean;
  /** Bump to frame the currently filtered results (e.g. after applying the
   * mobile filter sheet — its results may be entirely off-screen). */
  frameNonce?: number;
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

function stakeText(value: number | null): string {
  if (value == null) return "stake n/d";
  const pct = Number.isInteger(value) ? `${value}` : value.toFixed(1);
  return `${pct}% stake`;
}

/**
 * Callout card shown above the selected marker: name + quick facts. Built
 * with DOM APIs (textContent) so dataset strings can't inject markup. The
 * Tailwind classes are literal strings, so the JIT scanner picks them up.
 */
function buildCalloutElement(property: ExploreProperty): HTMLElement {
  const sector = sectorStyle(property.sector);

  const card = document.createElement("div");
  card.className =
    "pointer-events-auto relative flex max-w-[15rem] cursor-pointer flex-col gap-0.5 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-left shadow-xl ring-1 ring-black/[0.05] backdrop-blur";

  const nameRow = document.createElement("div");
  nameRow.className = "flex items-start gap-1.5";
  const dot = document.createElement("span");
  dot.className = "mt-1 h-2 w-2 shrink-0 rounded-full";
  dot.style.backgroundColor = sector.dot;
  dot.setAttribute("aria-hidden", "true");
  const name = document.createElement("span");
  name.className = "text-[13px] font-semibold leading-snug text-slate-900";
  name.textContent = property.name;
  nameRow.append(dot, name);

  const facts = document.createElement("div");
  facts.className = "pl-3.5 text-[11px] leading-snug text-slate-500";
  facts.textContent = `${sector.label} · ${stakeText(property.ownership)} · ${property.city}`;

  // The card is the doorway to the full panel — say so.
  const cta = document.createElement("div");
  cta.className = "pl-3.5 text-[11px] font-medium leading-snug text-emerald-700";
  cta.textContent = "View details ›";

  // Little arrow pointing at the marker.
  const tip = document.createElement("span");
  tip.className =
    "absolute left-1/2 top-full -mt-[5px] h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-b border-r border-slate-200 bg-white";
  tip.setAttribute("aria-hidden", "true");

  card.append(nameRow, facts, cta, tip);
  return card;
}

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
  onPeek,
  onClearPeek,
  onUnavailable,
  padding,
  panelInset = false,
  frameNonce = 0,
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

  usePropertyClusterLayer({ map, ready, features, selectedFeatures, onSelectProperty: onPeek });

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

  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Clicking empty basemap dismisses a peek callout; clicks that hit a marker
  // or cluster are excluded by hit-testing the point.
  useEffect(() => {
    if (!map || !ready) return;
    const onMapClick = (event: maplibregl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(event.point, {
        layers: [PROPERTY_POINT_LAYER, PROPERTY_CLUSTER_LAYER],
      });
      if (features.length === 0) onClearPeek();
    };
    map.on("click", onMapClick);
    return () => {
      map.off("click", onMapClick);
    };
  }, [map, ready, onClearPeek]);

  // Selected-property callout: a card above the marker with the name and
  // quick facts. This is the selection's identity on the map itself — a
  // slightly bigger dot is too easy to confuse with a cluster, and on phones
  // the list is never visible next to the map. Clicking it (re)opens the panel.
  useEffect(() => {
    if (!map || !ready || !selected) return;

    const card = buildCalloutElement(selected);
    const id = selected.id;
    const onClick = () => onSelectRef.current(id);
    card.addEventListener("click", onClick);

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      anchor: "bottom",
      offset: 18,
      maxWidth: "none",
      // The shared shell class strips MapLibre's default chrome and makes the
      // container click-through; the card re-enables pointer events itself.
      className: "nbim-gl-popup",
    })
      .setLngLat([selected.lng, selected.lat])
      .setDOMContent(card)
      .addTo(map);

    return () => {
      card.removeEventListener("click", onClick);
      popup.remove();
    };
  }, [map, ready, selected]);

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

  // Host-triggered framing (nonce bumps when the filter sheet applies new
  // filters). Read through a ref so the effect keys on the nonce alone.
  const frameResultsRef = useRef(frameResults);
  useEffect(() => {
    frameResultsRef.current = frameResults;
  }, [frameResults]);
  useEffect(() => {
    if (!ready || frameNonce === 0) return;
    frameResultsRef.current();
  }, [ready, frameNonce]);

  const tilted = view.pitch > 10;

  const toggleTilt = useCallback(() => {
    if (!map) return;
    map.easeTo({ pitch: tilted ? 0 : FOCUS_PITCH, duration: prefersReducedMotion() ? 0 : 500 });
  }, [map, tilted]);

  return (
    <div className="explore-map absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />

      {/* Map controls — bottom-left so they clear the list pane / bottom sheet;
          shifted right of the detail panel when it overlays the map edge. */}
      <div
        className={`pointer-events-none absolute bottom-4 z-[15] flex flex-col gap-2 ${
          panelInset ? "left-[424px] lg:left-[468px]" : "left-3 md:left-4"
        }`}
      >
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
