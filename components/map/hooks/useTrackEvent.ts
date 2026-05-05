"use client";

import { useCallback, useRef } from "react";

function generateId(): string {
  if (typeof crypto !== "undefined") {
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    }
  }
  return "unknown";
}

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem("nbim_sid");
    if (!id) {
      id = generateId();
      sessionStorage.setItem("nbim_sid", id);
    }
    return id;
  } catch {
    return "unknown";
  }
}

type TrackPayload = {
  event: string;
  propertyId?: string;
  propertyName?: string;
  propertyAddress?: string;
  cityName?: string;
  country?: string;
};

export function useTrackEvent() {
  const sessionId = useRef<string | null>(null);

  const track = useCallback((payload: TrackPayload) => {
    if (!sessionId.current) {
      sessionId.current = getSessionId();
    }
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, sessionId: sessionId.current }),
    }).catch(() => {});
  }, []);

  return track;
}
