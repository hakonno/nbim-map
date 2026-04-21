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
import { createSha1Id, sha1Digest } from "./lib/hash-utils.mjs";
import { parseNumber, parsePercent } from "./lib/number-utils.mjs";

const LEGACY_DEFAULT_INPUT = path.join(process.cwd(), "data", "raw", "re_20251231.csv");
const DEFAULT_INPUT = resolveActiveCsvInput(LEGACY_DEFAULT_INPUT);
const LEGACY_DEFAULT_OUTPUT = path.join(process.cwd(), "data", "properties.json");
const LEGACY_DEFAULT_COORDINATE_OUTPUT = path.join(process.cwd(), "data", "property-coordinates.json");
const LEGACY_DEFAULT_CACHE_FILE = path.join(process.cwd(), "data", "geocode-cache.json");
const DEFAULT_OUTPUT = resolveActiveReleaseFile("properties.json", LEGACY_DEFAULT_OUTPUT);
const DEFAULT_COORDINATE_OUTPUT = resolveActiveReleaseFile(
  "property-coordinates.json",
  LEGACY_DEFAULT_COORDINATE_OUTPUT
);
const DEFAULT_CACHE_FILE = resolveActiveReleaseFile("geocode-cache.json", LEGACY_DEFAULT_CACHE_FILE);

const DEFAULT_GEOCODER_BASE_URL = "https://nominatim.openstreetmap.org/search";
const DEFAULT_PHOTON_BASE_URL = "https://photon.komoot.io/api";
const DEFAULT_DELAY_MS = 250;
const DEFAULT_TIMEOUT_MS = 15000;
const MAX_US_ZIP_DISTANCE_KM = 120;

const HEADER_RULES = [
  { key: "region", required: true, aliases: ["region"] },
  { key: "country", required: true, aliases: ["country"] },
  { key: "address", required: true, aliases: ["address", "propertyaddress", "location"] },
  { key: "partnership", required: true, aliases: ["partnership", "partner", "owner"] },
  { key: "propertyType", required: false, aliases: ["industry", "propertytype", "type", "sector"] },
  { key: "ownershipPercent", required: true, aliases: ["ownership", "ownershippercent", "owned", "stake"] },
  { key: "valueNok", required: true, aliases: ["totalcountryvalue", "marketvalue", "valuenok", "value"] },
  { key: "valueUsd", required: false, aliases: ["totalcountryvalueusd", "marketvalueusd", "valueusd"] },
];

function parseArgs(argv) {
  const options = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    coordinateOutput: DEFAULT_COORDINATE_OUTPUT,
    cacheFile: DEFAULT_CACHE_FILE,
    geocoderBaseUrl: DEFAULT_GEOCODER_BASE_URL,
    photonBaseUrl: DEFAULT_PHOTON_BASE_URL,
    delayMs: DEFAULT_DELAY_MS,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    limit: null,
    noGeocode: false,
    enableNominatim: false,
    refreshCache: false,
    userAgent: "nbim-map-pregeocoder/1.0 (local preprocessing)",
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

    if (arg === "--coordinate-output" && argv[index + 1]) {
      options.coordinateOutput = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--cache-file" && argv[index + 1]) {
      options.cacheFile = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--geocoder-url" && argv[index + 1]) {
      options.geocoderBaseUrl = String(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--photon-url" && argv[index + 1]) {
      options.photonBaseUrl = String(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--delay-ms" && argv[index + 1]) {
      const parsed = Number(argv[index + 1]);
      if (Number.isFinite(parsed) && parsed >= 0) {
        options.delayMs = parsed;
      }
      index += 1;
      continue;
    }

    if (arg === "--timeout-ms" && argv[index + 1]) {
      const parsed = Number(argv[index + 1]);
      if (Number.isFinite(parsed) && parsed >= 1000) {
        options.timeoutMs = parsed;
      }
      index += 1;
      continue;
    }

    if (arg === "--limit" && argv[index + 1]) {
      const parsed = Number(argv[index + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.limit = Math.floor(parsed);
      }
      index += 1;
      continue;
    }

    if (arg === "--user-agent" && argv[index + 1]) {
      options.userAgent = String(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--no-geocode") {
      options.noGeocode = true;
      continue;
    }

    if (arg === "--enable-nominatim") {
      options.enableNominatim = true;
      continue;
    }

    if (arg === "--refresh-cache") {
      options.refreshCache = true;
      continue;
    }
  }

  return options;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function deriveNameFromAddress(address) {
  if (!address) {
    return null;
  }

  const firstPart = String(address).split(",")[0]?.trim();
  return firstPart || null;
}

function deriveCityFromAddress(address) {
  if (!address) {
    return null;
  }

  const parts = String(address)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  const lastPart = parts[parts.length - 1];
  const allUpperOrPostal = /^[0-9A-Z\- ]+$/.test(lastPart);
  if (allUpperOrPostal && parts.length > 1) {
    return parts[parts.length - 2];
  }

  return lastPart;
}

function getValue(values, index) {
  if (index === -1 || index == null) {
    return "";
  }

  return (values[index] ?? "").trim();
}

function toRawObject(headers, values) {
  const obj = {};
  for (let index = 0; index < headers.length; index += 1) {
    obj[headers[index]] = values[index] ?? "";
  }
  return obj;
}

function createPropertyId(record) {
  const key = [record.country, record.partnership, record.address, record.ownership_percent]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .join("|");

  return createSha1Id("prop", key, 16);
}

function createBuildCityPropertyId(country, partnership, address, ownershipRaw) {
  const key = [country, partnership, address, ownershipRaw].map((value) => String(value ?? "").trim()).join("|");
  return createSha1Id("prop", key, 14);
}

function createCacheKey(query) {
  return sha1Digest(String(query).trim().toLowerCase());
}

function sanitizeLatitude(value) {
  if (value == null) {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  if (parsed < -90 || parsed > 90) {
    return null;
  }
  return parsed;
}

function sanitizeLongitude(value) {
  if (value == null) {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  if (parsed < -180 || parsed > 180) {
    return null;
  }
  return parsed;
}

function splitAddressParts(address) {
  return String(address ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeStreetNumberRanges(value) {
  return String(value ?? "").replace(/\b(\d{1,6})-(\d{1,6})(?=\s+[A-Za-z])/g, "$1");
}

function normalizeAddressForQuery(address) {
  return normalizeStreetNumberRanges(String(address ?? "").replace(/\s+/g, " ").trim());
}

function stripLikelyPropertyName(address) {
  const parts = splitAddressParts(address);
  if (parts.length < 2) {
    return normalizeAddressForQuery(address);
  }

  const first = parts[0];
  const second = parts[1];
  const firstHasDigit = /\d/.test(first);
  const duplicatedPrefix = normalizeText(first) === normalizeText(second);

  if (!firstHasDigit || duplicatedPrefix) {
    return normalizeAddressForQuery(parts.slice(1).join(", "));
  }

  return normalizeAddressForQuery(parts.join(", "));
}

function isUnitedStates(country) {
  return normalizeText(country) === "unitedstates";
}

function normalizeUsZip(value) {
  const match = String(value ?? "").match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : null;
}

function extractUsZipFromAddress(address) {
  return normalizeUsZip(address);
}

function haversineDistanceKm(aLat, aLng, bLat, bLng) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const a = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function resolveCountryCenter(country) {
  const countryKey = normalizeText(country);
  const entry = COUNTRY_CENTERS[countryKey];
  if (!entry) {
    return null;
  }

  return {
    lat: entry[0],
    lng: entry[1],
    source: "country_center_fallback",
  };
}

function uniqueQueryCandidates(candidates) {
  const seen = new Set();
  const output = [];

  for (const candidate of candidates) {
    const query = String(candidate.query ?? "").trim();
    if (!query) {
      continue;
    }

    const key = query.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push({ ...candidate, query });
  }

  return output;
}

function buildGeocodeCandidates(record, geocodeContext = {}) {
  const address = normalizeAddressForQuery(record.address);
  const coreAddress = stripLikelyPropertyName(record.address);
  const addressMainSegment = splitAddressParts(coreAddress)[0] ?? "";
  const city = String(record.city ?? "").trim();
  const country = String(record.country ?? "").trim();
  const usState = String(geocodeContext.usState ?? "").trim();
  const usZip = String(geocodeContext.usZip ?? "").trim();

  const countryAwareCoreAddress = coreAddress
    ? [coreAddress, isUnitedStates(country) ? usState || null : null, country].filter(Boolean).join(", ")
    : "";

  const streetCityStateQuery =
    addressMainSegment && city && country
      ? [
          addressMainSegment,
          city,
          isUnitedStates(country) ? usState || null : null,
          isUnitedStates(country) ? usZip || null : null,
          country,
        ]
          .filter(Boolean)
          .join(", ")
      : "";

  const rawCandidates = [
    {
      label: "address_core_country",
      query: countryAwareCoreAddress,
    },
    {
      label: "street_city_country",
      query: streetCityStateQuery,
    },
    {
      label: "address_country",
      query: address && country ? `${address}, ${country}` : "",
    },
    {
      label: "address_city_country",
      query: address && city && country ? `${address}, ${city}, ${country}` : "",
    },
    {
      label: "name_city_state_country",
      query:
        record.name && city && country && isUnitedStates(country) && usState
          ? `${record.name}, ${city}, ${usState}, ${country}`
          : "",
    },
    {
      label: "name_city_country",
      query: record.name && city && country ? `${record.name}, ${city}, ${country}` : "",
    },
    {
      label: "city_state_country",
      query: city && country && isUnitedStates(country) && usState ? `${city}, ${usState}, ${country}` : "",
    },
    {
      label: "city_country",
      query: city && country ? `${city}, ${country}` : "",
    },
  ];

  return uniqueQueryCandidates(rawCandidates);
}

async function loadGeocodeCache(filePath, refreshCache) {
  if (refreshCache) {
    return {
      version: 1,
      provider: "nominatim",
      entries: {},
    };
  }

  const existing = await readJsonIfExists(filePath, null);
  if (!existing || typeof existing !== "object") {
    return {
      version: 1,
      provider: "nominatim",
      entries: {},
    };
  }

  return {
    version: 1,
    provider: "nominatim",
    entries: typeof existing.entries === "object" && existing.entries ? existing.entries : {},
  };
}

function createRateLimiter(delayMs) {
  let nextAllowedAt = 0;

  return async function waitForTurn() {
    const now = Date.now();
    const waitMs = nextAllowedAt - now;
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    nextAllowedAt = Date.now() + delayMs;
  };
}

async function geocodeWithNominatim(query, options, waitForTurn) {
  await waitForTurn();

  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "1",
    addressdetails: "1",
  });

  const url = `${options.geocoderBaseUrl}?${params.toString()}`;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": options.userAgent,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxAttempts) {
          await sleep(400 * attempt);
          continue;
        }
      }

      if (!response.ok) {
        throw new Error(`Geocoder response ${response.status}`);
      }

      const payload = await response.json();
      if (!Array.isArray(payload) || payload.length === 0) {
        return null;
      }

      const first = payload[0];
      const lat = sanitizeLatitude(first.lat);
      const lng = sanitizeLongitude(first.lon);
      const address = first.address && typeof first.address === "object" ? first.address : {};

      if (lat == null || lng == null) {
        return null;
      }

      return {
        lat,
        lng,
        display_name: String(first.display_name ?? ""),
        country: String(address.country ?? ""),
        country_code: String(address.country_code ?? ""),
        city: String(
          address.city ?? address.town ?? address.village ?? address.municipality ?? address.county ?? "",
        ),
        state: String(address.state ?? ""),
        postcode: String(address.postcode ?? ""),
        provider: "nominatim",
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}

async function geocodeWithPhoton(query, options, waitForTurn) {
  await waitForTurn();

  const params = new URLSearchParams({
    q: query,
    limit: "1",
  });

  const url = `${options.photonBaseUrl}?${params.toString()}`;
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": options.userAgent,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxAttempts) {
          await sleep(400 * attempt);
          continue;
        }
      }

      if (!response.ok) {
        throw new Error(`Photon response ${response.status}`);
      }

      const payload = await response.json();
      const features = Array.isArray(payload?.features) ? payload.features : [];

      if (features.length === 0) {
        return null;
      }

      const coordinates = features[0]?.geometry?.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) {
        return null;
      }

      const lng = sanitizeLongitude(coordinates[0]);
      const lat = sanitizeLatitude(coordinates[1]);
      const properties =
        features[0]?.properties && typeof features[0].properties === "object" ? features[0].properties : {};

      if (lat == null || lng == null) {
        return null;
      }

      return {
        lat,
        lng,
        display_name: String(properties.name ?? ""),
        country: String(properties.country ?? ""),
        country_code: String(properties.countrycode ?? ""),
        city: String(properties.city ?? properties.town ?? properties.village ?? properties.locality ?? ""),
        state: String(properties.state ?? properties.region ?? ""),
        postcode: String(properties.postcode ?? ""),
        provider: "photon",
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}

function normalizeCountryCode(value) {
  const normalized = normalizeText(value);
  return normalized.slice(0, 2);
}

function countryMatches(recordCountry, geocodeResult) {
  if (!recordCountry) {
    return true;
  }

  const expectedCountry = normalizeText(recordCountry);
  const actualCountry = normalizeText(geocodeResult.country ?? "");
  if (actualCountry && expectedCountry && actualCountry !== expectedCountry) {
    return false;
  }

  if (expectedCountry === "unitedstates") {
    const countryCode = normalizeCountryCode(geocodeResult.country_code ?? "");
    if (countryCode && countryCode !== "us") {
      return false;
    }
  }

  return true;
}

function validateGeocodeResult(record, geocodeResult, usZipContext) {
  if (!countryMatches(record.country, geocodeResult)) {
    return { valid: false, reason: "country_mismatch" };
  }

  if (!isUnitedStates(record.country) || !usZipContext?.usZip) {
    return { valid: true, reason: null };
  }

  const resultZip =
    normalizeUsZip(geocodeResult.postcode) ||
    normalizeUsZip(geocodeResult.display_name) ||
    normalizeUsZip(geocodeResult.city);

  if (resultZip && resultZip !== usZipContext.usZip) {
    return { valid: false, reason: "zip_mismatch" };
  }

  const zipLat = sanitizeLatitude(usZipContext.usZipLat);
  const zipLng = sanitizeLongitude(usZipContext.usZipLng);
  if (zipLat == null || zipLng == null) {
    return { valid: true, reason: null };
  }

  const distance = haversineDistanceKm(zipLat, zipLng, geocodeResult.lat, geocodeResult.lng);
  if (distance > MAX_US_ZIP_DISTANCE_KM) {
    return { valid: false, reason: "zip_distance" };
  }

  return { valid: true, reason: null };
}

async function resolveUsZipContext(record, options, cache, waitForTurn, stats, zipContextCache) {
  const emptyContext = {
    usZip: null,
    usState: null,
    usZipLat: null,
    usZipLng: null,
  };

  if (!isUnitedStates(record.country)) {
    return emptyContext;
  }

  const usZip = extractUsZipFromAddress(record.address);
  if (!usZip) {
    return emptyContext;
  }

  const cachedContext = zipContextCache.get(usZip);
  if (cachedContext) {
    stats.usZipCacheHits += 1;
    return cachedContext;
  }

  const query = `${usZip}, ${record.country}`;
  const cacheKey = createCacheKey(query);
  const cacheEntry = cache.entries[cacheKey];

  if (cacheEntry && cacheEntry.status === "ok") {
    const context = {
      usZip,
      usState: String(cacheEntry.state ?? "").trim() || null,
      usZipLat: sanitizeLatitude(cacheEntry.lat),
      usZipLng: sanitizeLongitude(cacheEntry.lng),
    };
    zipContextCache.set(usZip, context);
    stats.usZipCacheHits += 1;
    return context;
  }

  if (cacheEntry && (cacheEntry.status === "not_found" || cacheEntry.status === "invalid")) {
    const context = {
      usZip,
      usState: null,
      usZipLat: null,
      usZipLng: null,
    };
    zipContextCache.set(usZip, context);
    return context;
  }

  if (options.noGeocode) {
    const context = {
      usZip,
      usState: null,
      usZipLat: null,
      usZipLng: null,
    };
    zipContextCache.set(usZip, context);
    return context;
  }

  let geocodeResult = null;
  let hadRequestError = false;

  try {
    geocodeResult = await geocodeWithPhoton(query, options, waitForTurn);
  } catch {
    stats.photonRequestErrors += 1;
    hadRequestError = true;
  }

  if (!geocodeResult && options.enableNominatim) {
    try {
      geocodeResult = await geocodeWithNominatim(query, options, waitForTurn);
    } catch {
      stats.nominatimRequestErrors += 1;
      hadRequestError = true;
    }
  }

  if (geocodeResult) {
    cache.entries[cacheKey] = {
      status: "ok",
      lat: geocodeResult.lat,
      lng: geocodeResult.lng,
      display_name: geocodeResult.display_name,
      provider: geocodeResult.provider,
      country: geocodeResult.country,
      country_code: geocodeResult.country_code,
      city: geocodeResult.city,
      state: geocodeResult.state,
      postcode: geocodeResult.postcode,
      query,
      updated_at: new Date().toISOString(),
    };

    const context = {
      usZip,
      usState: String(geocodeResult.state ?? "").trim() || null,
      usZipLat: geocodeResult.lat,
      usZipLng: geocodeResult.lng,
    };
    zipContextCache.set(usZip, context);
    stats.usZipResolved += 1;
    return context;
  }

  if (!hadRequestError) {
    cache.entries[cacheKey] = {
      status: "not_found",
      query,
      updated_at: new Date().toISOString(),
    };
  }

  const context = {
    usZip,
    usState: null,
    usZipLat: null,
    usZipLng: null,
  };
  zipContextCache.set(usZip, context);
  return context;
}

async function resolveRecordCoordinates(record, options, cache, waitForTurn, stats, zipContextCache) {
  const usZipContext = await resolveUsZipContext(record, options, cache, waitForTurn, stats, zipContextCache);
  const candidates = buildGeocodeCandidates(record, usZipContext);

  for (const candidate of candidates) {
    const cacheKey = createCacheKey(candidate.query);
    const cached = cache.entries[cacheKey];

    if (cached && cached.status === "ok") {
      const lat = sanitizeLatitude(cached.lat);
      const lng = sanitizeLongitude(cached.lng);

      if (lat != null && lng != null) {
        const validation = validateGeocodeResult(
          record,
          {
            lat,
            lng,
            display_name: String(cached.display_name ?? ""),
            country: String(cached.country ?? ""),
            country_code: String(cached.country_code ?? ""),
            city: String(cached.city ?? ""),
            state: String(cached.state ?? ""),
            postcode: String(cached.postcode ?? ""),
          },
          usZipContext,
        );

        if (validation.valid) {
          stats.cacheHits += 1;
          return {
            lat,
            lng,
            source: `cache_${candidate.label}`,
            geocode_query: candidate.query,
          };
        }

        cache.entries[cacheKey] = {
          ...cached,
          status: "invalid",
          invalid_reason: validation.reason,
          updated_at: new Date().toISOString(),
        };
        stats.cacheRejected += 1;
      }
    }

    if (cached && (cached.status === "not_found" || cached.status === "invalid")) {
      stats.cacheMisses += 1;
      continue;
    }

    if (options.noGeocode) {
      continue;
    }

    let geocodeResult = null;
    let hadRequestError = false;

    try {
      geocodeResult = await geocodeWithPhoton(candidate.query, options, waitForTurn);
    } catch {
      stats.photonRequestErrors += 1;
      hadRequestError = true;
    }

    if (!geocodeResult && options.enableNominatim) {
      try {
        geocodeResult = await geocodeWithNominatim(candidate.query, options, waitForTurn);
      } catch {
        stats.nominatimRequestErrors += 1;
        hadRequestError = true;
      }
    }

    if (geocodeResult) {
      const validation = validateGeocodeResult(record, geocodeResult, usZipContext);
      if (!validation.valid) {
        cache.entries[cacheKey] = {
          status: "invalid",
          query: candidate.query,
          lat: geocodeResult.lat,
          lng: geocodeResult.lng,
          display_name: geocodeResult.display_name,
          provider: geocodeResult.provider,
          country: geocodeResult.country,
          country_code: geocodeResult.country_code,
          city: geocodeResult.city,
          state: geocodeResult.state,
          postcode: geocodeResult.postcode,
          invalid_reason: validation.reason,
          updated_at: new Date().toISOString(),
        };
        stats.geocodeRejected += 1;
        continue;
      }

      cache.entries[cacheKey] = {
        status: "ok",
        lat: geocodeResult.lat,
        lng: geocodeResult.lng,
        display_name: geocodeResult.display_name,
        provider: geocodeResult.provider,
        country: geocodeResult.country,
        country_code: geocodeResult.country_code,
        city: geocodeResult.city,
        state: geocodeResult.state,
        postcode: geocodeResult.postcode,
        query: candidate.query,
        updated_at: new Date().toISOString(),
      };

      if (candidate.label === "city_country" || candidate.label === "city_state_country") {
        stats.cityLevelGeocoded += 1;
      } else {
        stats.addressLevelGeocoded += 1;
      }

      if (geocodeResult.provider === "photon") {
        stats.photonResolved += 1;
      }

      return {
        lat: geocodeResult.lat,
        lng: geocodeResult.lng,
        source: `${candidate.label}_${geocodeResult.provider}`,
        geocode_query: candidate.query,
      };
    }

    if (hadRequestError) {
      continue;
    }

    cache.entries[cacheKey] = {
      status: "not_found",
      query: candidate.query,
      updated_at: new Date().toISOString(),
    };
  }

  const countryFallback = resolveCountryCenter(record.country);
  if (countryFallback) {
    stats.countryFallback += 1;
    return {
      lat: countryFallback.lat,
      lng: countryFallback.lng,
      source: countryFallback.source,
      geocode_query: null,
    };
  }

  stats.unresolved += 1;
  return {
    lat: null,
    lng: null,
    source: "missing",
    geocode_query: null,
  };
}

async function loadCsvInput(inputPath) {
  const rawBuffer = await fs.readFile(inputPath);
  const encoding = detectEncoding(rawBuffer);
  const decoded = decodeBuffer(rawBuffer, encoding);

  const lines = parseNonEmptyLines(decoded);
  if (lines.length < 2) {
    throw new Error("CSV file is empty or missing data rows");
  }

  return {
    encoding,
    headers: parseCsvLine(lines[0]),
    rows: lines.slice(1).map((line) => parseCsvLine(line)),
  };
}

function mapRowsToRecords(rows, headers, mappedHeaders) {
  return rows.map((values) => {
    const address = getValue(values, mappedHeaders.address);
    const ownershipPercentRaw = getValue(values, mappedHeaders.ownershipPercent);
    const country = getValue(values, mappedHeaders.country) || null;
    const partnership = getValue(values, mappedHeaders.partnership) || null;

    const record = {
      region: getValue(values, mappedHeaders.region) || null,
      country,
      partnership,
      property_type: getValue(values, mappedHeaders.propertyType) || null,
      name: deriveNameFromAddress(address),
      address: address || null,
      city: deriveCityFromAddress(address),
      ownership_percent: parsePercent(ownershipPercentRaw),
      value_original: parseNumber(getValue(values, mappedHeaders.valueNok)),
      currency_original: "NOK",
      value_nok_source: parseNumber(getValue(values, mappedHeaders.valueNok)),
      value_usd_source: parseNumber(getValue(values, mappedHeaders.valueUsd)),
      _raw: toRawObject(headers, values),
    };

    record.id = createPropertyId(record);
    record._build_city_property_id = createBuildCityPropertyId(country, partnership, address, ownershipPercentRaw);

    return record;
  });
}

function logMappedHeaders(mappedHeaders, headers) {
  for (const [field, index] of Object.entries(mappedHeaders)) {
    const label = index === -1 ? "(not mapped)" : headers[index];
    console.log(`- ${field}: ${label}`);
  }
}

function createGeocodeStats() {
  return {
    cacheHits: 0,
    cacheMisses: 0,
    cacheRejected: 0,
    geocodeRejected: 0,
    usZipCacheHits: 0,
    usZipResolved: 0,
    addressLevelGeocoded: 0,
    cityLevelGeocoded: 0,
    photonResolved: 0,
    countryFallback: 0,
    unresolved: 0,
    nominatimRequestErrors: 0,
    photonRequestErrors: 0,
  };
}

async function geocodeRecords(records, options, cache) {
  const waitForTurn = createRateLimiter(options.delayMs);
  const stats = createGeocodeStats();
  const coordinateEntries = {};
  const zipContextCache = new Map();

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const resolved = await resolveRecordCoordinates(record, options, cache, waitForTurn, stats, zipContextCache);

    record.lat = resolved.lat;
    record.lng = resolved.lng;
    record.coordinate_source = resolved.source;

    coordinateEntries[record._build_city_property_id] = {
      lat: resolved.lat,
      lng: resolved.lng,
      source: resolved.source,
      geocode_query: resolved.geocode_query,
      address: record.address,
      city: record.city,
      country: record.country,
      updated_at: new Date().toISOString(),
    };

    const processed = index + 1;
    if (processed === 1 || processed % 10 === 0 || processed === records.length) {
      console.log(`- Geocoded ${processed}/${records.length}`);
    }
  }

  return {
    coordinateEntries,
    stats,
  };
}

function stripBuildCityPropertyId(records) {
  return records.map((record) => {
    const rest = { ...record };
    delete rest._build_city_property_id;
    return rest;
  });
}

async function writeOutputs({ options, inputPath, records, coordinateEntries, cache }) {
  const outputRows = stripBuildCityPropertyId(records);

  await saveJson(options.output, outputRows);
  await saveJson(options.coordinateOutput, {
    generated_at: new Date().toISOString(),
    source_input: path.relative(process.cwd(), inputPath),
    total_records: outputRows.length,
    entries: coordinateEntries,
  });
  await saveJson(options.cacheFile, cache);

  return outputRows.length;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  console.log("[1/4] Parsing CSV input...");
  console.log(`- Input file: ${options.input}`);

  const { encoding, headers, rows } = await loadCsvInput(options.input);

  console.log(`- Encoding detected: ${encoding}`);
  console.log("- Delimiter: ;");
  console.log(`- Headers found: ${headers.length}`);
  console.log(`- Data rows found: ${rows.length}`);

  console.log("[2/4] Mapping fields dynamically from detected headers...");
  const mappedHeaders = mapHeaders(headers, HEADER_RULES);
  logMappedHeaders(mappedHeaders, headers);

  const parsedRecords = mapRowsToRecords(rows, headers, mappedHeaders);
  const records = options.limit ? parsedRecords.slice(0, options.limit) : parsedRecords;

  if (options.limit) {
    console.log(`- Applying --limit: processing ${records.length} records`);
  }

  console.log("[3/4] Pre-geocoding property coordinates...");
  console.log(`- Geocoder: ${options.geocoderBaseUrl}`);
  console.log(`- Fallback geocoder: ${options.photonBaseUrl}`);
  console.log(`- Nominatim enabled: ${options.enableNominatim ? "yes" : "no"}`);
  console.log(`- Cache: ${options.cacheFile}`);
  console.log(`- Coordinate sidecar output: ${options.coordinateOutput}`);

  const cache = await loadGeocodeCache(options.cacheFile, options.refreshCache);
  const { coordinateEntries, stats } = await geocodeRecords(records, options, cache);

  console.log("[4/4] Writing outputs...");
  console.log(`- Properties output: ${options.output}`);

  const totalRecords = await writeOutputs({
    options,
    inputPath: options.input,
    records,
    coordinateEntries,
    cache,
  });

  console.log(`- Wrote ${totalRecords} records`);
  console.log(`- Cache hits: ${stats.cacheHits}`);
  console.log(`- Cache not-found skips: ${stats.cacheMisses}`);
  console.log(`- Cache entries rejected by validation: ${stats.cacheRejected}`);
  console.log(`- Live geocode results rejected by validation: ${stats.geocodeRejected}`);
  console.log(`- US ZIP context cache hits: ${stats.usZipCacheHits}`);
  console.log(`- US ZIP contexts resolved live: ${stats.usZipResolved}`);
  console.log(`- Address-level geocodes: ${stats.addressLevelGeocoded}`);
  console.log(`- City-level geocodes: ${stats.cityLevelGeocoded}`);
  console.log(`- Resolved via Photon fallback: ${stats.photonResolved}`);
  console.log(`- Country fallback coordinates: ${stats.countryFallback}`);
  console.log(`- Unresolved coordinates: ${stats.unresolved}`);
  console.log(`- Nominatim request errors: ${stats.nominatimRequestErrors}`);
  console.log(`- Photon request errors: ${stats.photonRequestErrors}`);
  console.log("- Property pre-geocoding complete");
}

main().catch((error) => {
  console.error("Pipeline failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
