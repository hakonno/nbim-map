import { formatCountryWithFlag } from "@/components/map/formatCountryWithFlag";
import type { CityNode } from "@/types/cities";

import type { FlatProperty, SearchResult } from "@/components/map/mapTypes";

export function buildLocalSearchResults(
  query: string,
  mappableCities: CityNode[],
  flatProperties: FlatProperty[],
  limit: number
): SearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) {
    return [];
  }

  const cityMatches: SearchResult[] = mappableCities
    .filter((city) => {
      const cityText = `${city.city} ${city.country}`.toLowerCase();
      return cityText.includes(normalized);
    })
    .map((city) => ({
      id: `city-${city.id}`,
      type: "city",
      name: city.city,
      subtitle: formatCountryWithFlag(city.country),
      lat: city.lat as number,
      lng: city.lng as number,
      cityId: city.id,
    }));

  const propertyMatches: SearchResult[] = flatProperties
    .filter((property) => {
      const haystack = [property.name, property.address, property.cityName, property.country]
        .filter((part): part is string => Boolean(part && part.trim()))
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalized);
    })
    .map((property) => ({
      id: `property-${property.id}`,
      type: "property",
      name: property.office_name?.trim() || property.name?.trim() || "Unnamed property",
      subtitle: [
        property.is_nbim_office ? "Actual NBIM office" : null,
        property.address,
        property.cityName,
        formatCountryWithFlag(property.country),
      ]
        .filter((part): part is string => Boolean(part && part.trim()))
        .join(" · "),
      lat: property.lat,
      lng: property.lng,
      cityId: property.cityId,
      propertyId: property.id,
      sector: property.sector,
      isOffice: Boolean(property.is_nbim_office),
      officeCategory: property.office_category ?? null,
    }));

  return [...cityMatches, ...propertyMatches].slice(0, limit);
}
