"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import type { CityNode } from "@/types/cities";

const CityMapInner = dynamic(() => import("./CityMapInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[100svh] w-full items-center justify-center bg-slate-100 text-slate-700">
      Loading city investment map...
    </div>
  ),
});

type CityMapProps = {
  initialCities?: CityNode[];
  googleMapsEmbedApiKey?: string;
};

export default function CityMap({ initialCities, googleMapsEmbedApiKey = "" }: CityMapProps) {
  const [cities, setCities] = useState<CityNode[] | null>(initialCities ?? null);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (cities) {
      return;
    }

    const abortController = new AbortController();

    async function loadCities() {
      try {
        const response = await fetch("/api/cities", {
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to load cities (${response.status})`);
        }

        const payload = (await response.json()) as CityNode[];
        setCities(payload);
      } catch (caughtError) {
        if (abortController.signal.aborted) {
          return;
        }

        const message =
          caughtError instanceof Error ? caughtError.message : "Failed to load map data";
        setError(message);
      }
    }

    loadCities();

    return () => {
      abortController.abort();
    };
  }, [cities, reloadCount]);

  if (error) {
    return (
      <div className="flex h-[100svh] w-full items-center justify-center bg-rose-50 px-6 text-center text-rose-800">
        <div>
          <p className="text-base font-semibold">Unable to load city investment map data.</p>
          <p className="mt-2 text-sm opacity-80">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setReloadCount((current) => current + 1);
            }}
            className="mt-4 rounded-md border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-800 transition hover:bg-rose-100"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!cities) {
    return (
      <div className="flex h-[100svh] w-full items-center justify-center bg-slate-100 text-slate-700">
        Loading city investment map...
      </div>
    );
  }

  return <CityMapInner cities={cities} googleMapsEmbedApiKey={googleMapsEmbedApiKey} />;
}
