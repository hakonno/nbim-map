"use client";

import Link from "next/link";
import { memo } from "react";

import { formatCountryWithFlag } from "@/components/map/formatCountryWithFlag";
import { ownershipDotColor, sectorStyle } from "@/components/explore/sectorStyles";
import type { ExploreProperty } from "@/components/explore/types";
import { formatUsdValue } from "@/utils/formatCurrency";
import type { Currency } from "@/utils/formatCurrency";

type PropertyCardProps = {
  property: ExploreProperty;
  currency: Currency;
  usdToNok: number | null;
  isSelected: boolean;
  isCompared: boolean;
  compareDisabled: boolean;
  /** True while a detail panel is open: selecting then REPLACES the history
   * entry so Back never walks through previously viewed properties. */
  replaceOnSelect: boolean;
  onToggleCompare: (id: string) => void;
};

function ownershipText(value: number | null): string {
  if (value == null) return "Stake n/d";
  const pct = Number.isInteger(value) ? `${value}` : value.toFixed(1);
  return `${pct}% stake`;
}

function PropertyCard({
  property,
  currency,
  usdToNok,
  isSelected,
  isCompared,
  compareDisabled,
  replaceOnSelect,
  onToggleCompare,
}: PropertyCardProps) {
  const sector = sectorStyle(property.sector);

  return (
    <div
      id={`explore-card-${property.id}`}
      className={`group relative scroll-mt-3 overflow-hidden rounded-xl border bg-white transition-all duration-150 active:scale-[0.99] motion-reduce:active:scale-100 ${
        isSelected
          ? "border-emerald-500 ring-2 ring-emerald-500/60 shadow-sm"
          : "border-slate-200 hover:border-slate-300 hover:shadow-md"
      }`}
    >
      {/* Stretched link (overlay-link pattern; compare lives above it). A real
          anchor: crawlable, and soft-navigation opens the intercepted panel. */}
      <Link
        href={`/property/${property.id}`}
        scroll={false}
        replace={replaceOnSelect}
        aria-current={isSelected ? "page" : undefined}
        aria-label={`View ${property.name}, ${property.city}`}
        className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
      />

      {/* Sector accent: a soft wash of the sector color fading out rightward —
          scannable down the list without a hard-edged stripe. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-20"
        style={{ background: `linear-gradient(90deg, ${sector.dot}2e, transparent)` }}
      />


      <div className="pointer-events-none relative z-10 flex flex-col gap-1.5 py-3 pl-4 pr-3.5">
        <div className="flex flex-wrap items-center gap-1.5 pr-16">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${sector.chip}`}>
            {sector.label}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: ownershipDotColor(property.ownership) }}
            />
            {ownershipText(property.ownership)}
          </span>
        </div>

        <h3 className="text-sm font-semibold leading-snug text-slate-900 text-balance">
          {property.name}
        </h3>

        <p className="flex items-center gap-1 text-xs text-slate-500">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10Z" />
            <circle cx="12" cy="11" r="2" />
          </svg>
          <span className="truncate">
            {property.city}, {formatCountryWithFlag(property.country)}
          </span>
        </p>

        <div className="flex items-center justify-between gap-2 pt-0.5">
          {property.partner ? (
            <span className="truncate text-[11px] text-slate-400">{property.partner}</span>
          ) : (
            <span />
          )}
          {property.marketUsd != null ? (
            <span
              className="shrink-0 text-[11px] tabular-nums text-slate-500"
              title="ATTOM tax-assessor market estimate for the whole property — modelled, not NBIM's valuation or its stake."
            >
              <span className="text-slate-400">Est.</span>{" "}
              <span className="font-medium text-slate-700">
                {formatUsdValue(property.marketUsd, currency, usdToNok)}
              </span>
            </span>
          ) : null}
        </div>
      </div>

      {/* Compare toggle */}
      <button
        type="button"
        onClick={() => onToggleCompare(property.id)}
        disabled={compareDisabled && !isCompared}
        aria-pressed={isCompared}
        className={`pointer-events-auto absolute right-2.5 top-2.5 z-20 inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
          isCompared
            ? "border-emerald-500 bg-emerald-600 text-white"
            : "border-slate-200 bg-white/90 text-slate-500 hover:border-slate-300 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
        }`}
        title={isCompared ? "Remove from comparison" : "Add to comparison"}
      >
        {isCompared ? "✓" : "+"}
        <span className="sr-only md:not-sr-only">{isCompared ? "Comparing" : "Compare"}</span>
      </button>
    </div>
  );
}

export default memo(PropertyCard);
