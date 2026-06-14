"use client";

import type { Map as LeafletMap } from "leaflet";
import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";

import MapBuildingFootprint from "@/components/map/MapBuildingFootprint";
import MapEventBridge from "@/components/map/MapEventBridge";
import MapIntroCard from "@/components/map/MapIntroCard";
import MapMarkersLayer from "@/components/map/MapMarkersLayer";
import MapSelectionPanel from "@/components/map/MapSelectionPanel";
import { useLeafletUserLocation } from "@/components/map/useLeafletUserLocation";
import { useCityMapDerivedData } from "@/components/map/hooks/useCityMapDerivedData";
import { useTrackEvent } from "@/components/map/hooks/useTrackEvent";
import { useMapMobileInteractions } from "@/components/map/hooks/useMapMobileInteractions";
import {
  setCurrency,
  useCurrency,
} from "@/components/map/hooks/useCurrencyPreference";
import {
  FUND_REAL_ESTATE_VALUE_NOK,
  FUND_SHARE_PERCENT,
  getBaseTileLayer,
  MAP_CENTER,
  MAP_DEFAULT_ZOOM,
  SEARCH_RESULT_LIMIT,
  SHOW_PROPERTY_COORDINATES_DEBUG,
  ZOOM_PROPERTY_DETAIL,
  ZOOM_PROPERTY_FOCUS,
  ZOOM_SHOW_PROPERTIES,
} from "@/components/map/mapConstants";
import {
  initialSelectionState,
  type FlatProperty,
  type InitialFocus,
  type SearchResult,
  type SelectionState,
} from "@/components/map/mapTypes";
import type { CitySortOption } from "@/components/map/selection/cityListSorting";
import type { CityNode } from "@/types/cities";

type CityMapInnerProps = {
  cities: CityNode[];
  googleMapsEmbedApiKey: string;
  maptilerApiKey: string;
  initialFocus?: InitialFocus;
};

export default function CityMapInner({
  cities,
  googleMapsEmbedApiKey,
  maptilerApiKey,
  initialFocus,
}: CityMapInnerProps) {
  const baseTileLayer = getBaseTileLayer(maptilerApiKey);
  const [zoom, setZoom] = useState(MAP_DEFAULT_ZOOM);
  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selection, setSelection] = useState<SelectionState>(() =>
    initialSelectionState(initialFocus)
  );
  const [citySortOption, setCitySortOption] = useState<CitySortOption>("properties");
  const currency = useCurrency();
  const [mapCenter, setMapCenter] = useState<[number, number]>(MAP_CENTER);

  const {
    investmentMappableCities,
    flatProperties,
    flatPropertyById,
    selectedCity,
    selectedProperty,
    selectedFlatProperty,
    countryCitiesMap,
    selectedCountry,
    selectedCountryProperties,
    selectedCountryInvestmentProperties,
    selectedCountryAggregate,
    hasInternationalFund,
    totalNbimOffices,
    totalInvestments,
    countriesWithoutInternational,
    localSearchResults,
  } = useCityMapDerivedData({
    cities,
    searchQuery,
    selection,
    searchResultLimit: SEARCH_RESULT_LIMIT,
  });

  const track = useTrackEvent();
  const trackedPropertyId = useRef<string | null>(null);

  useEffect(() => {
    if (
      selection.mode === "property" &&
      selectedProperty &&
      selectedFlatProperty &&
      selection.selectedPropertyId !== trackedPropertyId.current
    ) {
      trackedPropertyId.current = selection.selectedPropertyId;
      track({
        event: "view_property",
        propertyId: selectedProperty.id,
        propertyName: selectedProperty.office_name ?? selectedProperty.name ?? undefined,
        propertyAddress: selectedProperty.address ?? undefined,
        cityName: selectedCity?.city ?? undefined,
        country: selectedCity?.country ?? undefined,
      });
    }
  }, [selection, selectedProperty, selectedFlatProperty, selectedCity, track]);

  const showProperties = zoom >= ZOOM_SHOW_PROPERTIES;
  const showPropertyDetail = zoom >= ZOOM_PROPERTY_DETAIL;

  const {
    getFocusCenter,
    handleMobilePanelHeightChange,
    handleMobileZoomIn,
    handleMobileZoomOut,
  } = useMapMobileInteractions({
    mapInstance,
    selectionMode: selection.mode,
    selectedCity,
    selectedCountry,
    selectedFlatProperty,
    countryCitiesMap,
  });

  const flyToCity = useCallback(
    (city: CityNode) => {
      if (!mapInstance || typeof city.lat !== "number" || typeof city.lng !== "number") {
        return;
      }

      const targetZoom = Math.max(mapInstance.getZoom(), ZOOM_SHOW_PROPERTIES + 1);
      const targetCenter = getFocusCenter([city.lat, city.lng], targetZoom);

      mapInstance.flyTo(targetCenter, targetZoom, {
        animate: true,
        duration: 0.75,
      });
    },
    [getFocusCenter, mapInstance]
  );

  const handleSelectCity = useCallback(
    (city: CityNode) => {
      setSelection({
        mode: "city",
        selectedCountry: null,
        selectedCityId: city.id,
        selectedPropertyId: null,
      });
      flyToCity(city);
    },
    [flyToCity]
  );

  const flyToCountry = useCallback(
    (country: string) => {
      if (!mapInstance) {
        return;
      }

      const countryCities = countryCitiesMap.get(country) ?? [];
      const countryCoordinates = countryCities
        .filter((city) => typeof city.lat === "number" && typeof city.lng === "number")
        .map((city) => [city.lat as number, city.lng as number] as [number, number]);

      if (countryCoordinates.length === 0) {
        return;
      }

      if (countryCoordinates.length === 1) {
        const [lat, lng] = countryCoordinates[0];
        const targetZoom = Math.max(mapInstance.getZoom(), ZOOM_SHOW_PROPERTIES + 1);
        const targetCenter = getFocusCenter([lat, lng], targetZoom);

        mapInstance.flyTo(targetCenter, targetZoom, {
          animate: true,
          duration: 0.75,
        });
        return;
      }

      mapInstance.fitBounds(countryCoordinates, {
        paddingTopLeft: [24, 96],
        paddingBottomRight: [24, 120],
        animate: true,
      });
    },
    [countryCitiesMap, getFocusCenter, mapInstance]
  );

  const handleSelectCountry = useCallback(
    (country: string) => {
      setSelection({
        mode: "country",
        selectedCountry: country,
        selectedCityId: null,
        selectedPropertyId: null,
      });
      flyToCountry(country);
    },
    [flyToCountry]
  );

  // Selecting a property highlights it and opens the panel, but does NOT move
  // the camera — the user clicked something already in view.
  const handleSelectProperty = useCallback((property: FlatProperty) => {
    setSelection((current) => ({
      mode: "property",
      selectedCountry: current.mode === "country" ? current.selectedCountry : null,
      selectedCityId: property.cityId,
      selectedPropertyId: property.id,
    }));
  }, []);

  const handleSelectPropertyById = useCallback(
    (propertyId: string) => {
      const property = flatPropertyById.get(propertyId);
      if (!property) {
        return;
      }

      handleSelectProperty(property);
    },
    [flatPropertyById, handleSelectProperty]
  );

  const handleSelectCityById = useCallback(
    (cityId: string) => {
      const city = investmentMappableCities.find((candidate) => candidate.id === cityId);
      if (!city) {
        return;
      }

      handleSelectCity(city);
    },
    [handleSelectCity, investmentMappableCities]
  );

  const handleBackToGlobal = useCallback(() => {
    setSelection({
      mode: "global",
      selectedCountry: null,
      selectedCityId: null,
      selectedPropertyId: null,
    });
  }, []);

  const handleBackToCity = useCallback(() => {
    setSelection((current) => {
      if (current.mode !== "property") {
        return current;
      }

      return {
        mode: current.selectedCountry ? "country" : "city",
        selectedCountry: current.selectedCountry,
        selectedCityId: current.selectedCountry ? null : current.selectedCityId,
        selectedPropertyId: null,
      };
    });
  }, []);

  const handleResetSelection = useCallback(() => {
    setSelection({
      mode: "global",
      selectedCountry: null,
      selectedCityId: null,
      selectedPropertyId: null,
    });

    if (!mapInstance) {
      return;
    }

    mapInstance.closePopup();
    mapInstance.flyTo(getFocusCenter(MAP_CENTER, MAP_DEFAULT_ZOOM), MAP_DEFAULT_ZOOM, {
      animate: true,
      duration: 0.9,
    });
  }, [getFocusCenter, mapInstance]);

  const handleSelectSearchResult = useCallback(
    (result: SearchResult) => {
      setSearchQuery("");

      if (result.type === "city") {
        const city = investmentMappableCities.find(
          (candidate) => candidate.id === result.cityId
        );
        if (city) {
          setSelection({
            mode: "city",
            selectedCountry: null,
            selectedCityId: city.id,
            selectedPropertyId: null,
          });
        }
      }

      if (result.type === "property" && result.propertyId) {
        setSelection({
          mode: "property",
          selectedCountry: null,
          selectedCityId: result.cityId,
          selectedPropertyId: result.propertyId,
        });
      }

      if (!mapInstance) {
        return;
      }

      const minimumTargetZoom = result.type === "property" ? ZOOM_PROPERTY_FOCUS : ZOOM_SHOW_PROPERTIES + 1;
      const targetZoom = Math.max(mapInstance.getZoom(), minimumTargetZoom);
      const targetCenter = getFocusCenter([result.lat, result.lng], targetZoom);

      mapInstance.flyTo(targetCenter, targetZoom, {
        animate: true,
        duration: 0.8,
      });
    },
    [getFocusCenter, investmentMappableCities, mapInstance]
  );

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  // The deep-link focus selection is already set via the useState initializer;
  // here we only move the camera once the map is ready (no setState).
  const appliedInitialFocus = useRef(false);
  useEffect(() => {
    if (appliedInitialFocus.current || !mapInstance || !initialFocus) {
      return;
    }
    appliedInitialFocus.current = true;
    if (initialFocus.kind === "city") {
      const city = investmentMappableCities.find((c) => c.id === initialFocus.cityId);
      if (city) flyToCity(city);
    } else {
      flyToCountry(initialFocus.country);
    }
  }, [mapInstance, initialFocus, investmentMappableCities, flyToCity, flyToCountry]);

  // Opt-in geolocation, mirroring the MapLibre engine: it fires only on an
  // explicit click, draws a client-side marker, and recenters with the same
  // mobile-aware focus math used elsewhere.
  const {
    status: locationStatus,
    message: locationMessage,
    locate,
    clearMessage: clearLocationMessage,
  } = useLeafletUserLocation({
    map: mapInstance,
    onLocated: (lat, lng) => {
      if (!mapInstance) return;
      const targetZoom = Math.max(mapInstance.getZoom(), ZOOM_SHOW_PROPERTIES);
      mapInstance.flyTo(getFocusCenter([lat, lng], targetZoom), targetZoom, {
        animate: true,
        duration: 0.9,
        easeLinearity: 0.25,
      });
    },
  });

  // Auto-dismiss the transient location message so it doesn't linger.
  useEffect(() => {
    if (!locationMessage) return;
    const timer = window.setTimeout(clearLocationMessage, 6000);
    return () => window.clearTimeout(timer);
  }, [locationMessage, clearLocationMessage]);

  const controlButtonClass =
    "flex h-9 w-9 items-center justify-center border border-slate-300 bg-white/95 text-slate-700 shadow-md backdrop-blur transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

  return (
    <div className="map-shell relative h-[100dvh] min-h-[100svh] w-full overflow-hidden touch-manipulation">
      <MapContainer
        center={MAP_CENTER}
        zoom={MAP_DEFAULT_ZOOM}
        minZoom={2}
        zoomControl={false}
        className="h-full w-full"
        worldCopyJump
      >
        <TileLayer attribution={baseTileLayer.attribution} url={baseTileLayer.url} />
        <MapEventBridge onMapReady={setMapInstance} onZoomChange={setZoom} onCenterChange={setMapCenter} />

        {mapInstance && (
          <>
            <MapMarkersLayer
              showPropertyDetail={showPropertyDetail}
              zoom={zoom}
              flatProperties={flatProperties}
              selection={selection}
              onSelectProperty={handleSelectProperty}
            />
            <MapBuildingFootprint selectedProperty={selectedFlatProperty} zoom={zoom} />
          </>
        )}
      </MapContainer>

      {/* Unified control stack for both breakpoints (replaces Leaflet's native
          ZoomControl). The zoom handlers fall back to plain zoomIn/zoomOut when
          not on mobile, so desktop behaviour is unchanged. */}
      <div className="map-leaflet-controls pointer-events-auto absolute left-2 z-[645] flex flex-col items-start">
        {locationMessage && (
          <div
            role="status"
            className="mb-2 max-w-[15rem] rounded-md border border-slate-300 bg-white/95 px-3 py-2 text-xs leading-snug text-slate-700 shadow-md backdrop-blur"
          >
            {locationMessage}
          </div>
        )}
        <button
          type="button"
          onClick={handleMobileZoomIn}
          aria-label="Zoom in"
          className={`${controlButtonClass} rounded-t-md text-xl leading-none`}
        >
          +
        </button>
        <button
          type="button"
          onClick={handleMobileZoomOut}
          aria-label="Zoom out"
          className={`${controlButtonClass} -mt-px text-xl leading-none`}
        >
          −
        </button>
        <button
          type="button"
          onClick={locate}
          aria-label="Show my location"
          aria-pressed={locationStatus === "active"}
          aria-busy={locationStatus === "locating"}
          className={`${controlButtonClass} -mt-px rounded-b-md ${
            locationStatus === "active" ? "!bg-blue-600 !text-white" : ""
          }`}
        >
          {locationStatus === "locating" ? (
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden="true"
            />
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 8a4 4 0 1 0 4 4 4 4 0 0 0-4-4Zm8.94 3A9 9 0 0 0 13 3.06V1h-2v2.06A9 9 0 0 0 3.06 11H1v2h2.06A9 9 0 0 0 11 20.94V23h2v-2.06A9 9 0 0 0 20.94 13H23v-2ZM12 19a7 7 0 1 1 7-7 7 7 0 0 1-7 7Z"
              />
            </svg>
          )}
        </button>
      </div>

      <MapIntroCard
        mode={selection.mode}
        selectedCity={selectedCity}
        selectedCountry={selectedCountry}
        selectedCountryPropertyCount={selectedCountryInvestmentProperties.length}
        selectedCountryCityCount={selectedCountryAggregate?.cityCount ?? 0}
        selectedCountryValueNok={selectedCountryAggregate?.countryValueNok ?? null}
        showProperties={showProperties}
        countriesWithoutInternational={countriesWithoutInternational}
        hasInternationalFund={hasInternationalFund}
        fundRealEstateValueNok={FUND_REAL_ESTATE_VALUE_NOK}
        fundSharePercent={FUND_SHARE_PERCENT}
        totalInvestments={totalInvestments}
        totalNbimOffices={totalNbimOffices}
        totalRealEstateValueNok={FUND_REAL_ESTATE_VALUE_NOK}
        currency={currency}
      />

      <MapSelectionPanel
        mode={selection.mode}
        selectedCountry={selectedCountry}
        selectedCity={selectedCity}
        selectedCountryProperties={selectedCountryProperties}
        totalRealEstateValueNok={FUND_REAL_ESTATE_VALUE_NOK}
        selectedProperty={selectedProperty}
        selectedPropertyCoordinates={
          selectedFlatProperty
            ? { lat: selectedFlatProperty.lat, lng: selectedFlatProperty.lng }
            : null
        }
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchResults={localSearchResults}
        mappableCities={investmentMappableCities}
        citySortOption={citySortOption}
        onCitySortOptionChange={setCitySortOption}
        onSelectCountry={handleSelectCountry}
        mapCenter={mapCenter}
        onSelectSearchResult={handleSelectSearchResult}
        onSelectCity={handleSelectCityById}
        onClearSearch={handleClearSearch}
        showCoordinatesDebug={SHOW_PROPERTY_COORDINATES_DEBUG}
        onClose={handleResetSelection}
        onBackToGlobal={handleBackToGlobal}
        onBackToCity={handleBackToCity}
        onSelectProperty={handleSelectPropertyById}
        onPanelHeightChange={handleMobilePanelHeightChange}
        googleMapsEmbedApiKey={googleMapsEmbedApiKey}
        currency={currency}
        onCurrencyChange={setCurrency}
      />
    </div>
  );
}
