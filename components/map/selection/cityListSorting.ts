import type { CityNode } from "@/types/cities";

export type CitySortOption = "investments" | "combined" | "alphabetical" | "proximity";

export type SortedCityEntry = {
  city: CityNode;
  distanceKm: number | null;
};

const cityNameCollator = new Intl.Collator("en", {
  sensitivity: "base",
  numeric: true,
});

function compareCityName(a: CityNode, b: CityNode) {
  const byCity = cityNameCollator.compare(a.city, b.city);
  if (byCity !== 0) {
    return byCity;
  }

  return cityNameCollator.compare(a.country, b.country);
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineDistanceKm(from: [number, number], to: [number, number]) {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(to[0] - from[0]);
  const deltaLng = toRadians(to[1] - from[1]);
  const fromLat = toRadians(from[0]);
  const toLat = toRadians(to[0]);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export function sortCitiesForList(
  cities: CityNode[],
  sortOption: CitySortOption,
  referencePoint: [number, number] | null
): SortedCityEntry[] {
  const maxPropertyCount = Math.max(...cities.map((city) => city.properties.length), 1);
  const maxOwnershipSum = Math.max(...cities.map((city) => city.total_ownership_sum), 1);

  const withDistance = cities.map((city) => {
    const hasCoordinates = typeof city.lat === "number" && typeof city.lng === "number";
    const distanceKm = referencePoint && hasCoordinates ? haversineDistanceKm(referencePoint, [city.lat, city.lng]) : null;
    const investmentsScore = city.properties.length / maxPropertyCount;
    const ownershipScore = city.total_ownership_sum / maxOwnershipSum;
    const combinedScore = investmentsScore * 0.55 + ownershipScore * 0.45;

    return {
      city,
      distanceKm,
      combinedScore,
    };
  });

  if (sortOption === "investments") {
    return withDistance.sort((a, b) => {
      const propertyCountDelta = b.city.properties.length - a.city.properties.length;
      if (propertyCountDelta !== 0) {
        return propertyCountDelta;
      }

      return compareCityName(a.city, b.city);
    });
  }

  if (sortOption === "alphabetical") {
    return withDistance.sort((a, b) => compareCityName(a.city, b.city));
  }

  if (sortOption === "proximity") {
    return withDistance.sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) {
        return compareCityName(a.city, b.city);
      }

      if (a.distanceKm == null) {
        return 1;
      }

      if (b.distanceKm == null) {
        return -1;
      }

      const distanceDelta = a.distanceKm - b.distanceKm;
      if (distanceDelta !== 0) {
        return distanceDelta;
      }

      return compareCityName(a.city, b.city);
    });
  }

  return withDistance.sort((a, b) => {
    const combinedDelta = b.combinedScore - a.combinedScore;
    if (combinedDelta !== 0) {
      return combinedDelta;
    }

    return compareCityName(a.city, b.city);
  });
}
