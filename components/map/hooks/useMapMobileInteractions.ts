"use client";

import type { Map as LeafletMap } from "leaflet";
import { useCallback, useRef } from "react";

import type { FlatProperty, SelectionState } from "@/components/map/mapTypes";
import type { CityNode } from "@/types/cities";

const MOBILE_PANEL_MEDIA_QUERY = "(max-width: 767px)";
const MOBILE_PANEL_HEIGHT_VAR = "--map-mobile-panel-height";
const MOBILE_INTRO_HEIGHT_VAR = "--map-mobile-intro-height";
const AUTO_RECENTER_TOLERANCE_PX = 32;

type UseMapMobileInteractionsParams = {
  mapInstance: LeafletMap | null;
  selectionMode: SelectionState["mode"];
  selectedCity: CityNode | null;
  selectedCountry: string | null;
  selectedFlatProperty: FlatProperty | null;
  countryCitiesMap: Map<string, CityNode[]>;
};

type UseMapMobileInteractionsResult = {
  getFocusCenter: (target: [number, number], zoomLevel: number) => [number, number];
  handleMobilePanelHeightChange: (nextPanelHeight: number) => void;
  handleMobileZoomIn: () => void;
  handleMobileZoomOut: () => void;
};

export function useMapMobileInteractions({
  mapInstance,
  selectionMode,
  selectedCity,
  selectedCountry,
  selectedFlatProperty,
  countryCitiesMap,
}: UseMapMobileInteractionsParams): UseMapMobileInteractionsResult {
  const mobilePanelHeightRef = useRef<number | null>(null);

  const getMobileOverlayHeights = useCallback(() => {
    const rootStyle = getComputedStyle(document.documentElement);
    const panelHeightRaw = rootStyle.getPropertyValue(MOBILE_PANEL_HEIGHT_VAR).trim();
    const introHeightRaw = rootStyle.getPropertyValue(MOBILE_INTRO_HEIGHT_VAR).trim();

    const panelHeightPx = Number.parseFloat(panelHeightRaw);
    const introHeightPx = Number.parseFloat(introHeightRaw);

    return {
      panelHeightPx:
        Number.isFinite(panelHeightPx) && panelHeightPx > 0 ? panelHeightPx : 0,
      introHeightPx:
        Number.isFinite(introHeightPx) && introHeightPx > 0 ? introHeightPx : 0,
    };
  }, []);

  const getMobileFocusContainerPoint = useCallback((): [number, number] | null => {
    if (
      !mapInstance ||
      typeof window === "undefined" ||
      !window.matchMedia(MOBILE_PANEL_MEDIA_QUERY).matches
    ) {
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
      if (
        !mapInstance ||
        typeof window === "undefined" ||
        !window.matchMedia(MOBILE_PANEL_MEDIA_QUERY).matches
      ) {
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

  const getFocusCenterForHeights = useCallback(
    (
      target: [number, number],
      zoomLevel: number,
      panelHeightPx: number,
      introHeightPx: number
    ): [number, number] => {
      if (!mapInstance) {
        return target;
      }

      const focusOffsetPx = (panelHeightPx - introHeightPx) / 2;
      if (!Number.isFinite(focusOffsetPx) || Math.abs(focusOffsetPx) < 1) {
        return target;
      }

      const targetPoint = mapInstance.project(target, zoomLevel);
      const adjustedCenterPoint = targetPoint.add([0, focusOffsetPx]);
      const adjustedCenter = mapInstance.unproject(adjustedCenterPoint, zoomLevel);
      return [adjustedCenter.lat, adjustedCenter.lng];
    },
    [mapInstance]
  );

  const handleMobilePanelHeightChange = useCallback(
    (nextPanelHeight: number) => {
      const previousPanelHeight = mobilePanelHeightRef.current;
      mobilePanelHeightRef.current = nextPanelHeight;

      if (
        !mapInstance ||
        typeof window === "undefined" ||
        !window.matchMedia(MOBILE_PANEL_MEDIA_QUERY).matches ||
        previousPanelHeight === null ||
        Math.abs(previousPanelHeight - nextPanelHeight) < 1
      ) {
        return;
      }

      const target: [number, number] | null =
        selectionMode === "property" && selectedFlatProperty
          ? [selectedFlatProperty.lat, selectedFlatProperty.lng]
          : selectionMode === "city" &&
              selectedCity &&
              typeof selectedCity.lat === "number" &&
              typeof selectedCity.lng === "number"
            ? [selectedCity.lat, selectedCity.lng]
            : selectionMode === "country" && selectedCountry
              ? (() => {
                  const countryCities = countryCitiesMap.get(selectedCountry) ?? [];
                  const firstCity = countryCities.find(
                    (city) =>
                      typeof city.lat === "number" &&
                      typeof city.lng === "number"
                  );

                  return firstCity
                    ? ([firstCity.lat as number, firstCity.lng as number] as [
                        number,
                        number,
                      ])
                    : null;
                })()
              : null;

      if (!target) {
        return;
      }

      const zoomLevel = mapInstance.getZoom();
      const { introHeightPx } = getMobileOverlayHeights();

      const expectedPreviousCenter = getFocusCenterForHeights(
        target,
        zoomLevel,
        previousPanelHeight,
        introHeightPx
      );
      const expectedNextCenter = getFocusCenterForHeights(
        target,
        zoomLevel,
        nextPanelHeight,
        introHeightPx
      );

      const currentCenterPoint = mapInstance.project(mapInstance.getCenter(), zoomLevel);
      const expectedPreviousPoint = mapInstance.project(expectedPreviousCenter, zoomLevel);
      if (currentCenterPoint.distanceTo(expectedPreviousPoint) > AUTO_RECENTER_TOLERANCE_PX) {
        return;
      }

      mapInstance.panTo(expectedNextCenter, {
        animate: true,
        duration: 0.3,
        easeLinearity: 0.25,
      });
    },
    [
      countryCitiesMap,
      getFocusCenterForHeights,
      getMobileOverlayHeights,
      mapInstance,
      selectedCity,
      selectedCountry,
      selectedFlatProperty,
      selectionMode,
    ]
  );

  const handleMobileZoomIn = useCallback(() => {
    if (!mapInstance) {
      return;
    }

    const targetZoom = Math.min(mapInstance.getZoom() + 1, mapInstance.getMaxZoom());
    if (targetZoom === mapInstance.getZoom()) {
      return;
    }

    const focusPoint = getMobileFocusContainerPoint();

    if (!focusPoint) {
      mapInstance.zoomIn();
      return;
    }

    const focusLatLng = mapInstance.containerPointToLatLng(focusPoint);
    const projectedFocus = mapInstance.project(focusLatLng, targetZoom);
    const containerCenter = mapInstance.getSize().divideBy(2);
    const targetCenterPoint = projectedFocus.add(containerCenter).subtract(focusPoint);
    const targetCenter = mapInstance.unproject(targetCenterPoint, targetZoom);

    mapInstance.flyTo(targetCenter, targetZoom, {
      animate: true,
      duration: 0.35,
      easeLinearity: 0.25,
    });
  }, [getMobileFocusContainerPoint, mapInstance]);

  const handleMobileZoomOut = useCallback(() => {
    if (!mapInstance) {
      return;
    }

    const targetZoom = Math.max(mapInstance.getZoom() - 1, mapInstance.getMinZoom());
    if (targetZoom === mapInstance.getZoom()) {
      return;
    }

    const focusPoint = getMobileFocusContainerPoint();

    if (!focusPoint) {
      mapInstance.zoomOut();
      return;
    }

    const focusLatLng = mapInstance.containerPointToLatLng(focusPoint);
    const projectedFocus = mapInstance.project(focusLatLng, targetZoom);
    const containerCenter = mapInstance.getSize().divideBy(2);
    const targetCenterPoint = projectedFocus.add(containerCenter).subtract(focusPoint);
    const targetCenter = mapInstance.unproject(targetCenterPoint, targetZoom);

    mapInstance.flyTo(targetCenter, targetZoom, {
      animate: true,
      duration: 0.35,
      easeLinearity: 0.25,
    });
  }, [getMobileFocusContainerPoint, mapInstance]);

  return {
    getFocusCenter,
    handleMobilePanelHeightChange,
    handleMobileZoomIn,
    handleMobileZoomOut,
  };
}
