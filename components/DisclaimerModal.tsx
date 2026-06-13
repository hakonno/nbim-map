"use client";

import { useSyncExternalStore } from "react";

// Single source of truth for the disclaimer copy. Editing any field here
// automatically re-shows the modal to returning users (see CONTENT_VERSION).
const DISCLAIMER = {
  title: "Early version",
  badge: "Last updated: June 2026",
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

function WarningGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

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
      className="fixed inset-0 z-[1050] flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm"
      onClick={handleClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="disclaimer-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600"
          >
            <WarningGlyph className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="disclaimer-title" className="text-lg font-semibold text-slate-900">
              {DISCLAIMER.title}
            </h2>
            <span className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {DISCLAIMER.badge}
            </span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-600">{DISCLAIMER.body}</p>

        <button
          type="button"
          onClick={handleClose}
          className="mt-5 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
