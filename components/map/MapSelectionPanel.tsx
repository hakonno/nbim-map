import type { CityNode, CityProperty } from "@/types/cities";

type PropertyCoordinates = {
  lat: number;
  lng: number;
};

type MapSelectionPanelProps = {
  mode: "city" | "property";
  selectedCity: CityNode | null;
  selectedProperty: CityProperty | null;
  selectedPropertyCoordinates: PropertyCoordinates | null;
  showCoordinatesDebug: boolean;
  onClose: () => void;
  onBackToCity: () => void;
  onSelectProperty: (propertyId: string) => void;
};

const decimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export default function MapSelectionPanel({
  mode,
  selectedCity,
  selectedProperty,
  selectedPropertyCoordinates,
  showCoordinatesDebug,
  onClose,
  onBackToCity,
  onSelectProperty,
}: MapSelectionPanelProps) {
  if (!selectedCity) {
    return null;
  }

  return (
    <aside className="safe-area-bottom absolute bottom-0 left-0 right-0 z-[500] max-h-[42svh] rounded-t-2xl border-t border-slate-200 bg-white/96 p-3 shadow-2xl backdrop-blur md:bottom-4 md:left-auto md:right-4 md:top-4 md:max-h-[calc(100svh-2rem)] md:w-[360px] md:rounded-2xl md:border md:p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900 text-balance">
          {mode === "property"
            ? selectedProperty?.name ?? "Property details"
            : `${selectedCity.city}, ${selectedCity.country}`}
        </h2>

        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          aria-label="Close details and return to map overview"
        >
          Close
        </button>
      </div>

      {mode === "city" && (
        <>
          <p className="mt-1 text-sm text-slate-700">
            {integerFormatter.format(selectedCity.properties.length)} investments in this city
          </p>

          <div className="mt-3 max-h-[26svh] space-y-2 overflow-y-auto overscroll-contain pr-1 md:max-h-[calc(100svh-11.5rem)]">
            {selectedCity.properties.map((property) => (
              <button
                key={property.id}
                type="button"
                className="pointer-events-auto w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                onClick={() => onSelectProperty(property.id)}
                aria-label={`Select property ${property.name ?? "Unnamed property"}`}
              >
                <h3 className="text-sm font-semibold text-slate-900 text-balance">{property.name ?? "Unnamed property"}</h3>
                <p className="mt-1 text-xs text-slate-700">{property.address ?? "No address"}</p>
                <p className="mt-2 text-xs text-slate-600">
                  {property.sector ?? "Unknown sector"} · {property.partnership ?? "Unknown partner"}
                </p>
                <p className="mt-1 text-xs text-slate-600 tabular-nums">
                  Ownership{" "}
                  {property.ownership_percent == null
                    ? "N/A"
                    : `${decimalFormatter.format(property.ownership_percent)}%`}
                </p>
              </button>
            ))}
          </div>
        </>
      )}

      {mode === "property" && selectedProperty && (
        <>
          <p className="mt-2 text-sm text-slate-700">{selectedProperty.address ?? "No address"}</p>
          <p className="mt-1 text-sm text-slate-600">
            {selectedCity.city}, {selectedCity.country}
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
      )}
    </aside>
  );
}
