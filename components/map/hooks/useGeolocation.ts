"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GeolocationStatus =
  | "idle"
  | "locating"
  | "active"
  | "denied"
  | "unavailable"
  | "error";

type UseGeolocationParams = {
  /** Called with a fresh fix so the engine can place its marker / move camera. */
  onPosition: (longitude: number, latitude: number) => void;
};

type UseGeolocationResult = {
  status: GeolocationStatus;
  /** Request a one-shot fix. Only ever call this from an explicit user gesture. */
  locate: () => void;
  /** Dismiss a transient error/permission message. */
  clearMessage: () => void;
};

// Engine-agnostic geolocation state machine shared by the MapLibre and Leaflet
// maps. It never auto-runs and never watches continuously: a single
// getCurrentPosition per explicit click, so the user stays in control.
export function useGeolocation({ onPosition }: UseGeolocationParams): UseGeolocationResult {
  const [status, setStatus] = useState<GeolocationStatus>("idle");

  const onPositionRef = useRef(onPosition);
  useEffect(() => {
    onPositionRef.current = onPosition;
  }, [onPosition]);

  const locate = useCallback(() => {
    // Geolocation requires a secure context (HTTPS or localhost) and support.
    if (
      typeof navigator === "undefined" ||
      !navigator.geolocation ||
      (typeof window !== "undefined" && !window.isSecureContext)
    ) {
      setStatus("unavailable");
      return;
    }

    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onPositionRef.current(position.coords.longitude, position.coords.latitude);
        setStatus("active");
      },
      (error) => {
        setStatus(error.code === error.PERMISSION_DENIED ? "denied" : "error");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, []);

  const clearMessage = useCallback(() => {
    setStatus((current) =>
      current === "denied" || current === "unavailable" || current === "error"
        ? "idle"
        : current
    );
  }, []);

  return { status, locate, clearMessage };
}

/** Maps an error/idle status to a user-facing message (null when nothing to show). */
export function geolocationMessage(status: GeolocationStatus): string | null {
  switch (status) {
    case "denied":
      return "Location access is blocked. Enable it in your browser settings to see where you are.";
    case "unavailable":
      return "Location isn’t available on this device or connection.";
    case "error":
      return "Couldn’t pinpoint your location. Please try again.";
    default:
      return null;
  }
}
