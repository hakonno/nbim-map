import ExploreApp from "@/components/explore/ExploreApp";
import { buildExploreData } from "@/lib/exploreData";
import { parseBasemapPreference } from "@/components/map/gl/basemapProviders";
import { DATASET_YEAR } from "@/app/siteMetadata";

export default function Home() {
  // MapTiler key for the base map tiles. Read server-side and passed as a prop
  // so the env var stays MAPTILER_API_KEY (no NEXT_PUBLIC_ prefix). The key is
  // still visible in browser tile requests — it is protected by MapTiler origin
  // restrictions, not secrecy.
  //
  // The key is optional: MapTiler is only the first tier of the basemap chain
  // in `components/map/gl/basemapProviders`. Without it — or once its credits
  // are spent — the map opens on the keyless OpenFreeMap tier instead, with
  // raw OpenStreetMap raster tiles below that. `MAP_PROVIDER` pins a tier
  // explicitly (`auto` | `maptiler` | `openfreemap` | `osm`).
  const maptilerApiKey = process.env.MAPTILER_API_KEY?.trim() ?? "";
  const mapProvider = parseBasemapPreference(process.env.MAP_PROVIDER);

  if (!maptilerApiKey && mapProvider === "auto") {
    console.info(
      "[explore] MAPTILER_API_KEY is not configured — using the keyless backup basemap."
    );
  }

  // Built on the server; only the trimmed, client-safe array is serialized into
  // the page. The list/filters render server-side (crawlable), the map hydrates
  // client-side. Property detail renders via the intercepted /property/[id]
  // route (see app/(explore)/@modal).
  const data = buildExploreData();

  return (
    <main className="flex flex-1">
      <ExploreApp
        data={data}
        maptilerApiKey={maptilerApiKey}
        mapProvider={mapProvider}
        datasetYear={DATASET_YEAR}
      />
    </main>
  );
}
