import { Fragment } from "react";
import { CircleMarker } from "react-leaflet";

import {
  getCityColors,
  getCityRadius,
  getPropertyColors,
} from "@/components/map/mapConstants";
import type { FlatProperty, SelectionState } from "@/components/map/mapTypes";
import type { CityNode } from "@/types/cities";

type MapMarkersLayerProps = {
  showProperties: boolean;
  showPropertyDetail: boolean;
  mappableCities: CityNode[];
  flatProperties: FlatProperty[];
  selection: SelectionState;
  maxPropertyCount: number;
  onSelectCity: (city: CityNode) => void;
  onSelectProperty: (property: FlatProperty) => void;
};

export default function MapMarkersLayer({
  showProperties,
  showPropertyDetail,
  mappableCities,
  flatProperties,
  selection,
  maxPropertyCount,
  onSelectCity,
  onSelectProperty,
}: MapMarkersLayerProps) {
  return (
    <>
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
                  onSelectCity(city);
                },
              }}
            />
          );
        })}

      {showProperties &&
        flatProperties.map((property) => {
          const isSelected = selection.mode === "property" && selection.selectedPropertyId === property.id;
          const propertyColors = getPropertyColors(property.ownership_percent, isSelected);

          if (isSelected) {
            return (
              <Fragment key={property.id}>
                <CircleMarker
                  center={[property.lat, property.lng]}
                  radius={showPropertyDetail ? 16 : 12}
                  className="selected-property-halo"
                  interactive={false}
                  pathOptions={{
                    color: propertyColors.stroke,
                    fillOpacity: 0,
                    opacity: 0.85,
                    weight: 2,
                  }}
                />
                <CircleMarker
                  center={[property.lat, property.lng]}
                  radius={showPropertyDetail ? 8.5 : 5.75}
                  pathOptions={{
                    color: propertyColors.stroke,
                    fillColor: propertyColors.fill,
                    fillOpacity: 0.9,
                    weight: 2.75,
                  }}
                  eventHandlers={{
                    click: () => {
                      onSelectProperty(property);
                    },
                  }}
                />
              </Fragment>
            );
          }

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
                  onSelectProperty(property);
                },
              }}
            />
          );
        })}
    </>
  );
}
