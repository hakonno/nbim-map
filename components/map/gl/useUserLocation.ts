"use client";

import maplibregl, { type Map as MaplibreMap } from "maplibre-gl";
import { useCallback, useEffect, useRef } from "react";

import {
  geolocationMessage,
  useGeolocation,
  type GeolocationStatus,
} from "@/components/map/hooks/useGeolocation";
import { createUserLocationElement } from "@/components/map/userLocationMarker";

export type { GeolocationStatus };

type UseUserLocationParams = {
  map: MaplibreMap | null;
  /** Called once a fix is obtained so the caller can move the camera. */
  onLocated?: (lng: number, lat: number) => void;
};

type UseUserLocationResult = {
  status: GeolocationStatus;
  message: string | null;
  locate: () => void;
  clearMessage: () => void;
};

export function useUserLocation({
  map,
  onLocated,
}: UseUserLocationParams): UseUserLocationResult {
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const handlePosition = useCallback(
    (lng: number, lat: number) => {
      if (!map) return;
      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat]);
      } else {
        markerRef.current = new maplibregl.Marker({
          element: createUserLocationElement(),
        })
          .setLngLat([lng, lat])
          .addTo(map);
      }
      onLocated?.(lng, lat);
    },
    [map, onLocated]
  );

  const { status, locate, clearMessage } = useGeolocation({ onPosition: handlePosition });

  // Drop the marker when the map is torn down or this component unmounts.
  useEffect(() => {
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
    };
  }, [map]);

  return { status, message: geolocationMessage(status), locate, clearMessage };
}
