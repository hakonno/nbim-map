import type { CityProperty } from "@/types/cities";

export type PropertySortOption = "ownership" | "alphabetical" | "partnership" | "sector";

const textCollator = new Intl.Collator("en", {
  sensitivity: "base",
  numeric: true,
});

function normalizedText(value: string | null | undefined) {
  return value?.trim() || "";
}

function compareByName(a: CityProperty, b: CityProperty) {
  const nameDelta = textCollator.compare(normalizedText(a.name), normalizedText(b.name));
  if (nameDelta !== 0) {
    return nameDelta;
  }

  return textCollator.compare(normalizedText(a.address), normalizedText(b.address));
}

function compareOptionalGroup(
  aValue: string | null,
  bValue: string | null,
  aProperty: CityProperty,
  bProperty: CityProperty
) {
  const aText = normalizedText(aValue);
  const bText = normalizedText(bValue);

  if (!aText && !bText) {
    return compareByName(aProperty, bProperty);
  }

  if (!aText) {
    return 1;
  }

  if (!bText) {
    return -1;
  }

  const primaryDelta = textCollator.compare(aText, bText);
  if (primaryDelta !== 0) {
    return primaryDelta;
  }

  return compareByName(aProperty, bProperty);
}

export function sortCityPropertiesForList<T extends CityProperty>(properties: T[], sortOption: PropertySortOption): T[] {
  const sorted = [...properties];

  if (sortOption === "alphabetical") {
    return sorted.sort(compareByName);
  }

  if (sortOption === "partnership") {
    return sorted.sort((a, b) => compareOptionalGroup(a.partnership, b.partnership, a, b));
  }

  if (sortOption === "sector") {
    return sorted.sort((a, b) => compareOptionalGroup(a.sector, b.sector, a, b));
  }

  return sorted.sort((a, b) => {
    if (a.ownership_percent == null && b.ownership_percent == null) {
      return compareByName(a, b);
    }

    if (a.ownership_percent == null) {
      return 1;
    }

    if (b.ownership_percent == null) {
      return -1;
    }

    const ownershipDelta = b.ownership_percent - a.ownership_percent;
    if (ownershipDelta !== 0) {
      return ownershipDelta;
    }

    return compareByName(a, b);
  });
}
