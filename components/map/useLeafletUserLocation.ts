"use client";

import L, { type Map as LeafletMap } from "leaflet";
import { useCallback, useEffect, useRef } from "react";

import {
  geolocationMessage,
  useGeolocation,
  type GeolocationStatus,
} from "@/components/map/hooks/useGeolocation";
import { USER_LOCATION_MARKER_HTML } from "@/components/map/userLocationMarker";

export type { GeolocationStatus };

type UseLeafletUserLocationParams = {
  map: LeafletMap | null;
  /** Called once a fix is obtained so the caller can move the camera. */
  onLocated?: (lat: number, lng: number) => void;
};

type UseLeafletUserLocationResult = {
  status: GeolocationStatus;
  message: string | null;
  locate: () => void;
  clearMessage: () => void;
};

function createLocationIcon(): L.DivIcon {
  return L.divIcon({
    className: "nbim-user-location",
    html: USER_LOCATION_MARKER_HTML,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

export function useLeafletUserLocation({
  map,
  onLocated,
}: UseLeafletUserLocationParams): UseLeafletUserLocationResult {
  const markerRef = useRef<L.Marker | null>(null);

  const handlePosition = useCallback(
    (lng: number, lat: number) => {
      if (!map) return;
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng], {
          icon: createLocationIcon(),
          interactive: false,
          keyboard: false,
          zIndexOffset: 1000,
        }).addTo(map);
      }
      onLocated?.(lat, lng);
    },
    [map, onLocated]
  );

  const { status, locate, clearMessage } = useGeolocation({ onPosition: handlePosition });

  // Remove the marker when the map is torn down or this component unmounts.
  useEffect(() => {
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
    };
  }, [map]);

  return { status, message: geolocationMessage(status), locate, clearMessage };
}
