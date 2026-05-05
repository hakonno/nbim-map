"use client";

import { useEffect, useState } from "react";

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

// Module-level cache shared across renders — treated as append-only external store
const cache = new Map<string, FetchResult>();

export function useAttomData(propertyId: string | null): FetchResult | null {
  // Counter-based re-render trigger; cache is read directly during render
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (!propertyId) return;

    if (cache.has(propertyId)) return;

    let cancelled = false;
    cache.set(propertyId, { status: "loading" });

    fetch(`/api/attom?id=${encodeURIComponent(propertyId)}`)
      .then((r) => r.json())
      .then((data: AttomData | null) => {
        if (cancelled) return;
        cache.set(propertyId, { status: "success", data });
        forceUpdate((n) => n + 1);
      })
      .catch(() => {
        if (cancelled) return;
        cache.set(propertyId, { status: "error" });
        forceUpdate((n) => n + 1);
      });

    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  if (!propertyId) return null;
  return cache.get(propertyId) ?? { status: "loading" };
}
