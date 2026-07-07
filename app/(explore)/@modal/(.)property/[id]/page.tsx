import { notFound } from "next/navigation";

import ExploreDetailModal from "@/components/explore/ExploreDetailModal";
import { buildExploreData } from "@/lib/exploreData";
import { getGoogleMapsEmbedApiKey } from "@/lib/googleMapsKey";
import { SITE_URL } from "@/app/siteMetadata";

type Params = Promise<{ id: string }>;

// Intercepted /property/[id]: rendered as a detail panel over the live explore
// app on client-side navigation. Hard loads never reach this file — they get
// the full static page under app/(content)/property/[id].
export default async function InterceptedPropertyPage({ params }: { params: Params }) {
  const { id } = await params;
  const property = buildExploreData().properties.find((p) => p.id === id);
  if (!property) {
    notFound();
  }

  return (
    <ExploreDetailModal
      property={property}
      googleMapsEmbedApiKey={getGoogleMapsEmbedApiKey()}
      siteUrl={SITE_URL}
    />
  );
}
