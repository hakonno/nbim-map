"use client";

import { useCallback, useSyncExternalStore } from "react";

export type AttomSaleHistoryEntry = {
  sequence?: number;
  saleTransDate?: string;
  saleSearchDate?: string;
  buyerName?: string;
  sellerName?: string;
  amount?: {
    saleAmt?: number;
    saleTransType?: string;
    saleDocType?: string;
  };
  calculation?: {
    pricepersizeunit?: number;
  };
  mortgage?: {
    FirstConcurrent?: {
      amount?: number;
      lenderLastName?: string;
    };
  };
};

export type AttomData = {
  attomId?: number;
  address?: {
    line1?: string;
    line2?: string;
    countrySubd?: string;
  };
  sale?: {
    saleTransDate?: string;
    sellerName?: string;
    amount?: {
      saleamt?: number;
      saleTransType?: string;
    };
  };
  assessment?: {
    market?: {
      mktttlvalue?: number;
      mktimprvalue?: number;
      mktlandvalue?: number;
    };
    assessed?: {
      assdttlvalue?: number;
    };
    tax?: {
      taxamt?: number;
      taxyear?: number;
    };
  };
  building?: {
    size?: {
      universalsize?: number;
    };
    summary?: {
      levels?: number;
      yearbuilteffective?: number;
    };
  };
  saleHistory?: AttomSaleHistoryEntry[];
};

export type FetchResult =
  | { status: "loading" }
  | { status: "success"; data: AttomData | null }
  | { status: "error" };

// Module-level external store shared across all hook instances. The cache only
// ever holds resolved results (success/error); "loading" is represented by the
// absence of an entry plus an in-flight marker. Every instance reading a given
// id subscribes, so all of them re-render together when the fetch settles.
const cache = new Map<string, FetchResult>();
const inFlight = new Set<string>();
const listeners = new Map<string, Set<() => void>>();

// Stable references so useSyncExternalStore's Object.is comparison never loops.
const LOADING: FetchResult = { status: "loading" };

function emit(id: string) {
  const set = listeners.get(id);
  if (!set) return;
  for (const listener of set) listener();
}

function startFetch(id: string) {
  // Already resolved successfully — keep the cached value.
  if (cache.get(id)?.status === "success") return;
  // A request for this id is already running; its result will notify everyone.
  if (inFlight.has(id)) return;

  inFlight.add(id);
  fetch(`/api/attom?id=${encodeURIComponent(id)}`)
    .then((r) => r.json())
    .then((data: AttomData | null) => {
      cache.set(id, { status: "success", data });
    })
    .catch(() => {
      cache.set(id, { status: "error" });
    })
    .finally(() => {
      inFlight.delete(id);
      emit(id);
    });
}

export function useAttomData(propertyId: string | null): FetchResult | null {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!propertyId) return () => {};

      let set = listeners.get(propertyId);
      if (!set) {
        set = new Set();
        listeners.set(propertyId, set);
      }
      set.add(onStoreChange);

      // Kick off the fetch, or join one already in flight for this id.
      startFetch(propertyId);

      return () => {
        set.delete(onStoreChange);
        if (set.size === 0) listeners.delete(propertyId);
      };
    },
    [propertyId]
  );

  const getSnapshot = useCallback(
    (): FetchResult | null => {
      if (!propertyId) return null;
      return cache.get(propertyId) ?? LOADING;
    },
    [propertyId]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
