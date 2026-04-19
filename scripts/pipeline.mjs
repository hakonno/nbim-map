import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_INPUT = path.join(process.cwd(), "data", "raw", "re_20251231.csv");
const DEFAULT_OUTPUT = path.join(process.cwd(), "data", "properties.json");

function parseArgs(argv) {
  const options = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input" && argv[index + 1]) {
      options.input = path.resolve(argv[index + 1]);
      index += 1;
    } else if (arg === "--output" && argv[index + 1]) {
      options.output = path.resolve(argv[index + 1]);
      index += 1;
    }
  }

  return options;
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

  // Heuristic: UTF-16 files often contain many null bytes in every second position.
  const sampleLength = Math.min(buffer.length, 4096);
  let nullByteCount = 0;
  for (let i = 0; i < sampleLength; i += 1) {
    if (buffer[i] === 0x00) {
      nullByteCount += 1;
    }
  }

  if (nullByteCount / sampleLength > 0.2) {
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

function createId(record) {
  const key = [record.country, record.partnership, record.address, record.ownership_percent]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .join("|");

  return `prop_${crypto.createHash("sha1").update(key).digest("hex").slice(0, 16)}`;
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

async function main() {
  const options = parseArgs(process.argv.slice(2));

  console.log("[1/3] Parsing CSV input...");
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
  console.log(`- Delimiter: ;`);
  console.log(`- Headers found: ${headers.length}`);
  console.log(`- Data rows found: ${rows.length}`);

  console.log("[2/3] Mapping fields dynamically from detected headers...");
  const mapped = mapHeaders(headers);

  for (const [field, index] of Object.entries(mapped)) {
    const label = index === -1 ? "(not mapped)" : headers[index];
    console.log(`- ${field}: ${label}`);
  }

  const outputRows = rows.map((values) => {
    const address = getValue(values, mapped.address);
    const ownershipPercentRaw = getValue(values, mapped.ownershipPercent);

    const record = {
      region: getValue(values, mapped.region) || null,
      country: getValue(values, mapped.country) || null,
      partnership: getValue(values, mapped.partnership) || null,
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

    record.id = createId(record);

    return record;
  });

  console.log("[3/3] Writing basic JSON output (no geocoding yet)...");
  console.log(`- Output file: ${options.output}`);

  await fs.mkdir(path.dirname(options.output), { recursive: true });
  await fs.writeFile(options.output, `${JSON.stringify(outputRows, null, 2)}\n`, "utf8");

  console.log(`- Wrote ${outputRows.length} records`);
  console.log("- Validation stage complete (steps 1-3)");
}

main().catch((error) => {
  console.error("Pipeline failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
