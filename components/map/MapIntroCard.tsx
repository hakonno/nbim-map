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
    <div className="pointer-events-none absolute left-2 top-2 z-[500] w-[min(calc(100%-1rem),20rem)] rounded-xl border border-white/70 bg-white/92 p-3 shadow-lg backdrop-blur sm:left-4 sm:top-4 sm:w-[calc(100%-2rem)] sm:max-w-sm sm:rounded-2xl sm:p-4 sm:shadow-xl">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700 sm:text-xs">NBIM Real Estate</p>

      {mode === "global" ? (
        <>
          <h1 className="mt-1 text-base font-semibold leading-tight text-slate-900 sm:text-xl">Owned Real Estate by Norway around the world</h1>
          <p className="mt-1 text-xs text-slate-700 sm:mt-2 sm:text-sm" role="status" aria-live="polite">
            Unlisted office, retail, and logistics properties in major cities.
          </p>

          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] sm:mt-3 sm:gap-2 sm:text-sm">
            <div className="rounded-lg bg-slate-100 p-2 sm:rounded-xl">
              <p className="text-slate-500">Value</p>
              <p className="font-semibold text-slate-900 tabular-nums">NOK {integerFormatter.format(fundRealEstateValueNok)}</p>
            </div>
            <div className="rounded-lg bg-slate-100 p-2 sm:rounded-xl">
              <p className="text-slate-500">of total fund investments</p>
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
          <h1 className="mt-1 text-base font-semibold leading-tight text-slate-900 sm:text-xl">
            {selectedCity.city}, {formatCountryWithFlag(selectedCity.country)}
          </h1>
          <p className="mt-1 text-xs text-slate-700 sm:mt-2 sm:text-sm" role="status" aria-live="polite">
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
          <h1 className="mt-1 text-base font-semibold leading-tight text-slate-900 sm:text-xl">Owned Real Estate by Norway around the world.</h1>
          <p className="mt-1 text-xs text-slate-700 sm:mt-2 sm:text-sm">Tap a city to continue.</p>
        </>
      )}

      <p className="mt-3 border-t border-slate-200 pt-2 text-[10px] leading-snug text-slate-500 sm:text-[11px]">
        This is an independent project using publicly available data. Not affiliated with Norges Bank Investment Management. Data may be inaccurate.
      </p>
      <p className="pointer-events-auto mt-1 text-[10px] leading-snug text-slate-500 sm:text-[11px]">
        <a
          href="https://www.nbim.no/en/investments/all-investments/#/2025-12-31/2-real_estate"
          target="_blank"
          rel="noreferrer"
          className="text-slate-700 underline underline-offset-2"
        >
          Source: NBIM holdings data (31 dec. 2025)
        </a>
      </p>
    </div>
  );
}

export default memo(MapIntroCard);
