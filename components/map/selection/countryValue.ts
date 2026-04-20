import type { CityNode } from "@/types/cities";

export function getCityCountryValueNok(city: CityNode) {
  for (const property of city.properties) {
    if (typeof property.value_nok === "number") {
      return property.value_nok;
    }
  }

  return null;
}
