"use client";

import { useEffect, useState } from "react";

import PropertyCard from "@/components/explore/PropertyCard";
import { useCurrency } from "@/components/map/hooks/useCurrencyPreference";
import { useUsdToNokRate } from "@/components/map/hooks/useExchangeRate";
import type { ExploreProperty } from "@/components/explore/types";

const PAGE_SIZE = 40;

type PropertyListProps = {
  properties: ExploreProperty[];
  selectedId: string | null;
  comparedIds: string[];
  compareFull: boolean;
  /** "column" for the split pane, "grid" for the full-width list view. */
  layout?: "column" | "grid";
  onSelect: (id: string) => void;
  onToggleCompare: (id: string) => void;
  onHover: (id: string | null) => void;
};

export default function PropertyList({
  properties,
  selectedId,
  comparedIds,
  compareFull,
  layout = "column",
  onSelect,
  onToggleCompare,
  onHover,
}: PropertyListProps) {
  const currency = useCurrency();
  const rate = useUsdToNokRate();
  const usdToNok = rate.status === "success" ? rate.usdToNok : null;
  const comparedSet = new Set(comparedIds);

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Collapse back to the first page whenever the result set changes (React's
  // recommended "adjust state during render" pattern — no extra render pass).
  const resultKey = `${properties.length}:${properties[0]?.id ?? ""}:${
    properties[properties.length - 1]?.id ?? ""
  }`;
  const [prevKey, setPrevKey] = useState(resultKey);
  if (resultKey !== prevKey) {
    setPrevKey(resultKey);
    setVisibleCount(PAGE_SIZE);
  }

  // When the map selects a property below the fold, page it in (adjust state
  // during render — the recommended pattern) so the card exists to scroll to.
  const selectedIndex = selectedId
    ? properties.findIndex((p) => p.id === selectedId)
    : -1;
  if (selectedIndex >= visibleCount) {
    setVisibleCount(Math.ceil((selectedIndex + 1) / PAGE_SIZE) * PAGE_SIZE);
  }

  // Reveal the selected card (DOM-only side effect — no setState here).
  useEffect(() => {
    if (!selectedId) return;
    const raf = requestAnimationFrame(() => {
      const node = document.getElementById(`explore-card-${selectedId}`);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      node?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedId, visibleCount]);

  if (properties.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" className="h-10 w-10 text-slate-300">
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="m20 20-3-3" />
        </svg>
        <p className="text-sm font-medium text-slate-700">No properties match your filters</p>
        <p className="text-xs text-slate-500">Try widening your search or clearing a filter.</p>
      </div>
    );
  }

  const shown = properties.slice(0, visibleCount);
  const remaining = properties.length - shown.length;

  const isGrid = layout === "grid";

  return (
    <div
      className={
        isGrid
          ? // pb clears the phone bottom stack: Map/List pill, lifted
            // attribution, and the compare tray when present (~11rem worst case).
            "mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 pb-44 pt-3 md:pb-8"
          : "flex flex-col gap-2.5 px-3 pb-6"
      }
    >
      <ul
        className={
          isGrid
            ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            : "flex flex-col gap-2.5"
        }
      >
        {shown.map((property) => (
          <li key={property.id}>
            <PropertyCard
              property={property}
              currency={currency}
              usdToNok={usdToNok}
              isSelected={property.id === selectedId}
              isCompared={comparedSet.has(property.id)}
              compareDisabled={compareFull}
              onSelect={onSelect}
              onToggleCompare={onToggleCompare}
              onHover={onHover}
            />
          </li>
        ))}
      </ul>

      {remaining > 0 ? (
        <button
          type="button"
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          className="mt-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          Show {Math.min(PAGE_SIZE, remaining)} more
          <span className="ml-1 text-slate-400">({remaining.toLocaleString("en-US")} left)</span>
        </button>
      ) : null}
    </div>
  );
}
