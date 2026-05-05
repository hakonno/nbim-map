"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "disclaimer_seen";

const subscribers = new Set<() => void>();

function subscribe(cb: () => void) {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

function getSnapshot(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

function getServerSnapshot(): boolean {
  // Hide on server and during hydration to avoid mismatch.
  return true;
}

export default function DisclaimerModal() {
  const seen = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (seen) return null;

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, "true");
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
          ⚠️ Early version
          <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded">
            Last updated: April 2026
          </span>
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          This app is under active development and may contain errors or incomplete data.
          Financial figures and property data are sourced from third-party sources and may not be accurate.
        </p>
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