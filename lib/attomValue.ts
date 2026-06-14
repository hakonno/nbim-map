import attomData from "@/data/attom-data.json";

// Server-only join helper: the ATTOM dataset is large (~2.3MB) and keyed by
// property id. Importing it here keeps it on the server — pages compute the
// single number per property at build time and ship only that to the client.
// Do NOT import this module from a client component.

// ATTOM occasionally returns placeholder amounts like $1; mirror the map's floor
// (see AttomDataSection) so we never headline a nonsense valuation.
const MIN_VALUE_USD = 1000;

type AttomEntry = {
  assessment?: { market?: { mktttlvalue?: number } };
};

// Some ids map to null (looked up, no record found), so allow null entries.
const data = attomData as unknown as Record<string, AttomEntry | null>;

/**
 * ATTOM tax-assessor market estimate (USD) of the *whole* property, or null when
 * there is no usable figure. Coverage is US-only and partial. This is a modelled
 * market estimate, not NBIM's valuation or its ownership share.
 */
export function getAttomMarketUsd(propertyId: string): number | null {
  const value = data[propertyId]?.assessment?.market?.mktttlvalue;
  return typeof value === "number" && value >= MIN_VALUE_USD ? value : null;
}
