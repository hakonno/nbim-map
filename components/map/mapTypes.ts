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
  sector?: string | null;
  isOffice?: boolean;
  officeCategory?: "office" | "head_office" | "real_estate_office" | null;
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

// Optional deep-link focus applied once on load (used by the city/country pages
// which embed the map scoped to a single place).
export type InitialFocus =
  | { kind: "city"; cityId: string }
  | { kind: "country"; country: string };

const GLOBAL_SELECTION: SelectionState = {
  mode: "global",
  selectedCountry: null,
  selectedCityId: null,
  selectedPropertyId: null,
};

/**
 * Derives the starting selection from an optional deep-link focus. Used as a
 * `useState` initializer so the panel opens on the right place at first paint
 * (no setState-in-effect); the camera fly happens separately once the map loads.
 */
export function initialSelectionState(initialFocus?: InitialFocus): SelectionState {
  if (initialFocus?.kind === "city") {
    return {
      mode: "city",
      selectedCountry: null,
      selectedCityId: initialFocus.cityId,
      selectedPropertyId: null,
    };
  }
  if (initialFocus?.kind === "country") {
    return {
      mode: "country",
      selectedCountry: initialFocus.country,
      selectedCityId: null,
      selectedPropertyId: null,
    };
  }
  return GLOBAL_SELECTION;
}
