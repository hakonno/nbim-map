"use client";

import { useSyncExternalStore } from "react";

import { isWebglSupported } from "@/components/map/gl/mapGlConstants";

// Browser-capability reads done the hydration-safe way (mirrors CityMap.tsx):
// the server snapshot is fixed, the real value is read on the client after mount
// via useSyncExternalStore — no setState-in-effect.

const noopSubscribe = () => () => {};

let webglCache: boolean | null = null;
function getWebglSnapshot(): boolean {
  if (webglCache === null) {
    webglCache = isWebglSupported();
  }
  return webglCache;
}

export function useWebglSupported(): boolean {
  return useSyncExternalStore(noopSubscribe, getWebglSnapshot, () => true);
}

const DESKTOP_QUERY = "(min-width: 768px)";

function subscribeDesktop(callback: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const media = window.matchMedia(DESKTOP_QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getDesktopSnapshot(): boolean {
  return typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches;
}

export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribeDesktop, getDesktopSnapshot, () => false);
}
