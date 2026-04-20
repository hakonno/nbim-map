import { spawnSync } from "node:child_process";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import {
  ACTIVE_DATASET_METADATA_PATH,
  readActiveDatasetSync,
} from "./lib/active-dataset.mjs";
import { saveJson } from "./lib/fs-json-utils.mjs";

const DATA_DIR = path.join(process.cwd(), "data");
const RAW_DIR = path.join(DATA_DIR, "raw");
const RELEASES_DIR = path.join(DATA_DIR, "releases");

const ACTIVE_OUTPUT_FILES = [
  "cities.json",
  "realestate.json",
];

const LEGACY_ROOT_PIPELINE_FILES = [
  "properties.json",
  "property-coordinates.json",
  "geocode-cache.json",
];

function parseArgs(argv) {
  const options = {
    year: "",
    source: "",
    csv: "",
    noGeocode: false,
    enableNominatim: false,
    refreshCache: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--year" && argv[index + 1]) {
      options.year = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }

    if (arg === "--source" && argv[index + 1]) {
      options.source = path.resolve(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--csv" && argv[index + 1]) {
      options.csv = String(argv[index + 1]).trim();
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

function toWorkspaceRelative(filePath) {
  return path.relative(process.cwd(), filePath).split(path.sep).join("/");
}

function assertYear(year) {
  if (!/^\d{4}$/.test(year)) {
    throw new Error("Invalid --year. Use a 4-digit year, for example --year 2026.");
  }
}

async function copySourceIntoYearFolder(sourcePath, rawYearDir) {
  if (!sourcePath) {
    return null;
  }

  await fsPromises.access(sourcePath);
  await fsPromises.mkdir(rawYearDir, { recursive: true });

  const destinationPath = path.join(rawYearDir, path.basename(sourcePath));

  if (path.resolve(sourcePath) !== path.resolve(destinationPath)) {
    await fsPromises.copyFile(sourcePath, destinationPath);
  }

  return destinationPath;
}

async function resolveCsvPath(rawYearDir, csvArg, importedPath) {
  if (importedPath) {
    return importedPath;
  }

  if (csvArg) {
    const candidatePath = path.isAbsolute(csvArg)
      ? csvArg
      : path.join(rawYearDir, csvArg);

    await fsPromises.access(candidatePath);
    return candidatePath;
  }

  const entries = await fsPromises.readdir(rawYearDir, { withFileTypes: true });
  const csvCandidates = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".csv"))
    .map((entry) => path.join(rawYearDir, entry.name))
    .sort((left, right) => right.localeCompare(left));

  if (csvCandidates.length === 0) {
    throw new Error(
      `No CSV files found in ${toWorkspaceRelative(rawYearDir)}. Provide --source or --csv.`
    );
  }

  return csvCandidates[0];
}

function runNodeScript(scriptName, args) {
  const scriptPath = path.join(process.cwd(), "scripts", scriptName);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`Script failed: ${scriptName}`);
  }
}

async function copyReleaseToActive(releaseDir) {
  for (const fileName of ACTIVE_OUTPUT_FILES) {
    const releasePath = path.join(releaseDir, fileName);
    const activePath = path.join(DATA_DIR, fileName);
    await fsPromises.copyFile(releasePath, activePath);
  }
}

function resolvePreviousReleaseCachePath(previous) {
  const releasePath = previous?.release_path;

  if (typeof releasePath === "string" && releasePath.trim() !== "") {
    const resolvedReleasePath = path.isAbsolute(releasePath)
      ? releasePath
      : path.join(process.cwd(), releasePath);
    const releaseCachePath = path.join(resolvedReleasePath, "geocode-cache.json");

    if (fs.existsSync(releaseCachePath)) {
      return releaseCachePath;
    }
  }

  const legacyRootCachePath = path.join(DATA_DIR, "geocode-cache.json");
  if (fs.existsSync(legacyRootCachePath)) {
    return legacyRootCachePath;
  }

  return null;
}

async function seedReleaseCacheIfMissing(releaseCachePath, previous) {
  if (fs.existsSync(releaseCachePath)) {
    return;
  }

  const sourceCachePath = resolvePreviousReleaseCachePath(previous);
  if (!sourceCachePath) {
    return;
  }

  await fsPromises.mkdir(path.dirname(releaseCachePath), { recursive: true });
  await fsPromises.copyFile(sourceCachePath, releaseCachePath);
}

async function removeLegacyRootPipelineFiles() {
  for (const fileName of LEGACY_ROOT_PIPELINE_FILES) {
    const filePath = path.join(DATA_DIR, fileName);
    try {
      await fsPromises.unlink(filePath);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        continue;
      }

      throw error;
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  assertYear(options.year);
  const previous = readActiveDatasetSync();

  const rawYearDir = path.join(RAW_DIR, options.year);
  const releaseDir = path.join(RELEASES_DIR, options.year);

  await fsPromises.mkdir(rawYearDir, { recursive: true });
  await fsPromises.mkdir(releaseDir, { recursive: true });

  console.log(`[1/5] Preparing raw input folder for ${options.year}...`);
  const importedCsvPath = await copySourceIntoYearFolder(options.source, rawYearDir);
  const csvPath = await resolveCsvPath(rawYearDir, options.csv, importedCsvPath);
  console.log(`- Active CSV candidate: ${toWorkspaceRelative(csvPath)}`);

  const releaseProperties = path.join(releaseDir, "properties.json");
  const releasePropertyCoordinates = path.join(releaseDir, "property-coordinates.json");
  const releaseCache = path.join(releaseDir, "geocode-cache.json");
  const releaseCities = path.join(releaseDir, "cities.json");
  const releaseRealestate = path.join(releaseDir, "realestate.json");

  const geocodingMode = options.noGeocode
    ? "disabled (country fallback only)"
    : options.enableNominatim
      ? "photon + nominatim"
      : "photon";

  console.log("[2/5] Building property-level outputs...");
  console.log(`- Geocoding mode: ${geocodingMode}`);
  console.log(`- Refresh cache: ${options.refreshCache ? "yes" : "no"}`);
  await seedReleaseCacheIfMissing(releaseCache, previous);

  const pipelineArgs = [
    "--input",
    csvPath,
    "--output",
    releaseProperties,
    "--coordinate-output",
    releasePropertyCoordinates,
    "--cache-file",
    releaseCache,
  ];

  if (options.noGeocode) {
    pipelineArgs.push("--no-geocode");
  }

  if (options.enableNominatim) {
    pipelineArgs.push("--enable-nominatim");
  }

  if (options.refreshCache) {
    pipelineArgs.push("--refresh-cache");
  }

  runNodeScript("pipeline.mjs", pipelineArgs);

  console.log("[3/5] Building city and normalized outputs...");
  runNodeScript("build-cities.mjs", [
    "--input",
    csvPath,
    "--output",
    releaseCities,
    "--realestate-output",
    releaseRealestate,
    "--property-coordinates",
    releasePropertyCoordinates,
    "--city-coordinates",
    path.join(DATA_DIR, "city-coordinates.json"),
  ]);

  console.log("[4/5] Switching active data files...");
  await copyReleaseToActive(releaseDir);
  await removeLegacyRootPipelineFiles();

  console.log("[5/5] Writing active dataset metadata...");
  const metadata = {
    version: 1,
    active_year: options.year,
    csv_path: toWorkspaceRelative(csvPath),
    release_path: toWorkspaceRelative(releaseDir),
    activated_at: new Date().toISOString(),
    previous_active_year:
      previous && typeof previous.active_year === "string" ? previous.active_year : null,
  };

  await saveJson(ACTIVE_DATASET_METADATA_PATH, metadata, { pretty: true });

  console.log("Dataset activation completed.");
  console.log(`- Active year: ${options.year}`);
  console.log(`- Metadata: ${toWorkspaceRelative(ACTIVE_DATASET_METADATA_PATH)}`);
  console.log(`- Release snapshot: ${toWorkspaceRelative(releaseDir)}`);
}

main().catch((error) => {
  console.error("Dataset activation failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});