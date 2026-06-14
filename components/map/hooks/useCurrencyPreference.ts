"use client";

import { useEffect, useSyncExternalStore } from "react";

import type { Currency } from "@/utils/formatCurrency";

// A single USD/NOK preference shared by the map and the list pages, so toggling
// it in one place is reflected everywhere. The exchange *rate* lives in
// useExchangeRate; this store only holds the user's chosen display currency.
const STORAGE_KEY = "nbim-currency";

let currency: Currency = "USD";
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((cb) => cb());
}

function subscribe(cb: () => void) {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

function getSnapshot(): Currency {
  return currency;
}

// Always "USD" on the server and for the first client paint, so hydration
// matches; localStorage is applied right after mount (see useCurrency).
function getServerSnapshot(): Currency {
  return "USD";
}

export function setCurrency(next: Currency) {
  if (currency === next) return;
  currency = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Ignore storage failures (private mode, blocked, etc.).
  }
  notify();
}

let hydrated = false;
function hydrateFromStorage() {
  if (hydrated) return;
  hydrated = true;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if ((stored === "USD" || stored === "NOK") && stored !== currency) {
      currency = stored;
      notify();
    }
  } catch {
    // Ignore.
  }
}

export function useCurrency(): Currency {
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    hydrateFromStorage();
  }, []);
  return value;
}
