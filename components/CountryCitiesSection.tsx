"use client";

import { useState } from "react";
import Link from "next/link";
import { cityToSlug } from "@/lib/citySlug";
import type { CityNode } from "@/types/cities";

interface CountryCitiesSectionProps {
  cities: CityNode[];
}

export default function CountryCitiesSection({
  cities,
}: CountryCitiesSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate visible cities (approximately 3 rows)
  // Assuming ~4-5 cities per row depending on name length
  const visibleCount = isExpanded ? cities.length : 30;
  const displayedCities = cities.slice(0, visibleCount);
  const hasMore = cities.length > visibleCount;

  return (
    <section aria-labelledby="cities-heading" className="flex flex-col gap-2">
      <h2 id="cities-heading" className="text-sm font-semibold text-slate-700">
        Cities
      </h2>

      <ul className="flex flex-wrap gap-2">
        {displayedCities.map((city) => (
          <li key={city.id}>
            <Link
              href={`/city/${cityToSlug(city.city, city.country)}`}
              className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
            >
              {city.city}{" "}
              <span className="ml-1 text-slate-400">
                ({city.properties.length})
              </span>
            </Link>
          </li>
        ))}
        {hasMore && !isExpanded && (
          <li>
            <button
              onClick={() => setIsExpanded(true)}
              className="inline-flex items-center px-3 py-1 text-sm text-slate-600 transition-colors hover:text-slate-700"
            >
              ...show all
            </button>
          </li>
        )}
      </ul>
    </section>
  );
}
