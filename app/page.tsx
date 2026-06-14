import Link from "next/link";

import CityMap from "@/components/CityMap";

export default function Home() {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const publicKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  const devKey = process.env.SECRET_DEV_GOOGLE_MAPS_API_KEY?.trim() ?? "";

  const googleMapsEmbedApiKey = isDevelopment ? devKey : publicKey;

  // MapTiler key for the base map tiles. Read server-side and passed as a prop
  // so the env var stays MAPTILER_API_KEY (no NEXT_PUBLIC_ prefix). The key is
  // still visible in browser tile requests — it is protected by MapTiler origin
  // restrictions, not secrecy. Falls back to OpenStreetMap tiles when unset.
  const maptilerApiKey = process.env.MAPTILER_API_KEY?.trim() ?? "";

  if (isDevelopment && !devKey) {
    console.error(
      "[maps] Street View embed disabled in local dev: SECRET_DEV_GOOGLE_MAPS_API_KEY is not configured."
    );
  }

  if (!isDevelopment && !publicKey) {
    console.error(
      "[maps] Street View embed disabled in production: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not configured."
    );
  }

  if (!maptilerApiKey) {
    console.error(
      "[maps] MAPTILER_API_KEY is not configured — falling back to OpenStreetMap base tiles."
    );
  }

  return (
    <main className="relative flex flex-1 min-h-[100svh]">
      <CityMap googleMapsEmbedApiKey={googleMapsEmbedApiKey} maptilerApiKey={maptilerApiKey} />
      {/* Crawlable, server-rendered link into the non-map content graph (the
          map itself is client-only, so this anchor is the homepage's path to
          /properties for search engines and AI crawlers). */}
      <Link
        href="/properties"
        className="pointer-events-auto absolute bottom-3 left-1/2 z-[640] -translate-x-1/2 rounded-full border border-slate-300 bg-white/95 px-4 py-2 text-sm font-medium text-slate-700 shadow-md backdrop-blur transition-colors hover:bg-white hover:text-slate-900"
      >
        Browse all properties (list view) →
      </Link>
    </main>
  );
}
