"use client";

import { useEffect } from "react";

import FilterControls from "@/components/explore/FilterControls";
import SearchInput from "@/components/explore/SearchInput";
import { SORT_OPTIONS, countActiveFilters } from "@/components/explore/filtering";
import { useSheetDrag } from "@/components/explore/useSheetDrag";
import type { ExploreFacets, Filters, SortKey } from "@/components/explore/types";

type FilterSheetProps = {
  filters: Filters;
  facets: ExploreFacets;
  resultCount: number;
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
  onClose: () => void;
};

export default function FilterSheet({
  filters,
  facets,
  resultCount,
  onChange,
  onClear,
  onClose,
}: FilterSheetProps) {
  const active = countActiveFilters(filters);
  const { sheetStyle, handleProps } = useSheetDrag(onClose);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
      <div onClick={onClose} aria-hidden="true" className="absolute inset-0 bg-slate-900/50" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        style={sheetStyle}
        className="relative flex max-h-[88vh] flex-col rounded-t-2xl border-t border-slate-200 bg-white shadow-2xl"
      >
        <div
          {...handleProps}
          className="flex touch-none cursor-grab justify-center py-3 active:cursor-grabbing"
          aria-hidden="true"
        >
          <span className="h-1.5 w-10 rounded-full bg-slate-300" />
        </div>
        <header className="flex items-center justify-between px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">Filters</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-5 w-5">
              <path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {/* The trigger pill says "Search & filter" — the sheet must
              actually offer search (the map view has no other query input). */}
          <div className="mb-5">
            <SearchInput
              value={filters.query}
              onChange={(query) => onChange({ query })}
            />
          </div>
          <FilterControls filters={filters} facets={facets} onChange={onChange} />

          <div className="mt-5">
            <label htmlFor="explore-sort-mobile" className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Sort
            </label>
            <select
              id="explore-sort-mobile"
              value={filters.sort}
              onChange={(e) => onChange({ sort: e.target.value as SortKey })}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <footer className="flex items-center gap-3 border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            onClick={onClear}
            disabled={active === 0}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            Show {resultCount.toLocaleString("en-US")} {resultCount === 1 ? "property" : "properties"}
          </button>
        </footer>
      </div>
    </div>
  );
}
