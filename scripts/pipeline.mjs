import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_INPUT = path.join(process.cwd(), "data", "raw", "re_20251231.csv");
const DEFAULT_OUTPUT = path.join(process.cwd(), "data", "properties.json");
const DEFAULT_COORDINATE_OUTPUT = path.join(process.cwd(), "data", "property-coordinates.json");
const DEFAULT_CACHE_FILE = path.join(process.cwd(), "data", "geocode-cache.json");

const DEFAULT_GEOCODER_BASE_URL = "https://nominatim.openstreetmap.org/search";
const DEFAULT_PHOTON_BASE_URL = "https://photon.komoot.io/api";
const DEFAULT_DELAY_MS = 250;
const DEFAULT_TIMEOUT_MS = 15000;

const COUNTRY_CENTERS = {
  belgium: [50.8333, 4.4699],
  czechrepublic: [49.8175, 15.473],
  france: [46.2276, 2.2137],
  germany: [51.1657, 10.4515],
  hungary: [47.1625, 19.5033],
  internationalfund: [20, 0],
  italy: [41.8719, 12.5674],
  japan: [36.2048, 138.2529],
  netherlands: [52.1326, 5.2913],
  poland: [51.9194, 19.1451],
  spain: [40.4637, -3.7492],
  sweden: [60.1282, 18.6435],
  switzerland: [46.8182, 8.2275],
  unitedkingdom: [55.3781, -3.436],
  unitedstates: [39.8283, -98.5795],
};

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

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function detectEncoding(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return "utf16le";
  }

  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return "utf16be";
  }

  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return "utf8";
  }

  const sampleLength = Math.min(buffer.length, 4096);
  let nullByteCount = 0;
  for (let i = 0; i < sampleLength; i += 1) {
    if (buffer[i] === 0x00) {
      nullByteCount += 1;
    }
  }

  if (sampleLength > 0 && nullByteCount / sampleLength > 0.2) {
    return "utf16le";
  }

  return "utf8";
}

function decodeBuffer(buffer, encoding) {
  if (encoding === "utf16be") {
    const swapped = Buffer.allocUnsafe(buffer.length - 2);
    for (let i = 2; i < buffer.length; i += 2) {
      swapped[i - 2] = buffer[i + 1] ?? 0;
      swapped[i - 1] = buffer[i];
    }
    return swapped.toString("utf16le");
  }

  if (encoding === "utf16le") {
    const offset = buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe ? 2 : 0;
    return buffer.slice(offset).toString("utf16le");
  }

  const offset =
    buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf ? 3 : 0;
  return buffer.slice(offset).toString("utf8");
}

function parseCsvLine(line, delimiter = ";") {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      const nextChar = line[index + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function normalizeHeader(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function scoreHeaderMatch(header, alias) {
  if (header === alias) {
    return 100;
  }

  if (header.includes(alias)) {
    return 80;
  }

  if (alias.includes(header) && header.length >= 4) {
    return 70;
  }

  return 0;
}

function mapHeaders(headers) {
  const normalizedHeaders = headers.map(normalizeHeader);

  const rules = [
    { key: "region", required: true, aliases: ["region"] },
    { key: "country", required: true, aliases: ["country"] },
    { key: "address", required: true, aliases: ["address", "propertyaddress", "location"] },
    { key: "partnership", required: true, aliases: ["partnership", "partner", "owner"] },
    { key: "propertyType", required: false, aliases: ["industry", "propertytype", "type", "sector"] },
    {
      key: "ownershipPercent",
      required: true,
      aliases: ["ownership", "ownershippercent", "owned", "stake"],
    },
    {
      key: "valueNok",
      required: true,
      aliases: ["totalcountryvalue", "marketvalue", "valuenok", "value"],
    },
    {
      key: "valueUsd",
      required: false,
      aliases: ["totalcountryvalueusd", "marketvalueusd", "valueusd"],
    },
  ];

  const usedIndices = new Set();
  const result = {};

  for (const rule of rules) {
    let bestIndex = -1;
    let bestScore = -1;

    for (let index = 0; index < normalizedHeaders.length; index += 1) {
      if (usedIndices.has(index)) {
        continue;
      }

      const header = normalizedHeaders[index];
      let score = 0;
      for (const alias of rule.aliases) {
        const aliasScore = scoreHeaderMatch(header, alias);
        if (aliasScore > score) {
          score = aliasScore;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    if (bestScore <= 0) {
      bestIndex = -1;
    }

    if (rule.required && bestIndex === -1) {
      throw new Error(`Missing required column for ${rule.key}`);
    }

    if (bestIndex !== -1) {
      usedIndices.add(bestIndex);
    }

    result[rule.key] = bestIndex;
  }

  return result;
}

function parseNumber(value) {
  if (!value) {
    return null;
  }

  let cleaned = String(value).trim();
  if (!cleaned) {
    return null;
  }

  cleaned = cleaned.replace(/[\s\u00a0]/g, "");

  if (cleaned.includes(",") && cleaned.includes(".")) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      cleaned = cleaned.replace(/\./g, "").replace(/,/g, ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (cleaned.includes(",")) {
    if (/,[0-9]{1,4}$/.test(cleaned)) {
      cleaned = cleaned.replace(/,/g, ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  }

  cleaned = cleaned.replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOwnershipPercent(value) {
  if (!value) {
    return null;
  }
  return parseNumber(String(value).replace(/%/g, ""));
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

function createPropertyId(record) {
  const key = [record.country, record.partnership, record.address, record.ownership_percent]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .join("|");

  return `prop_${crypto.createHash("sha1").update(key).digest("hex").slice(0, 16)}`;
}

function createCityBuildPropertyId(country, partnership, address, ownershipRaw) {
  const key = [country, partnership, address, ownershipRaw].map((value) => String(value ?? "").trim()).join("|");
  return `prop_${crypto.createHash("sha1").update(key).digest("hex").slice(0, 14)}`;
}

function toRawObject(headers, values) {
  const obj = {};
  for (let index = 0; index < headers.length; index += 1) {
    obj[headers[index]] = values[index] ?? "";
  }
  return obj;
}

function getValue(values, index) {
  if (index === -1 || index == null) {
    return "";
  }
  return (values[index] ?? "").trim();
}

function createCacheKey(query) {
  return crypto.createHash("sha1").update(String(query).trim().toLowerCase()).digest("hex");
}

function sanitizeCoordinate(value) {
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

function buildGeocodeCandidates(record) {
  const address = String(record.address ?? "").trim();
  const city = String(record.city ?? "").trim();
  const country = String(record.country ?? "").trim();

  const rawCandidates = [
    {
      label: "address_country",
      query: address && country ? `${address}, ${country}` : "",
    },
    {
      label: "address_city_country",
      query: address && city && country ? `${address}, ${city}, ${country}` : "",
    },
    {
      label: "name_city_country",
      query: record.name && city && country ? `${record.name}, ${city}, ${country}` : "",
    },
    {
      label: "city_country",
      query: city && country ? `${city}, ${country}` : "",
    },
  ];

  return uniqueQueryCandidates(rawCandidates);
}

async function readJsonIfExists(filePath, fallbackValue) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    return JSON.parse(text);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return fallbackValue;
    }

    throw error;
  }
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

async function saveJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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
    addressdetails: "0",
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
      const lat = sanitizeCoordinate(first.lat);
      const lng = sanitizeCoordinate(first.lon);

      if (lat == null || lng == null) {
        return null;
      }

      return {
        lat,
        lng,
        display_name: String(first.display_name ?? ""),
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

      const lng = sanitizeCoordinate(coordinates[0]);
      const lat = sanitizeCoordinate(coordinates[1]);

      if (lat == null || lng == null) {
        return null;
      }

      return {
        lat,
        lng,
        display_name: String(features[0]?.properties?.name ?? ""),
        provider: "photon",
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}

async function resolveRecordCoordinates(record, options, cache, waitForTurn, stats) {
  const candidates = buildGeocodeCandidates(record);

  for (const candidate of candidates) {
    const cacheKey = createCacheKey(candidate.query);
    const cached = cache.entries[cacheKey];

    if (cached && cached.status === "ok") {
      const lat = sanitizeCoordinate(cached.lat);
      const lng = sanitizeCoordinate(cached.lng);
      if (lat != null && lng != null) {
        stats.cacheHits += 1;
        return {
          lat,
          lng,
          source: `cache_${candidate.label}`,
          geocode_query: candidate.query,
        };
      }
    }

    if (cached && cached.status === "not_found") {
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
      cache.entries[cacheKey] = {
        status: "ok",
        lat: geocodeResult.lat,
        lng: geocodeResult.lng,
        display_name: geocodeResult.display_name,
        provider: geocodeResult.provider,
        query: candidate.query,
        updated_at: new Date().toISOString(),
      };

      if (candidate.label === "city_country") {
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

async function main() {
  const options = parseArgs(process.argv.slice(2));

  console.log("[1/4] Parsing CSV input...");
  console.log(`- Input file: ${options.input}`);

  const rawBuffer = await fs.readFile(options.input);
  const encoding = detectEncoding(rawBuffer);
  const decoded = decodeBuffer(rawBuffer, encoding);

  const lines = decoded
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("CSV file is empty or missing data rows");
  }

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => parseCsvLine(line));

  console.log(`- Encoding detected: ${encoding}`);
  console.log("- Delimiter: ;");
  console.log(`- Headers found: ${headers.length}`);
  console.log(`- Data rows found: ${rows.length}`);

  console.log("[2/4] Mapping fields dynamically from detected headers...");
  const mapped = mapHeaders(headers);

  for (const [field, index] of Object.entries(mapped)) {
    const label = index === -1 ? "(not mapped)" : headers[index];
    console.log(`- ${field}: ${label}`);
  }

  const parsedRecords = rows.map((values) => {
    const address = getValue(values, mapped.address);
    const ownershipPercentRaw = getValue(values, mapped.ownershipPercent);
    const country = getValue(values, mapped.country) || null;
    const partnership = getValue(values, mapped.partnership) || null;

    const record = {
      region: getValue(values, mapped.region) || null,
      country,
      partnership,
      property_type: getValue(values, mapped.propertyType) || null,
      name: deriveNameFromAddress(address),
      address: address || null,
      city: deriveCityFromAddress(address),
      ownership_percent: parseOwnershipPercent(ownershipPercentRaw),
      value_original: parseNumber(getValue(values, mapped.valueNok)),
      currency_original: "NOK",
      value_nok_source: parseNumber(getValue(values, mapped.valueNok)),
      value_usd_source: parseNumber(getValue(values, mapped.valueUsd)),
      _raw: toRawObject(headers, values),
    };

    record.id = createPropertyId(record);
    record._build_city_property_id = createCityBuildPropertyId(
      country,
      partnership,
      address,
      ownershipPercentRaw
    );

    return record;
  });

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
  const waitForTurn = createRateLimiter(options.delayMs);

  const stats = {
    cacheHits: 0,
    cacheMisses: 0,
    addressLevelGeocoded: 0,
    cityLevelGeocoded: 0,
    photonResolved: 0,
    countryFallback: 0,
    unresolved: 0,
    nominatimRequestErrors: 0,
    photonRequestErrors: 0,
  };

  const coordinateEntries = {};

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const resolved = await resolveRecordCoordinates(record, options, cache, waitForTurn, stats);

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

  console.log("[4/4] Writing outputs...");
  console.log(`- Properties output: ${options.output}`);

  const outputRows = records.map((record) => {
    const rest = { ...record };
    delete rest._build_city_property_id;
    return rest;
  });

  await saveJson(options.output, outputRows);
  await saveJson(options.coordinateOutput, {
    generated_at: new Date().toISOString(),
    source_input: path.relative(process.cwd(), options.input),
    total_records: outputRows.length,
    entries: coordinateEntries,
  });
  await saveJson(options.cacheFile, cache);

  console.log(`- Wrote ${outputRows.length} records`);
  console.log(`- Cache hits: ${stats.cacheHits}`);
  console.log(`- Cache not-found skips: ${stats.cacheMisses}`);
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
