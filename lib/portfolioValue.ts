import { getCityCountryValueNok } from "@/components/map/selection/countryValue";
import type { CityNode } from "@/types/cities";

// In the dataset, `value_nok` is a COUNTRY-level total stamped onto every
// property in that country (there are only ~15 distinct values, one per
// country). There is no per-city or per-property NBIM value. This helper
// surfaces the country total correctly and never double-counts by summing it
// across cities. The portfolio-wide total lives in lib/portfolio as
// PORTFOLIO_TOTAL_VALUE_NOK (the map's published figure).

/** The single country-level total real-estate value (NOK), or null if unknown. */
export function getCountryValueNok(cities: CityNode[]): number | null {
  for (const city of cities) {
    const value = getCityCountryValueNok(city);
    if (value != null) return value;
  }
  return null;
}
