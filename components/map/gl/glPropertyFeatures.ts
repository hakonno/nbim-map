import { getPropertyColors } from "@/components/map/mapConstants";
import type { FlatProperty } from "@/components/map/mapTypes";

const integerFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export type PropertyFeatureProps = {
  id: string;
  color: string;
  stroke: string;
  office: 0 | 1;
  investment: 0 | 1;
  ownershipForAvg: number;
  ownershipCountable: 0 | 1;
  cityId: string;
  cityName: string;
  label: string;
};

export type PropertyFeature = {
  type: "Feature";
  id: string;
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: PropertyFeatureProps;
};

export type PropertyFeatureCollection = {
  type: "FeatureCollection";
  features: PropertyFeature[];
};

/** Human-readable marker label, mirroring the Leaflet renderer's wording. */
export function getPropertyLabel(property: FlatProperty): string {
  const base =
    property.office_name?.trim() ||
    property.name?.trim() ||
    property.address?.trim() ||
    "Property";

  if (property.is_nbim_office) {
    const type =
      property.office_category === "head_office"
        ? "Head office"
        : property.office_category === "real_estate_office"
          ? "Real estate office"
          : "NBIM office";
    return `${base} · ${type}`;
  }

  if (property.ownership_percent == null) {
    return base;
  }
  if (Number.isInteger(property.ownership_percent)) {
    return `${base} · ${integerFormatter.format(property.ownership_percent)}%`;
  }
  return `${base} · ~${integerFormatter.format(Math.round(property.ownership_percent))}%`;
}

function toFeature(property: FlatProperty): PropertyFeature {
  const isOffice = Boolean(property.is_nbim_office);
  const colors = getPropertyColors(property.ownership_percent, false, isOffice);
  const hasOwnership =
    !isOffice && typeof property.ownership_percent === "number";

  return {
    type: "Feature",
    id: property.id,
    geometry: { type: "Point", coordinates: [property.lng, property.lat] },
    properties: {
      id: property.id,
      color: colors.fill,
      stroke: colors.stroke,
      office: isOffice ? 1 : 0,
      investment: isOffice ? 0 : 1,
      ownershipForAvg: hasOwnership ? (property.ownership_percent as number) : 0,
      ownershipCountable: hasOwnership ? 1 : 0,
      cityId: property.cityId,
      cityName: property.cityName,
      label: getPropertyLabel(property),
    },
  };
}

export function buildPropertyFeatureCollection(
  flatProperties: FlatProperty[]
): PropertyFeatureCollection {
  return {
    type: "FeatureCollection",
    features: flatProperties.map(toFeature),
  };
}

/** Single-feature collection for the highlighted selection (drawn above clusters). */
export function buildSelectedFeatureCollection(
  property: FlatProperty | null
): PropertyFeatureCollection {
  if (!property) {
    return { type: "FeatureCollection", features: [] };
  }

  const isOffice = Boolean(property.is_nbim_office);
  const colors = getPropertyColors(property.ownership_percent, true, isOffice);

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: property.id,
        geometry: { type: "Point", coordinates: [property.lng, property.lat] },
        properties: {
          id: property.id,
          color: colors.fill,
          stroke: colors.stroke,
          office: isOffice ? 1 : 0,
          investment: isOffice ? 0 : 1,
          ownershipForAvg: 0,
          ownershipCountable: 0,
          cityId: property.cityId,
          cityName: property.cityName,
          label: getPropertyLabel(property),
        },
      },
    ],
  };
}
