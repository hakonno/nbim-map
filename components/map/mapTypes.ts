import type { CityProperty } from "@/types/cities";

/** A property flattened with its city/country context — the shape the GL map
 * stack (glPropertyFeatures, usePropertyClusterLayer) renders. */
export type FlatProperty = CityProperty & {
  cityId: string;
  cityName: string;
  country: string;
  lat: number;
  lng: number;
};
