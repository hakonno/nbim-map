"use client";

import type { LeafletEvent, Map as LeafletMap } from "leaflet";
import { useEffect } from "react";
import { useMapEvents } from "react-leaflet";

type MapEventBridgeProps = {
  onMapReady: (map: LeafletMap) => void;
  onZoomChange: (zoom: number) => void;
  onCenterChange: (center: [number, number]) => void;
};

export default function MapEventBridge({
  onMapReady,
  onZoomChange,
  onCenterChange,
}: MapEventBridgeProps) {
  const map = useMapEvents({
    zoomend: (event: LeafletEvent) => {
      onZoomChange((event.target as { getZoom: () => number }).getZoom());
    },
    moveend: (event: LeafletEvent) => {
      const center = (
        event.target as { getCenter: () => { lat: number; lng: number } }
      ).getCenter();
      onCenterChange([center.lat, center.lng]);
    },
  });

  useEffect(() => {
    onMapReady(map);

    const center = map.getCenter();
    onCenterChange([center.lat, center.lng]);
  }, [map, onCenterChange, onMapReady]);

  return null;
}
