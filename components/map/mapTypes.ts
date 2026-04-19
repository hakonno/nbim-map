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
  | {
      mode: "global";
      selectedCityId: null;
      selectedPropertyId: null;
    }
  | {
      mode: "city";
      selectedCityId: string;
      selectedPropertyId: null;
    }
  | {
      mode: "property";
      selectedCityId: string;
      selectedPropertyId: string;
    };

export type PropertyCoordinates = {
  lat: number;
  lng: number;
};
