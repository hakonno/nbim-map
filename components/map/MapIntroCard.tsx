import type { CityAggregateContract, CityNode, GlobalOverviewContract } from "@/types/cities";

type MapIntroCardProps = {
  mode: "global" | "city" | "property";
  selectedCity: CityNode | null;
  selectedCityAggregate: CityAggregateContract | null;
  showProperties: boolean;
  globalOverview: GlobalOverviewContract;
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

export default function MapIntroCard({
  mode,
  selectedCity,
  selectedCityAggregate,
  showProperties,
  globalOverview,
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
          <h1 className="mt-1 text-base font-semibold leading-tight text-slate-900 sm:text-xl">Where Norway has invested in real estate</h1>
          <p className="mt-1 text-xs text-slate-700 sm:mt-2 sm:text-sm" role="status" aria-live="polite">
            Tap a city to see the properties in that area.
          </p>

          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] sm:mt-3 sm:gap-2 sm:text-sm">
            <div className="rounded-lg bg-slate-100 p-2 sm:rounded-xl">
              <p className="text-slate-500">Real estate in fund</p>
              <p className="font-semibold text-slate-900 tabular-nums">NOK {integerFormatter.format(fundRealEstateValueNok)}</p>
            </div>
            <div className="rounded-lg bg-slate-100 p-2 sm:rounded-xl">
              <p className="text-slate-500">Share of fund</p>
              <p className="font-semibold text-slate-900 tabular-nums">{percentageFormatter.format(fundSharePercent)}%</p>
            </div>
            <div className="rounded-lg bg-slate-100 p-2 sm:rounded-xl">
              <p className="text-slate-500">Countries</p>
              <p className="font-semibold text-slate-900 tabular-nums">
                {integerFormatter.format(countriesWithoutInternational)}
                {hasInternationalFund ? " + 1 intl fund" : ""}
              </p>
            </div>
            <div className="rounded-lg bg-slate-100 p-2 sm:rounded-xl">
              <p className="text-slate-500">Investments</p>
              <p className="font-semibold text-slate-900 tabular-nums">{integerFormatter.format(globalOverview.totalProperties)}</p>
            </div>
          </div>
        </>
      ) : selectedCity ? (
        <>
          <h1 className="mt-1 text-base font-semibold leading-tight text-slate-900 sm:text-xl">
            {selectedCity.city}, {selectedCity.country}
          </h1>
          <p className="mt-1 text-xs text-slate-700 sm:mt-2 sm:text-sm" role="status" aria-live="polite">
            {showProperties
              ? "Tap a blue dot or pick a property from the list."
              : "Zoom in to see individual properties in this city."}
          </p>

          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] sm:mt-3 sm:gap-2 sm:text-sm">
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
          </div>
        </>
      ) : (
        <>
          <h1 className="mt-1 text-base font-semibold leading-tight text-slate-900 sm:text-xl">Where Norway has invested in real estate</h1>
          <p className="mt-1 text-xs text-slate-700 sm:mt-2 sm:text-sm">Tap a city to continue.</p>
        </>
      )}
    </div>
  );
}
