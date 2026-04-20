import CityMap from "@/components/CityMap";

export default function Home() {
  const isDevelopment = process.env.NODE_ENV !== "production";
  const publicKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  const devKey = process.env.SECRET_DEV_GOOGLE_MAPS_API_KEY?.trim() ?? "";

  const googleMapsEmbedApiKey = isDevelopment ? devKey : publicKey;

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

  return (
    <main className="flex flex-1 min-h-[100svh]">
      <CityMap googleMapsEmbedApiKey={googleMapsEmbedApiKey} />
    </main>
  );
}
