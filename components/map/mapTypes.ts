import type { CityProperty } from "@/types/cities";

export type FlatProperty = CityProperty & {
  cityId: string;
  cityName: string;
  country: string;
  lat: number;
  lng: number;
};

export type SearchResult = {
  id: string;
  type: "city" | "property";
  name: string;
  subtitle: string;
  lat: number;
  lng: number;
  cityId: string;
  propertyId?: string;
};

export type SelectionState =
  {
    mode: "global" | "country" | "city" | "property";
    selectedCountry: string | null;
    selectedCityId: string | null;
    selectedPropertyId: string | null;
  };

export type PropertyCoordinates = {
  lat: number;
  lng: number;
};
