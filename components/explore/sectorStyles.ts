import type { Sector } from "@/components/explore/types";

// A calm, desaturated palette — one hue per sector so the eye can sort the map
// and the list at a glance without the colours shouting over the basemap.
type SectorStyle = {
  label: string;
  /** Marker / dot fill (hex, used by both the map and the card chips). */
  dot: string;
  /** Tailwind classes for the small sector pill in cards/filters. */
  chip: string;
};

export const SECTOR_STYLES: Record<Sector, SectorStyle> = {
  Office: {
    label: "Office",
    dot: "#4f6bed",
    chip: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100",
  },
  Retail: {
    label: "Retail",
    dot: "#c2603f",
    chip: "bg-orange-50 text-orange-700 ring-1 ring-orange-100",
  },
  Industrial: {
    label: "Industrial",
    dot: "#9a7b3f",
    chip: "bg-amber-50 text-amber-800 ring-1 ring-amber-100",
  },
  Residential: {
    label: "Residential",
    dot: "#3f9a72",
    chip: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
  },
  Fund: {
    label: "Fund",
    dot: "#8a6bd1",
    chip: "bg-violet-50 text-violet-700 ring-1 ring-violet-100",
  },
  Other: {
    label: "Other",
    dot: "#64748b",
    chip: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  },
};

export function sectorStyle(sector: Sector): SectorStyle {
  return SECTOR_STYLES[sector] ?? SECTOR_STYLES.Other;
}

/** Short human label for an ownership share, e.g. "100% — wholly owned". */
export function ownershipLabel(value: number | null): string {
  if (value == null) return "Stake undisclosed";
  const pct = Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
  if (value >= 100) return `${pct} · wholly owned`;
  if (value > 50) return `${pct} · majority`;
  if (value === 50) return `${pct} · joint`;
  return `${pct} · minority`;
}

// Slate → green ramp mirroring the map's ownership encoding (getPropertyColors).
export function ownershipDotColor(value: number | null): string {
  if (value == null) return "#cbd5e1";
  if (value >= 95) return "#22c55e";
  const ratio = Math.min(1, Math.max(0, value / 100));
  const hue = Math.round(Math.pow(ratio, 1.35) * 120);
  return `hsl(${hue}, 70%, 45%)`;
}
