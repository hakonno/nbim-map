"use client";

import { useMemo } from "react";

import { isInternationalFundCity } from "@/components/map/mapConstants";
import type { FlatProperty, SearchResult, SelectionState } from "@/components/map/mapTypes";
import { enrichCitiesWithNbimOffices } from "@/components/map/nbimOffices";
import { buildLocalSearchResults } from "@/components/map/searchResults";
import { buildCountryAggregates } from "@/components/map/selection/countryListSorting";
import type { CityNode } from "@/types/cities";

type UseCityMapDerivedDataParams = {
  cities: CityNode[];
  searchQuery: string;
  selection: SelectionState;
  searchResultLimit: number;
};

type UseCityMapDerivedDataResult = {
  mappableCities: CityNode[];
  investmentMappableCities: CityNode[];
  maxPropertyCount: number;
  flatProperties: FlatProperty[];
  flatPropertyById: Map<string, FlatProperty>;
  selectedCity: CityNode | null;
  selectedProperty: CityNode["properties"][number] | null;
  selectedFlatProperty: FlatProperty | null;
  countryCitiesMap: Map<string, CityNode[]>;
  selectedCountry: string | null;
  selectedCountryProperties: FlatProperty[];
  selectedCountryInvestmentProperties: FlatProperty[];
  selectedCountryAggregate: {
    country: string;
    cityCount: number;
    propertyCount: number;
    countryValueNok: number | null;
  } | null;
  hasInternationalFund: boolean;
  totalNbimOffices: number;
  totalInvestments: number;
  countriesWithoutInternational: number;
  localSearchResults: SearchResult[];
};

export function useCityMapDerivedData({
  cities,
  searchQuery,
  selection,
  searchResultLimit,
}: UseCityMapDerivedDataParams): UseCityMapDerivedDataResult {
  const enrichedCities = useMemo(() => enrichCitiesWithNbimOffices(cities), [cities]);

  const mappableCities = useMemo(
    () =>
      enrichedCities
        .filter((city) => typeof city.lat === "number" && typeof city.lng === "number")
        .filter((city) => !isInternationalFundCity(city)),
    [enrichedCities]
  );

  const investmentMappableCities = useMemo(
    () =>
      mappableCities
        .map((city) => {
          const investmentProperties = city.properties.filter(
            (property) => !property.is_nbim_office
          );

          return {
            ...city,
            properties: investmentProperties,
            total_ownership_sum: investmentProperties.reduce(
              (sum, property) =>
                typeof property.ownership_percent === "number"
                  ? sum + property.ownership_percent
                  : sum,
              0
            ),
          };
        })
        .filter((city) => city.properties.length > 0),
    [mappableCities]
  );

  const countriesWithoutInternational = useMemo(
    () => new Set(investmentMappableCities.map((city) => city.country)).size,
    [investmentMappableCities]
  );

  const maxPropertyCount = useMemo(
    () => Math.max(...investmentMappableCities.map((city) => city.properties.length), 1),
    [investmentMappableCities]
  );

  const flatProperties = useMemo<FlatProperty[]>(
    () =>
      mappableCities.flatMap((city) =>
        city.properties.map((property) => {
          const lat = typeof property.lat === "number" ? property.lat : (city.lat as number);
          const lng = typeof property.lng === "number" ? property.lng : (city.lng as number);

          return {
            ...property,
            cityId: city.id,
            cityName: city.city,
            country: city.country,
            lat,
            lng,
          };
        })
      ),
    [mappableCities]
  );

  const flatPropertyById = useMemo(
    () => new Map(flatProperties.map((property) => [property.id, property])),
    [flatProperties]
  );

  const selectedCity = useMemo(
    () =>
      selection.selectedCityId
        ? mappableCities.find((city) => city.id === selection.selectedCityId) ?? null
        : null,
    [selection.selectedCityId, mappableCities]
  );

  const selectedProperty = useMemo(
    () =>
      selection.mode === "property"
        ? selectedCity?.properties.find(
            (property) => property.id === selection.selectedPropertyId
          ) ?? null
        : null,
    [selection.mode, selection.selectedPropertyId, selectedCity]
  );

  const selectedFlatProperty = useMemo(
    () =>
      selection.mode === "property" && selection.selectedPropertyId
        ? flatPropertyById.get(selection.selectedPropertyId) ?? null
        : null,
    [selection.mode, selection.selectedPropertyId, flatPropertyById]
  );

  const countryCitiesMap = useMemo(() => {
    const byCountry = new Map<string, CityNode[]>();

    for (const city of investmentMappableCities) {
      const current = byCountry.get(city.country);
      if (current) {
        current.push(city);
      } else {
        byCountry.set(city.country, [city]);
      }
    }

    return byCountry;
  }, [investmentMappableCities]);

  const selectedCountry = useMemo(
    () => (selection.mode === "country" ? selection.selectedCountry : null),
    [selection.mode, selection.selectedCountry]
  );

  const selectedCountryProperties = useMemo(
    () =>
      selectedCountry
        ? flatProperties.filter((property) => property.country === selectedCountry)
        : [],
    [flatProperties, selectedCountry]
  );

  const selectedCountryInvestmentProperties = useMemo(
    () =>
      selectedCountryProperties.filter((property) => !property.is_nbim_office),
    [selectedCountryProperties]
  );

  const countryAggregatesByCountry = useMemo(() => {
    const aggregates = buildCountryAggregates(investmentMappableCities);
    return new Map(aggregates.map((aggregate) => [aggregate.country, aggregate]));
  }, [investmentMappableCities]);

  const selectedCountryAggregate = useMemo(
    () =>
      selectedCountry
        ? countryAggregatesByCountry.get(selectedCountry) ?? null
        : null,
    [countryAggregatesByCountry, selectedCountry]
  );

  const hasInternationalFund = useMemo(
    () => enrichedCities.some((city) => isInternationalFundCity(city)),
    [enrichedCities]
  );

  const totalNbimOffices = useMemo(
    () => flatProperties.filter((property) => property.is_nbim_office).length,
    [flatProperties]
  );

  const totalInvestments = useMemo(
    () => flatProperties.filter((property) => !property.is_nbim_office).length,
    [flatProperties]
  );

  const localSearchResults = useMemo(
    () =>
      buildLocalSearchResults(
        searchQuery,
        investmentMappableCities,
        flatProperties,
        searchResultLimit
      ),
    [searchQuery, investmentMappableCities, flatProperties, searchResultLimit]
  );

  return {
    mappableCities,
    investmentMappableCities,
    maxPropertyCount,
    flatProperties,
    flatPropertyById,
    selectedCity,
    selectedProperty,
    selectedFlatProperty,
    countryCitiesMap,
    selectedCountry,
    selectedCountryProperties,
    selectedCountryInvestmentProperties,
    selectedCountryAggregate,
    hasInternationalFund,
    totalNbimOffices,
    totalInvestments,
    countriesWithoutInternational,
    localSearchResults,
  };
}
