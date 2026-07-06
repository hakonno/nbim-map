import ExploreApp from "@/components/explore/ExploreApp";
import { buildExploreData } from "@/lib/exploreData";
import { SITE_URL } from "@/app/siteMetadata";

export default function Home() {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const publicKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  const devKey = process.env.SECRET_DEV_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  const googleMapsEmbedApiKey = isDevelopment ? devKey : publicKey;

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
  // client-side.
  const data = buildExploreData();

  return (
    <main className="flex flex-1">
      <ExploreApp
        data={data}
        maptilerApiKey={maptilerApiKey}
        googleMapsEmbedApiKey={googleMapsEmbedApiKey}
        siteUrl={SITE_URL}
      />
    </main>
  );
}
