import fs from "node:fs";
import path from "node:path";
import process from "node:process";

export const ACTIVE_DATASET_METADATA_PATH = path.join(
  process.cwd(),
  "data",
  "active-dataset.json"
);

function resolveWorkspacePath(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  return path.isAbsolute(value)
    ? value
    : path.join(process.cwd(), value);
}

export function readActiveDatasetSync() {
  try {
    const text = fs.readFileSync(ACTIVE_DATASET_METADATA_PATH, "utf8");
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function resolveActiveCsvInput(fallbackPath) {
  const activeDataset = readActiveDatasetSync();
  const csvPath = activeDataset?.csv_path;

  const resolvedPath = resolveWorkspacePath(csvPath);

  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    return fallbackPath;
  }

  return resolvedPath;
}

export function resolveActiveReleaseDir(fallbackPath) {
  const activeDataset = readActiveDatasetSync();

  const explicitRelease = resolveWorkspacePath(activeDataset?.release_path);
  if (explicitRelease && fs.existsSync(explicitRelease)) {
    return explicitRelease;
  }

  const activeYear = activeDataset?.active_year;
  if (typeof activeYear === "string" && activeYear.trim() !== "") {
    const inferredRelease = path.join(process.cwd(), "data", "releases", activeYear.trim());
    if (fs.existsSync(inferredRelease)) {
      return inferredRelease;
    }
  }

  return fallbackPath;
}

export function resolveActiveReleaseFile(fileName, fallbackPath) {
  const releaseDir = resolveActiveReleaseDir(null);
  if (!releaseDir) {
    return fallbackPath;
  }

  const resolvedPath = path.join(releaseDir, fileName);
  if (!fs.existsSync(resolvedPath)) {
    return fallbackPath;
  }

  return resolvedPath;
}