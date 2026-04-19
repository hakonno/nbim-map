"use client";

import type { LeafletEvent, Map as LeafletMap } from "leaflet";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, useMapEvents } from "react-leaflet";

import type {
  CityAggregateContract,
  CityNode,
  CityProperty,
  GlobalOverviewContract,
} from "@/types/cities";

// Zoom thresholds for layer transitions
const ZOOM_SHOW_PROPERTIES = 7; // above → switch from city markers to property markers
const ZOOM_PROPERTY_DETAIL = 10; // above → make property markers easier to inspect
const MAP_DEFAULT_ZOOM = 2;
const PROPERTY_VALUES_ENABLED = false;
const SHOW_PROPERTY_COORDINATES_DEBUG = true;

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

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

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

  const panelModeLabel =
    selection.mode === "global"
      ? "Global Mode"
      : selection.mode === "property"
        ? "Property Mode"
        : "City Mode";

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

            return (
              <CircleMarker
                key={property.id}
                center={[property.lat, property.lng]}
                radius={showPropertyDetail ? 8 : 5}
                pathOptions={{
                  color: isSelected ? "#9a3412" : "#1d4ed8",
                  fillColor: isSelected ? "#fb923c" : "#60a5fa",
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

      {/* Top-left info card */}
      <div className="pointer-events-none absolute left-3 top-3 z-[500] w-[calc(100%-1.5rem)] max-w-sm rounded-2xl border border-white/60 bg-white/92 p-4 shadow-xl backdrop-blur sm:left-4 sm:top-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">NBIM Real Estate</p>
        {selection.mode === "global" ? (
          <>
            <h1 className="mt-1 text-xl font-semibold text-slate-900 text-balance">Global geographic overview</h1>
            <p className="mt-2 text-sm text-slate-700" role="status" aria-live="polite">
              City markers scale by property count and color by density. Select a city marker to enter city mode.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs sm:text-sm">
              <div className="rounded-xl bg-slate-100 p-2">
                <p className="text-slate-500">Cities</p>
                <p className="font-semibold text-slate-900 tabular-nums">
                  {integerFormatter.format(globalOverview.totalCities)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-100 p-2">
                <p className="text-slate-500">Properties</p>
                <p className="font-semibold text-slate-900 tabular-nums">
                  {integerFormatter.format(globalOverview.totalProperties)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-100 p-2">
                <p className="text-slate-500">Countries</p>
                <p className="font-semibold text-slate-900 tabular-nums">
                  {integerFormatter.format(globalOverview.totalCountries)}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Portfolio value and ownership exposure are hidden until semantic definitions are available.
            </p>
          </>
        ) : selectedCity ? (
          <>
            <h1 className="mt-1 text-xl font-semibold text-slate-900 text-balance">
              {selectedCity.city}, {selectedCity.country}
            </h1>
            <p className="mt-2 text-sm text-slate-700" role="status" aria-live="polite">
              {showProperties
                ? "Property mode is active. Select a property marker or list item for details."
                : "City mode is active. Zoom in to reveal individual property markers."}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:text-sm">
              <div className="rounded-xl bg-slate-100 p-2">
                <p className="text-slate-500">Properties</p>
                <p className="font-semibold text-slate-900 tabular-nums">
                  {integerFormatter.format(selectedCityAggregate?.propertyCount ?? 0)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-100 p-2">
                <p className="text-slate-500">Exposure</p>
                <p className="font-semibold text-slate-900">Not aggregated</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Ownership and value aggregation are intentionally disabled at city level.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-1 text-xl font-semibold text-slate-900 text-balance">Selection unavailable</h1>
            <p className="mt-2 text-sm text-slate-700">Reset to overview and select a city marker again.</p>
          </>
        )}
      </div>

      {/* Right / bottom detail panel */}
      <aside className="safe-area-bottom absolute bottom-0 left-0 right-0 z-[500] max-h-[42svh] rounded-t-2xl border-t border-slate-200 bg-white/96 p-3 shadow-2xl backdrop-blur md:bottom-4 md:left-auto md:right-4 md:top-4 md:max-h-[calc(100svh-2rem)] md:w-[360px] md:rounded-2xl md:border md:p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{panelModeLabel}</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900 text-balance">
              {selection.mode === "global"
                ? "Portfolio context"
                : selection.mode === "property"
                  ? selectedProperty?.name ?? "Unnamed property"
                  : selectedCity
                    ? `${selectedCity.city}, ${selectedCity.country}`
                    : "Selection unavailable"}
            </h2>
          </div>

          {selection.mode !== "global" && (
            <button
              type="button"
              onClick={handleResetSelection}
              className="pointer-events-auto rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              aria-label="Close selection and return to global overview"
            >
              Close
            </button>
          )}
        </div>

        {selection.mode === "global" && (
          <>
            <p className="mt-2 text-sm text-slate-700">
              Select a city marker to zoom in, switch to city mode, and inspect properties.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs sm:text-sm">
              <div className="rounded-xl bg-slate-100 p-2">
                <p className="text-slate-500">Cities</p>
                <p className="font-semibold text-slate-900 tabular-nums">
                  {integerFormatter.format(globalOverview.totalCities)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-100 p-2">
                <p className="text-slate-500">Properties</p>
                <p className="font-semibold text-slate-900 tabular-nums">
                  {integerFormatter.format(globalOverview.totalProperties)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-100 p-2">
                <p className="text-slate-500">Countries</p>
                <p className="font-semibold text-slate-900 tabular-nums">
                  {integerFormatter.format(globalOverview.totalCountries)}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Estimated portfolio values are currently unavailable at reliable global granularity.
            </p>
          </>
        )}

        {selection.mode !== "global" && !selectedCity && (
          <p className="mt-2 text-sm text-slate-700">Selected city is unavailable. Use Close to reset to overview.</p>
        )}

        {selection.mode === "city" && selectedCity && (
          <>
            <p className="mt-1 text-sm text-slate-700">
              {selectedCity.country} · {integerFormatter.format(selectedCity.properties.length)} properties
            </p>
            <p className="mt-2 text-xs text-slate-500">
              City-level ownership exposure is intentionally not aggregated in this version.
            </p>

            <div className="mt-3 max-h-[26svh] space-y-2 overflow-y-auto overscroll-contain pr-1 md:max-h-[calc(100svh-13rem)]">
              {selectedCity.properties.map((property) => {
                const flatProperty = flatPropertyById.get(property.id);

                return (
                  <button
                    key={property.id}
                    type="button"
                    className="pointer-events-auto w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    onClick={() => {
                      if (!flatProperty) {
                        return;
                      }

                      handleSelectProperty(flatProperty);
                    }}
                    disabled={!flatProperty}
                    aria-label={`Select property ${property.name ?? "Unnamed property"}`}
                  >
                    <h3 className="text-sm font-semibold text-slate-900 text-balance">{property.name ?? "Unnamed property"}</h3>
                    <p className="mt-1 text-xs text-slate-700">{property.address ?? "No address"}</p>
                    <p className="mt-2 text-xs text-slate-600">
                      {property.sector ?? "Unknown sector"} · {property.partnership ?? "Unknown partner"}
                    </p>
                    <p className="mt-1 text-xs text-slate-600 tabular-nums">
                      Ownership {property.ownership_percent == null ? "N/A" : `${decimalFormatter.format(property.ownership_percent)}%`}
                    </p>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {selection.mode === "property" && selectedCity && selectedProperty && (
          <>
            <p className="mt-1 text-sm text-slate-700">{selectedProperty.address ?? "No address"}</p>
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
              {SHOW_PROPERTY_COORDINATES_DEBUG && selectedFlatProperty && (
                <p>
                  <span className="text-slate-500">Coordinates</span>{" "}
                  {selectedFlatProperty.lat.toFixed(6)}, {selectedFlatProperty.lng.toFixed(6)}
                </p>
              )}
            </div>

            {!PROPERTY_VALUES_ENABLED && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
                Property-level value is hidden until asset-level valuation data is available.
              </p>
            )}

            <button
              className="pointer-events-auto mt-4 rounded-md px-1 py-0.5 text-xs text-blue-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              onClick={handleBackToCity}
              type="button"
            >
              ← Back to {selectedCity.city} properties
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
