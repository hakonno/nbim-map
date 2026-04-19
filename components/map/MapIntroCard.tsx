import { memo } from "react";

import { formatCountryWithFlag } from "@/components/map/formatCountryWithFlag";
import type { CityNode } from "@/types/cities";

type MapIntroCardProps = {
  mode: "global" | "city" | "property";
  selectedCity: CityNode | null;
  showProperties: boolean;
  countriesWithoutInternational: number;
  hasInternationalFund: boolean;
  fundRealEstateValueNok: number;
  fundSharePercent: number;
};

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const percentageFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.51 7.51 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function MapIntroCard({
  mode,
  selectedCity,
  showProperties,
  countriesWithoutInternational,
  hasInternationalFund,
  fundRealEstateValueNok,
  fundSharePercent,
}: MapIntroCardProps) {
  return (
    <div className="pointer-events-none absolute left-0 right-0 top-0 z-[650] w-auto border-b border-white/80 bg-white/92 px-2.5 py-2 shadow-md backdrop-blur sm:left-4 sm:right-auto sm:top-4 sm:w-[calc(100%-2rem)] sm:max-w-sm sm:rounded-2xl sm:border sm:p-4 sm:shadow-xl">
      <div className="pointer-events-auto absolute right-2 top-2 flex items-center gap-1.5 sm:hidden">
        <a
          href="https://www.nbim.no/en/investments/all-investments/#/2025-12-31/2-real_estate"
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-6 items-center rounded-md border border-slate-200/90 bg-white/80 px-2 text-[10px] font-medium text-slate-600 shadow-sm backdrop-blur transition-colors hover:text-slate-800"
        >
          Source: NBIM
        </a>
        <a
          href="https://github.com/hakonno/nbim-map"
          target="_blank"
          rel="noreferrer"
          aria-label="Open source project on GitHub"
          className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200/90 bg-white/80 text-slate-600 shadow-sm backdrop-blur transition-colors hover:text-slate-800"
        >
          <GitHubMark className="h-3.5 w-3.5" />
        </a>
      </div>

      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700 sm:text-xs">NBIM&apos;s Real Estate Investments</p>

      {mode === "global" ? (
        <>
          <h1 className="mt-0.5 text-[13px] font-semibold leading-tight text-slate-900 sm:mt-1 sm:text-xl">Owned by Norway around the world</h1>
          <p className="mt-1 hidden text-[11px] text-slate-700 sm:mt-2 sm:block sm:text-sm" role="status" aria-live="polite">
            Unlisted office, retail, and logistics properties in major cities.
          </p>

          <p className="mt-1 text-[11px] text-slate-700 sm:hidden">
            NOK {integerFormatter.format(fundRealEstateValueNok)} · {percentageFormatter.format(fundSharePercent)}% of fund · {integerFormatter.format(countriesWithoutInternational)} countries
            {hasInternationalFund ? " + 1 intl fund" : ""}
          </p>

          <div className="mt-3 hidden grid-cols-2 gap-2 text-sm sm:grid">
            <div className="rounded-lg bg-slate-100 p-2 sm:rounded-xl">
              <p className="text-slate-500">Value</p>
              <p className="font-semibold text-slate-900 tabular-nums">NOK {integerFormatter.format(fundRealEstateValueNok)}</p>
            </div>
            <div className="rounded-lg bg-slate-100 p-2 sm:rounded-xl">
              <p className="text-slate-500">of fund&apos;s total investments</p>
              <p className="font-semibold text-slate-900 tabular-nums">{percentageFormatter.format(fundSharePercent)}%</p>
            </div>
            <div className="rounded-lg bg-slate-100 p-2 sm:rounded-xl">
              <p className="text-slate-500">Countries</p>
              <p className="font-semibold text-slate-900 tabular-nums">
                {integerFormatter.format(countriesWithoutInternational)}
                {hasInternationalFund ? " + 1 intl fund" : ""} 
                {/* todo: add info later */}
              </p>
            </div>
            {/* <div className="rounded-lg bg-slate-100 p-2 sm:rounded-xl">
              <p className="text-slate-500">Investments</p>
              <p className="font-semibold text-slate-900 tabular-nums">{integerFormatter.format(globalOverview.totalProperties)}</p>
            </div> */}
          </div>
        </>
      ) : selectedCity ? (
        <>
          <h1 className="mt-0.5 text-[13px] font-semibold leading-tight text-slate-900 sm:mt-1 sm:text-xl">
            {selectedCity.city}, {formatCountryWithFlag(selectedCity.country)}
          </h1>
          <p className="mt-1 text-[11px] text-slate-700 sm:mt-2 sm:text-sm" role="status" aria-live="polite">
            {showProperties
              ? "Tap a marker or pick a property from the list."
              : "Zoom in to see individual properties in this city."}
          </p>

          {/* <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] sm:mt-3 sm:gap-2 sm:text-sm">
            <div className="rounded-lg bg-slate-100 p-2 sm:rounded-xl">
              <p className="text-slate-500">Investments here</p>
              <p className="font-semibold text-slate-900 tabular-nums">
                {integerFormatter.format(selectedCityAggregate?.propertyCount ?? selectedCity.properties.length)}
              </p>
            </div>
            <div className="rounded-lg bg-slate-100 p-2 sm:rounded-xl">
              <p className="text-slate-500">Ownership</p>
              <p className="font-semibold text-slate-900">Shown per property</p>
            </div>
          </div> */}
        </>
      ) : (
        <>
          <h1 className="mt-0.5 text-[13px] font-semibold leading-tight text-slate-900 sm:mt-1 sm:text-xl">Owned Real Estate by Norway around the world.</h1>
          <p className="mt-1 text-[11px] text-slate-700 sm:mt-2 sm:text-sm">Tap a city to continue.</p>
        </>
      )}

      <p className="mt-2 border-t border-slate-200 pt-1 text-[9px] leading-snug text-slate-500 sm:hidden">
        Not affiliated with Norges Bank Investment Management. May contain inaccuracies.
      </p>

      <p className="mt-2 hidden border-t border-slate-200 pt-2 text-[9px] leading-snug text-slate-500 sm:mt-3 sm:block sm:text-[11px]">
        <span className="hidden sm:inline">This is an independent project using publicly available data. Not affiliated with Norges Bank Investment Management. Data may be inaccurate.</span>
      </p>
      <p className="pointer-events-auto mt-1 hidden items-center gap-2 text-[10px] leading-snug text-slate-500 sm:flex sm:text-[11px]">
        <a
          href="https://www.nbim.no/en/investments/all-investments/#/2025-12-31/2-real_estate"
          target="_blank"
          rel="noreferrer"
          className="text-slate-600 underline underline-offset-2 transition-colors hover:text-slate-800"
        >
          Source: NBIM holdings (31 Dec 2025)
        </a>
        <span className="text-slate-300" aria-hidden="true">•</span>
        <a
          href="https://github.com/hakonno/nbim-map"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-slate-600 transition-colors hover:text-slate-800"
        >
          <GitHubMark className="h-3.5 w-3.5" />
        </a>
      </p>
    </div>
  );
}

export default memo(MapIntroCard);
