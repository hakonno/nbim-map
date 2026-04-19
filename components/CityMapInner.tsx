"use client";

import { useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

import type { CityNode } from "@/types/cities";

type CityMapInnerProps = {
  cities: CityNode[];
};

const mapCenter: [number, number] = [25, 5];

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function getRadius(propertyCount: number, maxPropertyCount: number) {
  const ratio = Math.sqrt(propertyCount / Math.max(maxPropertyCount, 1));
  return 7 + ratio * 16;
}

export default function CityMapInner({ cities }: CityMapInnerProps) {
  const validCities = useMemo(
    () => cities.filter((city) => typeof city.lat === "number" && typeof city.lng === "number"),
    [cities]
  );

  const maxPropertyCount = useMemo(
    () => Math.max(...validCities.map((city) => city.properties.length), 1),
    [validCities]
  );

  const [selectedCityId, setSelectedCityId] = useState<string | null>(validCities[0]?.id ?? null);

  const selectedCity = useMemo(
    () => validCities.find((city) => city.id === selectedCityId) ?? validCities[0] ?? null,
    [selectedCityId, validCities]
  );

  const totalProperties = useMemo(
    () => validCities.reduce((sum, city) => sum + city.properties.length, 0),
    [validCities]
  );

  const totalCountries = useMemo(() => new Set(validCities.map((city) => city.country)).size, [validCities]);

  return (
    <div className="map-shell relative h-[100svh] w-full overflow-hidden">
      <MapContainer center={mapCenter} zoom={2} minZoom={2} className="h-full w-full" worldCopyJump>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {validCities.map((city) => (
          <CircleMarker
            key={city.id}
            center={[city.lat as number, city.lng as number]}
            radius={getRadius(city.properties.length, maxPropertyCount)}
            pathOptions={{
              color: city.id === selectedCityId ? "#b45309" : "#0f766e",
              fillColor: city.id === selectedCityId ? "#f59e0b" : "#14b8a6",
              fillOpacity: 0.82,
              weight: city.id === selectedCityId ? 2.5 : 1,
            }}
            eventHandlers={{
              click: () => setSelectedCityId(city.id),
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
      </MapContainer>

      <div className="pointer-events-none absolute left-3 top-3 z-[500] w-[calc(100%-1.5rem)] max-w-sm rounded-2xl border border-white/60 bg-white/92 p-4 shadow-xl backdrop-blur sm:left-4 sm:top-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">NBIM Real Estate</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">City-level investment map</h1>
        <p className="mt-2 text-sm text-slate-700">
          Precomputed city nodes for instant rendering with zero runtime geocoding.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs sm:text-sm">
          <div className="rounded-xl bg-slate-100 p-2">
            <p className="text-slate-500">Cities</p>
            <p className="font-semibold text-slate-900">{integerFormatter.format(validCities.length)}</p>
          </div>
          <div className="rounded-xl bg-slate-100 p-2">
            <p className="text-slate-500">Properties</p>
            <p className="font-semibold text-slate-900">{integerFormatter.format(totalProperties)}</p>
          </div>
          <div className="rounded-xl bg-slate-100 p-2">
            <p className="text-slate-500">Countries</p>
            <p className="font-semibold text-slate-900">{integerFormatter.format(totalCountries)}</p>
          </div>
        </div>
      </div>

      <aside className="absolute bottom-0 left-0 right-0 z-[500] max-h-[42svh] rounded-t-2xl border-t border-slate-200 bg-white/96 p-3 shadow-2xl backdrop-blur md:bottom-4 md:left-auto md:right-4 md:top-4 md:max-h-[calc(100svh-2rem)] md:w-[360px] md:rounded-2xl md:border md:p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Selected City</p>

        {selectedCity ? (
          <>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">
              {selectedCity.city}, {selectedCity.country}
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              {selectedCity.properties.length} properties · Ownership sum {decimalFormatter.format(selectedCity.total_ownership_sum)}%
            </p>

            <div className="mt-3 max-h-[26svh] space-y-2 overflow-y-auto pr-1 md:max-h-[calc(100svh-13rem)]">
              {selectedCity.properties.map((property) => (
                <article key={property.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <h3 className="text-sm font-semibold text-slate-900">{property.name ?? "Unnamed property"}</h3>
                  <p className="mt-1 text-xs text-slate-700">{property.address ?? "No address"}</p>
                  <p className="mt-2 text-xs text-slate-600">
                    {property.sector ?? "Unknown sector"} · {property.partnership ?? "Unknown partner"}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Ownership {property.ownership_percent ?? "N/A"}% · NOK {integerFormatter.format(property.value_nok ?? 0)}
                  </p>
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-700">Select a city marker to inspect aggregated properties.</p>
        )}
      </aside>
    </div>
  );
}
