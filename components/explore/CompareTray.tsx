"use client";

import { useEffect, useState } from "react";

import { formatCountryWithFlag } from "@/components/map/formatCountryWithFlag";
import { useCurrency } from "@/components/map/hooks/useCurrencyPreference";
import { useUsdToNokRate } from "@/components/map/hooks/useExchangeRate";
import {
  ownershipDotColor,
  ownershipLabel,
  sectorStyle,
} from "@/components/explore/sectorStyles";
import type { ExploreProperty } from "@/components/explore/types";
import { formatUsdValue } from "@/utils/formatCurrency";
import type { Currency } from "@/utils/formatCurrency";

export const MAX_COMPARE = 4;

type CompareTrayProps = {
  properties: ExploreProperty[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onSelect: (id: string) => void;
};

export default function CompareTray({ properties, onRemove, onClear, onSelect }: CompareTrayProps) {
  const [open, setOpen] = useState(false);
  const currency = useCurrency();
  const rate = useUsdToNokRate();
  const usdToNok = rate.status === "success" ? rate.usdToNok : null;

  if (properties.length === 0) return null;

  return (
    <>
      {/* Mobile bottom stack (bottom-up): Map/List pill, lifted attribution,
          then this tray — 7rem clears both. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[7rem] z-30 flex justify-center px-3 md:bottom-4">
        <div className="pointer-events-auto flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 pl-3 shadow-xl backdrop-blur">
          <span className="hidden text-xs font-medium text-slate-500 sm:inline">
            Compare
          </span>
          <ul className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
            {properties.map((property) => (
              <li key={property.id}>
                <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 py-1 pl-2 pr-1 text-xs text-slate-700">
                  <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: sectorStyle(property.sector).dot }} />
                  <span className="max-w-[7rem] truncate">{property.name}</span>
                  <button
                    type="button"
                    onClick={() => onRemove(property.id)}
                    aria-label={`Remove ${property.name} from comparison`}
                    className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" className="h-3 w-3">
                      <path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={properties.length < 2}
            className="ml-1 shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Compare {properties.length}
          </button>
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear comparison"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-4 w-4">
              <path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {open ? (
        <CompareModal
          properties={properties}
          currency={currency}
          usdToNok={usdToNok}
          onClose={() => setOpen(false)}
          onRemove={onRemove}
          onSelect={(id) => {
            setOpen(false);
            onSelect(id);
          }}
        />
      ) : null}
    </>
  );
}

type CompareModalProps = {
  properties: ExploreProperty[];
  currency: Currency;
  usdToNok: number | null;
  onClose: () => void;
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
};

function CompareModal({
  properties,
  currency,
  usdToNok,
  onClose,
  onRemove,
  onSelect,
}: CompareModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const rows: { label: string; render: (p: ExploreProperty) => React.ReactNode }[] = [
    {
      label: "Ownership",
      render: (p) => (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: ownershipDotColor(p.ownership) }} />
          <span className="font-semibold tabular-nums text-slate-900">{ownershipLabel(p.ownership)}</span>
        </span>
      ),
    },
    {
      label: "Sector",
      render: (p) => sectorStyle(p.sector).label,
    },
    {
      label: "Partner / operator",
      render: (p) => p.partner ?? "—",
    },
    {
      label: "Location",
      render: (p) => `${p.city}, ${formatCountryWithFlag(p.country)}`,
    },
    {
      label: "Market estimate (whole property)",
      render: (p) =>
        p.marketUsd != null ? (
          <span className="tabular-nums">{formatUsdValue(p.marketUsd, currency, usdToNok)}</span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      label: "NBIM total in country",
      render: (p) =>
        p.countryValueUsd != null ? (
          <span className="tabular-nums text-slate-600">
            {formatUsdValue(p.countryValueUsd, currency, usdToNok)}
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-6">
      <div
        onClick={onClose}
        aria-hidden="true"
        className="absolute inset-0"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Compare properties"
        className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-900">
            Compare {properties.length} properties
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comparison"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-5 w-5">
              <path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th scope="col" className="sticky left-0 z-10 bg-white px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Property
                </th>
                {properties.map((p) => (
                  <th key={p.id} scope="col" className="min-w-[10rem] px-3 py-3 align-top">
                    <button
                      type="button"
                      onClick={() => onSelect(p.id)}
                      className="text-left text-sm font-semibold text-slate-900 hover:text-emerald-700"
                    >
                      {p.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(p.id)}
                      className="mt-1 block text-[11px] font-medium text-slate-400 hover:text-slate-600"
                    >
                      Remove
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-slate-100 last:border-0">
                  <th scope="row" className="sticky left-0 z-10 bg-white px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 align-top">
                    {row.label}
                  </th>
                  {properties.map((p) => (
                    <td key={p.id} className="px-3 py-3 align-top text-slate-700">
                      {row.render(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
