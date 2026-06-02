"use client";

import { useSyncExternalStore } from "react";

// Single source of truth for the disclaimer copy. Editing any field here
// automatically re-shows the modal to returning users (see CONTENT_VERSION).
const DISCLAIMER = {
  title: "Early version",
  badge: "Last updated: April 2026",
  body:
    "This app is under active development and may contain errors or incomplete data. " +
    "Financial figures and property data are sourced from third-party sources and may not be accurate.",
};

// djb2 (xor variant) — small, deterministic, dependency-free.
function hashContent(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

// The "seen" marker is a hash of the content, so any code change to DISCLAIMER
// invalidates prior dismissals and the modal reappears automatically.
const CONTENT_VERSION = hashContent(
  `${DISCLAIMER.title}|${DISCLAIMER.badge}|${DISCLAIMER.body}`
);
const STORAGE_KEY = "disclaimer_seen";

const subscribers = new Set<() => void>();

function subscribe(cb: () => void) {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

function getSnapshot(): boolean {
  return localStorage.getItem(STORAGE_KEY) === CONTENT_VERSION;
}

function getServerSnapshot(): boolean {
  // Hide on server and during hydration to avoid mismatch.
  return true;
}

export default function DisclaimerModal() {
  const seen = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (seen) return null;

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, CONTENT_VERSION);
    subscribers.forEach((cb) => cb());
  };

  return (
    <div
      className="fixed inset-0 z-[1050] flex items-center justify-center bg-black/50 px-4"
      onClick={handleClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="disclaimer-title"
        className="bg-white rounded-2xl p-6 max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="disclaimer-title" className="text-xl font-semibold mb-2 flex items-center gap-2">
          ⚠️ {DISCLAIMER.title}
          <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded">
            {DISCLAIMER.badge}
          </span>
        </h2>
        <p className="text-sm text-gray-600 mb-4">{DISCLAIMER.body}</p>
        <button
          type="button"
          onClick={handleClose}
          className="w-full bg-black text-white py-2 rounded-xl"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
