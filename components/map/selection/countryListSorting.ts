import type { CityNode } from "@/types/cities";

import { getCityCountryValueNok } from "@/components/map/selection/countryValue";

export type CountrySortOption = "country-value" | "properties" | "cities" | "alphabetical";

export type CountryAggregate = {
  country: string;
  cityCount: number;
  propertyCount: number;
  countryValueNok: number | null;
};

const countryNameCollator = new Intl.Collator("en", {
  sensitivity: "base",
  numeric: true,
});

function compareCountryName(a: CountryAggregate, b: CountryAggregate) {
  return countryNameCollator.compare(a.country, b.country);
}

export function buildCountryAggregates(cities: CityNode[]) {
  const byCountry = new Map<string, CountryAggregate>();

  for (const city of cities) {
    const existing = byCountry.get(city.country);
    const cityCountryValueNok = getCityCountryValueNok(city);

    if (!existing) {
      byCountry.set(city.country, {
        country: city.country,
        cityCount: 1,
        propertyCount: city.properties.length,
        countryValueNok: cityCountryValueNok,
      });
      continue;
    }

    existing.cityCount += 1;
    existing.propertyCount += city.properties.length;
    if (existing.countryValueNok == null && cityCountryValueNok != null) {
      existing.countryValueNok = cityCountryValueNok;
    }
  }

  return Array.from(byCountry.values());
}

export function sortCountryAggregates(countryAggregates: CountryAggregate[], sortOption: CountrySortOption) {
  const sorted = [...countryAggregates];

  if (sortOption === "properties") {
    return sorted.sort((a, b) => {
      const propertyCountDelta = b.propertyCount - a.propertyCount;
      if (propertyCountDelta !== 0) {
        return propertyCountDelta;
      }

      return compareCountryName(a, b);
    });
  }

  if (sortOption === "cities") {
    return sorted.sort((a, b) => {
      const cityCountDelta = b.cityCount - a.cityCount;
      if (cityCountDelta !== 0) {
        return cityCountDelta;
      }

      return compareCountryName(a, b);
    });
  }

  if (sortOption === "alphabetical") {
    return sorted.sort(compareCountryName);
  }

  return sorted.sort((a, b) => {
    if (a.countryValueNok == null && b.countryValueNok == null) {
      return compareCountryName(a, b);
    }

    if (a.countryValueNok == null) {
      return 1;
    }

    if (b.countryValueNok == null) {
      return -1;
    }

    const valueDelta = b.countryValueNok - a.countryValueNok;
    if (valueDelta !== 0) {
      return valueDelta;
    }

    return compareCountryName(a, b);
  });
}
