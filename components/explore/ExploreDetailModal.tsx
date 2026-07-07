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
  // Dismiss-in-app: close the panel but stay in the explore app with the
  // property still highlighted — ?sel= carries the selection across, and
  // replace (not push) keeps history pointing where the visitor came from.
  const dismissInApp = useCallback(
    () => router.replace(`/?sel=${encodeURIComponent(property.id)}`, { scroll: false }),
    [router, property.id]
  );

  return (
    <PropertyDetail
      property={property}
      googleMapsEmbedApiKey={googleMapsEmbedApiKey}
      siteUrl={siteUrl}
      onClose={close}
      onDismissInApp={dismissInApp}
    />
  );
}
