"use client";

import { Circle, Polygon } from "react-leaflet";

import { useBuildingFootprint } from "@/components/map/hooks/useBuildingFootprint";
import {
  ZOOM_PROPERTY_FOCUS,
  getPropertyColors,
} from "@/components/map/mapConstants";
import type { FlatProperty } from "@/components/map/mapTypes";

type MapBuildingFootprintProps = {
  selectedProperty: FlatProperty | null;
  zoom: number;
};

export default function MapBuildingFootprint({
  selectedProperty,
  zoom,
}: MapBuildingFootprintProps) {
  const enabled = Boolean(selectedProperty) && zoom >= ZOOM_PROPERTY_FOCUS;

  const { coordinates, status } = useBuildingFootprint({
    propertyId: selectedProperty?.id ?? null,
    lat: selectedProperty?.lat ?? null,
    lng: selectedProperty?.lng ?? null,
    enabled,
  });

  if (!selectedProperty || !enabled) {
    return null;
  }

  const colors = getPropertyColors(
    selectedProperty.ownership_percent,
    true,
    Boolean(selectedProperty.is_nbim_office)
  );

  if (coordinates) {
    return (
      <Polygon
        positions={coordinates}
        pathOptions={{
          color: colors.stroke,
          weight: 2.5,
          opacity: 0.95,
          fillColor: colors.fill,
          fillOpacity: 0.35,
          className: "nbim-building-footprint",
        }}
        interactive={false}
      />
    );
  }

  if (status === "loading") {
    return (
      <Circle
        center={[selectedProperty.lat, selectedProperty.lng]}
        radius={22}
        pathOptions={{
          color: colors.stroke,
          weight: 2,
          opacity: 0.7,
          fillColor: colors.fill,
          fillOpacity: 0.15,
          className: "nbim-building-footprint-loading",
        }}
        interactive={false}
      />
    );
  }

  return null;
}
