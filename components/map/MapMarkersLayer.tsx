"use client";

import L from "leaflet";
import { useMemo } from "react";
import MarkerClusterGroup from "react-leaflet-cluster";
import { Marker, Tooltip } from "react-leaflet";

import {
  getPropertyColors,
  ZOOM_PROPERTY_FOCUS,
} from "@/components/map/mapConstants";
import type { FlatProperty, SelectionState } from "@/components/map/mapTypes";

const integerFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

type ClusterMarkerMeta = {
  o: number | null;
  f: boolean;
};

function encodeClusterMeta(property: FlatProperty): string {
  const meta: ClusterMarkerMeta = {
    o: typeof property.ownership_percent === "number" ? property.ownership_percent : null,
    f: Boolean(property.is_nbim_office),
  };
  return JSON.stringify(meta);
}

function decodeClusterMeta(value: unknown): ClusterMarkerMeta | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as ClusterMarkerMeta;
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed;
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return ch;
    }
  });
}

function createPropertyIcon(
  colors: { fill: string; stroke: string },
  size: number,
  isSelected: boolean
): L.DivIcon {
  const shadow = isSelected
    ? `box-shadow: 0 0 0 3px color-mix(in srgb, ${colors.stroke}, transparent 67%), 0 0 10px color-mix(in srgb, ${colors.stroke}, transparent 80%);`
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

type ClusterStats = {
  count: number;
  officeCount: number;
  investmentCount: number;
  ownershipAverage: number | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectClusterStats(cluster: any): ClusterStats {
  const markers: L.Marker[] = cluster.getAllChildMarkers();
  let ownershipSum = 0;
  let ownershipCount = 0;
  let officeCount = 0;
  let investmentCount = 0;

  for (const marker of markers) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = decodeClusterMeta((marker.options as any).alt);
    if (!meta) continue;
    if (meta.f) {
      officeCount++;
      continue;
    }
    investmentCount++;
    if (typeof meta.o === "number") {
      ownershipSum += meta.o;
      ownershipCount++;
    }
  }

  return {
    count: markers.length,
    officeCount,
    investmentCount,
    ownershipAverage: ownershipCount > 0 ? ownershipSum / ownershipCount : null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createClusterIcon(cluster: any): L.DivIcon {
  const { count, officeCount, investmentCount, ownershipAverage } = collectClusterStats(cluster);

  // Tiered sizing — small clusters stay readable, large ones scale up noticeably.
  let size: number;
  if (count < 10) size = 30;
  else if (count < 50) size = 40;
  else if (count < 200) size = 50;
  else size = 60;

  const mostlyOffices = officeCount > investmentCount && officeCount > 0;

  let fill: string;
  let stroke: string;
  let textColor: string;

  if (mostlyOffices) {
    fill = "#fbbf24";
    stroke = "#b45309";
    textColor = "#7c2d12";
  } else if (ownershipAverage != null) {
    const ratio = Math.min(1, Math.max(0, ownershipAverage / 100));
    const perceptualRatio = Math.pow(ratio, 1.35);
    const hue = Math.round(perceptualRatio * 120);
    fill = `hsl(${hue}, 84%, 64%)`;
    stroke = `hsl(${hue}, 68%, 36%)`;
    textColor = `hsl(${hue}, 70%, 16%)`;
  } else {
    fill = "rgba(148, 163, 184, 0.92)";
    stroke = "#475569";
    textColor = "#1e293b";
  }

  const fontSize = count >= 1000 ? 11 : count >= 100 ? 12 : 13;
  const badge = officeCount > 0 && !mostlyOffices
    ? `<span aria-hidden="true" style="
        position:absolute;top:-2px;right:-2px;
        min-width:12px;height:12px;padding:0 3px;
        border-radius:999px;background:#fbbf24;color:#7c2d12;
        border:1.5px solid #fff;box-sizing:border-box;
        font-size:9px;line-height:9px;font-weight:700;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 1px 2px rgba(15,23,42,0.25);
      ">${officeCount}</span>`
    : "";

  return L.divIcon({
    className: "nbim-cluster-icon",
    html: `<div style="
      position:relative;
      width:${size}px;height:${size}px;border-radius:50%;
      background:${fill};
      border:2px solid ${stroke};
      display:flex;align-items:center;justify-content:center;
      font-size:${fontSize}px;font-weight:700;color:${textColor};
      font-family:system-ui,sans-serif;box-sizing:border-box;
      box-shadow:0 2px 6px rgba(15,23,42,0.22);
    ">${count}${badge}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildClusterTooltipHtml(cluster: any): string {
  const { count, officeCount, investmentCount, ownershipAverage } = collectClusterStats(cluster);
  const markers: L.Marker[] = cluster.getAllChildMarkers();

  const cityCounts = new Map<string, number>();
  for (const marker of markers) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const city = (marker.options as any).title as string | undefined;
    if (!city) continue;
    cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
  }

  const topCities: [string, number][] = [];
  for (const [city, count] of cityCounts) {
    topCities.push([city, count]);
    if (topCities.length > 3) {
      topCities.sort((a, b) => b[1] - a[1]);
      topCities.pop();
    }
  }
  topCities.sort((a, b) => b[1] - a[1]);
  const extraCityCount = Math.max(0, cityCounts.size - topCities.length);

  const lines: string[] = [];
  lines.push(
    `<div class="cluster-tooltip__header">${count} marker${count === 1 ? "" : "s"}</div>`
  );

  const breakdown: string[] = [];
  if (investmentCount > 0) {
    breakdown.push(`${investmentCount} propert${investmentCount === 1 ? "y" : "ies"}`);
  }
  if (officeCount > 0) {
    breakdown.push(`${officeCount} NBIM office${officeCount === 1 ? "" : "s"}`);
  }
  if (breakdown.length > 0) {
    lines.push(`<div class="cluster-tooltip__row">${breakdown.join(" · ")}</div>`);
  }

  if (ownershipAverage != null) {
    const rounded = Math.round(ownershipAverage);
    const label = ownershipAverage >= 99.5 ? "100" : integerFormatter.format(rounded);
    lines.push(
      `<div class="cluster-tooltip__row cluster-tooltip__row--muted">~${label}% avg ownership</div>`
    );
  }

  if (topCities.length > 0) {
    const items = topCities
      .map(
        ([city, n]) =>
          `<li><span class="cluster-tooltip__city">${escapeHtml(city)}</span><span class="cluster-tooltip__city-count">${n}</span></li>`
      )
      .join("");
    const more = extraCityCount > 0
      ? `<li class="cluster-tooltip__more">+${extraCityCount} more cit${extraCityCount === 1 ? "y" : "ies"}</li>`
      : "";
    lines.push(`<ul class="cluster-tooltip__cities">${items}${more}</ul>`);
  }

  return lines.join("");
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

  const clusterEventHandlers = useMemo(
    () => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      clustermouseover: (event: any) => {
        const cluster = event.layer;
        cluster
          .bindTooltip(buildClusterTooltipHtml(cluster), {
            direction: "top",
            offset: [0, -8],
            className: "cluster-tooltip",
            sticky: false,
          })
          .openTooltip();
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      clustermouseout: (event: any) => {
        event.layer.closeTooltip();
        event.layer.unbindTooltip();
      },
    }),
    []
  );

  return (
    <MarkerClusterGroup
      chunkedLoading
      maxClusterRadius={60}
      disableClusteringAtZoom={ZOOM_PROPERTY_FOCUS}
      spiderfyOnMaxZoom
      showCoverageOnHover={false}
      zoomToBoundsOnClick
      iconCreateFunction={createClusterIcon}
      eventHandlers={clusterEventHandlers}
    >
      {flatProperties.map((property) => {
        const isSelected = selection.mode === "property" && selection.selectedPropertyId === property.id;
        const colors = getPropertyColors(
          property.ownership_percent,
          isSelected,
          Boolean(property.is_nbim_office)
        );
        const size = property.is_nbim_office
          ? showPropertyDetail ? 26 : 18
          : showPropertyDetail ? 24 : 16;
        const icon = createPropertyIcon(colors, size, isSelected);
        const showLabel = shouldShowPropertyLabel(property, isSelected);
        const tooltipClassName = [
          "map-marker-label",
          isSelected ? "map-marker-label--selected" : null,
          property.is_nbim_office ? "map-marker-label--office" : null,
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <Marker
            key={property.id}
            position={[property.lat, property.lng]}
            icon={icon}
            title={property.cityName}
            alt={encodeClusterMeta(property)}
            eventHandlers={{ click: () => onSelectProperty(property) }}
          >
            {showLabel && (
              <Tooltip
                direction="top"
                offset={[0, -size / 2]}
                opacity={1}
                permanent
                className={tooltipClassName}
              >
                {getPropertyLabel(property)}
              </Tooltip>
            )}
          </Marker>
        );
      })}
    </MarkerClusterGroup>
  );
}
