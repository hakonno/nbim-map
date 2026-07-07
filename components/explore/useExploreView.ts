"use client";

import { useSyncExternalStore } from "react";

export type ExploreView = "split" | "map" | "list";

// The detail panel renders in a parallel-route slot — a separate React tree
// from ExploreApp — but must adapt to the active view (e.g. no "Back to
// results" in the side-by-side list layout). Same module-store pattern as
// useCurrencyPreference.

let currentView: ExploreView = "split";
const subscribers = new Set<() => void>();

export function setExploreView(view: ExploreView) {
  if (view === currentView) return;
  currentView = view;
  subscribers.forEach((cb) => cb());
}

function subscribe(cb: () => void) {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

export function useExploreView(): ExploreView {
  return useSyncExternalStore(
    subscribe,
    () => currentView,
    () => "split" as const
  );
}

// Reverse channel: the panel can ask the app to change view (e.g. "Show on
// map" from the side-by-side list). ExploreApp registers the single handler.
type ViewRequestHandler = (view: ExploreView) => void;
let viewRequestHandler: ViewRequestHandler | null = null;

export function onExploreViewRequest(handler: ViewRequestHandler): () => void {
  viewRequestHandler = handler;
  return () => {
    if (viewRequestHandler === handler) viewRequestHandler = null;
  };
}

export function requestExploreView(view: ExploreView) {
  viewRequestHandler?.(view);
}
