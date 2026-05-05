import { memo, useCallback, useEffect, useRef, useState } from "react";

import { formatCountryWithFlag } from "@/components/map/formatCountryWithFlag";
import type { FlatProperty, PropertyCoordinates, SearchResult } from "@/components/map/mapTypes";
import AttomDataSection from "@/components/map/selection/AttomDataSection";
import { setRateInfoOpen } from "@/components/map/hooks/useExchangeRate";
import RateInfoModal from "@/components/map/RateInfoModal";
import type { Currency } from "@/utils/formatCurrency";
import CityPropertiesSection from "@/components/map/selection/CityPropertiesSection";
import CountryPropertiesSection from "@/components/map/selection/CountryPropertiesSection";
import type { CitySortOption } from "@/components/map/selection/cityListSorting";
import GlobalSearchSection from "@/components/map/selection/GlobalSearchSection";
import type { PropertySortOption } from "@/components/map/selection/propertySorting";
import PropertyDetailsSection from "@/components/map/selection/PropertyDetailsSection";
import type { CityNode, CityProperty } from "@/types/cities";

type MapSelectionPanelProps = {
  mode: "global" | "country" | "city" | "property";
  selectedCountry: string | null;
  selectedCity: CityNode | null;
  selectedCountryProperties: FlatProperty[];
  totalRealEstateValueNok: number;
  selectedProperty: CityProperty | null;
  selectedPropertyCoordinates: PropertyCoordinates | null;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchResults: SearchResult[];
  mappableCities: CityNode[];
  citySortOption: CitySortOption;
  onCitySortOptionChange: (option: CitySortOption) => void;
  onSelectCountry: (country: string) => void;
  mapCenter: [number, number] | null;
  onSelectSearchResult: (result: SearchResult) => void;
  onSelectCity: (cityId: string) => void;
  onClearSearch: () => void;
  showCoordinatesDebug: boolean;
  onClose: () => void;
  onBackToGlobal: () => void;
  onBackToCity: () => void;
  onSelectProperty: (propertyId: string) => void;
  onPanelHeightChange: (height: number) => void;
  googleMapsEmbedApiKey: string;
  currency: Currency;
  onCurrencyChange: (c: Currency) => void;
};

function MapSelectionPanel({
  mode,
  selectedCountry,
  selectedCity,
  selectedCountryProperties,
  totalRealEstateValueNok,
  selectedProperty,
  selectedPropertyCoordinates,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  mappableCities,
  citySortOption,
  onCitySortOptionChange,
  onSelectCountry,
  mapCenter,
  onSelectSearchResult,
  onSelectCity,
  onClearSearch,
  showCoordinatesDebug,
  onClose,
  onBackToGlobal,
  onBackToCity,
  onSelectProperty,
  onPanelHeightChange,
  googleMapsEmbedApiKey,
  currency,
  onCurrencyChange,
}: MapSelectionPanelProps) {
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);
  const [isMarketDataExpanded, setIsMarketDataExpanded] = useState(false);
  const [propertySortOption, setPropertySortOption] = useState<PropertySortOption>("ownership");
  const panelRef = useRef<HTMLElement | null>(null);
  const prevPropertyIdRef = useRef<string | null>(null);

  // Reset market data panel when property changes
  useEffect(() => {
    if (selectedProperty?.id !== prevPropertyIdRef.current) {
      prevPropertyIdRef.current = selectedProperty?.id ?? null;
      setIsMarketDataExpanded(false);
    }
  }, [selectedProperty?.id]);

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

  const filteredCountryProperties =
    selectedCountry && cityPropertyFilter.length >= 2
      ? selectedCountryProperties.filter((property) => {
          const haystack = [property.name, property.address, property.cityName, property.sector, property.partnership]
            .filter((part): part is string => Boolean(part && part.trim()))
            .join(" ")
            .toLowerCase();
          return haystack.includes(cityPropertyFilter);
        })
      : selectedCountryProperties;

  const isPropertyMode = mode === "property";
  const showExpandedLayout = isPropertyMode && isMarketDataExpanded;

  const mobileMaxH = !isPanelExpanded
    ? "max-h-[6rem]"
    : showExpandedLayout
      ? "max-h-[92svh]"
      : "max-h-[min(58svh,30rem)]";

  return (
    <>
    <RateInfoModal />
    <aside
      ref={panelRef}
      className={`safe-area-bottom pointer-events-auto absolute inset-x-2 bottom-2 z-[650] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/96 p-3 shadow-2xl backdrop-blur transition-[max-height,width] duration-300 ease-out sm:inset-x-3 sm:bottom-3 md:bottom-4 md:left-auto md:right-4 md:top-4 md:max-h-[calc(100svh-2rem)] md:p-4 ${mobileMaxH} ${showExpandedLayout ? "md:w-[730px]" : "md:w-[360px]"}`}
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

      <div
        id="map-selection-panel-content"
        className={`min-h-0 flex-1 overscroll-contain overflow-y-auto pr-0.5 ${showExpandedLayout ? "md:flex md:flex-row md:gap-0 md:overflow-hidden md:pr-0" : ""}`}
      >
        {/* Main column — always visible */}
        <div
          className={
            showExpandedLayout
              ? "md:w-[340px] md:shrink-0 md:overflow-y-auto md:pr-4 md:border-r md:border-slate-200"
              : ""
          }
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900 text-balance sm:text-lg">
              {mode === "global"
                ? "Search Investments"
                : mode === "country"
                ? selectedCountry
                  ? `${formatCountryWithFlag(selectedCountry)} overview`
                  : "Country overview"
                : mode === "property"
                ? selectedProperty?.office_name ?? selectedProperty?.name ?? "Property details"
                : selectedCity
                  ? `${selectedCity.city}, ${formatCountryWithFlag(selectedCity.country)}`
                  : "Search Investments"}
            </h2>

            <div className="flex shrink-0 items-center gap-1">
              {mode !== "global" && (
                <button
                  type="button"
                  onClick={mode === "property" ? onBackToCity : onBackToGlobal}
                  className="pointer-events-auto rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  aria-label={
                    mode === "property"
                      ? selectedCountry
                        ? "Back to country list"
                        : "Back to city list"
                      : "Back to search"
                  }
                >
                  {mode === "property"
                    ? selectedCountry
                      ? "← Country"
                      : "← City"
                    : "← Back"}
                </button>
              )}

              {/* Currency toggle — always visible */}
              <div className="pointer-events-auto inline-flex items-stretch overflow-hidden rounded-lg border border-slate-300 bg-white">
                <button
                  type="button"
                  onClick={() => onCurrencyChange(currency === "USD" ? "NOK" : "USD")}
                  className="px-2 py-1 text-xs font-semibold tabular-nums text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  aria-label={`Switch to ${currency === "USD" ? "NOK" : "USD"}`}
                  title={`Switch to ${currency === "USD" ? "NOK" : "USD"}`}
                >
                  {currency}
                </button>
                <button
                  type="button"
                  onClick={() => setRateInfoOpen(true)}
                  aria-label="Exchange rate info"
                  aria-haspopup="dialog"
                  className="flex items-center border-l border-slate-200 px-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="11" x2="12" y2="16" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </button>
              </div>

              {mode !== "global" && (
                <button
                  type="button"
                  onClick={onClose}
                  className="pointer-events-auto rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm leading-none transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  aria-label="Zoom to world map"
                  title="World map"
                >
                  🌍
                </button>
              )}
            </div>
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
                placeholder={
                  mode === "global"
                    ? "Search country, city or property"
                    : mode === "country"
                    ? "Filter properties in this country"
                    : "Filter properties in this city"
                }
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
              onSelectCountry={onSelectCountry}
              totalRealEstateValueNok={totalRealEstateValueNok}
              onSelectSearchResult={onSelectSearchResult}
              onSelectCity={onSelectCity}
              mapCenter={mapCenter}
              currency={currency}
            />
          )}

          {mode === "country" && selectedCountry && (
            <CountryPropertiesSection
              country={selectedCountry}
              filteredCountryProperties={filteredCountryProperties}
              totalCountryProperties={selectedCountryProperties.length}
              propertySortOption={propertySortOption}
              onPropertySortOptionChange={setPropertySortOption}
              onSelectProperty={onSelectProperty}
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
              backLabel={selectedCountry ? "← Back to country list" : "← Back to city list"}
              googleMapsEmbedApiKey={googleMapsEmbedApiKey}
              isMarketDataExpanded={isMarketDataExpanded}
              onToggleMarketData={() => setIsMarketDataExpanded((v) => !v)}
              currency={currency}
            />
          )}
        </div>

        {/* Right column: full market data panel, desktop only */}
        {showExpandedLayout && selectedProperty && (
          <div className="hidden md:flex md:flex-1 md:min-w-0 md:flex-col md:overflow-hidden md:pl-4">
            <div className="mb-3 flex shrink-0 items-center justify-between">
              <p className="text-base font-semibold text-slate-900">Market Data</p>
              <button
                type="button"
                onClick={() => setIsMarketDataExpanded(false)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <AttomDataSection
                propertyId={selectedProperty.id}
                mode="full"
                currency={currency}
                ownershipPercent={selectedProperty.ownership_percent}
              />
            </div>
          </div>
        )}
      </div>
    </aside>
    </>
  );
}

export default memo(MapSelectionPanel);
