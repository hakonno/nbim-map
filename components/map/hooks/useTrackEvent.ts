"use client";

import { useCallback, useRef } from "react";

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem("nbim_sid");
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
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
