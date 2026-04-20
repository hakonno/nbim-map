import { memo, useCallback, useEffect, useRef, useState } from "react";

import { formatCountryWithFlag } from "@/components/map/formatCountryWithFlag";
import type { PropertyCoordinates, SearchResult } from "@/components/map/mapTypes";
import CityPropertiesSection from "@/components/map/selection/CityPropertiesSection";
import type { CitySortOption } from "@/components/map/selection/cityListSorting";
import GlobalSearchSection from "@/components/map/selection/GlobalSearchSection";
import type { PropertySortOption } from "@/components/map/selection/propertySorting";
import PropertyDetailsSection from "@/components/map/selection/PropertyDetailsSection";
import type { CityNode, CityProperty } from "@/types/cities";

type MapSelectionPanelProps = {
  mode: "global" | "city" | "property";
  selectedCity: CityNode | null;
  selectedProperty: CityProperty | null;
  selectedPropertyCoordinates: PropertyCoordinates | null;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchResults: SearchResult[];
  mappableCities: CityNode[];
  citySortOption: CitySortOption;
  onCitySortOptionChange: (option: CitySortOption) => void;
  mapCenter: [number, number] | null;
  onSelectSearchResult: (result: SearchResult) => void;
  onSelectCity: (cityId: string) => void;
  onClearSearch: () => void;
  showCoordinatesDebug: boolean;
  onClose: () => void;
  onBackToCity: () => void;
  onSelectProperty: (propertyId: string) => void;
  onPanelHeightChange: (height: number) => void;
};

function MapSelectionPanel({
  mode,
  selectedCity,
  selectedProperty,
  selectedPropertyCoordinates,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  mappableCities,
  citySortOption,
  onCitySortOptionChange,
  mapCenter,
  onSelectSearchResult,
  onSelectCity,
  onClearSearch,
  showCoordinatesDebug,
  onClose,
  onBackToCity,
  onSelectProperty,
  onPanelHeightChange,
}: MapSelectionPanelProps) {
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);
  const [propertySortOption, setPropertySortOption] = useState<PropertySortOption>("ownership");
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const panelElement = panelRef.current;
    if (!panelElement) {
      return;
    }

    const updateMobilePanelHeight = () => {
      const nextHeight = Math.ceil(panelElement.getBoundingClientRect().height);
      document.documentElement.style.setProperty("--map-mobile-panel-height", `${nextHeight}px`);
      onPanelHeightChange(nextHeight);
    };

    updateMobilePanelHeight();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        updateMobilePanelHeight();
      });
      resizeObserver.observe(panelElement);
    }

    window.addEventListener("resize", updateMobilePanelHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateMobilePanelHeight);
      document.documentElement.style.removeProperty("--map-mobile-panel-height");
    };
  }, [onPanelHeightChange]);

  useEffect(() => {
    document.documentElement.style.setProperty("--map-mobile-panel-expanded", isPanelExpanded ? "1" : "0");

    return () => {
      document.documentElement.style.removeProperty("--map-mobile-panel-expanded");
    };
  }, [isPanelExpanded]);

  const handleTogglePanel = useCallback(() => {
    setIsPanelExpanded((current) => !current);
  }, []);

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
    <aside
      ref={panelRef}
      className={`safe-area-bottom pointer-events-auto absolute inset-x-2 bottom-2 z-[650] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/96 p-3 shadow-2xl backdrop-blur transition-[max-height] duration-300 ease-out sm:inset-x-3 sm:bottom-3 md:bottom-4 md:left-auto md:right-4 md:top-4 md:max-h-[calc(100svh-2rem)] md:w-[360px] md:p-4 ${
        isPanelExpanded ? "max-h-[min(58svh,30rem)]" : "max-h-[6rem]"
      }`}
    >
      <button
        type="button"
        className="mx-auto mb-2 flex w-full items-center justify-center rounded-lg py-1 text-slate-600 active:bg-slate-100/80 md:hidden"
        onClick={handleTogglePanel}
        aria-label={isPanelExpanded ? "Hide panel" : "Show panel"}
        aria-controls="map-selection-panel-content"
        aria-expanded={isPanelExpanded}
      >
        <span aria-hidden="true" className="text-base leading-none">
          {isPanelExpanded ? "v" : "^"}
        </span>
      </button>

      <div id="map-selection-panel-content" className="min-h-0 overflow-y-auto overscroll-contain pr-0.5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900 text-balance sm:text-lg">
            {mode === "global"
              ? "Search Investments"
              : mode === "property"
              ? selectedProperty?.name ?? "Property details"
              : selectedCity
                ? `${selectedCity.city}, ${formatCountryWithFlag(selectedCity.country)}`
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
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              onFocus={() => setIsPanelExpanded(true)}
              placeholder={mode === "global" ? "Search country, city or property" : "Filter properties in this city"}
              inputMode="search"
              enterKeyHint="search"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:text-sm"
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
          <GlobalSearchSection
            searchQuery={searchQuery}
            searchResults={searchResults}
            cities={mappableCities}
            citySortOption={citySortOption}
            onCitySortOptionChange={onCitySortOptionChange}
            onSelectSearchResult={onSelectSearchResult}
            onSelectCity={onSelectCity}
            mapCenter={mapCenter}
          />
        )}

        {mode === "city" && selectedCity && (
          <CityPropertiesSection
            selectedCity={selectedCity}
            filteredCityProperties={filteredCityProperties}
            propertySortOption={propertySortOption}
            onPropertySortOptionChange={setPropertySortOption}
            onSelectProperty={onSelectProperty}
          />
        )}

        {mode === "property" && selectedCity && selectedProperty && (
          <PropertyDetailsSection
            selectedCity={selectedCity}
            selectedProperty={selectedProperty}
            selectedPropertyCoordinates={selectedPropertyCoordinates}
            showCoordinatesDebug={showCoordinatesDebug}
            onBackToCity={onBackToCity}
          />
        )}
      </div>
    </aside>
  );
}

export default memo(MapSelectionPanel);
