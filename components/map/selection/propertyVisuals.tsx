import type { CityProperty } from "@/types/cities";
import type { ReactElement } from "react";

type OfficeCategory = CityProperty["office_category"];

function cx(...tokens: Array<string | false | null | undefined>) {
  return tokens.filter(Boolean).join(" ");
}

function normalizeSector(sector: string | null | undefined) {
  return (sector ?? "").trim().toLowerCase();
}

function BuildingGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="8" height="12" rx="1.25" />
      <path d="M10 6h4v8h-4" />
      <path d="M5 5h2M5 8h2M5 11h2" />
    </svg>
  );
}

function StorefrontGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 6h12l-1-3H3L2 6Z" />
      <path d="M3 6v6h10V6" />
      <path d="M6 12V9h4v3" />
    </svg>
  );
}

function FactoryGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 14V7l3 2V7l3 2V4h6v10H2Z" />
      <path d="M11 4V2h2v2" />
    </svg>
  );
}

function HomeGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 7.5 8 3l5.5 4.5V14h-11V7.5Z" />
      <path d="M6.25 14V9.75h3.5V14" />
    </svg>
  );
}

function FundGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 13h12" />
      <path d="M4 12V8m4 4V6m4 6V4" />
      <path d="m3.5 4.5 2.5 1.5 2.5-2 2.5 1" />
    </svg>
  );
}

function PinGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 14s4-4.22 4-7a4 4 0 1 0-8 0c0 2.78 4 7 4 7Z" />
      <circle cx="8" cy="7" r="1.6" />
    </svg>
  );
}

type SectorStyle = {
  label: string;
  className: string;
  icon: ({ className }: { className?: string }) => ReactElement;
};

function getSectorStyle(sector: string | null | undefined): SectorStyle {
  const normalized = normalizeSector(sector);

  if (normalized === "office") {
    return {
      label: "Office",
      className: "border-slate-300 bg-slate-100 text-slate-700",
      icon: BuildingGlyph,
    };
  }

  if (normalized === "retail") {
    return {
      label: "Retail",
      className: "border-amber-300 bg-amber-100 text-amber-800",
      icon: StorefrontGlyph,
    };
  }

  if (normalized === "industrial") {
    return {
      label: "Industrial",
      className: "border-cyan-300 bg-cyan-100 text-cyan-800",
      icon: FactoryGlyph,
    };
  }

  if (normalized === "residential") {
    return {
      label: "Residential",
      className: "border-rose-300 bg-rose-100 text-rose-800",
      icon: HomeGlyph,
    };
  }

  if (normalized === "fund") {
    return {
      label: "Fund",
      className: "border-emerald-300 bg-emerald-100 text-emerald-800",
      icon: FundGlyph,
    };
  }

  return {
    label: sector?.trim() || "Unspecified",
    className: "border-sky-300 bg-sky-100 text-sky-800",
    icon: PinGlyph,
  };
}

function formatOfficeCategoryLabel(officeCategory: OfficeCategory) {
  if (officeCategory === "head_office") {
    return "Head office";
  }

  if (officeCategory === "real_estate_office") {
    return "Real estate office";
  }

  return "NBIM office";
}

type SectorBadgeProps = {
  sector: string | null | undefined;
  className?: string;
};

export function SectorBadge({ sector, className }: SectorBadgeProps) {
  const style = getSectorStyle(sector);
  const Icon = style.icon;

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        style.className,
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {style.label}
    </span>
  );
}

type OfficeBadgeProps = {
  officeCategory: OfficeCategory;
  className?: string;
};

export function OfficeBadge({ officeCategory, className }: OfficeBadgeProps) {
  if (!officeCategory) {
    return null;
  }

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800",
        className
      )}
    >
      <BuildingGlyph className="h-3.5 w-3.5" />
      {formatOfficeCategoryLabel(officeCategory)}
    </span>
  );
}

export function getOfficeCategoryLabel(officeCategory: OfficeCategory) {
  return formatOfficeCategoryLabel(officeCategory);
}
