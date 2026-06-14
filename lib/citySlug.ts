import citiesJson from "@/data/cities.json";
import type { CityNode } from "@/types/cities";

const cities = citiesJson as CityNode[];

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function countryToSlug(country: string): string {
  return slugify(country);
}

const bareCitySlugCounts = (() => {
  const counts = new Map<string, number>();
  for (const city of cities) {
    const slug = slugify(city.city);
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  return counts;
})();

export function cityToSlug(city: string, country: string): string {
  const bare = slugify(city);
  const count = bareCitySlugCounts.get(bare) ?? 0;
  return count > 1 ? `${bare}-${slugify(country)}` : bare;
}

const citySlugIndex: ReadonlyMap<string, CityNode> = (() => {
  const index = new Map<string, CityNode>();
  for (const city of cities) {
    index.set(cityToSlug(city.city, city.country), city);
  }
  return index;
})();

export function findCityBySlug(slug: string): CityNode | null {
  return citySlugIndex.get(slug) ?? null;
}

export type CountryGroup = {
  country: string;
  slug: string;
  cities: CityNode[];
};

const countrySlugIndex: ReadonlyMap<string, CountryGroup> = (() => {
  const index = new Map<string, CountryGroup>();
  for (const city of cities) {
    const slug = countryToSlug(city.country);
    const existing = index.get(slug);
    if (existing) {
      existing.cities.push(city);
    } else {
      index.set(slug, { country: city.country, slug, cities: [city] });
    }
  }
  return index;
})();

export function findCountryBySlug(slug: string): CountryGroup | null {
  return countrySlugIndex.get(slug) ?? null;
}

export function getAllCitySlugs(): string[] {
  return Array.from(citySlugIndex.keys());
}

export function getAllCountrySlugs(): string[] {
  return Array.from(countrySlugIndex.keys());
}

export function getAllCountries(): CountryGroup[] {
  return Array.from(countrySlugIndex.values());
}

export function getAllCities(): CityNode[] {
  return cities;
}
