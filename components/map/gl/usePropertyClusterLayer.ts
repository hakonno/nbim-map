"use client";

import maplibregl, {
  type GeoJSONSource,
  type MapGeoJSONFeature,
  type MapLayerMouseEvent,
  type Map as MaplibreMap,
} from "maplibre-gl";
import { useEffect, useRef } from "react";

import type { BasemapFontStacks } from "@/components/map/gl/basemapProviders";
import {
  CLUSTER_FILL_COLOR,
  CLUSTER_RADIUS,
} from "@/components/map/gl/mapGlConstants";
import type { PropertyFeatureCollection } from "@/components/map/gl/glPropertyFeatures";
import { ZOOM_PROPERTY_FOCUS } from "@/components/map/mapConstants";

// Exported so the host map can hit-test marker clicks (e.g. to distinguish
// "clicked a marker" from "clicked empty basemap").
export const PROPERTY_POINT_LAYER = "nbim-unclustered";
export const PROPERTY_CLUSTER_LAYER = "nbim-clusters";

const SOURCE_ID = "nbim-properties";
const SELECTED_SOURCE_ID = "nbim-selected-property";
const CLUSTER_LAYER = PROPERTY_CLUSTER_LAYER;
const CLUSTER_COUNT_LAYER = "nbim-cluster-count";
const POINT_LAYER = PROPERTY_POINT_LAYER;
const LABEL_LAYER = "nbim-property-labels";
const SELECTED_HALO_LAYER = "nbim-selected-halo";

const LABEL_MIN_ZOOM = 17;

const integerFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const EMPTY_COLLECTION: PropertyFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

type UsePropertyClusterLayerParams = {
  map: MaplibreMap | null;
  /**
   * Bumps on every stylesheet load, including a basemap-provider swap. Keying
   * the layer setup on this (rather than a boolean "ready") is what makes the
   * markers survive a swap: `setStyle` throws away every layer and source, so
   * they have to be added again onto the new style. 0 means "no style yet".
   */
  styleEpoch: number;
  features: PropertyFeatureCollection;
  selectedFeatures: PropertyFeatureCollection;
  /**
   * Font stacks the active basemap provider can actually serve. A stack the
   * provider has no glyphs for renders as no text at all, which would silently
   * cost us the cluster counts and property labels.
   */
  fonts: BasemapFontStacks;
  onSelectProperty: (propertyId: string) => void;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function clusterTooltipHtml(props: Record<string, unknown>): string {
  const count = Number(props.point_count ?? 0);
  const officeCount = Number(props.officeCount ?? 0);
  const investmentCount = Number(props.investmentCount ?? 0);
  const ownershipSum = Number(props.ownershipSum ?? 0);
  const ownershipCount = Number(props.ownershipCount ?? 0);

  // The header names the cluster directly: pure properties or pure offices say
  // exactly what they are; only genuinely mixed clusters fall back to the
  // neutral "locations" and get a breakdown row. This avoids the awkward
  // "13 properties / 13 properties" repetition.
  const mixed = investmentCount > 0 && officeCount > 0;
  const header = mixed
    ? `${count} locations`
    : officeCount > 0
      ? `${count} NBIM office${count === 1 ? "" : "s"}`
      : `${count} propert${count === 1 ? "y" : "ies"}`;
  const lines: string[] = [
    `<div class="cluster-tooltip__header">${header}</div>`,
  ];

  if (mixed) {
    lines.push(
      `<div class="cluster-tooltip__row">${investmentCount} propert${
        investmentCount === 1 ? "y" : "ies"
      } · ${officeCount} NBIM office${officeCount === 1 ? "" : "s"}</div>`
    );
  }

  if (ownershipCount > 0) {
    const avg = ownershipSum / ownershipCount;
    const label = avg >= 99.5 ? "100" : integerFormatter.format(Math.round(avg));
    lines.push(
      `<div class="cluster-tooltip__row cluster-tooltip__row--muted">~${label}% avg ownership</div>`
    );
  }

  return `<div class="nbim-gl-cluster">${lines.join("")}</div>`;
}

export function usePropertyClusterLayer({
  map,
  styleEpoch,
  features,
  selectedFeatures,
  fonts,
  onSelectProperty,
}: UsePropertyClusterLayerParams): void {
  const onSelectRef = useRef(onSelectProperty);
  useEffect(() => {
    onSelectRef.current = onSelectProperty;
  }, [onSelectProperty]);

  // Ids in the selected source — the hover label is suppressed for these (the
  // host renders a richer callout there; both at once is double chrome).
  const selectedIdsRef = useRef<Set<string>>(new Set());
  const hoverPopupRef = useRef<maplibregl.Popup | null>(null);

  // --- Create sources, layers, and interaction handlers once the style loads,
  // and again after every provider swap (the new style starts empty).
  useEffect(() => {
    if (!map || styleEpoch === 0) {
      return;
    }

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: EMPTY_COLLECTION,
      cluster: true,
      clusterRadius: 60,
      clusterMaxZoom: ZOOM_PROPERTY_FOCUS - 1,
      promoteId: "id",
      clusterProperties: {
        officeCount: ["+", ["get", "office"]],
        investmentCount: ["+", ["get", "investment"]],
        ownershipSum: ["+", ["get", "ownershipForAvg"]],
        ownershipCount: ["+", ["get", "ownershipCountable"]],
      },
    });

    map.addSource(SELECTED_SOURCE_ID, {
      type: "geojson",
      data: EMPTY_COLLECTION,
    });

    map.addLayer({
      id: POINT_LAYER,
      type: "circle",
      source: SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": ["get", "color"],
        "circle-stroke-color": ["get", "stroke"],
        "circle-stroke-width": 1,
        "circle-opacity": 0.9,
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          6,
          ["case", ["==", ["get", "office"], 1], 6, 5],
          10,
          ["case", ["==", ["get", "office"], 1], 8, 7],
          14,
          ["case", ["==", ["get", "office"], 1], 11, 9],
          17,
          ["case", ["==", ["get", "office"], 1], 14, 12],
        ],
      },
    });

    map.addLayer({
      id: CLUSTER_LAYER,
      type: "circle",
      source: SOURCE_ID,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": CLUSTER_FILL_COLOR,
        "circle-radius": CLUSTER_RADIUS,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
        "circle-opacity": 0.94,
      },
    });

    map.addLayer({
      id: CLUSTER_COUNT_LAYER,
      type: "symbol",
      source: SOURCE_ID,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": fonts.bold,
        "text-size": 13,
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": "#0f172a",
      },
    });

    map.addLayer({
      id: LABEL_LAYER,
      type: "symbol",
      source: SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      minzoom: LABEL_MIN_ZOOM,
      layout: {
        "text-field": ["get", "label"],
        "text-font": fonts.regular,
        "text-size": 12,
        "text-offset": [0, -1.3],
        "text-anchor": "bottom",
        "text-optional": true,
        "text-max-width": 12,
      },
      paint: {
        "text-color": "#1f2937",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.6,
      },
    });

    map.addLayer({
      id: SELECTED_HALO_LAYER,
      type: "circle",
      source: SELECTED_SOURCE_ID,
      paint: {
        "circle-color": ["get", "color"],
        // Dark ink ring — nothing else on the map (dots, clusters) uses it,
        // so the selected marker reads as "chosen", not just "bigger".
        "circle-stroke-color": "#0f172a",
        "circle-stroke-width": 3,
        "circle-opacity": 1,
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          6,
          8,
          10,
          10,
          14,
          13,
          17,
          17,
        ],
      },
    });

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 14,
      className: "nbim-gl-popup",
    });
    hoverPopupRef.current = popup;

    const setPointer = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const clearPointer = () => {
      map.getCanvas().style.cursor = "";
      popup.remove();
    };

    const onClusterClick = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) {
        return;
      }
      const clusterId = feature.properties?.cluster_id;
      const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      if (clusterId == null || !source) {
        return;
      }
      void source.getClusterExpansionZoom(clusterId).then((expansionZoom) => {
        const geometry = feature.geometry;
        if (geometry.type !== "Point") {
          return;
        }
        map.easeTo({
          center: geometry.coordinates as [number, number],
          zoom: expansionZoom,
          duration: 500,
        });
      });
    };

    const onClusterMove = (event: MapLayerMouseEvent) => {
      setPointer();
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== "Point") {
        return;
      }
      popup
        .setLngLat(feature.geometry.coordinates as [number, number])
        .setHTML(clusterTooltipHtml(feature.properties ?? {}))
        .addTo(map);
    };

    const onPointClick = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0] as MapGeoJSONFeature | undefined;
      const id = feature?.properties?.id;
      if (typeof id === "string") {
        onSelectRef.current(id);
      }
    };

    const onPointMove = (event: MapLayerMouseEvent) => {
      setPointer();
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== "Point") {
        return;
      }
      // The selected marker already carries the callout card — the small
      // hover label on top of it is double chrome (and on touch, the tap's
      // synthetic mousemove would leave it stuck under the callout).
      const id = feature.properties?.id;
      if (typeof id === "string" && selectedIdsRef.current.has(id)) {
        popup.remove();
        return;
      }
      const label = feature.properties?.label;
      if (typeof label !== "string") {
        return;
      }
      popup
        .setLngLat(feature.geometry.coordinates as [number, number])
        .setHTML(`<div class="nbim-gl-popup__label">${escapeHtml(label)}</div>`)
        .addTo(map);
    };

    map.on("click", CLUSTER_LAYER, onClusterClick);
    map.on("mousemove", CLUSTER_LAYER, onClusterMove);
    map.on("mouseleave", CLUSTER_LAYER, clearPointer);
    map.on("click", POINT_LAYER, onPointClick);
    map.on("mousemove", POINT_LAYER, onPointMove);
    map.on("mouseleave", POINT_LAYER, clearPointer);

    return () => {
      map.off("click", CLUSTER_LAYER, onClusterClick);
      map.off("mousemove", CLUSTER_LAYER, onClusterMove);
      map.off("mouseleave", CLUSTER_LAYER, clearPointer);
      map.off("click", POINT_LAYER, onPointClick);
      map.off("mousemove", POINT_LAYER, onPointMove);
      map.off("mouseleave", POINT_LAYER, clearPointer);
      popup.remove();

      // On unmount the map instance is removed first (its hook runs earlier),
      // which clears its `style`. removeLayer/removeSource would then throw, and
      // remove() already disposed these layers — so bail. Read `style` directly
      // (O(1)); getStyle() would serialise the whole stylesheet just to check.
      // After a provider swap `style` is the NEW stylesheet, which never had
      // these layers — the getLayer/getSource guards below make that a no-op.
      if (!(map as { style?: unknown }).style) {
        return;
      }

      for (const layer of [
        SELECTED_HALO_LAYER,
        LABEL_LAYER,
        CLUSTER_COUNT_LAYER,
        CLUSTER_LAYER,
        POINT_LAYER,
      ]) {
        if (map.getLayer(layer)) {
          map.removeLayer(layer);
        }
      }
      for (const source of [SELECTED_SOURCE_ID, SOURCE_ID]) {
        if (map.getSource(source)) {
          map.removeSource(source);
        }
      }
    };
  }, [map, styleEpoch, fonts]);

  // --- Push new property data without rebuilding the layers.
  useEffect(() => {
    if (!map || styleEpoch === 0) {
      return;
    }
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(features);
  }, [map, styleEpoch, features]);

  // --- Update the highlighted selection.
  useEffect(() => {
    if (!map || styleEpoch === 0) {
      return;
    }
    const source = map.getSource(SELECTED_SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(selectedFeatures ?? EMPTY_COLLECTION);

    // Track selected ids for hover-label suppression, and clear any label
    // that a tap's synthetic mousemove left behind on the newly selected
    // marker (touch never fires mouseleave).
    selectedIdsRef.current = new Set(
      (selectedFeatures?.features ?? [])
        .map((feature) => feature.properties?.id)
        .filter((id): id is string => typeof id === "string")
    );
    if (selectedIdsRef.current.size > 0) {
      hoverPopupRef.current?.remove();
    }
  }, [map, styleEpoch, selectedFeatures]);
}
