import type {
  ExploreFacets,
  ExploreProperty,
  Filters,
  OwnershipBucket,
  Sector,
  SortKey,
} from "@/components/explore/types";

export const DEFAULT_FILTERS: Filters = {
  query: "",
  sectors: [],
  countries: [],
  partner: null,
  ownership: "any",
  marketDataOnly: false,
  // "featured" leads with the biggest city hubs, which mixes sectors, stakes
  // and partners on the first screen. Ownership-desc as default rendered a
  // monotone wall of "100% stake" cards (roughly half the portfolio).
  sort: "featured",
};

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "featured", label: "Featured: biggest hubs" },
  { value: "ownership-desc", label: "Ownership: high → low" },
  { value: "ownership-asc", label: "Ownership: low → high" },
  { value: "market-desc", label: "Market estimate: high → low" },
  { value: "name-asc", label: "Name: A → Z" },
  { value: "city-asc", label: "City: A → Z" },
];

export const OWNERSHIP_BUCKETS: { value: OwnershipBucket; label: string }[] = [
  { value: "any", label: "Any stake" },
  { value: "minority", label: "Minority (<50%)" },
  { value: "half", label: "Half (50%)" },
  { value: "majority", label: "Majority (>50%)" },
  { value: "full", label: "Wholly owned (100%)" },
];

function matchesOwnership(value: number | null, bucket: OwnershipBucket): boolean {
  if (bucket === "any") return true;
  if (value == null) return false;
  switch (bucket) {
    case "minority":
      return value < 50;
    case "half":
      return value === 50;
    case "majority":
      return value > 50 && value < 100;
    case "full":
      return value >= 100;
    default:
      return true;
  }
}

function buildHaystack(property: ExploreProperty): string {
  return [
    property.name,
    property.address,
    property.city,
    property.country,
    property.sector,
    property.partner,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function applyFilters(
  properties: ExploreProperty[],
  filters: Filters
): ExploreProperty[] {
  const query = filters.query.trim().toLowerCase();
  const sectorSet = filters.sectors.length ? new Set(filters.sectors) : null;
  const countrySet = filters.countries.length ? new Set(filters.countries) : null;

  const filtered = properties.filter((property) => {
    if (sectorSet && !sectorSet.has(property.sector)) return false;
    if (countrySet && !countrySet.has(property.country)) return false;
    if (filters.partner && property.partner !== filters.partner) return false;
    if (filters.marketDataOnly && property.marketUsd == null) return false;
    if (!matchesOwnership(property.ownership, filters.ownership)) return false;
    if (query && !buildHaystack(property).includes(query)) return false;
    return true;
  });

  return sortProperties(filtered, filters.sort);
}

function compareNumberDesc(a: number | null, b: number | null): number {
  // Nulls always sort last regardless of direction.
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return b - a;
}

export function sortProperties(
  properties: ExploreProperty[],
  sort: SortKey
): ExploreProperty[] {
  const sorted = [...properties];
  switch (sort) {
    case "featured": {
      // Cities with the most holdings first (computed on the current result
      // set, so it reads as "biggest hubs in these results"), then stable
      // alphabetical tie-breaks for determinism.
      const cityCounts = new Map<string, number>();
      for (const property of properties) {
        cityCounts.set(property.citySlug, (cityCounts.get(property.citySlug) ?? 0) + 1);
      }
      sorted.sort(
        (a, b) =>
          (cityCounts.get(b.citySlug) ?? 0) - (cityCounts.get(a.citySlug) ?? 0) ||
          a.city.localeCompare(b.city) ||
          a.name.localeCompare(b.name)
      );
      break;
    }
    case "ownership-desc":
      sorted.sort((a, b) => compareNumberDesc(a.ownership, b.ownership));
      break;
    case "ownership-asc":
      sorted.sort((a, b) => -compareNumberDesc(a.ownership, b.ownership));
      break;
    case "market-desc":
      sorted.sort((a, b) => compareNumberDesc(a.marketUsd, b.marketUsd));
      break;
    case "name-asc":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "city-asc":
      sorted.sort(
        (a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name)
      );
      break;
  }
  return sorted;
}

// --- URL round-trip -------------------------------------------------------
// Filters mirror into query params so filtered views are shareable links
// (e.g. /?country=France&sector=Retail). Defaults are omitted, so the bare
// homepage URL stays clean.

export function filtersToSearchParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set("q", filters.query.trim());
  if (filters.sectors.length) params.set("sector", filters.sectors.join(","));
  if (filters.countries.length) params.set("country", filters.countries.join(","));
  if (filters.partner) params.set("partner", filters.partner);
  if (filters.ownership !== "any") params.set("stake", filters.ownership);
  if (filters.marketDataOnly) params.set("market", "1");
  if (filters.sort !== DEFAULT_FILTERS.sort) params.set("sort", filters.sort);
  return params;
}

/**
 * Parse query params back into Filters, validating every value against the
 * facets / known keys so a mangled link degrades to defaults, never to a
 * broken state.
 */
export function filtersFromSearchParams(
  params: URLSearchParams,
  facets: ExploreFacets
): Filters {
  const knownSectors = new Set(facets.sectors.map((s) => s.value));
  const knownCountries = new Set(facets.countries.map((c) => c.value));
  const knownPartners = new Set(facets.partners.map((p) => p.value));
  const knownBuckets = new Set(OWNERSHIP_BUCKETS.map((b) => b.value));
  const knownSorts = new Set(SORT_OPTIONS.map((s) => s.value));

  const csv = (value: string | null) =>
    value ? value.split(",").map((part) => part.trim()).filter(Boolean) : [];

  const partner = params.get("partner");
  const stake = params.get("stake");
  const sort = params.get("sort");

  return {
    query: params.get("q")?.trim() ?? "",
    sectors: csv(params.get("sector")).filter((s): s is Sector =>
      knownSectors.has(s as Sector)
    ),
    countries: csv(params.get("country")).filter((c) => knownCountries.has(c)),
    partner: partner && knownPartners.has(partner) ? partner : null,
    ownership:
      stake && knownBuckets.has(stake as OwnershipBucket)
        ? (stake as OwnershipBucket)
        : "any",
    marketDataOnly: params.get("market") === "1",
    sort: sort && knownSorts.has(sort as SortKey) ? (sort as SortKey) : DEFAULT_FILTERS.sort,
  };
}

/**
 * Number of non-default filter facets active (drives the "N filters" badges
 * and "clear all" affordances). The free-text query deliberately does NOT
 * count: a non-empty search box is its own indicator, and the mobile pill
 * displays the query text directly.
 */
export function countActiveFilters(filters: Filters): number {
  let count = 0;
  if (filters.sectors.length) count += 1;
  if (filters.countries.length) count += 1;
  if (filters.partner) count += 1;
  if (filters.ownership !== "any") count += 1;
  if (filters.marketDataOnly) count += 1;
  return count;
}

export type ExploreSummary = {
  count: number;
  /** Mean disclosed NBIM ownership across the set (null if none disclosed). */
  avgOwnership: number | null;
  countryCount: number;
};

/** Trustworthy aggregates only — the dataset has no per-property value to sum. */
export function summarize(properties: ExploreProperty[]): ExploreSummary {
  const countries = new Set<string>();
  let ownershipSum = 0;
  let ownershipCount = 0;
  for (const property of properties) {
    countries.add(property.country);
    if (property.ownership != null) {
      ownershipSum += property.ownership;
      ownershipCount += 1;
    }
  }
  return {
    count: properties.length,
    avgOwnership: ownershipCount > 0 ? ownershipSum / ownershipCount : null,
    countryCount: countries.size,
  };
}
