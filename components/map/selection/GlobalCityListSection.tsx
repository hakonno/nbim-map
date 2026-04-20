import { useMemo } from "react";

import { formatCountryWithFlag } from "@/components/map/formatCountryWithFlag";
import {
  sortCitiesForList,
  type CitySortOption,
} from "@/components/map/selection/cityListSorting";
import type { CityNode } from "@/types/cities";

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

type GlobalCityListSectionProps = {
  cities: CityNode[];
  sortOption: CitySortOption;
  onSortOptionChange: (option: CitySortOption) => void;
  onSelectCity: (cityId: string) => void;
  mapCenter: [number, number] | null;
};

export default function GlobalCityListSection({
  cities,
  sortOption,
  onSortOptionChange,
  onSelectCity,
  mapCenter,
}: GlobalCityListSectionProps) {
  const sortedCities = useMemo(
    () => sortCitiesForList(cities, sortOption, mapCenter),
    [cities, sortOption, mapCenter]
  );

  return (
    <>
      <p className="mt-2 text-xs text-slate-600">Browse cities directly or search above for city and property matches.</p>

      <div className="mt-3 flex items-center justify-between gap-2">
        <label htmlFor="city-sort" className="text-xs font-medium text-slate-700">
          Sort cities by
        </label>
        <select
          id="city-sort"
          value={sortOption}
          onChange={(event) => onSortOptionChange(event.target.value as CitySortOption)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="investments">Investments</option>
          <option value="combined">Combined</option>
          <option value="alphabetical">Alphabetical</option>
          <option value="proximity">Proximity</option>
        </select>
      </div>

      <div className="mt-2 max-h-[32svh] space-y-2 overflow-y-auto overscroll-contain pr-1 md:max-h-[calc(100svh-15rem)]">
        {sortedCities.map(({ city, distanceKm }) => (
          <button
            key={city.id}
            type="button"
            className="pointer-events-auto w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            onClick={() => onSelectCity(city.id)}
            aria-label={`Select city ${city.city}, ${city.country}`}
          >
            <h3 className="text-sm font-semibold text-slate-900 text-balance">
              {city.city}, {formatCountryWithFlag(city.country)}
            </h3>
            <p className="mt-1 text-xs text-slate-700">
              {integerFormatter.format(city.properties.length)} investments
            </p>
            {sortOption === "proximity" && (
              <p className="mt-1 text-xs text-slate-600">
                {distanceKm == null
                  ? "Distance unavailable"
                  : `${integerFormatter.format(Math.round(distanceKm))} km from map center`}
              </p>
            )}
          </button>
        ))}
      </div>
    </>
  );
}
