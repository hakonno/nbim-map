import nbimOfficesJson from "@/data/nbim-offices.json";
import type { CityNode, CityProperty } from "@/types/cities";

type OfficeCategory = NonNullable<CityProperty["office_category"]>;

type NbimOfficeDefinition = {
  id: string;
  office_name: string;
  office_category: OfficeCategory;
  office_entity: string;
  city: string;
  country: string;
  address: string;
  lat: number;
  lng: number;
  match_hints: string[];
};

const NBIM_OFFICES = nbimOfficesJson as NbimOfficeDefinition[];

function normalizeForMatch(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function toSlug(value: string) {
  return normalizeForMatch(value).replace(/\s+/g, "-");
}

function buildCityKey(country: string, city: string) {
  return `${normalizeForMatch(country)}|${normalizeForMatch(city)}`;
}

function getOfficeHints(office: NbimOfficeDefinition) {
  return office.match_hints.map((hint) => normalizeForMatch(hint)).filter(Boolean);
}

function isOfficeMatch(property: CityProperty, office: NbimOfficeDefinition) {
  const propertyName = normalizeForMatch(property.name);
  const propertyAddress = normalizeForMatch(property.address);
  const hints = getOfficeHints(office);

  if (hints.length === 0) {
    return false;
  }

  return hints.some((hint) => {
    if (!hint) {
      return false;
    }

    if (propertyName && (propertyName.includes(hint) || hint.includes(propertyName))) {
      return true;
    }

    if (propertyAddress && (propertyAddress.includes(hint) || hint.includes(propertyAddress))) {
      return true;
    }

    return false;
  });
}

function buildOfficeProperty(office: NbimOfficeDefinition): CityProperty {
  return {
    id: `prop_nbim_office_${toSlug(office.id)}`,
    name: office.office_name,
    address: office.address,
    partnership: office.office_entity,
    sector: "Office",
    lat: office.lat,
    lng: office.lng,
    ownership_percent: null,
    value_nok: null,
    value_usd: null,
    is_nbim_office: true,
    office_name: office.office_name,
    office_category: office.office_category,
    office_entity: office.office_entity,
  };
}

function applyOfficeMetadata(property: CityProperty, office: NbimOfficeDefinition): CityProperty {
  return {
    ...property,
    sector: property.sector ?? "Office",
    partnership: property.partnership ?? office.office_entity,
    lat: typeof property.lat === "number" ? property.lat : office.lat,
    lng: typeof property.lng === "number" ? property.lng : office.lng,
    is_nbim_office: true,
    office_name: office.office_name,
    office_category: office.office_category,
    office_entity: office.office_entity,
  };
}

function createOfficeCity(office: NbimOfficeDefinition): CityNode {
  return {
    id: `city_nbim_office_${toSlug(office.country)}_${toSlug(office.city)}`,
    city: office.city,
    country: office.country,
    lat: office.lat,
    lng: office.lng,
    properties: [buildOfficeProperty(office)],
    total_ownership_sum: 0,
  };
}

export function enrichCitiesWithNbimOffices(cities: CityNode[]) {
  const enrichedCities = cities.map((city) => ({
    ...city,
    properties: city.properties.map((property) => ({ ...property })),
  }));

  const byCityKey = new Map<string, CityNode>();
  for (const city of enrichedCities) {
    byCityKey.set(buildCityKey(city.country, city.city), city);
  }

  for (const office of NBIM_OFFICES) {
    const cityKey = buildCityKey(office.country, office.city);
    const existingCity = byCityKey.get(cityKey);

    if (!existingCity) {
      const officeCity = createOfficeCity(office);
      enrichedCities.push(officeCity);
      byCityKey.set(cityKey, officeCity);
      continue;
    }

    const matchingPropertyIndex = existingCity.properties.findIndex((property) =>
      isOfficeMatch(property, office)
    );

    if (matchingPropertyIndex >= 0) {
      existingCity.properties[matchingPropertyIndex] = applyOfficeMetadata(
        existingCity.properties[matchingPropertyIndex],
        office
      );
    } else {
      existingCity.properties.push(buildOfficeProperty(office));
      existingCity.properties.sort((a, b) => {
        const aName = (a.name ?? "").trim();
        const bName = (b.name ?? "").trim();
        const nameCompare = aName.localeCompare(bName);
        if (nameCompare !== 0) {
          return nameCompare;
        }

        return (a.address ?? "").localeCompare(b.address ?? "");
      });
    }

    if (typeof existingCity.lat !== "number" || typeof existingCity.lng !== "number") {
      existingCity.lat = office.lat;
      existingCity.lng = office.lng;
    }
  }

  enrichedCities.sort((a, b) => {
    const countryCompare = a.country.localeCompare(b.country);
    if (countryCompare !== 0) {
      return countryCompare;
    }

    return a.city.localeCompare(b.city);
  });

  return enrichedCities;
}
