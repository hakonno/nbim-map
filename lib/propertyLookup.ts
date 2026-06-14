import { cityToSlug } from "@/lib/citySlug";
import { getInvestmentCities } from "@/lib/portfolio";
import type { CityNode, CityProperty } from "@/types/cities";

// Property ids (e.g. "prop_xxx") are globally unique across the dataset — the
// ATTOM join is keyed by the same id — so a flat id → location index is safe.
// Built from the investment dataset so offices / the intl-fund bucket get no
// page (see lib/portfolio).
export type PropertyLocation = {
  property: CityProperty;
  city: CityNode;
  citySlug: string;
};

const propertyIndex: ReadonlyMap<string, PropertyLocation> = (() => {
  const index = new Map<string, PropertyLocation>();
  for (const city of getInvestmentCities()) {
    const citySlug = cityToSlug(city.city, city.country);
    for (const property of city.properties) {
      index.set(property.id, { property, city, citySlug });
    }
  }
  return index;
})();

export function findPropertyById(id: string): PropertyLocation | null {
  return propertyIndex.get(id) ?? null;
}

export function getAllPropertyIds(): string[] {
  return Array.from(propertyIndex.keys());
}
