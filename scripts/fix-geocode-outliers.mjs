import path from "node:path";
import process from "node:process";

import {
  resolveActiveReleaseDir,
  resolveActiveReleaseFile,
} from "./lib/active-dataset.mjs";
import { readJsonIfExists, saveJson } from "./lib/fs-json-utils.mjs";

const LEGACY_DEFAULT_COORDINATE_FILE = path.join(process.cwd(), "data", "property-coordinates.json");
const DEFAULT_COORDINATE_FILE = resolveActiveReleaseFile(
  "property-coordinates.json",
  LEGACY_DEFAULT_COORDINATE_FILE
);
const DEFAULT_REPORT_FILE = path.join(
  resolveActiveReleaseDir(path.join(process.cwd(), "data")),
  "geocode-validation.json"
);
const DEFAULT_OUTPUT_FILE = path.join(
  resolveActiveReleaseDir(path.join(process.cwd(), "data")),
  "geocode-autofix.json"
);
const DEFAULT_FIX_CODES = new Set([
  "zip_distance_outlier",
  "zip_state_mismatch",
  "zip_postcode_mismatch",
  "country_fallback_for_us_zip",
]);

const DEFAULT_PHOTON_URL = "https://photon.komoot.io/api";
const ZIP_GEOCODE_DELAY_MS = 350;

function parseArgs(argv) {
  const options = {
    coordinatesFile: DEFAULT_COORDINATE_FILE,
    reportFile: DEFAULT_REPORT_FILE,
    outputFile: DEFAULT_OUTPUT_FILE,
    apply: false,
    maxFixes: null,
    codes: null,
    geocodeMissingZips: false,
    photonUrl: DEFAULT_PHOTON_URL,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--coordinates" && argv[index + 1]) {
      options.coordinatesFile = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--report" && argv[index + 1]) {
      options.reportFile = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--output" && argv[index + 1]) {
      options.outputFile = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--max-fixes" && argv[index + 1]) {
      const parsed = Number(argv[index + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.maxFixes = Math.floor(parsed);
      }
      index += 1;
      continue;
    }

    if (arg === "--codes" && argv[index + 1]) {
      options.codes = new Set(
        String(argv[index + 1])
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      );
      index += 1;
      continue;
    }

    if (arg === "--apply") {
      options.apply = true;
      continue;
    }

    if (arg === "--geocode-missing-zips") {
      options.geocodeMissingZips = true;
      continue;
    }

    if (arg === "--photon-url" && argv[index + 1]) {
      options.photonUrl = argv[index + 1];
      index += 1;
      continue;
    }
  }

  return options;
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

function shouldIncludeCandidate(candidate, activeCodes) {
  if (!candidate || typeof candidate !== "object") {
    return false;
  }

  const suggested = candidate.suggested_fix;
  if (!suggested || suggested.type !== "zip_center" || suggested.confidence !== "high") {
    return false;
  }

  const issueCodes = Array.isArray(candidate.issue_codes) ? candidate.issue_codes : [];
  return issueCodes.some((code) => activeCodes.has(code));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function geocodeSingleZip(zip, photonUrl) {
  const query = `${zip}, United States`;
  const url = `${photonUrl}?q=${encodeURIComponent(query)}&limit=3&lang=en`;
  const response = await fetch(url, {
    headers: { "User-Agent": "nbim-map-geocode-fix/1.0" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Photon returned ${response.status} for ZIP ${zip}`);
  }

  const data = await response.json();
  const features = Array.isArray(data?.features) ? data.features : [];

  // Pick the feature whose postcode matches and is in the US
  const match = features.find((f) => {
    const props = f?.properties ?? {};
    const country = String(props.country ?? "").toLowerCase();
    const postcode = String(props.postcode ?? "").replace(/-\d+$/, "");
    return (
      (country.includes("united states") || country.includes("usa") || props.country_code === "US") &&
      postcode === zip
    );
  }) ?? features[0];

  if (!match) return null;

  const [lng, lat] = match.geometry?.coordinates ?? [];
  if (typeof lat !== "number" || typeof lng !== "number") return null;

  const props = match.properties ?? {};
  return {
    lat,
    lng,
    zip,
    state: String(props.state ?? props.county ?? ""),
    country_code: String(props.country_code ?? "US"),
  };
}

async function resolveMissingZipFixes(findings, photonUrl) {
  // Collect unique ZIPs from zip_context_missing findings
  const zipToFindings = new Map();

  for (const finding of findings) {
    const zipIssue = finding.issues?.find((i) => i.code === "zip_context_missing");
    if (!zipIssue) continue;
    const zip = zipIssue.details?.zip ?? finding.issues?.find((i) => i.details?.zip)?.details?.zip;
    if (!zip) continue;
    if (!zipToFindings.has(zip)) zipToFindings.set(zip, []);
    zipToFindings.get(zip).push(finding);
  }

  if (zipToFindings.size === 0) return [];

  console.log(`Geocoding ${zipToFindings.size} missing ZIP(s) via Photon...`);

  const fixes = [];

  for (const [zip, affectedFindings] of zipToFindings) {
    process.stdout.write(`  ZIP ${zip}... `);

    let result = null;
    try {
      result = await geocodeSingleZip(zip, photonUrl);
    } catch {
      console.log("error, skipping");
    }

    if (result) {
      console.log(`${result.lat.toFixed(4)}, ${result.lng.toFixed(4)} (${result.state})`);
      for (const finding of affectedFindings) {
        fixes.push({
          property_key: finding.property_key,
          address: finding.address ?? "",
          city: finding.city ?? "",
          country: finding.country ?? "",
          issue_codes: finding.issues?.map((i) => i.code) ?? [],
          suggested_fix: {
            type: "zip_center",
            confidence: "medium",
            reason: "photon_zip_geocode",
            zip,
            state: result.state,
            lat: result.lat,
            lng: result.lng,
          },
        });
      }
    } else {
      console.log("no result, skipping");
    }

    await sleep(ZIP_GEOCODE_DELAY_MS);
  }

  return fixes;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const report = await readJsonIfExists(options.reportFile, null);
  if (!report || typeof report !== "object") {
    throw new Error(`Validation report is missing or invalid JSON: ${options.reportFile}`);
  }

  const allCandidates = Array.isArray(report.autofix_candidates) ? report.autofix_candidates : [];

  const activeCodes = options.codes ?? DEFAULT_FIX_CODES;
  const selectedCandidates = allCandidates.filter((candidate) =>
    shouldIncludeCandidate(candidate, activeCodes)
  );

  const limitedCandidates =
    options.maxFixes && selectedCandidates.length > options.maxFixes
      ? selectedCandidates.slice(0, options.maxFixes)
      : selectedCandidates;

  if (!options.apply) {
    const preview = {
      mode: "dry-run",
      generated_at: new Date().toISOString(),
      report_file: options.reportFile,
      selected_codes: [...activeCodes],
      total_candidates_in_report: allCandidates.length,
      matching_candidates: selectedCandidates.length,
      selected_for_run: limitedCandidates.length,
      sample: limitedCandidates.slice(0, 25),
      next_step: "Run again with --apply to persist fixes",
    };

    await saveJson(options.outputFile, preview, { pretty: true });

    console.log("Autofix dry-run complete.");
    console.log(`- Report: ${options.reportFile}`);
    console.log(`- Selected candidates: ${limitedCandidates.length}`);
    console.log(`- Preview file: ${options.outputFile}`);
    return;
  }

  const coordinatePayload = await readJsonIfExists(options.coordinatesFile, null);
  if (!coordinatePayload || typeof coordinatePayload !== "object") {
    throw new Error(`Coordinate file is missing or invalid JSON: ${options.coordinatesFile}`);
  }

  const entries = coordinatePayload.entries;
  if (!entries || typeof entries !== "object") {
    throw new Error(`Coordinate file does not contain an entries object: ${options.coordinatesFile}`);
  }

  let allToApply = [...limitedCandidates];

  if (options.geocodeMissingZips) {
    const allFindings = Array.isArray(report.findings) ? report.findings : [];
    const missingZipFixes = await resolveMissingZipFixes(allFindings, options.photonUrl);
    console.log(`ZIP geocoding resolved ${missingZipFixes.length} additional fix(es).`);
    allToApply = allToApply.concat(missingZipFixes);
  }

  const nowIso = new Date().toISOString();
  let applied = 0;
  let skippedMissing = 0;
  let skippedInvalidTarget = 0;

  const appliedFixes = [];

  for (const candidate of allToApply) {
    const entryKey = candidate.property_key;
    const entry = entries[entryKey];

    if (!entry) {
      skippedMissing += 1;
      continue;
    }

    const targetLat = toFiniteNumber(candidate?.suggested_fix?.lat);
    const targetLng = toFiniteNumber(candidate?.suggested_fix?.lng);

    if (targetLat == null || targetLng == null) {
      skippedInvalidTarget += 1;
      continue;
    }

    const previous = {
      lat: toFiniteNumber(entry.lat),
      lng: toFiniteNumber(entry.lng),
      source: String(entry.source ?? ""),
    };

    entry.lat = targetLat;
    entry.lng = targetLng;
    entry.source = "autofix_zip_center";
    entry.updated_at = nowIso;
    entry.autofix = {
      type: "zip_center",
      reason: candidate?.suggested_fix?.reason ?? "us_zip_context",
      zip: candidate?.suggested_fix?.zip ?? null,
      state: candidate?.suggested_fix?.state ?? null,
      confidence: candidate?.suggested_fix?.confidence ?? "high",
      applied_at: nowIso,
      previous,
    };

    applied += 1;
    appliedFixes.push({
      property_key: entryKey,
      address: entry.address ?? "",
      city: entry.city ?? "",
      country: entry.country ?? "",
      previous,
      updated: {
        lat: targetLat,
        lng: targetLng,
        source: entry.source,
      },
      issue_codes: candidate.issue_codes ?? [],
    });
  }

  await saveJson(options.coordinatesFile, coordinatePayload);

  const summary = {
    mode: "apply",
    generated_at: nowIso,
    report_file: options.reportFile,
    coordinates_file: options.coordinatesFile,
    selected_codes: [...activeCodes],
    total_candidates_in_report: allCandidates.length,
    matching_candidates: selectedCandidates.length,
    selected_for_run: allToApply.length,
    applied,
    skipped_missing_entries: skippedMissing,
    skipped_invalid_targets: skippedInvalidTarget,
    applied_fixes: appliedFixes,
  };

  await saveJson(options.outputFile, summary, { pretty: true });

  console.log("Autofix apply complete.");
  console.log(`- Coordinates updated: ${options.coordinatesFile}`);
  console.log(`- Applied fixes: ${applied}`);
  console.log(`- Missing entries skipped: ${skippedMissing}`);
  console.log(`- Invalid targets skipped: ${skippedInvalidTarget}`);
  console.log(`- Summary file: ${options.outputFile}`);
}

main().catch((error) => {
  console.error("Autofix failed.");
  console.error(error);
  process.exitCode = 1;
});
