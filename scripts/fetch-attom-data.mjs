import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_KEY = process.env.ATTOM_API_KEY;
if (!API_KEY) {
console.error("Error: ATTOM_API_KEY not set in environment");
process.exit(1);
}
const BASE_URL = "https://api.gateway.attomdata.com/propertyapi/v1.0.0";
const OUTPUT_FILE = path.join(__dirname, "../data/attom-data.json");
const DELAY_MS = 800; // ~75 req/min, stay under typical limits

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseAddress(addressStr) {
  if (!addressStr) return null;
  const parts = addressStr.split(", ");
  if (parts.length < 4) return null;
  // Format: "Name, Street, ZIP, City"
  const street = parts[1];
  const zip = parts[parts.length - 2];
  const city = parts[parts.length - 1];
  if (!street || !zip || !city) return null;
  return { address1: street, address2: `${city} ${zip}` };
}

async function fetchAttom(endpoint, params) {
  const query = new URLSearchParams(params).toString();
  const url = `${BASE_URL}/${endpoint}?${query}`;
  const res = await fetch(url, {
    headers: { accept: "application/json", apikey: API_KEY },
  });
  if (!res.ok) return null;
  const json = await res.json();
  if (json?.status?.code !== 0 || !json?.property?.length) return null;
  return json.property[0];
}

async function fetchSaleHistory(attomId) {
  const res = await fetch(
    `${BASE_URL}/saleshistory/expandedhistory?attomid=${attomId}`,
    { headers: { accept: "application/json", apikey: API_KEY } }
  );
  if (!res.ok) return null;
  const json = await res.json();
  if (json?.status?.code !== 0 || !json?.property?.length) return null;
  return json.property[0]?.saleHistory ?? null;
}

async function main() {
  const cities = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../data/cities.json"), "utf8")
  );

  const usCities = cities.filter((c) => c.country === "United States");
  const usProperties = usCities.flatMap((c) =>
    c.properties
      .filter((p) => !p.is_nbim_office)
      .map((p) => ({ ...p, cityName: c.city }))
  );

  console.log(`Processing ${usProperties.length} US properties...`);

  // Load existing results to allow resuming
  let results = {};
  if (fs.existsSync(OUTPUT_FILE)) {
    results = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf8"));
    console.log(`Resuming — ${Object.keys(results).length} already fetched.`);
  }

  let fetched = 0;
  let skipped = 0;
  let failed = 0;

  for (const prop of usProperties) {
    if (results[prop.id] !== undefined) {
      skipped++;
      continue;
    }

    const parsed = parseAddress(prop.address);
    if (!parsed) {
      results[prop.id] = null;
      failed++;
      continue;
    }

    process.stdout.write(
      `[${fetched + skipped + failed + 1}/${usProperties.length}] ${prop.name ?? prop.address}... `
    );

    const allEvents = await fetchAttom("allevents/detail", parsed);

    if (!allEvents) {
      console.log("no result");
      results[prop.id] = null;
      failed++;
    } else {
      const attomId = allEvents.identifier?.attomId;
      let saleHistory = null;
      if (attomId) {
        await sleep(DELAY_MS);
        saleHistory = await fetchSaleHistory(attomId);
      }

      results[prop.id] = {
        attomId,
        address: allEvents.address ?? null,
        sale: allEvents.sale ?? null,
        assessment: allEvents.assessment ?? null,
        avm: allEvents.avm ?? null,
        building: allEvents.building ?? null,
        saleHistory: saleHistory ?? null,
        fetchedAt: new Date().toISOString(),
      };

      const saleAmt = allEvents.sale?.amount?.saleamt;
      const mktValue = allEvents.assessment?.market?.mktttlvalue;
      console.log(
        `ok | sale: ${saleAmt ? "$" + (saleAmt / 1e6).toFixed(1) + "M" : "—"} | mkt: ${mktValue ? "$" + (mktValue / 1e6).toFixed(1) + "M" : "—"}`
      );
      fetched++;
    }

    // Save after every 10 properties
    if ((fetched + failed) % 10 === 0) {
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
    }

    await sleep(DELAY_MS);
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));

  console.log("\n=== Done ===");
  console.log(`Fetched: ${fetched}`);
  console.log(`No result: ${failed}`);
  console.log(`Skipped (already had): ${skipped}`);
  console.log(`Output: ${OUTPUT_FILE}`);
}

main().catch(console.error);
