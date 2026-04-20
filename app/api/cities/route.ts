import citiesJson from "@/data/cities.json";
import type { CityNode } from "@/types/cities";

const cities = citiesJson as CityNode[];

export const dynamic = "force-static";
export const revalidate = 86400;

export async function GET() {
  return Response.json(cities, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
