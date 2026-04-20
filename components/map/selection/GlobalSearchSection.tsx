import { useState } from "react";

import type { SearchResult } from "@/components/map/mapTypes";
import GlobalCityListSection from "@/components/map/selection/GlobalCityListSection";
import GlobalCountryListSection from "@/components/map/selection/GlobalCountryListSection";
import type { CitySortOption } from "@/components/map/selection/cityListSorting";
import type { CountrySortOption } from "@/components/map/selection/countryListSorting";
import { OfficeBadge, SectorBadge } from "@/components/map/selection/propertyVisuals";
import type { CityNode } from "@/types/cities";

type GlobalSearchSectionProps = {
  searchQuery: string;
  searchResults: SearchResult[];
  onSelectSearchResult: (result: SearchResult) => void;
  cities: CityNode[];
  citySortOption: CitySortOption;
  onCitySortOptionChange: (option: CitySortOption) => void;
  onSelectCity: (cityId: string) => void;
  onSelectCountry: (country: string) => void;
  totalRealEstateValueNok: number;
  mapCenter: [number, number] | null;
};

export default function GlobalSearchSection({
  searchQuery,
  searchResults,
  onSelectSearchResult,
  cities,
  citySortOption,
  onCitySortOptionChange,
  onSelectCity,
  onSelectCountry,
  totalRealEstateValueNok,
  mapCenter,
}: GlobalSearchSectionProps) {
  const [globalListMode, setGlobalListMode] = useState<"cities" | "countries">("cities");
  const [countrySortOption, setCountrySortOption] = useState<CountrySortOption>("country-value");

  if (searchQuery.trim().length < 2) {
    return (
      <>
        <div className="mt-2 flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setGlobalListMode("cities")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              globalListMode === "cities"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
            aria-pressed={globalListMode === "cities"}
          >
            Cities
          </button>
          <button
            type="button"
            onClick={() => setGlobalListMode("countries")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              globalListMode === "countries"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
            aria-pressed={globalListMode === "countries"}
          >
            Countries
          </button>
        </div>

        {globalListMode === "cities" ? (
          <GlobalCityListSection
            cities={cities}
            sortOption={citySortOption}
            onSortOptionChange={onCitySortOptionChange}
            onSelectCity={onSelectCity}
            mapCenter={mapCenter}
            totalRealEstateValueNok={totalRealEstateValueNok}
          />
        ) : (
          <GlobalCountryListSection
            cities={cities}
            sortOption={countrySortOption}
            onSortOptionChange={setCountrySortOption}
            onSelectCountry={onSelectCountry}
            totalRealEstateValueNok={totalRealEstateValueNok}
          />
        )}
      </>
    );
  }

  return (
    <>
      <p className="mt-2 text-xs text-slate-600">Search in NBIM dataset. Select a result to zoom and open details.</p>
      <div className="mt-2 max-h-[32svh] space-y-2 overflow-y-auto overscroll-contain pr-1 md:max-h-[calc(100svh-15rem)]">
        {searchResults.length === 0 && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            No local matches. Try another city, property name, or address.
          </p>
        )}

        {searchResults.map((result) => (
          <button
            key={result.id}
            type="button"
            className="pointer-events-auto w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            onClick={() => onSelectSearchResult(result)}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {result.type === "city"
                ? "City"
                : result.isOffice
                  ? "Office location"
                  : "Property"}
            </p>
            <h3 className="text-sm font-semibold text-slate-900 text-balance">{result.name}</h3>
            {result.subtitle && <p className="mt-1 text-xs text-slate-700">{result.subtitle}</p>}
            {result.type === "property" && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <SectorBadge sector={result.sector} />
                {result.isOffice && <OfficeBadge officeCategory={result.officeCategory ?? null} />}
              </div>
            )}
          </button>
        ))}
      </div>
    </>
  );
}
