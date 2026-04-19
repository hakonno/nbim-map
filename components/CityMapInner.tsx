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

const MOBILE_PANEL_MEDIA_QUERY = "(max-width: 767px)";
const MOBILE_PANEL_HEIGHT_VAR = "--map-mobile-panel-height";
const MOBILE_INTRO_HEIGHT_VAR = "--map-mobile-intro-height";

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

  const getMobileOverlayHeights = useCallback(() => {
    const rootStyle = getComputedStyle(document.documentElement);
    const panelHeightRaw = rootStyle.getPropertyValue(MOBILE_PANEL_HEIGHT_VAR).trim();
    const introHeightRaw = rootStyle.getPropertyValue(MOBILE_INTRO_HEIGHT_VAR).trim();

    const panelHeightPx = Number.parseFloat(panelHeightRaw);
    const introHeightPx = Number.parseFloat(introHeightRaw);

    return {
      panelHeightPx: Number.isFinite(panelHeightPx) && panelHeightPx > 0 ? panelHeightPx : 0,
      introHeightPx: Number.isFinite(introHeightPx) && introHeightPx > 0 ? introHeightPx : 0,
    };
  }, []);

  const getMobileFocusContainerPoint = useCallback((): [number, number] | null => {
    if (!mapInstance || typeof window === "undefined" || !window.matchMedia(MOBILE_PANEL_MEDIA_QUERY).matches) {
      return null;
    }

    const { panelHeightPx, introHeightPx } = getMobileOverlayHeights();
    const size = mapInstance.getSize();
    const visibleTop = introHeightPx;
    const visibleBottom = Math.max(visibleTop + 1, size.y - panelHeightPx);

    return [size.x / 2, (visibleTop + visibleBottom) / 2];
  }, [getMobileOverlayHeights, mapInstance]);

  const getFocusCenter = useCallback(
    (target: [number, number], zoomLevel: number): [number, number] => {
      if (!mapInstance || typeof window === "undefined" || !window.matchMedia(MOBILE_PANEL_MEDIA_QUERY).matches) {
        return target;
      }

      const { panelHeightPx, introHeightPx } = getMobileOverlayHeights();
      const focusOffsetPx = (panelHeightPx - introHeightPx) / 2;

      if (!Number.isFinite(focusOffsetPx) || Math.abs(focusOffsetPx) < 1) {
        return target;
      }

      const targetPoint = mapInstance.project(target, zoomLevel);
      const adjustedCenterPoint = targetPoint.add([0, focusOffsetPx]);
      const adjustedCenter = mapInstance.unproject(adjustedCenterPoint, zoomLevel);
      return [adjustedCenter.lat, adjustedCenter.lng];
    },
    [getMobileOverlayHeights, mapInstance]
  );

  const handleMobileZoomIn = useCallback(() => {
    if (!mapInstance) {
      return;
    }

    const targetZoom = Math.min(mapInstance.getZoom() + 1, mapInstance.getMaxZoom());
    const focusPoint = getMobileFocusContainerPoint();

    if (focusPoint) {
      mapInstance.setZoomAround(focusPoint, targetZoom, { animate: true });
      return;
    }

    mapInstance.zoomIn();
  }, [getMobileFocusContainerPoint, mapInstance]);

  const handleMobileZoomOut = useCallback(() => {
    if (!mapInstance) {
      return;
    }

    const targetZoom = Math.max(mapInstance.getZoom() - 1, mapInstance.getMinZoom());
    const focusPoint = getMobileFocusContainerPoint();

    if (focusPoint) {
      mapInstance.setZoomAround(focusPoint, targetZoom, { animate: true });
      return;
    }

    mapInstance.zoomOut();
  }, [getMobileFocusContainerPoint, mapInstance]);

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
    mapInstance.flyTo(getFocusCenter(MAP_CENTER, MAP_DEFAULT_ZOOM), MAP_DEFAULT_ZOOM, {
      animate: true,
      duration: 0.9,
    });
  }, [getFocusCenter, mapInstance]);

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
      const targetZoom = Math.max(mapInstance.getZoom(), minimumTargetZoom);
      const targetCenter = getFocusCenter([result.lat, result.lng], targetZoom);

      mapInstance.flyTo(targetCenter, targetZoom, {
        animate: true,
        duration: 0.8,
      });
    },
    [getFocusCenter, mapInstance, mappableCities]
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
