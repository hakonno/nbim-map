"use client";

import type { LeafletEvent, Map as LeafletMap } from "leaflet";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, useMapEvents } from "react-leaflet";

import MapIntroCard from "@/components/map/MapIntroCard";
import MapSelectionPanel from "@/components/map/MapSelectionPanel";
import type {
  CityAggregateContract,
  CityNode,
  CityProperty,
  GlobalOverviewContract,
} from "@/types/cities";

// Zoom thresholds for layer transitions
const ZOOM_SHOW_PROPERTIES = 7; // above → switch from city markers to property markers
const ZOOM_PROPERTY_DETAIL = 10; // above → make property markers easier to inspect
const MAP_DEFAULT_ZOOM = 3;
const SHOW_PROPERTY_COORDINATES_DEBUG = false;

type CityMapInnerProps = {
  cities: CityNode[];
};

type FlatProperty = CityProperty & {
  cityId: string;
  cityName: string;
  country: string;
  lat: number;
  lng: number;
};

type SelectionState =
  | {
      mode: "global";
      selectedCityId: null;
      selectedPropertyId: null;
    }
  | {
      mode: "city";
      selectedCityId: string;
      selectedPropertyId: null;
    }
  | {
      mode: "property";
      selectedCityId: string;
      selectedPropertyId: string;
    };

const mapCenter: [number, number] = [25, 5];
const FUND_REAL_ESTATE_VALUE_NOK = 371_524_114_446;
const FUND_SHARE_PERCENT = 1.7;

function getCityRadius(propertyCount: number, maxPropertyCount: number) {
  const ratio = Math.sqrt(propertyCount / Math.max(maxPropertyCount, 1));
  return 7 + ratio * 16;
}

function getDensityRatio(propertyCount: number, maxPropertyCount: number) {
  return Math.min(1, propertyCount / Math.max(maxPropertyCount, 1));
}

function getCityColors(propertyCount: number, maxPropertyCount: number, isSelected: boolean) {
  const ratio = getDensityRatio(propertyCount, maxPropertyCount);
  const hue = Math.round(190 - ratio * 130);

  if (isSelected) {
    return {
      stroke: `hsl(${hue}, 76%, 35%)`,
      fill: `hsl(${hue}, 84%, 55%)`,
    };
  }

  return {
    stroke: `hsl(${hue}, 70%, 44%)`,
    fill: `hsl(${hue}, 82%, 60%)`,
  };
}

function getPropertyColors(ownershipPercent: number | null, isSelected: boolean) {
  if (ownershipPercent == null) {
    return {
      stroke: isSelected ? "#334155" : "#64748b",
      fill: isSelected ? "#94a3b8" : "#cbd5e1",
    };
  }

  const ratio = Math.min(1, Math.max(0, ownershipPercent / 100));
  const hue = Math.round(8 + ratio * 122);

  if (isSelected) {
    return {
      stroke: `hsl(${hue}, 78%, 30%)`,
      fill: `hsl(${hue}, 86%, 54%)`,
    };
  }

  return {
    stroke: `hsl(${hue}, 72%, 40%)`,
    fill: `hsl(${hue}, 82%, 61%)`,
  };
}

function MapEventBridge({
  onMapReady,
  onZoomChange,
}: {
  onMapReady: (map: LeafletMap) => void;
  onZoomChange: (zoom: number) => void;
}) {
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
  const [selection, setSelection] = useState<SelectionState>({
    mode: "global",
    selectedCityId: null,
    selectedPropertyId: null,
  });

  const validCities = useMemo(
    () => cities.filter((city) => typeof city.lat === "number" && typeof city.lng === "number"),
    [cities]
  );

  const maxPropertyCount = useMemo(
    () => Math.max(...validCities.map((city) => city.properties.length), 1),
    [validCities]
  );

  // Flat list of every property with deterministic coordinates.
  // If a property has its own lat/lng use that, otherwise fall back to city center.
  const flatProperties = useMemo<FlatProperty[]>(
    () =>
      validCities.flatMap((city) =>
        city.properties.map((prop) => {
          const lat = typeof prop.lat === "number" ? prop.lat : (city.lat as number);
          const lng = typeof prop.lng === "number" ? prop.lng : (city.lng as number);
          return {
            ...prop,
            cityId: city.id,
            cityName: city.city,
            country: city.country,
            lat,
            lng,
          };
        })
      ),
    [validCities]
  );

  const flatPropertyById = useMemo(
    () => new Map(flatProperties.map((property) => [property.id, property])),
    [flatProperties]
  );

  const globalOverview = useMemo<GlobalOverviewContract>(
    () => ({
      totalCities: validCities.length,
      totalCountries: new Set(validCities.map((city) => city.country)).size,
      totalProperties: validCities.reduce((sum, city) => sum + city.properties.length, 0),
      estimatedPortfolioValueNok: null,
      estimatedPortfolioValueUsd: null,
    }),
    [validCities]
  );

  const cityAggregates = useMemo<Map<string, CityAggregateContract>>(
    () =>
      new Map(
        validCities.map((city) => [
          city.id,
          {
            cityId: city.id,
            propertyCount: city.properties.length,
            ownershipExposurePercent: null,
            estimatedExposureNok: null,
          },
        ])
      ),
    [validCities]
  );

  const selectedCity = useMemo(
    () =>
      selection.mode === "global"
        ? null
        : validCities.find((city) => city.id === selection.selectedCityId) ?? null,
    [selection, validCities]
  );

  const selectedCityAggregate = useMemo(
    () => (selectedCity ? cityAggregates.get(selectedCity.id) ?? null : null),
    [selectedCity, cityAggregates]
  );

  const selectedProperty = useMemo(
    () =>
      selection.mode === "property"
        ? selectedCity?.properties.find((property) => property.id === selection.selectedPropertyId) ?? null
        : null,
    [selection, selectedCity]
  );

  const selectedFlatProperty = useMemo(
    () =>
      selection.mode === "property"
        ? flatPropertyById.get(selection.selectedPropertyId) ?? null
        : null,
    [selection, flatPropertyById]
  );

  const showProperties = zoom >= ZOOM_SHOW_PROPERTIES;
  const showPropertyDetail = zoom >= ZOOM_PROPERTY_DETAIL;

  const hasInternationalFund = useMemo(
    () =>
      validCities.some(
        (city) => city.country.trim().toLowerCase() === "international fund"
      ),
    [validCities]
  );

  const countriesWithoutInternational = useMemo(
    () => Math.max(0, globalOverview.totalCountries - (hasInternationalFund ? 1 : 0)),
    [globalOverview.totalCountries, hasInternationalFund]
  );

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

      const targetZoom = Math.max(mapInstance.getZoom(), ZOOM_PROPERTY_DETAIL);
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
    mapInstance.flyTo(mapCenter, MAP_DEFAULT_ZOOM, {
      animate: true,
      duration: 0.9,
    });
  }, [mapInstance]);

  return (
    <div className="map-shell relative h-[100svh] w-full overflow-hidden touch-manipulation">
      <MapContainer center={mapCenter} zoom={MAP_DEFAULT_ZOOM} minZoom={2} className="h-full w-full" worldCopyJump>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEventBridge onMapReady={setMapInstance} onZoomChange={setZoom} />

        {/* Layer 1 – city overview (zoom < ZOOM_SHOW_PROPERTIES) */}
        {!showProperties &&
          validCities.map((city) => {
            const isSelected = selection.mode !== "global" && selection.selectedCityId === city.id;
            const cityColors = getCityColors(city.properties.length, maxPropertyCount, isSelected);

            return (
              <CircleMarker
                key={city.id}
                center={[city.lat as number, city.lng as number]}
                radius={getCityRadius(city.properties.length, maxPropertyCount)}
                pathOptions={{
                  color: cityColors.stroke,
                  fillColor: cityColors.fill,
                  fillOpacity: 0.82,
                  weight: isSelected ? 2.5 : 1.25,
                }}
                eventHandlers={{
                  click: () => {
                    handleSelectCity(city);
                  },
                }}
              />
            );
          })}

        {/* Layer 2 – individual property markers (zoom >= ZOOM_SHOW_PROPERTIES) */}
        {showProperties &&
          flatProperties.map((property) => {
            const isSelected =
              selection.mode === "property" && selection.selectedPropertyId === property.id;
            const propertyColors = getPropertyColors(property.ownership_percent, isSelected);

            return (
              <CircleMarker
                key={property.id}
                center={[property.lat, property.lng]}
                radius={showPropertyDetail ? 8 : 5}
                pathOptions={{
                  color: propertyColors.stroke,
                  fillColor: propertyColors.fill,
                  fillOpacity: 0.82,
                  weight: isSelected ? 2.5 : 1,
                }}
                eventHandlers={{
                  click: () => {
                    handleSelectProperty(property);
                  },
                }}
              />
            );
          })}
      </MapContainer>

      <MapIntroCard
        mode={selection.mode}
        selectedCity={selectedCity}
        selectedCityAggregate={selectedCityAggregate}
        showProperties={showProperties}
        globalOverview={globalOverview}
        countriesWithoutInternational={countriesWithoutInternational}
        hasInternationalFund={hasInternationalFund}
        fundRealEstateValueNok={FUND_REAL_ESTATE_VALUE_NOK}
        fundSharePercent={FUND_SHARE_PERCENT}
      />

      {selection.mode !== "global" && (
        <MapSelectionPanel
          mode={selection.mode === "property" ? "property" : "city"}
          selectedCity={selectedCity}
          selectedProperty={selectedProperty}
          selectedPropertyCoordinates={
            selectedFlatProperty
              ? { lat: selectedFlatProperty.lat, lng: selectedFlatProperty.lng }
              : null
          }
          showCoordinatesDebug={SHOW_PROPERTY_COORDINATES_DEBUG}
          onClose={handleResetSelection}
          onBackToCity={handleBackToCity}
          onSelectProperty={handleSelectPropertyById}
        />
      )}
    </div>
  );
}
