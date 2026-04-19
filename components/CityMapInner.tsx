"use client";

import type { LeafletEvent, Map as LeafletMap } from "leaflet";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, ZoomControl, useMapEvents } from "react-leaflet";

import MapIntroCard from "@/components/map/MapIntroCard";
import MapSelectionPanel from "@/components/map/MapSelectionPanel";
import { formatCountryWithFlag } from "@/components/map/formatCountryWithFlag";
import type {
  CityNode,
  CityProperty,
  GlobalOverviewContract,
} from "@/types/cities";

// Zoom thresholds for layer transitions
const ZOOM_SHOW_PROPERTIES = 7; // above → switch from city markers to property markers
const ZOOM_PROPERTY_DETAIL = 10; // above → make property markers easier to inspect
const MAP_DEFAULT_ZOOM = 3;
const SEARCH_RESULT_LIMIT = 12;
const SHOW_PROPERTY_COORDINATES_DEBUG = true;

type CityMapInnerProps = {
  cities: CityNode[];
};

type MapEventBridgeProps = {
  onMapReady: (map: LeafletMap) => void;
  onZoomChange: (zoom: number) => void;
};

type FlatProperty = CityProperty & {
  cityId: string;
  cityName: string;
  country: string;
  lat: number;
  lng: number;
};

type SearchResult = {
  id: string;
  type: "city" | "property";
  name: string;
  subtitle: string;
  lat: number;
  lng: number;
  cityId: string;
  propertyId?: string;
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

function isInternationalFundCity(city: Pick<CityNode, "city" | "country">) {
  const cityName = city.city.trim().toLowerCase();
  const countryName = city.country.trim().toLowerCase();
  return cityName === "international fund" || countryName === "international fund";
}

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

  const maxPropertyCount = useMemo(
    () => Math.max(...mappableCities.map((city) => city.properties.length), 1),
    [mappableCities]
  );

  // Flat list of every property with deterministic coordinates.
  // If a property has its own lat/lng use that, otherwise fall back to city center.
  const flatProperties = useMemo<FlatProperty[]>(
    () =>
      mappableCities.flatMap((city) =>
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
    [mappableCities]
  );

  const flatPropertyById = useMemo(
    () => new Map(flatProperties.map((property) => [property.id, property])),
    [flatProperties]
  );

  const globalOverview = useMemo<GlobalOverviewContract>(
    () => ({
      totalCities: mappableCities.length,
      totalCountries: new Set(mappableCities.map((city) => city.country)).size,
      totalProperties: mappableCities.reduce((sum, city) => sum + city.properties.length, 0),
      estimatedPortfolioValueNok: null,
      estimatedPortfolioValueUsd: null,
    }),
    [mappableCities]
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
    () =>
      selection.mode === "property"
        ? flatPropertyById.get(selection.selectedPropertyId) ?? null
        : null,
    [selection, flatPropertyById]
  );

  const showProperties = zoom >= ZOOM_SHOW_PROPERTIES;
  const showPropertyDetail = zoom >= ZOOM_PROPERTY_DETAIL;

  const hasInternationalFund = useMemo(
    () => cities.some((city) => isInternationalFundCity(city)),
    [cities]
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

  const localSearchResults = useMemo<SearchResult[]>(() => {
    const query = searchQuery.trim().toLowerCase();
    if (query.length < 2) {
      return [];
    }

    const cityMatches: SearchResult[] = mappableCities
      .filter((city) => {
        const cityText = `${city.city} ${city.country}`.toLowerCase();
        return cityText.includes(query);
      })
      .map((city) => ({
        id: `city-${city.id}`,
        type: "city",
        name: city.city,
        subtitle: formatCountryWithFlag(city.country),
        lat: city.lat as number,
        lng: city.lng as number,
        cityId: city.id,
      }));

    const propertyMatches: SearchResult[] = flatProperties
      .filter((property) => {
        const haystack = [property.name, property.address, property.cityName, property.country]
          .filter((part): part is string => Boolean(part && part.trim()))
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .map((property) => ({
        id: `property-${property.id}`,
        type: "property",
        name: property.name?.trim() || "Unnamed property",
        subtitle: [property.address, property.cityName, formatCountryWithFlag(property.country)]
          .filter((part): part is string => Boolean(part && part.trim()))
          .join(" · "),
        lat: property.lat,
        lng: property.lng,
        cityId: property.cityId,
        propertyId: property.id,
      }));

    return [...cityMatches, ...propertyMatches].slice(0, SEARCH_RESULT_LIMIT);
  }, [searchQuery, mappableCities, flatProperties]);

  const handleSelectSearchResult = useCallback(
    (result: SearchResult) => {
      // Clear search when moving from global results into selection detail states.
      // Keeping the query here can unintentionally hide city properties.
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

      mapInstance.flyTo([result.lat, result.lng], Math.max(mapInstance.getZoom(), ZOOM_SHOW_PROPERTIES + 1), {
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
      center={mapCenter} 
      zoom={MAP_DEFAULT_ZOOM} 
      minZoom={2} 
      zoomControl={false}
      className="h-full w-full" 
      worldCopyJump>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ZoomControl position="bottomleft" /> 
        <MapEventBridge onMapReady={setMapInstance} onZoomChange={setZoom} />

        {/* Layer 1 – city overview (zoom < ZOOM_SHOW_PROPERTIES) */}
        {!showProperties &&
          mappableCities.map((city) => {
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
        showProperties={showProperties}
        countriesWithoutInternational={countriesWithoutInternational}
        hasInternationalFund={hasInternationalFund}
        fundRealEstateValueNok={FUND_REAL_ESTATE_VALUE_NOK}
        fundSharePercent={FUND_SHARE_PERCENT}
      />

      <MapSelectionPanel
        mode={selection.mode === "global" ? "global" : selection.mode === "property" ? "property" : "city"}
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
