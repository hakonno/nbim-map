"use client";

import maplibregl, { type LngLatBoundsLike, type PaddingOptions } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import MapIntroCard from "@/components/map/MapIntroCard";
import MapSelectionPanel from "@/components/map/MapSelectionPanel";
import {
  buildPropertyFeatureCollection,
  buildSelectedFeatureCollection,
} from "@/components/map/gl/glPropertyFeatures";
import { FOCUS_PITCH, MAX_PITCH } from "@/components/map/gl/mapGlConstants";
import { useGlBuildingFootprint } from "@/components/map/gl/useGlBuildingFootprint";
import { useMaplibreMap } from "@/components/map/gl/useMaplibreMap";
import { usePropertyClusterLayer } from "@/components/map/gl/usePropertyClusterLayer";
import { useCityMapDerivedData } from "@/components/map/hooks/useCityMapDerivedData";
import { useTrackEvent } from "@/components/map/hooks/useTrackEvent";
import {
  FUND_REAL_ESTATE_VALUE_NOK,
  FUND_SHARE_PERCENT,
  MAP_CENTER,
  MAP_DEFAULT_ZOOM,
  SEARCH_RESULT_LIMIT,
  SHOW_PROPERTY_COORDINATES_DEBUG,
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
import type { Currency } from "@/utils/formatCurrency";
import type { CityNode } from "@/types/cities";

const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

type CityMapGLProps = {
  cities: CityNode[];
  googleMapsEmbedApiKey: string;
  maptilerApiKey: string;
  initialFocus?: InitialFocus;
  /** Switch to the Leaflet engine (no WebGL, bad key, or MapTiler quota exhausted). */
  onEngineFallback: (reason: string) => void;
};

export default function CityMapGL({
  cities,
  googleMapsEmbedApiKey,
  maptilerApiKey,
  initialFocus,
  onEngineFallback,
}: CityMapGLProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selection, setSelection] = useState<SelectionState>(() =>
    initialSelectionState(initialFocus)
  );
  const [citySortOption, setCitySortOption] = useState<CitySortOption>("properties");
  const [currency, setCurrency] = useState<Currency>("USD");

  const { containerRef, map, ready, view } = useMaplibreMap({
    maptilerApiKey,
    minZoom: 2,
    onUnavailable: onEngineFallback,
  });

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

  const showProperties = view.zoom >= ZOOM_SHOW_PROPERTIES;
  const isTilted = view.pitch > 8;
  const isRotated = Math.abs(view.bearing) > 1 || isTilted;

  // --- Camera helpers.
  const getPadding = useCallback((): Required<PaddingOptions> => {
    if (typeof window === "undefined" || !window.matchMedia(MOBILE_MEDIA_QUERY).matches) {
      return { top: 0, bottom: 0, left: 0, right: 0 };
    }
    const root = getComputedStyle(document.documentElement);
    const intro = Number.parseFloat(root.getPropertyValue("--map-mobile-intro-height"));
    const panel = Number.parseFloat(root.getPropertyValue("--map-mobile-panel-height"));
    return {
      top: Number.isFinite(intro) && intro > 0 ? intro : 0,
      bottom: Number.isFinite(panel) && panel > 0 ? panel : 0,
      left: 0,
      right: 0,
    };
  }, []);

  const flyToPoint = useCallback(
    (lat: number, lng: number, minZoom: number, pitch?: number) => {
      if (!map) return;
      map.flyTo({
        center: [lng, lat],
        zoom: Math.max(map.getZoom(), minZoom),
        pitch: pitch ?? map.getPitch(),
        padding: getPadding(),
        duration: 900,
        essential: true,
      });
    },
    [getPadding, map]
  );

  // Navigation keeps the current tilt rather than forcing 3D — the user opts
  // into 3D via the tilt button or by dragging. Buildings extrude when tilted.
  const flyToCity = useCallback(
    (city: CityNode) => {
      if (typeof city.lat !== "number" || typeof city.lng !== "number") return;
      flyToPoint(city.lat, city.lng, ZOOM_SHOW_PROPERTIES + 1);
    },
    [flyToPoint]
  );

  const flyToCountry = useCallback(
    (country: string) => {
      if (!map) return;
      const coordinates = (countryCitiesMap.get(country) ?? [])
        .filter((city) => typeof city.lat === "number" && typeof city.lng === "number")
        .map((city) => [city.lng as number, city.lat as number] as [number, number]);

      if (coordinates.length === 0) return;
      if (coordinates.length === 1) {
        const [lng, lat] = coordinates[0];
        flyToPoint(lat, lng, ZOOM_SHOW_PROPERTIES + 1);
        return;
      }

      const bounds = coordinates.reduce(
        (acc, coord) => acc.extend(coord),
        new maplibregl.LngLatBounds(coordinates[0], coordinates[0])
      );
      const base = getPadding();
      map.fitBounds(bounds as LngLatBoundsLike, {
        padding: { ...base, top: base.top + 24, bottom: base.bottom + 24 },
        pitch: 0,
        bearing: 0,
        duration: 900,
        maxZoom: ZOOM_PROPERTY_FOCUS,
      });
    },
    [countryCitiesMap, flyToPoint, getPadding, map]
  );

  // --- Selection handlers.
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
      if (property) handleSelectProperty(property);
    },
    [flatPropertyById, handleSelectProperty]
  );

  const handleSelectCityById = useCallback(
    (cityId: string) => {
      const city = investmentMappableCities.find((candidate) => candidate.id === cityId);
      if (city) handleSelectCity(city);
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
      if (current.mode !== "property") return current;
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
    if (!map) return;
    map.flyTo({
      center: [MAP_CENTER[1], MAP_CENTER[0]],
      zoom: MAP_DEFAULT_ZOOM,
      pitch: 0,
      bearing: 0,
      padding: getPadding(),
      duration: 1000,
      essential: true,
    });
  }, [getPadding, map]);

  const handleSelectSearchResult = useCallback(
    (result: SearchResult) => {
      setSearchQuery("");

      if (result.type === "city") {
        const city = investmentMappableCities.find((c) => c.id === result.cityId);
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

      const minZoom = result.type === "property" ? ZOOM_PROPERTY_FOCUS : ZOOM_SHOW_PROPERTIES + 1;
      flyToPoint(result.lat, result.lng, minZoom);
    },
    [flyToPoint, investmentMappableCities]
  );

  const handleClearSearch = useCallback(() => setSearchQuery(""), []);

  // --- Mobile: keep the focused property visible when the bottom sheet resizes.
  const handleMobilePanelHeightChange = useCallback(() => {
    if (!map || selection.mode !== "property" || !selectedFlatProperty) return;
    if (typeof window === "undefined" || !window.matchMedia(MOBILE_MEDIA_QUERY).matches) return;
    map.easeTo({
      center: [selectedFlatProperty.lng, selectedFlatProperty.lat],
      padding: getPadding(),
      duration: 250,
    });
  }, [getPadding, map, selectedFlatProperty, selection.mode]);

  // --- Camera control buttons.
  const visualCenterLngLat = useCallback(() => {
    if (!map) return null;
    const canvas = map.getCanvas();
    const padding = getPadding();
    const x = canvas.clientWidth / 2;
    const y = (padding.top + (canvas.clientHeight - padding.bottom)) / 2;
    return map.unproject([x, y]);
  }, [getPadding, map]);

  const handleZoomIn = useCallback(() => {
    if (!map) return;
    const center = visualCenterLngLat();
    map.easeTo({
      zoom: Math.min(map.getZoom() + 1, map.getMaxZoom()),
      center: center ?? undefined,
      padding: getPadding(),
      duration: 300,
    });
  }, [getPadding, map, visualCenterLngLat]);

  const handleZoomOut = useCallback(() => {
    if (!map) return;
    const center = visualCenterLngLat();
    map.easeTo({
      zoom: Math.max(map.getZoom() - 1, map.getMinZoom()),
      center: center ?? undefined,
      padding: getPadding(),
      duration: 300,
    });
  }, [getPadding, map, visualCenterLngLat]);

  const handleToggleTilt = useCallback(() => {
    if (!map) return;
    map.easeTo({ pitch: isTilted ? 0 : FOCUS_PITCH, duration: 500 });
  }, [isTilted, map]);

  const handleResetNorth = useCallback(() => {
    if (!map) return;
    map.easeTo({ bearing: 0, pitch: 0, duration: 500 });
  }, [map]);

  // Desktop 3D control: Cmd+scroll (macOS) / Ctrl+scroll (others) tilts the
  // camera, a familiar gesture. We use Cmd on macOS specifically because
  // trackpad pinch-zoom there fires as ctrl+wheel — hijacking ctrl would break
  // it. Plain scroll still zooms; Ctrl/right-drag still rotates (MapLibre default).
  useEffect(() => {
    if (!map) return;
    const container = map.getContainer();
    const isMac =
      typeof navigator !== "undefined" &&
      /mac|iphone|ipad|ipod/i.test(navigator.userAgent);

    const onWheel = (event: WheelEvent) => {
      const tiltModifier = isMac ? event.metaKey : event.ctrlKey;
      if (!tiltModifier) return;
      // Stop MapLibre's scroll-zoom from also firing for this gesture.
      event.preventDefault();
      event.stopPropagation();
      const delta = event.deltaY < 0 ? 4 : -4;
      map.setPitch(Math.min(MAX_PITCH, Math.max(0, map.getPitch() + delta)));
    };

    container.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel, { capture: true });
    };
  }, [map]);

  // --- Map data layers (declared after handlers so the click callback exists).
  const propertyFeatures = useMemo(
    () => buildPropertyFeatureCollection(flatProperties),
    [flatProperties]
  );
  const selectedFeatures = useMemo(
    () => buildSelectedFeatureCollection(selectedFlatProperty),
    [selectedFlatProperty]
  );

  usePropertyClusterLayer({
    map,
    ready,
    features: propertyFeatures,
    selectedFeatures,
    onSelectProperty: handleSelectPropertyById,
  });

  useGlBuildingFootprint({
    map,
    ready,
    selectedProperty: selectedFlatProperty,
    zoom: view.zoom,
  });

  // The deep-link focus selection is already set via the useState initializer;
  // here we only move the camera once the map has loaded (no setState).
  const appliedInitialFocus = useRef(false);
  useEffect(() => {
    if (appliedInitialFocus.current || !ready || !initialFocus) {
      return;
    }
    appliedInitialFocus.current = true;
    if (initialFocus.kind === "city") {
      const city = investmentMappableCities.find((c) => c.id === initialFocus.cityId);
      if (city) flyToCity(city);
    } else {
      flyToCountry(initialFocus.country);
    }
  }, [ready, initialFocus, investmentMappableCities, flyToCity, flyToCountry]);

  const controlButtonClass =
    "flex h-9 w-9 items-center justify-center border border-slate-300 bg-white/95 text-slate-700 shadow-md backdrop-blur transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

  return (
    <div className="map-shell relative h-[100dvh] min-h-[100svh] w-full overflow-hidden touch-manipulation">
      <div ref={containerRef} className="h-full w-full" aria-label="3D investment map" />

      <div className="map-gl-controls pointer-events-auto absolute left-2 z-[645] flex flex-col">
        <button
          type="button"
          onClick={handleZoomIn}
          aria-label="Zoom in"
          className={`${controlButtonClass} rounded-t-md text-xl leading-none`}
        >
          +
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          aria-label="Zoom out"
          className={`${controlButtonClass} -mt-px text-xl leading-none`}
        >
          −
        </button>
        <button
          type="button"
          onClick={handleToggleTilt}
          aria-label={isTilted ? "Switch to flat 2D view" : "Tilt to 3D view"}
          aria-pressed={isTilted}
          className={`${controlButtonClass} -mt-px text-[11px] font-semibold leading-none ${isTilted ? "!bg-blue-600 !text-white" : ""}`}
        >
          3D
        </button>
        {isRotated && (
          <button
            type="button"
            onClick={handleResetNorth}
            aria-label="Reset bearing to north and flatten"
            className={`${controlButtonClass} -mt-px rounded-b-md`}
            style={{ transform: `rotate(${-view.bearing}deg)` }}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 2l3.5 8.5L12 9l-3.5 1.5L12 2zm0 20l-3.5-8.5L12 15l3.5-1.5L12 22z"
              />
            </svg>
          </button>
        )}
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
        mapCenter={view.center}
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
