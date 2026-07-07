"use client";

import { useState, useSyncExternalStore } from "react";

import DataFreshnessModal from "@/components/explore/DataFreshnessModal";

type DataFreshnessIndicatorProps = {
  datasetYear: string;
  expectedLatestYear: number;
  isStale: boolean;
};

// djb2 (xor variant) — small, deterministic, dependency-free.
function hashContent(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function storageKey(datasetYear: string, expectedLatestYear: number): string {
  return `data_freshness_seen_${datasetYear}_${expectedLatestYear}`;
}

function contentVersion(datasetYear: string, expectedLatestYear: number): string {
  // Bumping the trailing version invalidates prior dismissals when the copy
  // changes, causing the modal to reappear automatically.
  return hashContent(`${datasetYear}|${expectedLatestYear}|v1`);
}

const subscribers = new Set<() => void>();

function subscribe(cb: () => void) {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

function notify() {
  subscribers.forEach((cb) => cb());
}

function useFreshnessDismissed(datasetYear: string, expectedLatestYear: number): boolean {
  const key = storageKey(datasetYear, expectedLatestYear);
  const version = contentVersion(datasetYear, expectedLatestYear);

  return useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(key) === version,
    // Hide during SSR / hydration to avoid a mismatch: the banner still
    // renders, so the warning is visible; the modal simply appears after
    // the client checks its stored state.
    () => true
  );
}

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

export default function DataFreshnessIndicator({
  datasetYear,
  expectedLatestYear,
  isStale,
}: DataFreshnessIndicatorProps) {
  const [forceOpen, setForceOpen] = useState(false);
  const dismissed = useFreshnessDismissed(datasetYear, expectedLatestYear);

  if (!isStale) return null;

  const isOpen = forceOpen || !dismissed;

  const handleClose = () => {
    const key = storageKey(datasetYear, expectedLatestYear);
    const version = contentVersion(datasetYear, expectedLatestYear);
    localStorage.setItem(key, version);
    notify();
    setForceOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setForceOpen(true)}
        aria-haspopup="dialog"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
      >
        <WarningGlyph className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Data may be outdated</span>
        <span className="sm:hidden">Old data</span>
      </button>

      {isOpen ? (
        <DataFreshnessModal
          datasetYear={datasetYear}
          expectedLatestYear={expectedLatestYear}
          onClose={handleClose}
        />
      ) : null}
    </>
  );
}
