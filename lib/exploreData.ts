import { formatCountryWithFlag } from "@/components/map/formatCountryWithFlag";
import {
  getInvestmentCities,
  getPortfolioCounts,
  PORTFOLIO_TOTAL_VALUE_NOK,
} from "@/lib/portfolio";
import { cityToSlug, countryToSlug } from "@/lib/citySlug";
import { getAttomMarketUsd } from "@/lib/attomValue";
import type {
  ExploreData,
  ExploreFacets,
  ExploreProperty,
  Sector,
} from "@/components/explore/types";

// Server-only builder. Flattens the investment portfolio (offices and the
// non-geographic "international fund" bucket are already excluded by
// getInvestmentCities) into a compact, client-shippable list. The heavy source
// datasets (cities.json, the 2.3MB ATTOM join) stay on the server; only the
// trimmed array below is serialized into the page payload.

const KNOWN_SECTORS: ReadonlySet<string> = new Set([
  "Office",
  "Retail",
  "Industrial",
  "Residential",
  "Fund",
]);

function normalizeSector(raw: string | null | undefined): Sector {
  const value = raw?.trim();
  if (value && KNOWN_SECTORS.has(value)) {
    return value as Sector;
  }
  return "Other";
}

// On wholly-owned assets the dataset lists NBIM itself in the partner field.
// That is the owner, not a joint-venture partner, so treat it as "no partner".
const NBIM_SELF = "norges bank investment management";

function normalizePartner(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value || value.toLowerCase() === NBIM_SELF) {
    return null;
  }
  return value;
}

// ~1m precision is plenty for a marker; trimming digits shrinks the payload.
function round(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}

let cache: ExploreData | null = null;

export function buildExploreData(): ExploreData {
  if (cache) {
    return cache;
  }

  const properties: ExploreProperty[] = [];
  const sectorCounts = new Map<Sector, number>();
  const countryCounts = new Map<string, number>();
  const partnerCounts = new Map<string, number>();

  for (const city of getInvestmentCities()) {
    const citySlug = cityToSlug(city.city, city.country);
    const countrySlug = countryToSlug(city.country);

    for (const property of city.properties) {
      if (property.lat == null || property.lng == null) {
        continue;
      }

      const sector = normalizeSector(property.sector);
      const partner = normalizePartner(property.partnership);

      properties.push({
        id: property.id,
        name: property.name?.trim() || property.address?.trim() || "Property",
        address: property.address?.trim() || "",
        sector,
        partner,
        ownership: property.ownership_percent,
        countryValueUsd: property.value_usd,
        marketUsd: getAttomMarketUsd(property.id),
        lat: round(property.lat),
        lng: round(property.lng),
        city: city.city,
        citySlug,
        country: city.country,
        countrySlug,
      });

      sectorCounts.set(sector, (sectorCounts.get(sector) ?? 0) + 1);
      countryCounts.set(city.country, (countryCounts.get(city.country) ?? 0) + 1);
      if (partner) {
        partnerCounts.set(partner, (partnerCounts.get(partner) ?? 0) + 1);
      }
    }
  }

  const facets: ExploreFacets = {
    sectors: Array.from(sectorCounts, ([value, count]) => ({ value, count })).sort(
      (a, b) => b.count - a.count
    ),
    countries: Array.from(countryCounts, ([value, count]) => ({
      value,
      slug: countryToSlug(value),
      flag: formatCountryWithFlag(value).split(" ")[0] ?? "",
      count,
    })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "en")),
    partners: Array.from(partnerCounts, ([value, count]) => ({ value, count })).sort(
      (a, b) => b.count - a.count || a.value.localeCompare(b.value, "en")
    ),
  };

  const counts = getPortfolioCounts();

  cache = {
    properties,
    facets,
    totals: {
      propertyCount: properties.length,
      cityCount: counts.cityCount,
      countryCount: counts.countryCount,
      portfolioValueNok: PORTFOLIO_TOTAL_VALUE_NOK,
    },
  };

  return cache;
}
