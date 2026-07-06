import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import CurrencyValue from "@/components/CurrencyValue";
import JsonLd from "@/components/seo/JsonLd";
import { formatCountryWithFlag } from "@/components/map/formatCountryWithFlag";
import { countryToSlug } from "@/lib/citySlug";
import { getAttomMarketUsd } from "@/lib/attomValue";
import { getGoogleMapsEmbedApiKey } from "@/lib/googleMapsKey";
import { findPropertyById, getAllPropertyIds } from "@/lib/propertyLookup";
import { SITE_NAME, SITE_URL } from "@/app/siteMetadata";
import type { CityProperty } from "@/types/cities";

export const dynamicParams = false;

type Params = Promise<{ id: string }>;

const MARKET_DISCLAIMER =
  "ATTOM tax-assessor market estimate for the whole property — an approximate modelled figure, not NBIM's own valuation or its ownership share. US properties only, where available.";

export function generateStaticParams() {
  return getAllPropertyIds().map((id) => ({ id }));
}

function propertyDisplayName(property: CityProperty): string {
  return (
    property.office_name ??
    property.name ??
    property.address ??
    "NBIM property"
  );
}

// Stored addresses follow the shape "{name}, {street}, {postcode}, {city}".
// Strip the leading name and the trailing city so the page can show the street
// line on its own — the name is the heading and the city is linked separately.
function streetAddress(
  address: string | null,
  name: string,
  city: string
): string | null {
  if (!address) {
    return null;
  }
  let value = address.trim();
  const trimmedName = name.trim();
  if (trimmedName && value.toLowerCase().startsWith(trimmedName.toLowerCase())) {
    value = value.slice(trimmedName.length);
  }
  value = value.replace(/^[\s,–-]+/, "");
  const trimmedCity = city.trim();
  if (trimmedCity && value.toLowerCase().endsWith(trimmedCity.toLowerCase())) {
    value = value.slice(0, value.length - trimmedCity.length);
  }
  value = value.replace(/[\s,–-]+$/, "").trim();
  return value.length > 0 ? value : null;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const found = findPropertyById(id);
  if (!found) {
    return { title: "Property not found" };
  }

  const { property, city } = found;
  const name = propertyDisplayName(property);
  const where = `${city.city}, ${city.country}`;
  const title = `${name} — NBIM property in ${where}`;

  const hasAddress = Boolean(property.address && property.address !== name);
  const sectorPhrase = property.sector ? `${property.sector.toLowerCase()} property` : "property";
  const stakePhrase =
    property.ownership_percent != null
      ? `, with an NBIM ownership stake of ${property.ownership_percent}%`
      : "";
  const description = `${name}${
    hasAddress ? ` at ${property.address}` : ""
  } in ${where} — a ${sectorPhrase} owned by Norway's sovereign wealth fund, Norges Bank Investment Management (NBIM)${stakePhrase}.`;

  return {
    title,
    description,
    alternates: { canonical: `/property/${id}` },
    openGraph: {
      type: "website",
      url: `/property/${id}`,
      title,
      description,
      siteName: SITE_NAME,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function PropertyPage({ params }: { params: Params }) {
  const { id } = await params;
  const found = findPropertyById(id);
  if (!found) {
    notFound();
  }

  const { property, city, citySlug } = found;
  const countrySlug = countryToSlug(city.country);
  const name = propertyDisplayName(property);
  const partnership = property.partnership ?? null;
  const street = streetAddress(property.address, name, city.city);
  const attomMarketUsd = getAttomMarketUsd(property.id);

  const hasCoordinates =
    typeof property.lat === "number" &&
    typeof property.lng === "number" &&
    Number.isFinite(property.lat) &&
    Number.isFinite(property.lng);

  const embedKey = getGoogleMapsEmbedApiKey();
  const streetViewEmbedUrl =
    embedKey && hasCoordinates
      ? `https://www.google.com/maps/embed/v1/streetview?key=${encodeURIComponent(
          embedKey
        )}&location=${property.lat},${property.lng}&source=outdoor&radius=120`
      : null;

  const sectorPhrase = property.sector ? `${property.sector.toLowerCase()} property` : "property";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "All properties",
                item: `${SITE_URL}/properties`,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: city.country,
                item: `${SITE_URL}/country/${countrySlug}`,
              },
              {
                "@type": "ListItem",
                position: 3,
                name: city.city,
                item: `${SITE_URL}/city/${citySlug}`,
              },
              {
                "@type": "ListItem",
                position: 4,
                name,
                item: `${SITE_URL}/property/${id}`,
              },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "Place",
            name,
            url: `${SITE_URL}/property/${id}`,
            ...(property.address
              ? {
                  address: {
                    "@type": "PostalAddress",
                    streetAddress: property.address,
                    addressLocality: city.city,
                    addressCountry: city.country,
                  },
                }
              : {}),
            ...(hasCoordinates
              ? {
                  geo: {
                    "@type": "GeoCoordinates",
                    latitude: property.lat,
                    longitude: property.lng,
                  },
                }
              : {}),
          },
        ]}
      />

      <nav className="text-sm text-slate-600" aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/properties" className="hover:text-slate-900 hover:underline">
              All properties
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={`/country/${countrySlug}`}
              className="hover:text-slate-900 hover:underline"
            >
              {city.country}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`/city/${citySlug}`} className="hover:text-slate-900 hover:underline">
              {city.city}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="font-medium text-slate-900">{name}</li>
        </ol>
      </nav>

      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">{name}</h1>

        {/* Location reads as one address, not three disconnected fields. The
            city and country stay linked for navigation. */}
        <address className="flex flex-col gap-0.5 text-base not-italic text-slate-700">
          {street ? <span>{street}</span> : null}
          <span className="text-sm text-slate-600">
            <Link href={`/city/${citySlug}`} className="text-blue-700 hover:underline">
              {city.city}
            </Link>
            {", "}
            <Link
              href={`/country/${countrySlug}`}
              className="text-blue-700 hover:underline"
            >
              {formatCountryWithFlag(city.country)}
            </Link>
          </span>
        </address>

        <p className="text-base text-slate-700">
          A {sectorPhrase} in {city.city}, held within the unlisted real estate
          portfolio of Norway&apos;s sovereign wealth fund, Norges Bank Investment
          Management (NBIM)
          {property.ownership_percent != null ? (
            <>
              {", with an ownership stake of "}
              <strong>{property.ownership_percent}%</strong>
            </>
          ) : null}
          .
        </p>

        {hasCoordinates ? (
          <p>
            {/* ?focus= deep link: the explore app strips the param and opens
                this property's panel over the live map. */}
            <Link
              href={`/?focus=${encodeURIComponent(property.id)}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700"
            >
              View on the interactive map
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 17 17 7M9 7h8v8" />
              </svg>
            </Link>
          </p>
        ) : null}
      </header>

      <section aria-labelledby="facts-heading" className="flex flex-col gap-3">
        <h2 id="facts-heading" className="text-xl font-semibold text-slate-900">
          Key facts
        </h2>
        <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-2">
          <div className="bg-white px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Sector
            </dt>
            <dd className="mt-1 text-sm text-slate-900">{property.sector || "—"}</dd>
          </div>
          <div className="bg-white px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              NBIM ownership
            </dt>
            <dd className="mt-1 text-sm text-slate-900 tabular-nums">
              {property.ownership_percent != null ? `${property.ownership_percent}%` : "—"}
            </dd>
          </div>
          <div className="bg-white px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Partner
            </dt>
            <dd className="mt-1 text-sm text-slate-900">{partnership ?? "—"}</dd>
          </div>
          {/* Only when data exists — an empty "ATTOM ?" cell just raises questions. */}
          {attomMarketUsd != null ? (
            <div className="bg-white px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Market estimate{" "}
                <abbr title={MARKET_DISCLAIMER} className="cursor-help text-slate-400">
                  (ATTOM&nbsp;?)
                </abbr>
              </dt>
              <dd className="mt-1 text-sm text-slate-900 tabular-nums">
                <CurrencyValue usd={attomMarketUsd} />
              </dd>
            </div>
          ) : null}
        </dl>

        {attomMarketUsd != null ? (
          <p className="text-xs text-slate-500">{MARKET_DISCLAIMER}</p>
        ) : (
          <p className="text-xs text-slate-500">
            NBIM does not publish per-property values, and no independent
            estimate is available for this property.
          </p>
        )}
      </section>

      {streetViewEmbedUrl ? (
        <section aria-labelledby="streetview-heading" className="flex flex-col gap-2">
          <h2
            id="streetview-heading"
            className="text-xl font-semibold text-slate-900"
          >
            Street View
          </h2>
          <iframe
            allowFullScreen
            className="h-72 w-full rounded-xl border border-slate-200"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={streetViewEmbedUrl}
            title={`Street View for ${name}`}
          />
          <p className="text-xs text-slate-400">
            Street view is approximate and may not point exactly at the property.
          </p>
        </section>
      ) : null}

      <section aria-labelledby="more-heading" className="flex flex-col gap-2 text-sm">
        <h2 id="more-heading" className="sr-only">
          Related
        </h2>
        <Link href={`/city/${citySlug}`} className="text-blue-700 hover:underline">
          See all NBIM properties in {city.city} →
        </Link>
        <Link href={`/country/${countrySlug}`} className="text-blue-700 hover:underline">
          See all NBIM real estate in {city.country} →
        </Link>
        <Link href="/properties" className="text-blue-700 hover:underline">
          Browse the full list of NBIM properties →
        </Link>
        <Link href="/" className="text-blue-700 hover:underline">
          Open the interactive map →
        </Link>
      </section>
    </main>
  );
}
