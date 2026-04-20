import { useMemo } from "react";

import type { FlatProperty } from "@/components/map/mapTypes";
import {
  sortCityPropertiesForList,
  type PropertySortOption,
} from "@/components/map/selection/propertySorting";
import { OfficeBadge, SectorBadge } from "@/components/map/selection/propertyVisuals";

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

type CountryPropertiesSectionProps = {
  country: string;
  filteredCountryProperties: FlatProperty[];
  totalCountryProperties: number;
  propertySortOption: PropertySortOption;
  onPropertySortOptionChange: (option: PropertySortOption) => void;
  onSelectProperty: (propertyId: string) => void;
};

export default function CountryPropertiesSection({
  country,
  filteredCountryProperties,
  totalCountryProperties,
  propertySortOption,
  onPropertySortOptionChange,
  onSelectProperty,
}: CountryPropertiesSectionProps) {
  const sortedCountryProperties = useMemo(
    () => sortCityPropertiesForList(filteredCountryProperties, propertySortOption),
    [filteredCountryProperties, propertySortOption]
  );

  const containsOfficeLocations = filteredCountryProperties.some(
    (property) => property.is_nbim_office
  );

  return (
    <>
      <p className="mt-1 text-sm text-slate-700">
        {integerFormatter.format(filteredCountryProperties.length)} of {integerFormatter.format(totalCountryProperties)} {containsOfficeLocations ? "locations" : "properties"} shown in {country}
      </p>

      <div className="mt-3 flex items-center justify-between gap-2">
        <label htmlFor="country-property-sort" className="text-xs font-medium text-slate-700">
          Sort properties by
        </label>
        <select
          id="country-property-sort"
          value={propertySortOption}
          onChange={(event) => onPropertySortOptionChange(event.target.value as PropertySortOption)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="ownership">Ownership</option>
          <option value="alphabetical">Alphabetical</option>
          <option value="partnership">Partner</option>
          <option value="sector">Sector</option>
        </select>
      </div>

      <div className="mt-3 max-h-[32svh] space-y-2 overflow-y-auto overscroll-contain pr-1 md:max-h-[calc(100svh-11.5rem)]">
        {sortedCountryProperties.map((property) => (
          <button
            key={property.id}
            type="button"
            className="pointer-events-auto w-full cursor-pointer rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-3 text-left shadow-sm transition-colors hover:border-blue-300 hover:from-blue-50 hover:to-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            onClick={() => onSelectProperty(property.id)}
            aria-label={`Select property ${property.office_name ?? property.name ?? "Unnamed property"}`}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <SectorBadge sector={property.sector} />
              {property.is_nbim_office && (
                <OfficeBadge officeCategory={property.office_category ?? null} />
              )}
            </div>

            <h3 className="mt-2 text-sm font-semibold text-slate-900 text-balance">
              {property.office_name ?? property.name ?? "Unnamed property"}
            </h3>
            <p className="mt-1 text-xs text-slate-700">{property.address ?? "No address"}</p>
            <p className="mt-1 text-xs text-slate-600">{property.cityName}, {property.country}</p>
            <p className="mt-2 text-xs text-slate-600">{property.partnership ?? "Unknown partner"}</p>
            <p className="mt-1 text-xs text-slate-600 tabular-nums">
              Ownership {property.ownership_percent == null ? "N/A" : `${decimalFormatter.format(property.ownership_percent)}%`}
            </p>
          </button>
        ))}

        {sortedCountryProperties.length === 0 && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            No properties match this filter.
          </p>
        )}
      </div>
    </>
  );
}
