"use client";

import { useEffect, useSyncExternalStore } from "react";

export type RateMode = "reporting" | "live";

export type RateState =
  | { status: "loading" }
  | { status: "success"; usdToNok: number; nokToUsd: number; date: string; mode: RateMode }
  | { status: "error" };

export const REPORTING_DATE = "2025-12-31";

const cached: Record<RateMode, RateState | null> = {
  reporting: null,
  live: null,
};
const inflight: Record<RateMode, Promise<void> | null> = {
  reporting: null,
  live: null,
};

let currentMode: RateMode = "reporting";
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

let rateInfoOpen = false;
const infoSubscribers = new Set<() => void>();

function subscribeInfo(cb: () => void) {
  infoSubscribers.add(cb);
  return () => {
    infoSubscribers.delete(cb);
  };
}

function getRateInfoOpen(): boolean {
  return rateInfoOpen;
}

export function setRateInfoOpen(next: boolean) {
  if (rateInfoOpen === next) return;
  rateInfoOpen = next;
  infoSubscribers.forEach((cb) => cb());
}

export function useRateInfoOpen(): boolean {
  return useSyncExternalStore(subscribeInfo, getRateInfoOpen, getRateInfoOpen);
}

function urlFor(mode: RateMode): string {
  const base = "https://api.frankfurter.dev/v2/rates?base=USD&quotes=NOK";
  return mode === "reporting" ? `${base}&date=${REPORTING_DATE}` : base;
}

function fetchRate(mode: RateMode): Promise<void> {
  if (inflight[mode]) return inflight[mode]!;
  inflight[mode] = fetch(urlFor(mode))
    .then((r) => r.json())
    .then((data) => {
      const entry = Array.isArray(data) ? data[0] : null;
      const rate = entry?.rate ?? entry?.rates?.NOK;
      if (typeof rate === "number" && rate > 0) {
        cached[mode] = {
          status: "success",
          usdToNok: rate,
          nokToUsd: 1 / rate,
          date: entry?.date ?? "",
          mode,
        };
      } else {
        cached[mode] = { status: "error" };
      }
    })
    .catch(() => {
      cached[mode] = { status: "error" };
      inflight[mode] = null;
    })
    .finally(() => {
      notify();
    });
  return inflight[mode]!;
}

function getMode(): RateMode {
  return currentMode;
}

export function setRateMode(next: RateMode) {
  if (currentMode === next) return;
  currentMode = next;
  if (!cached[next]) fetchRate(next);
  notify();
}

export function useRateMode(): RateMode {
  return useSyncExternalStore(subscribe, getMode, getMode);
}

const LOADING: RateState = { status: "loading" };

function getRateSnapshot(): RateState {
  return cached[currentMode] ?? LOADING;
}

export function useUsdToNokRate(): RateState {
  const state = useSyncExternalStore(subscribe, getRateSnapshot, getRateSnapshot);

  useEffect(() => {
    if (!cached[currentMode]) fetchRate(currentMode);
  }, [state]);

  return state;
}
