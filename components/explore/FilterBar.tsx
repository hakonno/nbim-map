"use client";

import FilterControls from "@/components/explore/FilterControls";
import Popover from "@/components/explore/Popover";
import { SORT_OPTIONS, countActiveFilters } from "@/components/explore/filtering";
import { sectorStyle } from "@/components/explore/sectorStyles";
import type { ExploreFacets, Filters, Sector, SortKey } from "@/components/explore/types";

type FilterBarProps = {
  filters: Filters;
  facets: ExploreFacets;
  resultCount: number;
  totalCount: number;
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
};

export default function FilterBar({
  filters,
  facets,
  resultCount,
  totalCount,
  onChange,
  onClear,
}: FilterBarProps) {
  const active = countActiveFilters(filters);

  const toggleSector = (sector: Sector) => {
    const next = filters.sectors.includes(sector)
      ? filters.sectors.filter((s) => s !== sector)
      : [...filters.sectors, sector];
    onChange({ sectors: next });
  };

  return (
    <div className="relative z-20 flex flex-col gap-2.5 border-b border-slate-200 bg-white/95 px-3 py-3 backdrop-blur">
      {/* Search */}
      <div className="relative">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400">
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="m20 20-3-3" />
        </svg>
        <input
          type="search"
          value={filters.query}
          onChange={(e) => onChange({ query: e.target.value })}
          placeholder="Search property, city, country or partner"
          aria-label="Search properties"
          inputMode="search"
          enterKeyHint="search"
          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-9 text-base text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 sm:text-sm"
        />
        {filters.query ? (
          <button
            type="button"
            onClick={() => onChange({ query: "" })}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Clear search"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-4 w-4">
              <path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        ) : null}
      </div>

      {/* Quick sector chips */}
      <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5">
        {facets.sectors.map(({ value }) => {
          const activeChip = filters.sectors.includes(value);
          const style = sectorStyle(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => toggleSector(value)}
              aria-pressed={activeChip}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                activeChip
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: activeChip ? "#fff" : style.dot }} />
              {style.label}
            </button>
          );
        })}
      </div>

      {/* Filters + sort + summary */}
      <div className="flex flex-wrap items-center gap-2">
        <Popover
          label="All filters"
          align="left"
          triggerClassName={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
            active > 0
              ? "border-emerald-500 bg-emerald-50 text-emerald-800"
              : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
          }`}
          panelClassName="flex max-h-[calc(100vh-13.5rem)] w-[min(21rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black/[0.04]"
          trigger={
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16M7 12h10M10 19h4" />
              </svg>
              Filters
              {active > 0 ? (
                <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[11px] font-semibold text-white">
                  {active}
                </span>
              ) : null}
            </>
          }
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Filters</p>
            {active > 0 ? (
              <button
                type="button"
                onClick={onClear}
                className="rounded-md px-1.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 hover:underline"
              >
                Clear all
              </button>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <FilterControls filters={filters} facets={facets} onChange={onChange} />
          </div>
        </Popover>

        <label className="sr-only" htmlFor="explore-sort">
          Sort properties
        </label>
        <select
          id="explore-sort"
          value={filters.sort}
          onChange={(e) => onChange({ sort: e.target.value as SortKey })}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <p className="ml-auto text-xs text-slate-500" aria-live="polite">
          <span className="font-semibold tabular-nums text-slate-700">
            {resultCount.toLocaleString("en-US")}
          </span>
          {resultCount !== totalCount ? (
            <> of {totalCount.toLocaleString("en-US")}</>
          ) : null}{" "}
          properties
        </p>
      </div>
    </div>
  );
}
