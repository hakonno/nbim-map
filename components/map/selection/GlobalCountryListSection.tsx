import { useMemo } from "react";

import { formatCountryWithFlag } from "@/components/map/formatCountryWithFlag";
import {
  buildCountryAggregates,
  sortCountryAggregates,
  type CountrySortOption,
} from "@/components/map/selection/countryListSorting";
import type { CityNode } from "@/types/cities";

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

type GlobalCountryListSectionProps = {
  cities: CityNode[];
  sortOption: CountrySortOption;
  onSortOptionChange: (option: CountrySortOption) => void;
  onSelectCountry: (country: string) => void;
  totalRealEstateValueNok: number;
};

export default function GlobalCountryListSection({
  cities,
  sortOption,
  onSortOptionChange,
  onSelectCountry,
  totalRealEstateValueNok,
}: GlobalCountryListSectionProps) {
  const sortedCountries = useMemo(() => {
    const countryAggregates = buildCountryAggregates(cities);
    return sortCountryAggregates(countryAggregates, sortOption);
  }, [cities, sortOption]);

  return (
    <>
      <p className="mt-2 text-xs text-slate-600">Investments by country. (% of fund&apos;s real estate investments).</p>

      <div className="mt-3 flex items-center justify-between gap-2">
        <label htmlFor="country-sort" className="text-xs font-medium text-slate-700">
          Sort countries by
        </label>
        <select
          id="country-sort"
          value={sortOption}
          onChange={(event) => onSortOptionChange(event.target.value as CountrySortOption)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="country-value">Country value (NOK)</option>
          <option value="properties">Properties</option>
          <option value="cities">Cities</option>
          <option value="alphabetical">Alphabetical</option>
        </select>
      </div>

      <div className="mt-2 max-h-[32svh] space-y-2 overflow-y-auto overscroll-contain pr-1 md:max-h-[calc(100svh-15rem)]">
        {sortedCountries.map((country) => {
          const countrySharePercent =
            country.countryValueNok == null || totalRealEstateValueNok <= 0
              ? null
              : (country.countryValueNok / totalRealEstateValueNok) * 100;

          return (
            <button
              key={country.country}
              type="button"
              className="pointer-events-auto w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              aria-label={`Select country ${country.country}`}
              onClick={() => onSelectCountry(country.country)}
            >
              <h3 className="text-sm font-semibold text-slate-900 text-balance">{formatCountryWithFlag(country.country)}</h3>
              <p className="mt-1 text-xs text-slate-700">
                {integerFormatter.format(country.propertyCount)} properties in {integerFormatter.format(country.cityCount)} cities
              </p>
              {country.countryValueNok != null && (
                <p className="mt-1 text-xs text-slate-600">
                  Value: NOK {compactCurrencyFormatter.format(country.countryValueNok)}
                  {countrySharePercent == null ? "" : ` (${countrySharePercent.toFixed(1)}%)`}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
