"use client";

import type { Map as LeafletMap } from "leaflet";
import { useCallback, useState } from "react";
import { MapContainer, TileLayer, ZoomControl } from "react-leaflet";

import MapEventBridge from "@/components/map/MapEventBridge";
import MapIntroCard from "@/components/map/MapIntroCard";
import MapMarkersLayer from "@/components/map/MapMarkersLayer";
import MapSelectionPanel from "@/components/map/MapSelectionPanel";
import { useCityMapDerivedData } from "@/components/map/hooks/useCityMapDerivedData";
import { useMapMobileInteractions } from "@/components/map/hooks/useMapMobileInteractions";
import {
  FUND_REAL_ESTATE_VALUE_NOK,
  FUND_SHARE_PERCENT,
  MAP_CENTER,
  MAP_DEFAULT_ZOOM,
  SEARCH_RESULT_LIMIT,
  SHOW_PROPERTY_COORDINATES_DEBUG,
  ZOOM_PROPERTY_DETAIL,
  ZOOM_PROPERTY_FOCUS,
  ZOOM_SHOW_PROPERTIES,
} from "@/components/map/mapConstants";
import type { FlatProperty, SearchResult, SelectionState } from "@/components/map/mapTypes";
import type { CitySortOption } from "@/components/map/selection/cityListSorting";
import type { CityNode } from "@/types/cities";

type CityMapInnerProps = {
  cities: CityNode[];
  googleMapsEmbedApiKey: string;
};

export default function CityMapInner({ cities, googleMapsEmbedApiKey }: CityMapInnerProps) {
  const [zoom, setZoom] = useState(MAP_DEFAULT_ZOOM);
  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selection, setSelection] = useState<SelectionState>({
    mode: "global",
    selectedCountry: null,
    selectedCityId: null,
    selectedPropertyId: null,
  });
  const [citySortOption, setCitySortOption] = useState<CitySortOption>("properties");
  const [mapCenter, setMapCenter] = useState<[number, number]>(MAP_CENTER);

  const {
    investmentMappableCities,
    maxPropertyCount,
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

  const flyToProperty = useCallback(
    (property: FlatProperty) => {
      if (!mapInstance) {
        return;
      }

      const targetZoom = Math.max(mapInstance.getZoom(), ZOOM_PROPERTY_FOCUS);
      const targetCenter = getFocusCenter([property.lat, property.lng], targetZoom);

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

  const handleSelectProperty = useCallback(
    (property: FlatProperty) => {
      setSelection((current) => ({
        mode: "property",
        selectedCountry: current.mode === "country" ? current.selectedCountry : null,
        selectedCityId: property.cityId,
        selectedPropertyId: property.id,
      }));
      flyToProperty(property);
    },
    [flyToProperty]
  );

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
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ZoomControl position="bottomleft" />
        <MapEventBridge onMapReady={setMapInstance} onZoomChange={setZoom} onCenterChange={setMapCenter} />

        {mapInstance && (
          <MapMarkersLayer
            showProperties={showProperties}
            showPropertyDetail={showPropertyDetail}
            mappableCities={investmentMappableCities}
            flatProperties={flatProperties}
            selection={selection}
            maxPropertyCount={maxPropertyCount}
            onSelectCity={handleSelectCity}
            onSelectProperty={handleSelectProperty}
          />
        )}
      </MapContainer>

      <div className="map-mobile-zoom-controls pointer-events-auto absolute left-2 z-[645]">
        <button
          type="button"
          onClick={handleMobileZoomIn}
          aria-label="Zoom in"
          className="flex h-9 w-9 items-center justify-center rounded-t-md border border-slate-300 bg-white/95 text-xl leading-none text-slate-700 shadow-md backdrop-blur transition-colors hover:bg-white"
        >
          +
        </button>
        <button
          type="button"
          onClick={handleMobileZoomOut}
          aria-label="Zoom out"
          className="-mt-px flex h-9 w-9 items-center justify-center rounded-b-md border border-slate-300 bg-white/95 text-xl leading-none text-slate-700 shadow-md backdrop-blur transition-colors hover:bg-white"
        >
          -
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
      />
    </div>
  );
}
