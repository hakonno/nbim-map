"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import PropertyDetail from "@/components/explore/PropertyDetail";
import type { ExploreProperty } from "@/components/explore/types";

type ExploreDetailModalProps = {
  property: ExploreProperty;
  googleMapsEmbedApiKey: string;
  siteUrl: string;
};

/**
 * Client shell for the intercepted /property/[id] route: the detail panel with
 * "close = go back". The explore page underneath stays mounted (parallel-route
 * slot), so closing returns to the exact filtered list and camera position.
 */
export default function ExploreDetailModal({
  property,
  googleMapsEmbedApiKey,
  siteUrl,
}: ExploreDetailModalProps) {
  const router = useRouter();
  const close = useCallback(() => router.back(), [router]);
  // "Explore the map": close the panel but stay in the app — replace (not
  // push) so history stays where the visitor came from (e.g. the index page).
  const showMap = useCallback(() => router.replace("/", { scroll: false }), [router]);

  return (
    <PropertyDetail
      property={property}
      googleMapsEmbedApiKey={googleMapsEmbedApiKey}
      siteUrl={siteUrl}
      onClose={close}
      onShowMap={showMap}
    />
  );
}
