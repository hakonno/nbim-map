"use client";

import type { LeafletEvent } from "leaflet";
import { useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMapEvents } from "react-leaflet";

import type { CityNode, CityProperty } from "@/types/cities";

// Zoom thresholds for layer transitions
const ZOOM_SHOW_PROPERTIES = 7; // above → switch from city markers to property markers
const ZOOM_PROPERTY_DETAIL = 10; // above → show full detail popup on each property marker
const MAP_DEFAULT_ZOOM = 2;

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

function ZoomTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  useMapEvents({
    zoomend: (e: LeafletEvent) => {
      onZoomChange((e.target as { getZoom: () => number }).getZoom());
    },
  });
  return null;
}

export default function CityMapInner({ cities }: CityMapInnerProps) {
  const [zoom, setZoom] = useState(MAP_DEFAULT_ZOOM);

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

  const [selectedCityId, setSelectedCityId] = useState<string | null>(validCities[0]?.id ?? null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  const selectedCity = useMemo(
    () => validCities.find((city) => city.id === selectedCityId) ?? validCities[0] ?? null,
    [selectedCityId, validCities]
  );

  const selectedProperty = useMemo(
    () => selectedCity?.properties.find((p) => p.id === selectedPropertyId) ?? null,
    [selectedCity, selectedPropertyId]
  );

  const totalProperties = useMemo(
    () => validCities.reduce((sum, city) => sum + city.properties.length, 0),
    [validCities]
  );

  const totalCountries = useMemo(() => new Set(validCities.map((city) => city.country)).size, [validCities]);

  const showProperties = zoom >= ZOOM_SHOW_PROPERTIES;
  const showPropertyDetail = zoom >= ZOOM_PROPERTY_DETAIL;

  return (
    <div className="map-shell relative h-[100svh] w-full overflow-hidden touch-manipulation">
      <MapContainer center={mapCenter} zoom={MAP_DEFAULT_ZOOM} minZoom={2} className="h-full w-full" worldCopyJump>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ZoomTracker onZoomChange={setZoom} />

        {/* Layer 1 – city overview (zoom < ZOOM_SHOW_PROPERTIES) */}
        {!showProperties &&
          validCities.map((city) => (
            <CircleMarker
              key={city.id}
              center={[city.lat as number, city.lng as number]}
              radius={getCityRadius(city.properties.length, maxPropertyCount)}
              pathOptions={{
                color: city.id === selectedCityId ? "#b45309" : "#0f766e",
                fillColor: city.id === selectedCityId ? "#f59e0b" : "#14b8a6",
                fillOpacity: 0.82,
                weight: city.id === selectedCityId ? 2.5 : 1,
              }}
              eventHandlers={{
                click: () => {
                  setSelectedCityId(city.id);
                  setSelectedPropertyId(null);
                },
              }}
            >
              <Popup>
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">{city.city}</p>
                  <p>{city.country}</p>
                  <p>{city.properties.length} properties</p>
                  <p>Ownership sum: {decimalFormatter.format(city.total_ownership_sum)}%</p>
                </div>
              </Popup>
            </CircleMarker>
          ))}

        {/* Layer 2 – individual property markers (zoom >= ZOOM_SHOW_PROPERTIES) */}
        {showProperties &&
          flatProperties.map((prop) => (
            <CircleMarker
              key={prop.id}
              center={[prop.lat, prop.lng]}
              radius={showPropertyDetail ? 8 : 5}
              pathOptions={{
                color: prop.id === selectedPropertyId ? "#b45309" : "#1d4ed8",
                fillColor: prop.id === selectedPropertyId ? "#f59e0b" : "#3b82f6",
                fillOpacity: 0.82,
                weight: prop.id === selectedPropertyId ? 2.5 : 1,
              }}
              eventHandlers={{
                click: () => {
                  setSelectedCityId(prop.cityId);
                  setSelectedPropertyId(prop.id);
                },
              }}
            >
              {showPropertyDetail && (
                <Popup>
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold">{prop.name ?? "Unnamed property"}</p>
                    <p className="text-xs text-gray-600">{prop.address}</p>
                    <p>
                      {prop.cityName}, {prop.country}
                    </p>
                    <p>{prop.sector ?? "Unknown sector"}</p>
                    <p>Ownership: {prop.ownership_percent ?? "N/A"}%</p>
                    <p>NOK {integerFormatter.format(prop.value_nok ?? 0)}</p>
                  </div>
                </Popup>
              )}
            </CircleMarker>
          ))}
      </MapContainer>

      {/* Top-left info card */}
      <div className="pointer-events-none absolute left-3 top-3 z-[500] w-[calc(100%-1.5rem)] max-w-sm rounded-2xl border border-white/60 bg-white/92 p-4 shadow-xl backdrop-blur sm:left-4 sm:top-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">NBIM Real Estate</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900 text-balance">Multi-resolution investment map</h1>
        <p className="mt-2 text-sm text-slate-700" role="status" aria-live="polite">
          {!showProperties
            ? "Zoom in to explore individual properties within each city."
            : showPropertyDetail
              ? "Individual properties — click a marker for details."
              : "Property markers use fixed source coordinates; zoom in for easier selection."}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs sm:text-sm">
          <div className="rounded-xl bg-slate-100 p-2">
            <p className="text-slate-500">Cities</p>
            <p className="font-semibold text-slate-900 tabular-nums">{integerFormatter.format(validCities.length)}</p>
          </div>
          <div className="rounded-xl bg-slate-100 p-2">
            <p className="text-slate-500">Properties</p>
            <p className="font-semibold text-slate-900 tabular-nums">{integerFormatter.format(totalProperties)}</p>
          </div>
          <div className="rounded-xl bg-slate-100 p-2">
            <p className="text-slate-500">Countries</p>
            <p className="font-semibold text-slate-900 tabular-nums">{integerFormatter.format(totalCountries)}</p>
          </div>
        </div>
      </div>

      {/* Right / bottom detail panel */}
      <aside className="safe-area-bottom absolute bottom-0 left-0 right-0 z-[500] max-h-[42svh] rounded-t-2xl border-t border-slate-200 bg-white/96 p-3 shadow-2xl backdrop-blur md:bottom-4 md:left-auto md:right-4 md:top-4 md:max-h-[calc(100svh-2rem)] md:w-[360px] md:rounded-2xl md:border md:p-4">
        {showProperties && selectedProperty ? (
          // Property detail view
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">Selected Property</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900 text-balance">
              {selectedProperty.name ?? "Unnamed property"}
            </h2>
            <p className="mt-1 text-sm text-slate-700">{selectedProperty.address ?? "No address"}</p>
            <p className="mt-1 text-sm text-slate-600">
              {selectedCity?.city}, {selectedCity?.country}
            </p>
            <div className="mt-3 space-y-1 text-sm text-slate-700 tabular-nums">
              <p>
                <span className="text-slate-500">Sector</span> {selectedProperty.sector ?? "N/A"}
              </p>
              <p>
                <span className="text-slate-500">Partner</span> {selectedProperty.partnership ?? "N/A"}
              </p>
              <p>
                <span className="text-slate-500">Ownership</span> {selectedProperty.ownership_percent ?? "N/A"}%
              </p>
              <p>
                <span className="text-slate-500">Value NOK</span> {integerFormatter.format(selectedProperty.value_nok ?? 0)}
              </p>
              {selectedProperty.value_usd != null && (
                <p>
                  <span className="text-slate-500">Value USD</span> {integerFormatter.format(selectedProperty.value_usd)}
                </p>
              )}
            </div>
            <button
              className="pointer-events-auto mt-4 rounded-md px-1 py-0.5 text-xs text-blue-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              onClick={() => setSelectedPropertyId(null)}
              type="button"
            >
              ← Back to {selectedCity?.city} properties
            </button>
          </>
        ) : (
          // City / property list view
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {showProperties ? "Properties in view" : "Selected City"}
            </p>

            {selectedCity ? (
              <>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  {selectedCity.city}, {selectedCity.country}
                </h2>
                <p className="mt-1 text-sm text-slate-700 tabular-nums">
                  {selectedCity.properties.length} properties · Ownership sum{" "}
                  {decimalFormatter.format(selectedCity.total_ownership_sum)}%
                </p>

                <div className="mt-3 max-h-[26svh] space-y-2 overflow-y-auto overscroll-contain pr-1 md:max-h-[calc(100svh-13rem)]">
                  {selectedCity.properties.map((property) => {
                    const isSelected = property.id === selectedPropertyId;
                    const stateClasses = isSelected
                      ? "border-amber-300 bg-amber-50"
                      : "border-slate-200 bg-slate-50";
                    const cardBody = (
                      <>
                        <h3 className="text-sm font-semibold text-slate-900 text-balance">{property.name ?? "Unnamed property"}</h3>
                        <p className="mt-1 text-xs text-slate-700">{property.address ?? "No address"}</p>
                        <p className="mt-2 text-xs text-slate-600">
                          {property.sector ?? "Unknown sector"} · {property.partnership ?? "Unknown partner"}
                        </p>
                        <p className="mt-1 text-xs text-slate-600 tabular-nums">
                          Ownership {property.ownership_percent ?? "N/A"}% · NOK{" "}
                          {integerFormatter.format(property.value_nok ?? 0)}
                        </p>
                      </>
                    );

                    if (showProperties) {
                      return (
                        <button
                          key={property.id}
                          type="button"
                          className={`pointer-events-auto w-full cursor-pointer rounded-xl border p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${stateClasses}`}
                          onClick={() => setSelectedPropertyId(property.id)}
                          aria-pressed={isSelected}
                          aria-label={`Select property ${property.name ?? "Unnamed property"}`}
                        >
                          {cardBody}
                        </button>
                      );
                    }

                    return (
                      <article
                        key={property.id}
                        className={`rounded-xl border p-3 ${stateClasses}`}
                      >
                        {cardBody}
                      </article>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-700">Select a city marker to inspect aggregated properties.</p>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
