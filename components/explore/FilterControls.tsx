"use client";

import { OWNERSHIP_BUCKETS } from "@/components/explore/filtering";
import { sectorStyle } from "@/components/explore/sectorStyles";
import type {
  ExploreFacets,
  Filters,
  OwnershipBucket,
  Sector,
} from "@/components/explore/types";

type FilterControlsProps = {
  filters: Filters;
  facets: ExploreFacets;
  onChange: (patch: Partial<Filters>) => void;
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </p>
  );
}

export default function FilterControls({ filters, facets, onChange }: FilterControlsProps) {
  const toggleSector = (sector: Sector) => {
    const next = filters.sectors.includes(sector)
      ? filters.sectors.filter((s) => s !== sector)
      : [...filters.sectors, sector];
    onChange({ sectors: next });
  };

  const toggleCountry = (country: string) => {
    const next = filters.countries.includes(country)
      ? filters.countries.filter((c) => c !== country)
      : [...filters.countries, country];
    onChange({ countries: next });
  };

  return (
    <div className="flex flex-col gap-5">
      <section>
        <Eyebrow>Sector</Eyebrow>
        <div className="flex flex-wrap gap-1.5">
          {facets.sectors.map(({ value, count }) => {
            const active = filters.sectors.includes(value);
            const style = sectorStyle(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleSector(value)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  active
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: active ? "#fff" : style.dot }}
                />
                {style.label}
                <span className={active ? "text-white/60" : "text-slate-400"}>{count}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <Eyebrow>Ownership</Eyebrow>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {OWNERSHIP_BUCKETS.map(({ value, label }) => {
            const active = filters.ownership === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onChange({ ownership: value as OwnershipBucket })}
                aria-pressed={active}
                className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  active
                    ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <Eyebrow>Country</Eyebrow>
        <div className="flex max-h-44 flex-col gap-0.5 overflow-y-auto pr-1">
          {facets.countries.map(({ value, count, flag }) => {
            const active = filters.countries.includes(value);
            return (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggleCountry(value)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span aria-hidden="true">{flag}</span>
                <span className="flex-1 text-slate-700">{value}</span>
                <span className="tabular-nums text-xs text-slate-400">{count}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section>
        <Eyebrow>Partner / operator</Eyebrow>
        <select
          value={filters.partner ?? ""}
          onChange={(e) => onChange({ partner: e.target.value || null })}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        >
          <option value="">All partners</option>
          {facets.partners.map(({ value, count }) => (
            <option key={value} value={value}>
              {value} ({count})
            </option>
          ))}
        </select>
      </section>

      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
        <span className="text-sm text-slate-700">
          Has US market estimate
          <span className="block text-[11px] text-slate-400">ATTOM tax-assessor data</span>
        </span>
        <input
          type="checkbox"
          checked={filters.marketDataOnly}
          onChange={(e) => onChange({ marketDataOnly: e.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
      </label>
    </div>
  );
}
