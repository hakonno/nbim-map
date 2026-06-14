import {
  FUND_REAL_ESTATE_VALUE_NOK,
  isInternationalFundCity,
} from "@/components/map/mapConstants";
import { cityToSlug, countryToSlug, getAllCities } from "@/lib/citySlug";
import type { CountryGroup } from "@/lib/citySlug";
import type { CityNode, CityProperty } from "@/types/cities";

/**
 * Central definition of the *browsable* portfolio for the list/SEO site. It
 * reuses the interactive map's own classification rules so the two never drift:
 *
 *   • NBIM offices (`is_nbim_office`) are operational locations, not real estate
 *     investments — the map counts them separately ("investments + offices").
 *   • The "International fund" is a non-geographic bucket, not a country — the
 *     map excludes it from the country count (it shows "+ 1 intl fund").
 *
 * The reported total *value* deliberately still includes the international fund,
 * matching NBIM's published figure ([[FUND_REAL_ESTATE_VALUE_NOK]]).
 *
 * Note: NBIM offices are not present in `cities.json` today (the map injects
 * them at runtime), but we filter for them anyway so the counts stay correct if
 * that ever changes.
 */

export function isNbimOffice(property: CityProperty): boolean {
  return Boolean(property.is_nbim_office);
}

export function isInvestmentProperty(property: CityProperty): boolean {
  return !isNbimOffice(property);
}

// A city reduced to its investable properties, or null when it is the
// international-fund bucket or has no investment properties left.
function toInvestmentCity(city: CityNode): CityNode | null {
  if (isInternationalFundCity(city)) {
    return null;
  }
  const properties = city.properties.filter(isInvestmentProperty);
  if (properties.length === 0) {
    return null;
  }
  return properties.length === city.properties.length
    ? city
    : { ...city, properties };
}

let investmentCitiesCache: CityNode[] | null = null;
export function getInvestmentCities(): CityNode[] {
  if (!investmentCitiesCache) {
    investmentCitiesCache = getAllCities()
      .map(toInvestmentCity)
      .filter((city): city is CityNode => city !== null);
  }
  return investmentCitiesCache;
}

let investmentCountriesCache: CountryGroup[] | null = null;
export function getInvestmentCountries(): CountryGroup[] {
  if (!investmentCountriesCache) {
    const byCountry = new Map<string, CountryGroup>();
    for (const city of getInvestmentCities()) {
      const slug = countryToSlug(city.country);
      const existing = byCountry.get(slug);
      if (existing) {
        existing.cities.push(city);
      } else {
        byCountry.set(slug, { country: city.country, slug, cities: [city] });
      }
    }
    investmentCountriesCache = Array.from(byCountry.values());
  }
  return investmentCountriesCache;
}

let citySlugIndexCache: Map<string, CityNode> | null = null;
function citySlugIndex(): Map<string, CityNode> {
  if (!citySlugIndexCache) {
    citySlugIndexCache = new Map(
      getInvestmentCities().map((city) => [cityToSlug(city.city, city.country), city])
    );
  }
  return citySlugIndexCache;
}

let countrySlugIndexCache: Map<string, CountryGroup> | null = null;
function countrySlugIndex(): Map<string, CountryGroup> {
  if (!countrySlugIndexCache) {
    countrySlugIndexCache = new Map(
      getInvestmentCountries().map((group) => [group.slug, group])
    );
  }
  return countrySlugIndexCache;
}

export function findInvestmentCityBySlug(slug: string): CityNode | null {
  return citySlugIndex().get(slug) ?? null;
}

export function findInvestmentCountryBySlug(slug: string): CountryGroup | null {
  return countrySlugIndex().get(slug) ?? null;
}

export function getInvestmentCitySlugs(): string[] {
  return Array.from(citySlugIndex().keys());
}

export function getInvestmentCountrySlugs(): string[] {
  return Array.from(countrySlugIndex().keys());
}

export type PortfolioCounts = {
  propertyCount: number;
  cityCount: number;
  countryCount: number;
};

export function getPortfolioCounts(): PortfolioCounts {
  const cities = getInvestmentCities();
  const countries = new Set<string>();
  let propertyCount = 0;
  for (const city of cities) {
    propertyCount += city.properties.length;
    countries.add(city.country);
  }
  return { propertyCount, cityCount: cities.length, countryCount: countries.size };
}

/** NBIM's disclosed total unlisted real estate value (includes the intl fund). */
export const PORTFOLIO_TOTAL_VALUE_NOK = FUND_REAL_ESTATE_VALUE_NOK;
