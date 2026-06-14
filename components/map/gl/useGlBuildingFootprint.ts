"use client";

import { type GeoJSONSource, type Map as MaplibreMap } from "maplibre-gl";
import { useEffect } from "react";

import { useBuildingFootprint } from "@/components/map/hooks/useBuildingFootprint";
import { getPropertyColors, ZOOM_PROPERTY_FOCUS } from "@/components/map/mapConstants";
import type { FlatProperty } from "@/components/map/mapTypes";

const SOURCE_ID = "nbim-building-footprint";
const FILL_LAYER = "nbim-building-footprint-fill";
const LINE_LAYER = "nbim-building-footprint-line";

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

type UseGlBuildingFootprintParams = {
  map: MaplibreMap | null;
  ready: boolean;
  selectedProperty: FlatProperty | null;
  zoom: number;
};

/**
 * Highlights the selected property's OSM building footprint as a ground overlay
 * (fill + outline). The volumetric 3D comes from the vector tiles' extruded
 * buildings; this just emphasises which footprint is selected.
 */
export function useGlBuildingFootprint({
  map,
  ready,
  selectedProperty,
  zoom,
}: UseGlBuildingFootprintParams): void {
  const enabled = Boolean(selectedProperty) && zoom >= ZOOM_PROPERTY_FOCUS;

  const { coordinates } = useBuildingFootprint({
    propertyId: selectedProperty?.id ?? null,
    lat: selectedProperty?.lat ?? null,
    lng: selectedProperty?.lng ?? null,
    enabled,
  });

  // Create the source + layers once.
  useEffect(() => {
    if (!map || !ready) {
      return;
    }

    map.addSource(SOURCE_ID, { type: "geojson", data: EMPTY });
    map.addLayer({
      id: FILL_LAYER,
      type: "fill",
      source: SOURCE_ID,
      paint: {
        "fill-color": ["get", "fill"],
        "fill-opacity": 0.35,
      },
    });
    map.addLayer({
      id: LINE_LAYER,
      type: "line",
      source: SOURCE_ID,
      paint: {
        "line-color": ["get", "stroke"],
        "line-width": 2.5,
        "line-opacity": 0.95,
      },
    });

    return () => {
      // The map instance is removed before this cleanup on unmount, clearing
      // its style; getLayer/removeLayer would throw, and remove() already
      // disposed these layers, so bail when the style is gone.
      if (!map.getStyle()) {
        return;
      }
      for (const layer of [LINE_LAYER, FILL_LAYER]) {
        if (map.getLayer(layer)) {
          map.removeLayer(layer);
        }
      }
      if (map.getSource(SOURCE_ID)) {
        map.removeSource(SOURCE_ID);
      }
    };
  }, [map, ready]);

  // Push the current footprint polygon.
  useEffect(() => {
    if (!map || !ready) {
      return;
    }
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) {
      return;
    }

    if (!enabled || !selectedProperty || !coordinates || coordinates.length < 3) {
      source.setData(EMPTY);
      return;
    }

    const colors = getPropertyColors(
      selectedProperty.ownership_percent,
      true,
      Boolean(selectedProperty.is_nbim_office)
    );

    // GeoJSON wants [lng, lat] and a closed ring.
    const ring = coordinates.map(([lat, lng]) => [lng, lat]);
    const [firstLng, firstLat] = ring[0];
    const [lastLng, lastLat] = ring[ring.length - 1];
    if (firstLng !== lastLng || firstLat !== lastLat) {
      ring.push([firstLng, firstLat]);
    }

    source.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { fill: colors.fill, stroke: colors.stroke },
          geometry: { type: "Polygon", coordinates: [ring] },
        },
      ],
    });
  }, [map, ready, enabled, selectedProperty, coordinates]);
}
