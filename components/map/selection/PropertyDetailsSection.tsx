import { formatCountryWithFlag } from "@/components/map/formatCountryWithFlag";
import type { PropertyCoordinates } from "@/components/map/mapTypes";
import {
  getOfficeCategoryLabel,
  OfficeBadge,
  SectorBadge,
} from "@/components/map/selection/propertyVisuals";
import type { CityNode, CityProperty } from "@/types/cities";

const decimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

type PropertyDetailsSectionProps = {
  selectedCity: CityNode;
  selectedProperty: CityProperty;
  selectedPropertyCoordinates: PropertyCoordinates | null;
  showCoordinatesDebug: boolean;
  onBackToCity: () => void;
  backLabel?: string;
};

export default function PropertyDetailsSection({
  selectedCity,
  selectedProperty,
  selectedPropertyCoordinates,
  showCoordinatesDebug,
  onBackToCity,
  backLabel = "\u2190 Back to city list",
}: PropertyDetailsSectionProps) {
  const isOfficeLocation = Boolean(selectedProperty.is_nbim_office);
  const displayName = selectedProperty.office_name ?? selectedProperty.name ?? "Property";
  const partnerOrEntity = selectedProperty.office_entity ?? selectedProperty.partnership ?? "N/A";

  return (
    <>
      <section className="mt-2 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-md ring-1 ring-slate-200/70">

        <div className="px-4 py-3.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <SectorBadge sector={selectedProperty.sector} />
            {isOfficeLocation && (
              <OfficeBadge officeCategory={selectedProperty.office_category ?? null} />
            )}
          </div>

          <h3 className="mt-2 text-base font-semibold text-slate-900 text-balance">{displayName}</h3>

          <p className="mt-1 text-sm text-slate-700">{selectedProperty.address ?? "No address"}</p>
          <p className="mt-1 text-sm text-slate-600">
            {selectedCity.city}, {formatCountryWithFlag(selectedCity.country)}
          </p>
        </div>

        <div className="border-t border-slate-200/90 px-4 py-3 text-sm text-slate-700">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Partner / entity
          </p>
          <p className="mt-1 text-sm text-slate-800">{partnerOrEntity}</p>
        </div>

        <div className="border-t border-slate-200/90 px-4 py-3 text-sm text-slate-700 tabular-nums">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ownership</p>
          <p className="mt-1 text-sm text-slate-800">
            {selectedProperty.ownership_percent == null
              ? isOfficeLocation
                ? "N/A (operational office)"
                : "N/A"
              : `${decimalFormatter.format(selectedProperty.ownership_percent)}%`}
          </p>
        </div>

        {showCoordinatesDebug && selectedPropertyCoordinates && (
          <div className="border-t border-slate-200/90 px-4 py-3 text-sm text-slate-700 tabular-nums">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Coordinates
            </p>
            <p className="mt-1 text-sm text-slate-800">
              {selectedPropertyCoordinates.lat.toFixed(6)}, {selectedPropertyCoordinates.lng.toFixed(6)}
            </p>
          </div>
        )}

        {isOfficeLocation && (
          <div className="border-t border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
              Office context
            </p>
            <p className="mt-1 font-semibold">This is an actual NBIM office location.</p>
            <p className="mt-1">
              Type: {getOfficeCategoryLabel(selectedProperty.office_category ?? null)}
              {selectedProperty.office_entity
                ? ` · Entity: ${selectedProperty.office_entity}`
                : ""}
            </p>
          </div>
        )}
      </section>

      <button
        className="pointer-events-auto mt-4 rounded-md px-1 py-0.5 text-xs text-blue-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        onClick={onBackToCity}
        type="button"
      >
        {backLabel}
      </button>
    </>
  );
}
