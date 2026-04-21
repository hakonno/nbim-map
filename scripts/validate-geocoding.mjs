import path from "node:path";
import process from "node:process";

import {
  resolveActiveReleaseDir,
  resolveActiveReleaseFile,
} from "./lib/active-dataset.mjs";
import { normalizeText } from "./lib/csv-utils.mjs";
import { readJsonIfExists, saveJson } from "./lib/fs-json-utils.mjs";

const LEGACY_DEFAULT_COORDINATE_FILE = path.join(process.cwd(), "data", "property-coordinates.json");
const LEGACY_DEFAULT_CACHE_FILE = path.join(process.cwd(), "data", "geocode-cache.json");
const DEFAULT_COORDINATE_FILE = resolveActiveReleaseFile(
  "property-coordinates.json",
  LEGACY_DEFAULT_COORDINATE_FILE
);
const DEFAULT_CACHE_FILE = resolveActiveReleaseFile("geocode-cache.json", LEGACY_DEFAULT_CACHE_FILE);
const DEFAULT_REPORT_FILE = path.join(
  resolveActiveReleaseDir(path.join(process.cwd(), "data")),
  "geocode-validation.json"
);

const DEFAULT_MAX_US_ZIP_DISTANCE_KM = 120;
const DEFAULT_CITY_OUTLIER_WARN_KM = 100;
const DEFAULT_CITY_OUTLIER_ERROR_KM = 180;
const MIN_CITY_CLUSTER_SIZE = 8;

const US_STATE_MAP = {
  AL: "AL",
  ALABAMA: "AL",
  AK: "AK",
  ALASKA: "AK",
  AZ: "AZ",
  ARIZONA: "AZ",
  AR: "AR",
  ARKANSAS: "AR",
  CA: "CA",
  CALIFORNIA: "CA",
  CO: "CO",
  COLORADO: "CO",
  CT: "CT",
  CONNECTICUT: "CT",
  DE: "DE",
  DELAWARE: "DE",
  FL: "FL",
  FLORIDA: "FL",
  GA: "GA",
  GEORGIA: "GA",
  HI: "HI",
  HAWAII: "HI",
  ID: "ID",
  IDAHO: "ID",
  IL: "IL",
  ILLINOIS: "IL",
  IN: "IN",
  INDIANA: "IN",
  IA: "IA",
  IOWA: "IA",
  KS: "KS",
  KANSAS: "KS",
  KY: "KY",
  KENTUCKY: "KY",
  LA: "LA",
  LOUISIANA: "LA",
  ME: "ME",
  MAINE: "ME",
  MD: "MD",
  MARYLAND: "MD",
  MA: "MA",
  MASSACHUSETTS: "MA",
  MI: "MI",
  MICHIGAN: "MI",
  MN: "MN",
  MINNESOTA: "MN",
  MS: "MS",
  MISSISSIPPI: "MS",
  MO: "MO",
  MISSOURI: "MO",
  MT: "MT",
  MONTANA: "MT",
  NE: "NE",
  NEBRASKA: "NE",
  NV: "NV",
  NEVADA: "NV",
  NH: "NH",
  NEWHAMPSHIRE: "NH",
  NJ: "NJ",
  NEWJERSEY: "NJ",
  NM: "NM",
  NEWMEXICO: "NM",
  NY: "NY",
  NEWYORK: "NY",
  NC: "NC",
  NORTHCAROLINA: "NC",
  ND: "ND",
  NORTHDAKOTA: "ND",
  OH: "OH",
  OHIO: "OH",
  OK: "OK",
  OKLAHOMA: "OK",
  OR: "OR",
  OREGON: "OR",
  PA: "PA",
  PENNSYLVANIA: "PA",
  RI: "RI",
  RHODEISLAND: "RI",
  SC: "SC",
  SOUTHCAROLINA: "SC",
  SD: "SD",
  SOUTHDAKOTA: "SD",
  TN: "TN",
  TENNESSEE: "TN",
  TX: "TX",
  TEXAS: "TX",
  UT: "UT",
  UTAH: "UT",
  VT: "VT",
  VERMONT: "VT",
  VA: "VA",
  VIRGINIA: "VA",
  WA: "WA",
  WASHINGTON: "WA",
  WV: "WV",
  WESTVIRGINIA: "WV",
  WI: "WI",
  WISCONSIN: "WI",
  WY: "WY",
  WYOMING: "WY",
  DC: "DC",
  DISTRICTOFCOLUMBIA: "DC",
};

function parseArgs(argv) {
  const options = {
    coordinatesFile: DEFAULT_COORDINATE_FILE,
    cacheFile: DEFAULT_CACHE_FILE,
    outputFile: DEFAULT_REPORT_FILE,
    maxUsZipDistanceKm: DEFAULT_MAX_US_ZIP_DISTANCE_KM,
    cityOutlierWarnKm: DEFAULT_CITY_OUTLIER_WARN_KM,
    cityOutlierErrorKm: DEFAULT_CITY_OUTLIER_ERROR_KM,
    strict: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--coordinates" && argv[index + 1]) {
      options.coordinatesFile = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--cache-file" && argv[index + 1]) {
      options.cacheFile = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--output" && argv[index + 1]) {
      options.outputFile = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--max-us-zip-distance-km" && argv[index + 1]) {
      const parsed = Number(argv[index + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.maxUsZipDistanceKm = parsed;
      }
      index += 1;
      continue;
    }

    if (arg === "--city-outlier-warn-km" && argv[index + 1]) {
      const parsed = Number(argv[index + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.cityOutlierWarnKm = parsed;
      }
      index += 1;
      continue;
    }

    if (arg === "--city-outlier-error-km" && argv[index + 1]) {
      const parsed = Number(argv[index + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.cityOutlierErrorKm = parsed;
      }
      index += 1;
      continue;
    }

    if (arg === "--strict") {
      options.strict = true;
    }
  }

  return options;
}

function normalizeQueryKey(query) {
  return String(query ?? "").trim().toLowerCase();
}

function toFiniteNumber(value) {
  if (value == null) {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isValidCoordinate(lat, lng) {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const r = 6371;
  const toRad = (value) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function median(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function normalizeUsZip(value) {
  const match = String(value ?? "").match(/(\d{5})(?:-\d{4})?/);
  return match ? match[1] : null;
}

function extractUsZip(address) {
  // NBIM address format: "Name, Street, ZIP, City" — ZIP is second-to-last comma-separated part
  const parts = String(address ?? "").split(",").map((s) => s.trim());
  for (let i = parts.length - 2; i >= 0; i--) {
    const m = parts[i].match(/^(\d{5})(?:-\d{4})?$/);
    if (m) return m[1];
  }
  return null;
}

function normalizeUsState(value) {
  const compact = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

  if (!compact) {
    return null;
  }

  return US_STATE_MAP[compact] ?? null;
}

function hasAddressRange(address) {
  return /\b\d{1,6}\s*[-/]\s*\d{1,6}\b/.test(String(address ?? ""));
}

function buildCacheIndex(cacheEntries) {
  const byQuery = new Map();

  for (const entry of Object.values(cacheEntries ?? {})) {
    const queryKey = normalizeQueryKey(entry?.query);
    if (!queryKey) {
      continue;
    }

    if (!byQuery.has(queryKey)) {
      byQuery.set(queryKey, entry);
    }
  }

  return byQuery;
}

function buildUsZipContext(cacheEntries) {
  const contexts = new Map();

  for (const entry of Object.values(cacheEntries ?? {})) {
    if (entry?.status !== "ok") {
      continue;
    }

    const query = String(entry?.query ?? "").trim();
    const match = query.match(/^(\d{5})(?:-\d{4})?,\s*United States$/i);
    if (!match) {
      continue;
    }

    const zip = match[1];
    const lat = toFiniteNumber(entry.lat);
    const lng = toFiniteNumber(entry.lng);
    if (lat == null || lng == null || !isValidCoordinate(lat, lng)) {
      continue;
    }

    if (!contexts.has(zip)) {
      contexts.set(zip, {
        zip,
        lat,
        lng,
        state: normalizeUsState(entry.state),
        city: String(entry.city ?? "").trim() || null,
      });
    }
  }

  return contexts;
}

function buildCityClusters(entries) {
  const groupMap = new Map();

  for (const [propertyKey, entry] of Object.entries(entries ?? {})) {
    if (entry?.source === "country_center_fallback") {
      continue;
    }

    const lat = toFiniteNumber(entry?.lat);
    const lng = toFiniteNumber(entry?.lng);
    if (lat == null || lng == null || !isValidCoordinate(lat, lng)) {
      continue;
    }

    const city = String(entry?.city ?? "").trim();
    const country = String(entry?.country ?? "").trim();
    if (!city || !country) {
      continue;
    }

    const key = `${normalizeText(country)}|${normalizeText(city)}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }

    groupMap.get(key).push({ propertyKey, lat, lng });
  }

  const clusterMap = new Map();

  for (const [groupKey, points] of groupMap.entries()) {
    if (points.length < MIN_CITY_CLUSTER_SIZE) {
      continue;
    }

    const medianLat = median(points.map((point) => point.lat));
    const medianLng = median(points.map((point) => point.lng));

    if (medianLat == null || medianLng == null) {
      continue;
    }

    const distances = points.map((point) =>
      haversineDistanceKm(medianLat, medianLng, point.lat, point.lng)
    );

    clusterMap.set(groupKey, {
      count: points.length,
      medianLat,
      medianLng,
      medianDistanceKm: median(distances) ?? 0,
    });
  }

  return clusterMap;
}

function createIssue(severity, code, message, details = null) {
  const issue = { severity, code, message };

  if (details && typeof details === "object") {
    issue.details = details;
  }

  return issue;
}

function summarizeIssues(issueCountsByCode, issueCountsBySeverity, issues) {
  for (const issue of issues) {
    issueCountsByCode[issue.code] = (issueCountsByCode[issue.code] ?? 0) + 1;
    issueCountsBySeverity[issue.severity] = (issueCountsBySeverity[issue.severity] ?? 0) + 1;
  }
}

function compareSeverity(a, b) {
  const ranking = { error: 3, warning: 2, info: 1 };
  return (ranking[b] ?? 0) - (ranking[a] ?? 0);
}

function buildSuggestedFix(entry, zipContext, issueCodes) {
  if (!zipContext) {
    return null;
  }

  const zipIssueCodes = new Set([
    "zip_distance_outlier",
    "zip_state_mismatch",
    "zip_postcode_mismatch",
    "country_fallback_for_us_zip",
  ]);

  const hasZipIssue = issueCodes.some((code) => zipIssueCodes.has(code));
  if (!hasZipIssue) {
    return null;
  }

  return {
    type: "zip_center",
    confidence: "high",
    reason: "us_zip_context",
    zip: zipContext.zip,
    state: zipContext.state,
    lat: zipContext.lat,
    lng: zipContext.lng,
  };
}

function evaluateEntry(entryKey, entry, context, options) {
  const issues = [];

  const lat = toFiniteNumber(entry?.lat);
  const lng = toFiniteNumber(entry?.lng);

  if (lat == null || lng == null || !isValidCoordinate(lat, lng)) {
    issues.push(
      createIssue(
        "error",
        "invalid_coordinates",
        "Coordinate is missing or outside valid latitude/longitude bounds"
      )
    );

    return { issues, suggestedFix: null };
  }

  const countryNormalized = normalizeText(entry?.country ?? "");
  const cityNormalized = normalizeText(entry?.city ?? "");
  const isUnitedStates = countryNormalized === "unitedstates";

  if (hasAddressRange(entry?.address)) {
    issues.push(
      createIssue(
        "info",
        "address_range_detected",
        "Address contains a numeric range; keep original range for display and use resolved point for mapping"
      )
    );
  }

  if (entry?.source === "country_center_fallback") {
    if (isUnitedStates) {
      issues.push(
        createIssue(
          "error",
          "country_fallback_us",
          "US property still uses country center fallback"
        )
      );
    } else {
      issues.push(
        createIssue(
          "warning",
          "country_fallback_non_us",
          "Property uses country center fallback"
        )
      );
    }
  }

  let zipContext = null;
  const isAutofix = String(entry?.source ?? "").startsWith("autofix_");

  if (isUnitedStates && !isAutofix) {
    const addressZip = extractUsZip(entry?.address);
    if (addressZip) {
      zipContext = context.usZipContexts.get(addressZip) ?? null;

      if (!zipContext) {
        issues.push(
          createIssue(
            "warning",
            "zip_context_missing",
            "No ZIP context entry was available in geocode cache",
            { zip: addressZip }
          )
        );
      } else {
        const zipDistanceKm = haversineDistanceKm(zipContext.lat, zipContext.lng, lat, lng);
        if (zipDistanceKm > options.maxUsZipDistanceKm) {
          issues.push(
            createIssue(
              "error",
              "zip_distance_outlier",
              "Coordinate is far from ZIP centroid",
              {
                zip: addressZip,
                distance_km: Number(zipDistanceKm.toFixed(1)),
                max_distance_km: options.maxUsZipDistanceKm,
              }
            )
          );
        }

        const cacheEntry = context.cacheByQuery.get(normalizeQueryKey(entry?.geocode_query));
        const cacheState = normalizeUsState(cacheEntry?.state);
        if (cacheState && zipContext.state && cacheState !== zipContext.state) {
          issues.push(
            createIssue(
              "error",
              "zip_state_mismatch",
              "Geocoder state disagrees with ZIP-derived state",
              {
                zip: addressZip,
                zip_state: zipContext.state,
                geocoder_state: cacheState,
              }
            )
          );
        }

        const cachePostcode = normalizeUsZip(cacheEntry?.postcode);
        if (cachePostcode && cachePostcode !== addressZip) {
          issues.push(
            createIssue(
              "error",
              "zip_postcode_mismatch",
              "Geocoder postcode disagrees with ZIP in source address",
              {
                zip: addressZip,
                geocoder_postcode: cachePostcode,
              }
            )
          );
        }

        if (entry?.source === "country_center_fallback") {
          issues.push(
            createIssue(
              "error",
              "country_fallback_for_us_zip",
              "US fallback coordinate can be replaced by ZIP centroid",
              { zip: addressZip }
            )
          );
        }
      }
    }
  }

  const clusterKey = `${countryNormalized}|${cityNormalized}`;
  const cluster = context.cityClusters.get(clusterKey);

  if (cluster) {
    const distanceFromCityMedian = haversineDistanceKm(cluster.medianLat, cluster.medianLng, lat, lng);
    const warningThreshold = Math.max(
      options.cityOutlierWarnKm,
      Math.max(30, cluster.medianDistanceKm * 4)
    );
    const errorThreshold = Math.max(
      options.cityOutlierErrorKm,
      Math.max(60, cluster.medianDistanceKm * 6)
    );

    if (distanceFromCityMedian > errorThreshold) {
      issues.push(
        createIssue(
          "error",
          "city_cluster_outlier",
          "Coordinate is a strong outlier for its city/country cluster",
          {
            city_cluster_size: cluster.count,
            distance_km: Number(distanceFromCityMedian.toFixed(1)),
            threshold_km: Number(errorThreshold.toFixed(1)),
          }
        )
      );
    } else if (distanceFromCityMedian > warningThreshold) {
      issues.push(
        createIssue(
          "warning",
          "city_cluster_drift",
          "Coordinate is unusually far from city cluster median",
          {
            city_cluster_size: cluster.count,
            distance_km: Number(distanceFromCityMedian.toFixed(1)),
            threshold_km: Number(warningThreshold.toFixed(1)),
          }
        )
      );
    }
  }

  const issueCodes = issues.map((issue) => issue.code);
  const suggestedFix = buildSuggestedFix(entry, zipContext, issueCodes);

  return { issues, suggestedFix };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const coordinatesPayload = await readJsonIfExists(options.coordinatesFile, null);
  if (!coordinatesPayload || typeof coordinatesPayload !== "object") {
    throw new Error(`Coordinate file is missing or invalid JSON: ${options.coordinatesFile}`);
  }

  const coordinateEntries = coordinatesPayload.entries;
  if (!coordinateEntries || typeof coordinateEntries !== "object") {
    throw new Error(`Coordinate file does not contain an entries object: ${options.coordinatesFile}`);
  }

  const cachePayload = await readJsonIfExists(options.cacheFile, null);
  if (!cachePayload || typeof cachePayload !== "object") {
    throw new Error(`Cache file is missing or invalid JSON: ${options.cacheFile}`);
  }

  const cacheEntries = cachePayload.entries;
  if (!cacheEntries || typeof cacheEntries !== "object") {
    throw new Error(`Cache file does not contain an entries object: ${options.cacheFile}`);
  }

  const context = {
    cacheByQuery: buildCacheIndex(cacheEntries),
    usZipContexts: buildUsZipContext(cacheEntries),
    cityClusters: buildCityClusters(coordinateEntries),
  };

  const issueCountsByCode = {};
  const issueCountsBySeverity = { error: 0, warning: 0, info: 0 };
  const findings = [];
  const autofixCandidates = [];

  for (const [entryKey, entry] of Object.entries(coordinateEntries)) {
    const { issues, suggestedFix } = evaluateEntry(entryKey, entry, context, options);
    if (issues.length === 0) {
      continue;
    }

    issues.sort((a, b) => compareSeverity(a.severity, b.severity));
    summarizeIssues(issueCountsByCode, issueCountsBySeverity, issues);

    const severities = [...new Set(issues.map((issue) => issue.severity))].sort(compareSeverity);

    findings.push({
      property_key: entryKey,
      address: entry?.address ?? "",
      city: entry?.city ?? "",
      country: entry?.country ?? "",
      source: entry?.source ?? "",
      geocode_query: entry?.geocode_query ?? null,
      lat: toFiniteNumber(entry?.lat),
      lng: toFiniteNumber(entry?.lng),
      severities,
      issues,
      suggested_fix: suggestedFix,
    });

    if (suggestedFix && severities.includes("error")) {
      autofixCandidates.push({
        property_key: entryKey,
        address: entry?.address ?? "",
        city: entry?.city ?? "",
        country: entry?.country ?? "",
        current: {
          lat: toFiniteNumber(entry?.lat),
          lng: toFiniteNumber(entry?.lng),
          source: entry?.source ?? "",
        },
        issue_codes: issues.map((issue) => issue.code),
        suggested_fix: suggestedFix,
      });
    }
  }

  findings.sort((a, b) => compareSeverity(a.severities[0], b.severities[0]));

  const entriesWithErrors = findings.filter((finding) => finding.severities.includes("error")).length;
  const entriesWithWarningsOnly = findings.filter(
    (finding) => !finding.severities.includes("error") && finding.severities.includes("warning")
  ).length;
  const entriesWithInfoOnly = findings.filter(
    (finding) => !finding.severities.includes("error") && !finding.severities.includes("warning")
  ).length;

  const report = {
    version: 1,
    generated_at: new Date().toISOString(),
    inputs: {
      coordinates_file: options.coordinatesFile,
      cache_file: options.cacheFile,
    },
    thresholds: {
      max_us_zip_distance_km: options.maxUsZipDistanceKm,
      city_outlier_warn_km: options.cityOutlierWarnKm,
      city_outlier_error_km: options.cityOutlierErrorKm,
      min_city_cluster_size: MIN_CITY_CLUSTER_SIZE,
    },
    summary: {
      total_properties: Object.keys(coordinateEntries).length,
      entries_with_issues: findings.length,
      entries_with_errors: entriesWithErrors,
      entries_with_warnings_only: entriesWithWarningsOnly,
      entries_with_info_only: entriesWithInfoOnly,
      issue_counts_by_severity: issueCountsBySeverity,
      issue_counts_by_code: issueCountsByCode,
      autofix_candidates: autofixCandidates.length,
    },
    autofix_candidates: autofixCandidates,
    findings,
  };

  await saveJson(options.outputFile, report, { pretty: true });

  console.log("Geocode quality validation complete.");
  console.log(`- Coordinates: ${options.coordinatesFile}`);
  console.log(`- Cache: ${options.cacheFile}`);
  console.log(`- Report: ${options.outputFile}`);
  console.log(`- Properties checked: ${report.summary.total_properties}`);
  console.log(`- Entries with issues: ${report.summary.entries_with_issues}`);
  console.log(`- Entries with errors: ${report.summary.entries_with_errors}`);
  console.log(`- Entries with warnings only: ${report.summary.entries_with_warnings_only}`);
  console.log(`- Entries with info only: ${report.summary.entries_with_info_only}`);
  console.log(`- Autofix candidates: ${report.summary.autofix_candidates}`);

  if (options.strict && entriesWithErrors > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Validation failed.");
  console.error(error);
  process.exitCode = 1;
});
