import { formatCountryWithFlag } from "@/components/map/formatCountryWithFlag";
import type { PropertyCoordinates } from "@/components/map/mapTypes";
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
};

export default function PropertyDetailsSection({
  selectedCity,
  selectedProperty,
  selectedPropertyCoordinates,
  showCoordinatesDebug,
  onBackToCity,
}: PropertyDetailsSectionProps) {
  return (
    <>
      <p className="mt-2 text-sm text-slate-700">{selectedProperty.address ?? "No address"}</p>
      <p className="mt-1 text-sm text-slate-600">
        {selectedCity.city}, {formatCountryWithFlag(selectedCity.country)}
      </p>

      <div className="mt-3 space-y-1 text-sm text-slate-700 tabular-nums">
        <p>
          <span className="text-slate-500">Sector</span> {selectedProperty.sector ?? "N/A"}
        </p>
        <p>
          <span className="text-slate-500">Partner</span> {selectedProperty.partnership ?? "N/A"}
        </p>
        <p>
          <span className="text-slate-500">Ownership</span>{" "}
          {selectedProperty.ownership_percent == null
            ? "N/A"
            : `${decimalFormatter.format(selectedProperty.ownership_percent)}%`}
        </p>
        {showCoordinatesDebug && selectedPropertyCoordinates && (
          <p>
            <span className="text-slate-500">Coordinates</span>{" "}
            {selectedPropertyCoordinates.lat.toFixed(6)}, {selectedPropertyCoordinates.lng.toFixed(6)}
          </p>
        )}
      </div>

      <button
        className="pointer-events-auto mt-4 rounded-md px-1 py-0.5 text-xs text-blue-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        onClick={onBackToCity}
        type="button"
      >
        ← Back to city list
      </button>
    </>
  );
}
