import type { CityNode } from "@/types/cities";

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

type CityPropertiesSectionProps = {
  selectedCity: CityNode;
  filteredCityProperties: CityNode["properties"];
  onSelectProperty: (propertyId: string) => void;
};

export default function CityPropertiesSection({
  selectedCity,
  filteredCityProperties,
  onSelectProperty,
}: CityPropertiesSectionProps) {
  return (
    <>
      <p className="mt-1 text-sm text-slate-700">
        {integerFormatter.format(filteredCityProperties.length)} of {integerFormatter.format(selectedCity.properties.length)} investments shown
      </p>

      <div className="mt-3 max-h-[32svh] space-y-2 overflow-y-auto overscroll-contain pr-1 md:max-h-[calc(100svh-11.5rem)]">
        {filteredCityProperties.map((property) => (
          <button
            key={property.id}
            type="button"
            className="pointer-events-auto w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            onClick={() => onSelectProperty(property.id)}
            aria-label={`Select property ${property.name ?? "Unnamed property"}`}
          >
            <h3 className="text-sm font-semibold text-slate-900 text-balance">{property.name ?? "Unnamed property"}</h3>
            <p className="mt-1 text-xs text-slate-700">{property.address ?? "No address"}</p>
            <p className="mt-2 text-xs text-slate-600">
              {property.sector ?? "Unknown sector"} · {property.partnership ?? "Unknown partner"}
            </p>
            <p className="mt-1 text-xs text-slate-600 tabular-nums">
              Ownership{" "}
              {property.ownership_percent == null ? "N/A" : `${decimalFormatter.format(property.ownership_percent)}%`}
            </p>
          </button>
        ))}

        {filteredCityProperties.length === 0 && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            No properties match this filter.
          </p>
        )}
      </div>
    </>
  );
}
