"use client";

import type { LeafletEvent, Map as LeafletMap } from "leaflet";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, ZoomControl, useMapEvents } from "react-leaflet";

import MapIntroCard from "@/components/map/MapIntroCard";
import MapMarkersLayer from "@/components/map/MapMarkersLayer";
import MapSelectionPanel from "@/components/map/MapSelectionPanel";
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
  isInternationalFundCity,
} from "@/components/map/mapConstants";
import type { FlatProperty, SearchResult, SelectionState } from "@/components/map/mapTypes";
import { buildLocalSearchResults } from "@/components/map/searchResults";
import type { CityNode } from "@/types/cities";

type CityMapInnerProps = {
  cities: CityNode[];
};

type MapEventBridgeProps = {
  onMapReady: (map: LeafletMap) => void;
  onZoomChange: (zoom: number) => void;
};

function MapEventBridge({ onMapReady, onZoomChange }: MapEventBridgeProps) {
  const map = useMapEvents({
    zoomend: (e: LeafletEvent) => {
      onZoomChange((e.target as { getZoom: () => number }).getZoom());
    },
  });

  useEffect(() => {
    onMapReady(map);
  }, [map, onMapReady]);

  return null;
}

export default function CityMapInner({ cities }: CityMapInnerProps) {
  const [zoom, setZoom] = useState(MAP_DEFAULT_ZOOM);
  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selection, setSelection] = useState<SelectionState>({
    mode: "global",
    selectedCityId: null,
    selectedPropertyId: null,
  });

  const mappableCities = useMemo(
    () =>
      cities
        .filter((city) => typeof city.lat === "number" && typeof city.lng === "number")
        .filter((city) => !isInternationalFundCity(city)),
    [cities]
  );

  const totalCountries = useMemo(
    () => new Set(mappableCities.map((city) => city.country)).size,
    [mappableCities]
  );

  const maxPropertyCount = useMemo(
    () => Math.max(...mappableCities.map((city) => city.properties.length), 1),
    [mappableCities]
  );

  const flatProperties = useMemo<FlatProperty[]>(
    () =>
      mappableCities.flatMap((city) =>
        city.properties.map((property) => {
          const lat = typeof property.lat === "number" ? property.lat : (city.lat as number);
          const lng = typeof property.lng === "number" ? property.lng : (city.lng as number);

          return {
            ...property,
            cityId: city.id,
            cityName: city.city,
            country: city.country,
            lat,
            lng,
          };
        })
      ),
    [mappableCities]
  );

  const flatPropertyById = useMemo(
    () => new Map(flatProperties.map((property) => [property.id, property])),
    [flatProperties]
  );

  const selectedCity = useMemo(
    () =>
      selection.mode === "global"
        ? null
        : mappableCities.find((city) => city.id === selection.selectedCityId) ?? null,
    [selection, mappableCities]
  );

  const selectedProperty = useMemo(
    () =>
      selection.mode === "property"
        ? selectedCity?.properties.find((property) => property.id === selection.selectedPropertyId) ?? null
        : null,
    [selection, selectedCity]
  );

  const selectedFlatProperty = useMemo(
    () => (selection.mode === "property" ? flatPropertyById.get(selection.selectedPropertyId) ?? null : null),
    [selection, flatPropertyById]
  );

  const hasInternationalFund = useMemo(
    () => cities.some((city) => isInternationalFundCity(city)),
    [cities]
  );

  const countriesWithoutInternational = useMemo(
    () => totalCountries,
    [totalCountries]
  );

  const localSearchResults = useMemo(
    () => buildLocalSearchResults(searchQuery, mappableCities, flatProperties, SEARCH_RESULT_LIMIT),
    [searchQuery, mappableCities, flatProperties]
  );

  const showProperties = zoom >= ZOOM_SHOW_PROPERTIES;
  const showPropertyDetail = zoom >= ZOOM_PROPERTY_DETAIL;

  const flyToCity = useCallback(
    (city: CityNode) => {
      if (!mapInstance || typeof city.lat !== "number" || typeof city.lng !== "number") {
        return;
      }

      const targetZoom = Math.max(mapInstance.getZoom(), ZOOM_SHOW_PROPERTIES + 1);
      mapInstance.flyTo([city.lat, city.lng], targetZoom, {
        animate: true,
        duration: 0.75,
      });
    },
    [mapInstance]
  );

  const flyToProperty = useCallback(
    (property: FlatProperty) => {
      if (!mapInstance) {
        return;
      }

      const targetZoom = Math.max(mapInstance.getZoom(), ZOOM_PROPERTY_FOCUS);
      mapInstance.flyTo([property.lat, property.lng], targetZoom, {
        animate: true,
        duration: 0.75,
      });
    },
    [mapInstance]
  );

  const handleSelectCity = useCallback(
    (city: CityNode) => {
      setSelection({
        mode: "city",
        selectedCityId: city.id,
        selectedPropertyId: null,
      });
      flyToCity(city);
    },
    [flyToCity]
  );

  const handleSelectProperty = useCallback(
    (property: FlatProperty) => {
      setSelection({
        mode: "property",
        selectedCityId: property.cityId,
        selectedPropertyId: property.id,
      });
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

  const handleBackToCity = useCallback(() => {
    setSelection((current) => {
      if (current.mode !== "property") {
        return current;
      }

      return {
        mode: "city",
        selectedCityId: current.selectedCityId,
        selectedPropertyId: null,
      };
    });
  }, []);

  const handleResetSelection = useCallback(() => {
    setSelection({
      mode: "global",
      selectedCityId: null,
      selectedPropertyId: null,
    });

    if (!mapInstance) {
      return;
    }

    mapInstance.closePopup();
    mapInstance.flyTo(MAP_CENTER, MAP_DEFAULT_ZOOM, {
      animate: true,
      duration: 0.9,
    });
  }, [mapInstance]);

  const handleSelectSearchResult = useCallback(
    (result: SearchResult) => {
      setSearchQuery("");

      if (result.type === "city") {
        const city = mappableCities.find((candidate) => candidate.id === result.cityId);
        if (city) {
          setSelection({
            mode: "city",
            selectedCityId: city.id,
            selectedPropertyId: null,
          });
        }
      }

      if (result.type === "property" && result.propertyId) {
        setSelection({
          mode: "property",
          selectedCityId: result.cityId,
          selectedPropertyId: result.propertyId,
        });
      }

      if (!mapInstance) {
        return;
      }

      const minimumTargetZoom = result.type === "property" ? ZOOM_PROPERTY_FOCUS : ZOOM_SHOW_PROPERTIES + 1;
      mapInstance.flyTo([result.lat, result.lng], Math.max(mapInstance.getZoom(), minimumTargetZoom), {
        animate: true,
        duration: 0.8,
      });
    },
    [mapInstance, mappableCities]
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
        <MapEventBridge onMapReady={setMapInstance} onZoomChange={setZoom} />

        {mapInstance && (
          <MapMarkersLayer
            showProperties={showProperties}
            showPropertyDetail={showPropertyDetail}
            mappableCities={mappableCities}
            flatProperties={flatProperties}
            selection={selection}
            maxPropertyCount={maxPropertyCount}
            onSelectCity={handleSelectCity}
            onSelectProperty={handleSelectProperty}
          />
        )}
      </MapContainer>

      <MapIntroCard
        mode={selection.mode}
        selectedCity={selectedCity}
        showProperties={showProperties}
        countriesWithoutInternational={countriesWithoutInternational}
        hasInternationalFund={hasInternationalFund}
        fundRealEstateValueNok={FUND_REAL_ESTATE_VALUE_NOK}
        fundSharePercent={FUND_SHARE_PERCENT}
        totalInvestments={flatProperties.length}
      />

      <MapSelectionPanel
        mode={selection.mode}
        selectedCity={selectedCity}
        selectedProperty={selectedProperty}
        selectedPropertyCoordinates={
          selectedFlatProperty
            ? { lat: selectedFlatProperty.lat, lng: selectedFlatProperty.lng }
            : null
        }
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchResults={localSearchResults}
        onSelectSearchResult={handleSelectSearchResult}
        onClearSearch={handleClearSearch}
        showCoordinatesDebug={SHOW_PROPERTY_COORDINATES_DEBUG}
        onClose={handleResetSelection}
        onBackToCity={handleBackToCity}
        onSelectProperty={handleSelectPropertyById}
      />
    </div>
  );
}
