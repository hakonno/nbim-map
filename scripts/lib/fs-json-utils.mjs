import fs from "node:fs/promises";
import path from "node:path";

export async function readJsonIfExists(filePath, fallbackValue) {
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

export async function saveJson(filePath, value, options = {}) {
  const spacing = options.pretty ? 2 : undefined;

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, spacing)}\n`, "utf8");
}
