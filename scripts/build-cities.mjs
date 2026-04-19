import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_INPUT = path.join(process.cwd(), "data", "raw", "re_20251231.csv");
const DEFAULT_OUTPUT = path.join(process.cwd(), "data", "cities.json");
const DEFAULT_PROPERTY_COORDINATES = path.join(process.cwd(), "data", "property-coordinates.json");

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

const CITY_COORDS = {
  "belgium|tongeren": [50.7811, 5.4647],
  "belgium|bornem": [51.0973, 4.2438],

  "czechrepublic|prague": [50.0755, 14.4378],
  "czechrepublic|ricanyjazlovice": [49.9919, 14.6578],
  "czechrepublic|stenovice": [49.6701, 13.397],

  "france|paris": [48.8566, 2.3522],
  "france|puteaux": [48.8849, 2.2399],
  "france|clichy": [48.9045, 2.3064],
  "france|marseille": [43.2965, 5.3698],
  "france|toulouse": [43.6047, 1.4442],
  "france|reims": [49.2583, 4.0317],
  "france|rouen": [49.4431, 1.0993],
  "france|rennes": [48.1173, -1.6778],
  "france|montpellier": [43.6108, 3.8767],
  "france|brest": [48.3904, -4.4861],
  "france|angers": [47.4784, -0.5632],
  "france|bordeaux": [44.8378, -0.5792],
  "france|gentilly": [48.8156, 2.3417],
  "france|creteil": [48.79, 2.455],
  "france|cergy": [49.0364, 2.0761],
  "france|bron": [45.7333, 4.9167],
  "france|clermontferrand": [45.7772, 3.087],
  "france|ivrysurseine": [48.8147, 2.3882],
  "france|saintouensurseine": [48.9122, 2.3344],
  "france|bagneux": [48.7953, 2.3074],
  "france|bagnolet": [48.8667, 2.4167],
  "france|caen": [49.1829, -0.3707],

  "germany|berlin": [52.52, 13.405],
  "germany|dortmund": [51.5136, 7.4653],
  "germany|augsburg": [48.3705, 10.8978],
  "germany|hamm": [51.6739, 7.815],
  "germany|rosstal": [49.3956, 10.8878],
  "germany|sehnde": [52.3144, 9.9681],
  "germany|grolsheim": [49.8874, 7.918],
  "germany|gernsheim": [49.7533, 8.4897],
  "germany|alzenau": [50.0878, 9.0628],
  "germany|bonen": [51.5983, 7.7656],
  "germany|herne": [51.538, 7.2257],
  "germany|cologne": [50.9375, 6.9603],
  "germany|neustadt": [49.35, 11.2167],

  "hungary|budapest": [47.4979, 19.0402],

  "italy|rome": [41.9028, 12.4964],
  "italy|piacenza": [45.0522, 9.693],
  "italy|lodi": [45.3144, 9.503],
  "italy|romentino": [45.4618, 8.7245],
  "italy|bologna": [44.4949, 11.3426],
  "italy|somaglia": [45.1398, 9.6394],

  "japan|tokyo": [35.6762, 139.6503],

  "netherlands|tilburg": [51.5555, 5.0913],
  "netherlands|venlo": [51.3704, 6.1724],
  "netherlands|eindhoven": [51.4416, 5.4697],
  "netherlands|veghel": [51.6167, 5.55],
  "netherlands|bleiswijk": [52.0108, 4.5314],
  "netherlands|eemhaven": [51.89, 4.29],
  "netherlands|breda": [51.5719, 4.7683],
  "netherlands|born": [51.0317, 5.8097],
  "netherlands|roosendaal": [51.5308, 4.4653],

  "poland|warsaw": [52.2297, 21.0122],
  "poland|piotrkowtrybunalski": [51.4052, 19.703],
  "poland|poznan": [52.4064, 16.9252],
  "poland|blonie": [52.198, 20.617],
  "poland|wroclaw": [51.1079, 17.0385],

  "spain|madrid": [40.4168, -3.7038],
  "spain|barcelona": [41.3874, 2.1686],
  "spain|murcia": [37.9922, -1.1307],
  "spain|cadiz": [36.5271, -6.2886],
  "spain|albacete": [38.9942, -1.8585],
  "spain|lleida": [41.6176, 0.620],
  "spain|castellondelaplana": [39.9864, -0.0513],
  "spain|montcada": [39.5452, -0.3948],
  "spain|coslada": [40.4238, -3.5613],
  "spain|sanfernandodehenares": [40.4255, -3.5324],
  "spain|santboi": [41.3436, 2.0366],
  "spain|alcaladehenares": [40.4818, -3.3649],

  "sweden|jonkoping": [57.7826, 14.1618],
  "sweden|norrkoping": [58.5877, 16.1924],

  "switzerland|zurich": [47.3769, 8.5417],

  "unitedkingdom|london": [51.5072, -0.1276],
  "unitedkingdom|sheffield": [53.3811, -1.4701],
  "unitedkingdom|cambridge": [52.2053, 0.1218],
  "unitedkingdom|birmingham": [52.4862, -1.8904],
  "unitedkingdom|hemelhempstead": [51.7527, -0.47],
  "unitedkingdom|northampton": [52.2405, -0.9027],
  "unitedkingdom|daventry": [52.2574, -1.164],
  "unitedkingdom|coventry": [52.4068, -1.5197],
  "unitedkingdom|greenford": [51.5286, -0.3552],
  "unitedkingdom|nuneaton": [52.5232, -1.4652],
  "unitedkingdom|rugby": [52.3709, -1.2642],
  "unitedkingdom|miltonkeynes": [52.04, -0.7594],
  "unitedkingdom|hounslow": [51.4609, -0.3731],
  "unitedkingdom|westdrayton": [51.5059, -0.472],
  "unitedkingdom|walthamabbey": [51.6877, -0.0049],
};

function parseArgs(argv) {
  const options = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    propertyCoordinates: DEFAULT_PROPERTY_COORDINATES,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--input" && argv[index + 1]) {
      options.input = path.resolve(argv[index + 1]);
      index += 1;
    } else if (arg === "--output" && argv[index + 1]) {
      options.output = path.resolve(argv[index + 1]);
      index += 1;
    } else if (arg === "--property-coordinates" && argv[index + 1]) {
      options.propertyCoordinates = path.resolve(argv[index + 1]);
      index += 1;
    }
  }

  return options;
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
    const offset = buffer[0] === 0xff && buffer[1] === 0xfe ? 2 : 0;
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

function parseNumber(value) {
  if (!value) {
    return null;
  }

  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOwnership(value) {
  if (!value) {
    return null;
  }

  return parseNumber(String(value).replace(/%/g, ""));
}

function headerScore(header, alias) {
  if (header === alias) {
    return 100;
  }
  if (header.includes(alias)) {
    return 80;
  }
  return 0;
}

function mapHeaders(headers) {
  const normalized = headers.map((header) => normalizeText(header));
  const rules = [
    { key: "country", required: true, aliases: ["country"] },
    { key: "address", required: true, aliases: ["address", "location"] },
    { key: "partnership", required: true, aliases: ["partnership", "partner"] },
    { key: "industry", required: false, aliases: ["industry", "sector", "type"] },
    { key: "ownership", required: true, aliases: ["ownership", "stake"] },
    { key: "valueNok", required: true, aliases: ["totalcountryvalue", "valuenok", "value"] },
    { key: "valueUsd", required: false, aliases: ["totalcountryvalueusd", "valueusd"] },
  ];

  const mapped = {};

  for (const rule of rules) {
    let winnerIndex = -1;
    let winnerScore = -1;

    for (let index = 0; index < normalized.length; index += 1) {
      const candidate = normalized[index];
      let score = 0;

      for (const alias of rule.aliases) {
        score = Math.max(score, headerScore(candidate, alias));
      }

      if (score > winnerScore) {
        winnerScore = score;
        winnerIndex = index;
      }
    }

    if (winnerScore <= 0) {
      winnerIndex = -1;
    }

    if (rule.required && winnerIndex === -1) {
      throw new Error(`Missing required column: ${rule.key}`);
    }

    mapped[rule.key] = winnerIndex;
  }

  return mapped;
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

function createHashId(prefix, key) {
  const digest = crypto.createHash("sha1").update(key).digest("hex").slice(0, 14);
  return `${prefix}_${digest}`;
}

function resolveLatLng(city, country) {
  const cityKey = `${normalizeText(country)}|${normalizeText(city)}`;
  if (CITY_COORDS[cityKey]) {
    const [lat, lng] = CITY_COORDS[cityKey];
    return { lat, lng, source: "city_lookup" };
  }

  const countryKey = normalizeText(country);
  if (COUNTRY_CENTERS[countryKey]) {
    const [lat, lng] = COUNTRY_CENTERS[countryKey];
    return { lat, lng, source: "country_fallback" };
  }

  return { lat: null, lng: null, source: "missing" };
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

async function loadPropertyCoordinates(filePath) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(text);

    if (parsed && typeof parsed === "object" && parsed.entries && typeof parsed.entries === "object") {
      return parsed.entries;
    }

    if (parsed && typeof parsed === "object") {
      return parsed;
    }

    return {};
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
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

async function main() {
  const options = parseArgs(process.argv.slice(2));

  console.log("[1/6] Parsing raw CSV...");
  console.log(`- Input: ${options.input}`);

  const rawBuffer = await fs.readFile(options.input);
  const encoding = detectEncoding(rawBuffer);
  const text = decodeBuffer(rawBuffer, encoding);

  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("Input CSV is empty or missing rows.");
  }

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => parseCsvLine(line));

  console.log(`- Encoding detected: ${encoding}`);
  console.log("- Delimiter: ;");
  console.log(`- Headers: ${headers.length}`);
  console.log(`- Rows: ${rows.length}`);

  console.log("[2/6] Mapping columns dynamically...");
  const mapped = mapHeaders(headers);
  for (const [field, index] of Object.entries(mapped)) {
    console.log(`- ${field}: ${index === -1 ? "(not mapped)" : headers[index]}`);
  }

  console.log("[3/6] Loading pre-geocoded property coordinates...");
  console.log(`- Property coordinate file: ${options.propertyCoordinates}`);
  const propertyCoordinateEntries = await loadPropertyCoordinates(options.propertyCoordinates);
  console.log(`- Property coordinate entries loaded: ${Object.keys(propertyCoordinateEntries).length}`);

  console.log("[4/6] Grouping into city-level nodes...");
  const cityGroups = new Map();
  let preGeocodedPropertyCount = 0;

  for (const values of rows) {
    const country = getValue(values, mapped.country) || "Unknown";
    const address = getValue(values, mapped.address);
    const cityFromAddress = extractCity(address, country);
    const city = cityFromAddress || country;

    const groupKey = `${normalizeText(country)}|${normalizeText(city)}`;

    if (!cityGroups.has(groupKey)) {
      cityGroups.set(groupKey, {
        id: createHashId("city", groupKey),
        city,
        country,
        lat: null,
        lng: null,
        properties: [],
        total_ownership_sum: 0,
      });
    }

    const node = cityGroups.get(groupKey);

    const partnership = getValue(values, mapped.partnership);
    const ownershipRaw = getValue(values, mapped.ownership);

    const propertyId = createHashId("prop", [country, partnership, address, ownershipRaw].join("|"));
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
      sector: getValue(values, mapped.industry) || null,
      ownership_percent: parseOwnership(ownershipRaw),
      value_nok: parseNumber(getValue(values, mapped.valueNok)),
      value_usd: parseNumber(getValue(values, mapped.valueUsd)),
      lat: propertyLat,
      lng: propertyLng,
    };

    node.properties.push(property);

    if (typeof property.ownership_percent === "number") {
      node.total_ownership_sum += property.ownership_percent;
    }
  }

  console.log(`- City nodes created: ${cityGroups.size}`);
  console.log(`- Properties with pre-geocoded coordinates: ${preGeocodedPropertyCount}`);

  console.log("[5/6] Resolving city and property coordinates...");
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
      const resolved = resolveLatLng(node.city, node.country);
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

  console.log(`- Resolved by city lookup: ${cityLookupCount}`);
  console.log(`- Resolved by country fallback: ${countryFallbackCount}`);
  console.log(`- Resolved by property centroid: ${cityCentroidCount}`);
  console.log(`- Missing coordinates: ${missingCoordsCount}`);
  console.log(`- Properties filled from city coordinates: ${propertyCityFallbackCount}`);
  console.log(`- Properties still missing coordinates: ${propertyMissingCoordsCount}`);

  console.log("[6/6] Writing city dataset...");
  console.log(`- Output: ${options.output}`);

  await fs.mkdir(path.dirname(options.output), { recursive: true });
  await fs.writeFile(options.output, `${JSON.stringify(cities, null, 2)}\n`, "utf8");

  const totalProperties = cities.reduce((sum, city) => sum + city.properties.length, 0);
  console.log(`- Wrote ${cities.length} cities with ${totalProperties} aggregated properties`);
  console.log("- MVP layer 1 dataset is ready");
}

main().catch((error) => {
  console.error("City preprocessing failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
