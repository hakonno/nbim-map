import type { CityNode } from "@/types/cities";

export const ZOOM_SHOW_PROPERTIES = 7;
export const ZOOM_PROPERTY_DETAIL = 10;
export const ZOOM_PROPERTY_FOCUS = 12;
export const MAP_DEFAULT_ZOOM = 3;
export const MAP_CENTER: [number, number] = [25, 5];

export const SEARCH_RESULT_LIMIT = 12;
export const SHOW_PROPERTY_COORDINATES_DEBUG = true;

export const FUND_REAL_ESTATE_VALUE_NOK = 371_524_114_446;
export const FUND_SHARE_PERCENT = 1.7;

function getDensityRatio(propertyCount: number, maxPropertyCount: number) {
  return Math.min(1, propertyCount / Math.max(maxPropertyCount, 1));
}

export function getCityRadius(propertyCount: number, maxPropertyCount: number) {
  const ratio = Math.sqrt(propertyCount / Math.max(maxPropertyCount, 1));
  return 7 + ratio * 16;
}

export function getCityColors(propertyCount: number, maxPropertyCount: number, isSelected: boolean) {
  const ratio = getDensityRatio(propertyCount, maxPropertyCount);
  const hue = Math.round(190 - ratio * 130);

  if (isSelected) {
    return {
      stroke: `hsl(${hue}, 76%, 35%)`,
      fill: `hsl(${hue}, 84%, 55%)`,
    };
  }

  return {
    stroke: `hsl(${hue}, 70%, 44%)`,
    fill: `hsl(${hue}, 82%, 60%)`,
  };
}

export function getPropertyColors(ownershipPercent: number | null, isSelected: boolean) {
  if (ownershipPercent == null) {
    return {
      stroke: isSelected ? "#334155" : "#64748b",
      fill: isSelected ? "#94a3b8" : "#cbd5e1",
    };
  }

  const ratio = Math.min(1, Math.max(0, ownershipPercent / 100));
  const hue = Math.round(8 + ratio * 122);

  if (isSelected) {
    return {
      stroke: `hsl(${hue}, 78%, 30%)`,
      fill: `hsl(${hue}, 86%, 54%)`,
    };
  }

  return {
    stroke: `hsl(${hue}, 72%, 40%)`,
    fill: `hsl(${hue}, 82%, 61%)`,
  };
}

export function isInternationalFundCity(city: Pick<CityNode, "city" | "country">) {
  const cityName = city.city.trim().toLowerCase();
  const countryName = city.country.trim().toLowerCase();
  return cityName === "international fund" || countryName === "international fund";
}
