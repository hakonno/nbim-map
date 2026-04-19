import type { CityNode, CityProperty } from "@/types/cities";

type PropertyCoordinates = {
  lat: number;
  lng: number;
};

type MapSelectionPanelProps = {
  mode: "global" | "city" | "property";
  selectedCity: CityNode | null;
  selectedProperty: CityProperty | null;
  selectedPropertyCoordinates: PropertyCoordinates | null;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchResults: Array<{
    id: string;
    type: "city" | "property";
    name: string;
    subtitle: string;
    lat: number;
    lng: number;
    cityId: string;
    propertyId?: string;
  }>;
  onSelectSearchResult: (result: {
    id: string;
    type: "city" | "property";
    name: string;
    subtitle: string;
    lat: number;
    lng: number;
    cityId: string;
    propertyId?: string;
  }) => void;
  onClearSearch: () => void;
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
  searchQuery,
  onSearchQueryChange,
  searchResults,
  onSelectSearchResult,
  onClearSearch,
  showCoordinatesDebug,
  onClose,
  onBackToCity,
  onSelectProperty,
}: MapSelectionPanelProps) {
  const cityPropertyFilter = searchQuery.trim().toLowerCase();
  const filteredCityProperties =
    selectedCity && cityPropertyFilter.length >= 2
      ? selectedCity.properties.filter((property) => {
          const haystack = [property.name, property.address, property.sector, property.partnership]
            .filter((part): part is string => Boolean(part && part.trim()))
            .join(" ")
            .toLowerCase();
          return haystack.includes(cityPropertyFilter);
        })
      : selectedCity?.properties ?? [];

  return (
    <aside className="safe-area-bottom absolute bottom-0 left-0 right-0 z-[500] max-h-[42svh] rounded-t-2xl border-t border-slate-200 bg-white/96 p-3 shadow-2xl backdrop-blur md:bottom-4 md:left-auto md:right-4 md:top-4 md:max-h-[calc(100svh-2rem)] md:w-[360px] md:rounded-2xl md:border md:p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900 text-balance">
          {mode === "global"
            ? "Search Investments"
            : mode === "property"
            ? selectedProperty?.name ?? "Property details"
            : selectedCity
              ? `${selectedCity.city}, ${selectedCity.country}`
              : "Search Investments"}
        </h2>

        {mode !== "global" && (
          <button
            type="button"
            onClick={onClose}
            className="pointer-events-auto rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            aria-label="Close details and return to map overview"
          >
            Close
          </button>
        )}
      </div>

      <div className="pointer-events-auto mt-2">
        <label htmlFor="selection-search" className="sr-only">
          Search
        </label>
        <div className="relative">
          <input
            id="selection-search"
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder={mode === "global" ? "Search country, city or property" : "Filter properties in this city"}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:text-sm"
            autoComplete="off"
          />
          {searchQuery.trim().length > 0 && (
            <button
              type="button"
              onClick={onClearSearch}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Clear search"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {mode === "global" && (
        <>
          <p className="mt-2 text-xs text-slate-600">Search in NBIM dataset. Select a result to zoom and open details.</p>
          {searchQuery.trim().length >= 2 && (
            <div className="mt-2 max-h-[26svh] space-y-2 overflow-y-auto overscroll-contain pr-1 md:max-h-[calc(100svh-15rem)]">
              {searchResults.length === 0 && (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  No local matches. Try another city, property name, or address.
                </p>
              )}

              {searchResults.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  className="pointer-events-auto w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  onClick={() => onSelectSearchResult(result)}
                >
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    {result.type === "city" ? "City" : "Property"}
                  </p>
                  <h3 className="text-sm font-semibold text-slate-900 text-balance">{result.name}</h3>
                  {result.subtitle && <p className="mt-1 text-xs text-slate-700">{result.subtitle}</p>}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {mode === "city" && selectedCity && (
        <>
          <p className="mt-1 text-sm text-slate-700">
            {integerFormatter.format(filteredCityProperties.length)} of {integerFormatter.format(selectedCity.properties.length)} investments shown
          </p>

          <div className="mt-3 max-h-[26svh] space-y-2 overflow-y-auto overscroll-contain pr-1 md:max-h-[calc(100svh-11.5rem)]">
            {filteredCityProperties.map((property) => (
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

            {filteredCityProperties.length === 0 && (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                No properties match this filter.
              </p>
            )}
          </div>
        </>
      )}

      {mode === "property" && selectedCity && selectedProperty && (
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
