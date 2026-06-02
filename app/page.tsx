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
    <main className="flex flex-1 min-h-[100svh]">
      <CityMap googleMapsEmbedApiKey={googleMapsEmbedApiKey} maptilerApiKey={maptilerApiKey} />
    </main>
  );
}
