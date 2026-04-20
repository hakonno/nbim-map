import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { COUNTRY_CENTERS } from "./lib/country-centers.mjs";
import {
  decodeBuffer,
  detectEncoding,
  normalizeText,
  parseCsvLine,
  parseNonEmptyLines,
} from "./lib/csv-utils.mjs";
import { resolveActiveCsvInput, resolveActiveReleaseFile } from "./lib/active-dataset.mjs";
import { readJsonIfExists, saveJson } from "./lib/fs-json-utils.mjs";
import { mapHeaders } from "./lib/header-mapping.mjs";
import { createSha1Id } from "./lib/hash-utils.mjs";
import { parseNumber, parsePercent } from "./lib/number-utils.mjs";

const LEGACY_DEFAULT_INPUT = path.join(process.cwd(), "data", "raw", "re_20251231.csv");
const DEFAULT_INPUT = resolveActiveCsvInput(LEGACY_DEFAULT_INPUT);
const RUNTIME_CITIES_OUTPUT = path.join(process.cwd(), "data", "cities.json");
const RUNTIME_REALESTATE_OUTPUT = path.join(process.cwd(), "data", "realestate.json");
const DEFAULT_OUTPUT = resolveActiveReleaseFile("cities.json", RUNTIME_CITIES_OUTPUT);
const DEFAULT_REALESTATE_OUTPUT = resolveActiveReleaseFile("realestate.json", RUNTIME_REALESTATE_OUTPUT);
const LEGACY_DEFAULT_PROPERTY_COORDINATES = path.join(
  process.cwd(),
  "data",
  "property-coordinates.json"
);
const DEFAULT_PROPERTY_COORDINATES = resolveActiveReleaseFile(
  "property-coordinates.json",
  LEGACY_DEFAULT_PROPERTY_COORDINATES
);
const DEFAULT_CITY_COORDINATES = path.join(process.cwd(), "data", "city-coordinates.json");

const HEADER_RULES = [
  { key: "country", required: true, aliases: ["country"] },
  { key: "address", required: true, aliases: ["address", "propertyaddress", "location"] },
  { key: "partnership", required: true, aliases: ["partnership", "partner", "owner"] },
  { key: "industry", required: false, aliases: ["industry", "propertytype", "type", "sector"] },
  { key: "ownership", required: true, aliases: ["ownership", "ownershippercent", "owned", "stake"] },
  { key: "valueNok", required: true, aliases: ["totalcountryvalue", "marketvalue", "valuenok", "value"] },
  { key: "valueUsd", required: false, aliases: ["totalcountryvalueusd", "marketvalueusd", "valueusd"] },
];

function parseArgs(argv) {
  const options = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    realestateOutput: DEFAULT_REALESTATE_OUTPUT,
    propertyCoordinates: DEFAULT_PROPERTY_COORDINATES,
    cityCoordinates: DEFAULT_CITY_COORDINATES,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--input" && argv[index + 1]) {
      options.input = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--output" && argv[index + 1]) {
      options.output = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--realestate-output" && argv[index + 1]) {
      options.realestateOutput = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--property-coordinates" && argv[index + 1]) {
      options.propertyCoordinates = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--city-coordinates" && argv[index + 1]) {
      options.cityCoordinates = path.resolve(argv[index + 1]);
      index += 1;
    }
  }

  return options;
}

async function mirrorRuntimeSnapshot(sourcePath, runtimePath) {
  if (path.resolve(sourcePath) === path.resolve(runtimePath)) {
    return false;
  }

  await fs.mkdir(path.dirname(runtimePath), { recursive: true });
  await fs.copyFile(sourcePath, runtimePath);
  return true;
}

function getValue(values, index) {
  if (index === -1 || index == null) {
    return "";
  }

  return String(values[index] ?? "").trim();
}

function extractPropertyName(address) {
  if (!address) {
    return null;
  }

  const first = address.split(",")[0]?.trim();
  return first || null;
}

function isPostalLike(text) {
  const compact = text.replace(/\s+/g, "");
  const hasDigit = /[0-9]/.test(compact);
  return hasDigit && /^[A-Z0-9-]{3,10}$/i.test(compact);
}

function extractCity(address, country) {
  if (!address) {
    return null;
  }

  const parts = String(address)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return null;
  }

  let city = parts[parts.length - 1];

  if (normalizeText(city) === normalizeText(country) && parts.length > 1) {
    city = parts[parts.length - 2];
  }

  if (isPostalLike(city) && parts.length > 1) {
    city = parts[parts.length - 2];
  }

  return city || null;
}

function resolveLatLng(city, country, cityCoordinates) {
  const cityKey = `${normalizeText(country)}|${normalizeText(city)}`;
  const cityEntry = cityCoordinates[cityKey];
  if (Array.isArray(cityEntry) && cityEntry.length >= 2) {
    return {
      lat: Number(cityEntry[0]),
      lng: Number(cityEntry[1]),
      source: "city_lookup",
    };
  }

  const countryKey = normalizeText(country);
  const countryEntry = COUNTRY_CENTERS[countryKey];
  if (Array.isArray(countryEntry) && countryEntry.length >= 2) {
    return {
      lat: Number(countryEntry[0]),
      lng: Number(countryEntry[1]),
      source: "country_fallback",
    };
  }

  return {
    lat: null,
    lng: null,
    source: "missing",
  };
}

function isFiniteCoordinate(value) {
  if (value == null) {
    return false;
  }

  if (typeof value === "string" && value.trim() === "") {
    return false;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= -180 && parsed <= 180;
}

function toNumericCoordinate(value) {
  return isFiniteCoordinate(value) ? Number(value) : null;
}

async function loadCsvInput(filePath) {
  const rawBuffer = await fs.readFile(filePath);
  const encoding = detectEncoding(rawBuffer);
  const text = decodeBuffer(rawBuffer, encoding);

  const lines = parseNonEmptyLines(text);
  if (lines.length < 2) {
    throw new Error("Input CSV is empty or missing rows.");
  }

  return {
    encoding,
    headers: parseCsvLine(lines[0]),
    rows: lines.slice(1).map((line) => parseCsvLine(line)),
  };
}

async function loadPropertyCoordinates(filePath) {
  const parsed = await readJsonIfExists(filePath, {});

  if (parsed && typeof parsed === "object" && parsed.entries && typeof parsed.entries === "object") {
    return parsed.entries;
  }

  if (parsed && typeof parsed === "object") {
    return parsed;
  }

  return {};
}

async function loadCityCoordinates(filePath) {
  const parsed = await readJsonIfExists(filePath, {});
  return parsed && typeof parsed === "object" ? parsed : {};
}

function calculatePropertyCentroid(properties) {
  const valid = properties.filter((property) => isFiniteCoordinate(property.lat) && isFiniteCoordinate(property.lng));

  if (valid.length === 0) {
    return null;
  }

  const total = valid.reduce(
    (acc, property) => {
      acc.lat += Number(property.lat);
      acc.lng += Number(property.lng);
      return acc;
    },
    { lat: 0, lng: 0 }
  );

  return {
    lat: Number((total.lat / valid.length).toFixed(6)),
    lng: Number((total.lng / valid.length).toFixed(6)),
    count: valid.length,
  };
}

function mapRowsToCityGroups(rows, mappedHeaders, propertyCoordinateEntries) {
  const cityGroups = new Map();
  let preGeocodedPropertyCount = 0;

  for (const values of rows) {
    const country = getValue(values, mappedHeaders.country) || "Unknown";
    const address = getValue(values, mappedHeaders.address);
    const cityFromAddress = extractCity(address, country);
    const city = cityFromAddress || country;

    const groupKey = `${normalizeText(country)}|${normalizeText(city)}`;

    if (!cityGroups.has(groupKey)) {
      cityGroups.set(groupKey, {
        id: createSha1Id("city", groupKey, 14),
        city,
        country,
        lat: null,
        lng: null,
        properties: [],
        total_ownership_sum: 0,
      });
    }

    const node = cityGroups.get(groupKey);

    const partnership = getValue(values, mappedHeaders.partnership);
    const ownershipRaw = getValue(values, mappedHeaders.ownership);
    const propertyKey = [country, partnership, address, ownershipRaw].join("|");
    const propertyId = createSha1Id("prop", propertyKey, 14);

    const coordinateEntry = propertyCoordinateEntries[propertyId] ?? null;
    const propertyLat = toNumericCoordinate(coordinateEntry?.lat);
    const propertyLng = toNumericCoordinate(coordinateEntry?.lng);

    if (propertyLat != null && propertyLng != null) {
      preGeocodedPropertyCount += 1;
    }

    const property = {
      id: propertyId,
      name: extractPropertyName(address),
      address: address || null,
      partnership: partnership || null,
      sector: getValue(values, mappedHeaders.industry) || null,
      ownership_percent: parsePercent(ownershipRaw),
      value_nok: parseNumber(getValue(values, mappedHeaders.valueNok)),
      value_usd: parseNumber(getValue(values, mappedHeaders.valueUsd)),
      lat: propertyLat,
      lng: propertyLng,
    };

    node.properties.push(property);

    if (typeof property.ownership_percent === "number") {
      node.total_ownership_sum += property.ownership_percent;
    }
  }

  return {
    cityGroups,
    preGeocodedPropertyCount,
  };
}

function resolveCitiesFromGroups(cityGroups, cityCoordinates) {
  let cityLookupCount = 0;
  let countryFallbackCount = 0;
  let missingCoordsCount = 0;
  let cityCentroidCount = 0;
  let propertyCityFallbackCount = 0;
  let propertyMissingCoordsCount = 0;

  const cities = Array.from(cityGroups.values()).map((node) => {
    const centroid = calculatePropertyCentroid(node.properties);

    if (centroid) {
      node.lat = centroid.lat;
      node.lng = centroid.lng;
      cityCentroidCount += 1;
    } else {
      const resolved = resolveLatLng(node.city, node.country, cityCoordinates);
      node.lat = resolved.lat;
      node.lng = resolved.lng;

      if (resolved.source === "city_lookup") {
        cityLookupCount += 1;
      } else if (resolved.source === "country_fallback") {
        countryFallbackCount += 1;
      } else {
        missingCoordsCount += 1;
      }
    }

    node.properties = node.properties.map((property) => {
      if (isFiniteCoordinate(property.lat) && isFiniteCoordinate(property.lng)) {
        return property;
      }

      if (isFiniteCoordinate(node.lat) && isFiniteCoordinate(node.lng)) {
        propertyCityFallbackCount += 1;
        return {
          ...property,
          lat: Number(node.lat),
          lng: Number(node.lng),
        };
      }

      propertyMissingCoordsCount += 1;
      return property;
    });

    node.properties.sort((a, b) => {
      const nameCompare = String(a.name ?? "").localeCompare(String(b.name ?? ""));
      if (nameCompare !== 0) {
        return nameCompare;
      }
      return String(a.address ?? "").localeCompare(String(b.address ?? ""));
    });

    node.total_ownership_sum = Number(node.total_ownership_sum.toFixed(2));
    return node;
  });

  cities.sort((a, b) => {
    const countryCompare = a.country.localeCompare(b.country);
    if (countryCompare !== 0) {
      return countryCompare;
    }
    return a.city.localeCompare(b.city);
  });

  return {
    cities,
    stats: {
      cityLookupCount,
      countryFallbackCount,
      missingCoordsCount,
      cityCentroidCount,
      propertyCityFallbackCount,
      propertyMissingCoordsCount,
    },
  };
}

function createCountryId(country) {
  return createSha1Id("country", normalizeText(country), 14);
}

function buildPropertyDictionary(cities) {
  const partnerships = new Set();
  const sectors = new Set();

  for (const city of cities) {
    for (const property of city.properties) {
      if (property.partnership) {
        partnerships.add(property.partnership);
      }

      if (property.sector) {
        sectors.add(property.sector);
      }
    }
  }

  const partnershipList = Array.from(partnerships).sort((a, b) => a.localeCompare(b));
  const sectorList = Array.from(sectors).sort((a, b) => a.localeCompare(b));

  return {
    partnerships: partnershipList,
    sectors: sectorList,
    partnershipToId: new Map(partnershipList.map((value, index) => [value, index])),
    sectorToId: new Map(sectorList.map((value, index) => [value, index])),
  };
}

function buildCountryValueProfiles(cities) {
  const profiles = new Map();

  for (const city of cities) {
    const countryId = createCountryId(city.country);

    if (!profiles.has(countryId)) {
      profiles.set(countryId, {
        valueNok: new Set(),
        valueUsd: new Set(),
      });
    }

    const profile = profiles.get(countryId);

    for (const property of city.properties) {
      if (typeof property.value_nok === "number") {
        profile.valueNok.add(property.value_nok);
      }

      if (typeof property.value_usd === "number") {
        profile.valueUsd.add(property.value_usd);
      }
    }
  }

  return profiles;
}

function buildNormalizedRealestate({ cities, sourceInput }) {
  const countryValueProfiles = buildCountryValueProfiles(cities);
  const dictionary = buildPropertyDictionary(cities);
  const countryValueModes = new Map();

  for (const [countryId, profile] of countryValueProfiles.entries()) {
    const hasSingleValueNok = profile.valueNok.size === 1;
    const hasSingleValueUsd = profile.valueUsd.size === 1;

    countryValueModes.set(countryId, {
      hasSingleValueNok,
      hasSingleValueUsd,
      valueNok: hasSingleValueNok ? Array.from(profile.valueNok)[0] : null,
      valueUsd: hasSingleValueUsd ? Array.from(profile.valueUsd)[0] : null,
      valueScope: hasSingleValueNok && hasSingleValueUsd ? "country_unique" : "property_mixed",
    });
  }

  const countries = {};
  const cityEntities = {};
  const propertyEntities = {};

  for (const city of cities) {
    const countryId = createCountryId(city.country);
    const valueMode = countryValueModes.get(countryId) ?? {
      hasSingleValueNok: false,
      hasSingleValueUsd: false,
      valueNok: null,
      valueUsd: null,
      valueScope: "property_mixed",
    };

    if (!countries[countryId]) {
      countries[countryId] = {
        country: city.country,
        city_ids: [],
        property_count: 0,
        total_ownership_sum: 0,
        value_nok: valueMode.valueNok,
        value_usd: valueMode.valueUsd,
        value_scope: valueMode.valueScope,
      };
    }

    const country = countries[countryId];
    country.city_ids.push(city.id);
    country.property_count += city.properties.length;
    country.total_ownership_sum = Number(
      (country.total_ownership_sum + city.total_ownership_sum).toFixed(2)
    );

    const propertyIds = [];

    for (const property of city.properties) {
      const partnershipId = property.partnership
        ? dictionary.partnershipToId.get(property.partnership) ?? null
        : null;
      const sectorId = property.sector
        ? dictionary.sectorToId.get(property.sector) ?? null
        : null;

      const propertyNode = {
        city_id: city.id,
        name: property.name,
        address: property.address,
        partnership_id: partnershipId,
        sector_id: sectorId,
        ownership_percent: property.ownership_percent,
        lat: property.lat,
        lng: property.lng,
      };

      if (!valueMode.hasSingleValueNok) {
        propertyNode.value_nok = property.value_nok;
      }

      if (!valueMode.hasSingleValueUsd) {
        propertyNode.value_usd = property.value_usd;
      }

      propertyEntities[property.id] = propertyNode;
      propertyIds.push(property.id);
    }

    cityEntities[city.id] = {
      city: city.city,
      country_id: countryId,
      lat: city.lat,
      lng: city.lng,
      total_ownership_sum: city.total_ownership_sum,
      property_ids: propertyIds,
    };
  }

  for (const country of Object.values(countries)) {
    country.city_ids.sort((a, b) => a.localeCompare(b));
  }

  return {
    version: 1,
    generated_at: new Date().toISOString(),
    source_input: sourceInput,
    stats: {
      countries: Object.keys(countries).length,
      cities: Object.keys(cityEntities).length,
      properties: Object.keys(propertyEntities).length,
      dictionary_partnerships: dictionary.partnerships.length,
      dictionary_sectors: dictionary.sectors.length,
    },
    dictionary: {
      partnerships: dictionary.partnerships,
      sectors: dictionary.sectors,
    },
    entities: {
      countries,
      cities: cityEntities,
      properties: propertyEntities,
    },
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  console.log("[1/6] Parsing raw CSV...");
  console.log(`- Input: ${options.input}`);

  const { encoding, headers, rows } = await loadCsvInput(options.input);

  console.log(`- Encoding detected: ${encoding}`);
  console.log("- Delimiter: ;");
  console.log(`- Headers: ${headers.length}`);
  console.log(`- Rows: ${rows.length}`);

  console.log("[2/6] Mapping columns dynamically...");
  const mappedHeaders = mapHeaders(headers, HEADER_RULES);
  for (const [field, index] of Object.entries(mappedHeaders)) {
    console.log(`- ${field}: ${index === -1 ? "(not mapped)" : headers[index]}`);
  }

  console.log("[3/6] Loading coordinate sidecars...");
  console.log(`- Property coordinate file: ${options.propertyCoordinates}`);
  console.log(`- City coordinate file: ${options.cityCoordinates}`);

  const [propertyCoordinateEntries, cityCoordinates] = await Promise.all([
    loadPropertyCoordinates(options.propertyCoordinates),
    loadCityCoordinates(options.cityCoordinates),
  ]);

  console.log(`- Property coordinate entries loaded: ${Object.keys(propertyCoordinateEntries).length}`);
  console.log(`- City lookup entries loaded: ${Object.keys(cityCoordinates).length}`);

  console.log("[4/6] Grouping into city-level nodes...");
  const { cityGroups, preGeocodedPropertyCount } = mapRowsToCityGroups(
    rows,
    mappedHeaders,
    propertyCoordinateEntries
  );

  console.log(`- City nodes created: ${cityGroups.size}`);
  console.log(`- Properties with pre-geocoded coordinates: ${preGeocodedPropertyCount}`);

  console.log("[5/6] Resolving city and property coordinates...");
  const { cities, stats } = resolveCitiesFromGroups(cityGroups, cityCoordinates);

  console.log(`- Resolved by city lookup: ${stats.cityLookupCount}`);
  console.log(`- Resolved by country fallback: ${stats.countryFallbackCount}`);
  console.log(`- Resolved by property centroid: ${stats.cityCentroidCount}`);
  console.log(`- Missing coordinates: ${stats.missingCoordsCount}`);
  console.log(`- Properties filled from city coordinates: ${stats.propertyCityFallbackCount}`);
  console.log(`- Properties still missing coordinates: ${stats.propertyMissingCoordsCount}`);

  console.log("[6/7] Writing city dataset...");
  console.log(`- Output: ${options.output}`);
  await saveJson(options.output, cities);
  const mirroredCityRuntime = await mirrorRuntimeSnapshot(options.output, RUNTIME_CITIES_OUTPUT);

  console.log("[7/7] Writing normalized real estate graph...");
  console.log(`- Output: ${options.realestateOutput}`);

  const normalizedRealestate = buildNormalizedRealestate({
    cities,
    sourceInput: path.relative(process.cwd(), options.input),
  });

  await saveJson(options.realestateOutput, normalizedRealestate);
  const mirroredRealestateRuntime = await mirrorRuntimeSnapshot(
    options.realestateOutput,
    RUNTIME_REALESTATE_OUTPUT
  );

  const totalProperties = cities.reduce((sum, city) => sum + city.properties.length, 0);
  console.log(`- Wrote ${cities.length} cities with ${totalProperties} aggregated properties`);
  console.log(`- Wrote ${normalizedRealestate.stats.countries} countries to normalized graph`);
  if (mirroredCityRuntime) {
    console.log(`- Mirrored active runtime city snapshot: ${path.relative(process.cwd(), RUNTIME_CITIES_OUTPUT)}`);
  }
  if (mirroredRealestateRuntime) {
    console.log(
      `- Mirrored active runtime realestate snapshot: ${path.relative(process.cwd(), RUNTIME_REALESTATE_OUTPUT)}`
    );
  }
  console.log("- MVP layer 1 dataset is ready");
}

main().catch((error) => {
  console.error("City preprocessing failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
