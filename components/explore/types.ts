// Shared types for the Explore (property discovery) experience.

export type Sector =
  | "Office"
  | "Retail"
  | "Industrial"
  | "Residential"
  | "Fund"
  | "Other";

/** One investment property, trimmed for the client. Built by lib/exploreData.ts. */
export type ExploreProperty = {
  id: string;
  name: string;
  address: string;
  sector: Sector;
  partner: string | null;
  /** NBIM ownership share, 0–100, or null when undisclosed. */
  ownership: number | null;
  /**
   * NBIM's disclosed total real-estate value for this property's COUNTRY, in USD
   * (the dataset stamps one country total onto every property — it is never a
   * per-property figure). Shown only as country context, never summed.
   */
  countryValueUsd: number | null;
  /** ATTOM tax-assessor market estimate of the whole property (US-only), or null. */
  marketUsd: number | null;
  lat: number;
  lng: number;
  city: string;
  citySlug: string;
  country: string;
  countrySlug: string;
};

export type SectorFacet = { value: Sector; count: number };
export type CountryFacet = { value: string; slug: string; flag: string; count: number };
export type PartnerFacet = { value: string; count: number };

export type ExploreFacets = {
  sectors: SectorFacet[];
  countries: CountryFacet[];
  partners: PartnerFacet[];
};

export type ExploreTotals = {
  propertyCount: number;
  cityCount: number;
  countryCount: number;
  /** NBIM's disclosed total unlisted real estate value (NOK). */
  portfolioValueNok: number;
};

export type ExploreData = {
  properties: ExploreProperty[];
  facets: ExploreFacets;
  totals: ExploreTotals;
};

export type SortKey =
  | "featured"
  | "ownership-desc"
  | "ownership-asc"
  | "market-desc"
  | "name-asc"
  | "city-asc";

/** Quick ownership buckets — friendlier than a raw slider for scanning. */
export type OwnershipBucket = "any" | "minority" | "half" | "majority" | "full";

export type Filters = {
  query: string;
  sectors: Sector[];
  countries: string[];
  partner: string | null;
  ownership: OwnershipBucket;
  /** Only properties with an ATTOM US market estimate. */
  marketDataOnly: boolean;
  sort: SortKey;
};
