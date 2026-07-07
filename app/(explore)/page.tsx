import ExploreApp from "@/components/explore/ExploreApp";
import { buildExploreData } from "@/lib/exploreData";
import { DATASET_YEAR } from "@/app/siteMetadata";

function isDatasetStale(datasetYear: string, currentYear: number): boolean {
  // NBIM publishes real-estate holdings once a year. A one-year lag is normal
  // (e.g. 2025 data shown in 2026); flag it only when the calendar has moved
  // two years past the latest disclosure without a newer release.
  const year = parseInt(datasetYear, 10);
  return Number.isFinite(year) && currentYear > year + 1;
}

export default function Home() {
  // MapTiler key for the base map tiles. Read server-side and passed as a prop
  // so the env var stays MAPTILER_API_KEY (no NEXT_PUBLIC_ prefix). The key is
  // still visible in browser tile requests — it is protected by MapTiler origin
  // restrictions, not secrecy.
  const maptilerApiKey = process.env.MAPTILER_API_KEY?.trim() ?? "";

  if (!maptilerApiKey) {
    console.error(
      "[explore] MAPTILER_API_KEY is not configured — the homepage falls back to the list-only view."
    );
  }

  // Built on the server; only the trimmed, client-safe array is serialized into
  // the page. The list/filters render server-side (crawlable), the map hydrates
  // client-side. Property detail renders via the intercepted /property/[id]
  // route (see app/(explore)/@modal).
  const data = buildExploreData();

  const currentYear = new Date().getFullYear();

  return (
    <main className="flex flex-1">
      <ExploreApp
        data={data}
        maptilerApiKey={maptilerApiKey}
        datasetYear={DATASET_YEAR}
        currentYear={currentYear}
        isDatasetStale={isDatasetStale(DATASET_YEAR, currentYear)}
      />
    </main>
  );
}
