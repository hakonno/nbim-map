"use client";

import L from "leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { Marker, Tooltip } from "react-leaflet";

import { getPropertyColors } from "@/components/map/mapConstants";
import type { FlatProperty, SelectionState } from "@/components/map/mapTypes";

const integerFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function createPropertyIcon(
  colors: { fill: string; stroke: string },
  size: number,
  isSelected: boolean
): L.DivIcon {
  const shadow = isSelected
    ? `box-shadow: 0 0 0 3px ${colors.stroke}55, 0 0 10px ${colors.stroke}33;`
    : "";
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${colors.fill};
      border:${isSelected ? 2.5 : 1}px solid ${colors.stroke};
      opacity:${isSelected ? 1 : 0.88};
      box-sizing:border-box;${shadow}
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createClusterIcon(cluster: any): L.DivIcon {
  const count: number = cluster.getChildCount();
  const size = Math.min(44, Math.max(22, 18 + Math.sqrt(count) * 2.4));
  const fontSize = count >= 100 ? 10 : 11;
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:rgba(148,163,184,0.88);
      border:1.5px solid #475569;
      display:flex;align-items:center;justify-content:center;
      font-size:${fontSize}px;font-weight:700;color:#1e293b;
      font-family:system-ui,sans-serif;box-sizing:border-box;
    ">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

type MapMarkersLayerProps = {
  showPropertyDetail: boolean;
  zoom: number;
  flatProperties: FlatProperty[];
  selection: SelectionState;
  onSelectProperty: (property: FlatProperty) => void;
};

export default function MapMarkersLayer({
  showPropertyDetail,
  zoom,
  flatProperties,
  selection,
  onSelectProperty,
}: MapMarkersLayerProps) {
  const getPropertyLabel = (property: FlatProperty) => {
    const base = property.office_name?.trim() || property.name?.trim() || property.address?.trim() || "Property";
    if (property.is_nbim_office) {
      const type =
        property.office_category === "head_office" ? "Head office"
        : property.office_category === "real_estate_office" ? "Real estate office"
        : "NBIM office";
      return `${base} · ${type}`;
    }
    if (property.ownership_percent == null) return base;
    if (Number.isInteger(property.ownership_percent))
      return `${base} · ${integerFormatter.format(property.ownership_percent)}%`;
    return `${base} · ~${integerFormatter.format(Math.round(property.ownership_percent))}%`;
  };

  const shouldShowPropertyLabel = (property: FlatProperty, isSelected: boolean) => {
    if (zoom < 17) return false;
    if (isSelected) return true;
    return selection.mode !== "global" && selection.selectedCityId === property.cityId;
  };

  return (
    <MarkerClusterGroup
      chunkedLoading
      maxClusterRadius={60}
      disableClusteringAtZoom={15}
      iconCreateFunction={createClusterIcon}
      eventHandlers={{
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        clustermouseover: (e: any) => {
          const cluster = e.layer;
          const markers: L.Marker[] = cluster.getAllChildMarkers();
          const cityCount = new Map<string, number>();
          for (const m of markers) {
            const city = (m.options as any).title as string;
            if (city) cityCount.set(city, (cityCount.get(city) ?? 0) + 1);
          }
          const city = [...cityCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
          cluster
            .bindTooltip(`<b>${city}</b> · ${markers.length} properties`, {
              direction: "top",
              offset: [0, -8],
              className: "cluster-tooltip",
            })
            .openTooltip();
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        clustermouseout: (e: any) => {
          e.layer.closeTooltip();
          e.layer.unbindTooltip();
        },
      }}
    >
      {flatProperties.map((property) => {
        const isSelected = selection.mode === "property" && selection.selectedPropertyId === property.id;
        const colors = getPropertyColors(
          property.ownership_percent,
          isSelected,
          Boolean(property.is_nbim_office)
        );
        const size = property.is_nbim_office
          ? showPropertyDetail ? 18 : 12
          : showPropertyDetail ? 16 : 10;
        const icon = createPropertyIcon(colors, size, isSelected);
        const showLabel = shouldShowPropertyLabel(property, isSelected);

        return (
          <Marker
            key={property.id}
            position={[property.lat, property.lng]}
            icon={icon}
            title={property.cityName}
            eventHandlers={{ click: () => onSelectProperty(property) }}
          >
            {showLabel && (
              <Tooltip direction="top" offset={[0, -size / 2]} opacity={1} permanent className="map-marker-label">
                {getPropertyLabel(property)}
              </Tooltip>
            )}
          </Marker>
        );
      })}
    </MarkerClusterGroup>
  );
}
