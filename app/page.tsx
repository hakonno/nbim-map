import CityMap from "@/components/CityMap";
import citiesJson from "@/data/cities.json";
import type { CityNode } from "@/types/cities";

const cityNodes = citiesJson as CityNode[];

export default function Home() {
  return (
    <main className="flex flex-1 min-h-[100svh]">
      <CityMap cities={cityNodes} />
    </main>
  );
}
