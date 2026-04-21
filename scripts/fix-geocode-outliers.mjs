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

function parseArgs(argv) {
  const options = {
    coordinatesFile: DEFAULT_COORDINATE_FILE,
    reportFile: DEFAULT_REPORT_FILE,
    outputFile: DEFAULT_OUTPUT_FILE,
    apply: false,
    maxFixes: null,
    codes: null,
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

  const nowIso = new Date().toISOString();
  let applied = 0;
  let skippedMissing = 0;
  let skippedInvalidTarget = 0;

  const appliedFixes = [];

  for (const candidate of limitedCandidates) {
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
    selected_for_run: limitedCandidates.length,
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
