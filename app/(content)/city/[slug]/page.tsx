import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import CityMap from "@/components/CityMap";
import PropertiesTable, { type PropertyRow } from "@/components/PropertiesTable";
import JsonLd from "@/components/seo/JsonLd";
import { cityToSlug, countryToSlug } from "@/lib/citySlug";
import {
  findInvestmentCityBySlug,
  findInvestmentCountryBySlug,
  getInvestmentCitySlugs,
} from "@/lib/portfolio";
import { getAttomMarketUsd } from "@/lib/attomValue";
import { getGoogleMapsEmbedApiKey } from "@/lib/googleMapsKey";
import { SITE_NAME, SITE_URL } from "@/app/siteMetadata";

export const dynamicParams = false;

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return getInvestmentCitySlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const city = findInvestmentCityBySlug(slug);
  if (!city) {
    return { title: "City not found" };
  }

  const propertyCount = city.properties.length;
  const title = `${city.city}, ${city.country} – NBIM-owned properties`;
  const description = `${propertyCount} ${
    propertyCount === 1 ? "property" : "properties"
  } in ${city.city}, ${city.country} owned by Norway's sovereign wealth fund (NBIM). Addresses, sectors, partnerships and ownership stakes.`;

  return {
    title,
    description,
    alternates: { canonical: `/city/${slug}` },
    openGraph: {
      type: "website",
      url: `/city/${slug}`,
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

export default async function CityPage({ params }: { params: Params }) {
  const { slug } = await params;
  const city = findInvestmentCityBySlug(slug);
  if (!city) {
    notFound();
  }

  const country = findInvestmentCountryBySlug(countryToSlug(city.country));
  const sectors = Array.from(
    new Set(city.properties.map((p) => p.sector).filter((s): s is string => Boolean(s)))
  );
  const propertyCount = city.properties.length;
  const otherCitiesInCountry = (country?.cities ?? []).filter(
    (other) => other.id !== city.id
  );

  const rows: PropertyRow[] = city.properties.map((prop) => ({
    propId: prop.id,
    name: prop.name ?? "",
    address: prop.address ?? "",
    sector: prop.sector ?? "",
    partnership: prop.partnership ?? "",
    ownershipPercent: prop.ownership_percent,
    attomMarketUsd: getAttomMarketUsd(prop.id),
    city: city.city,
    country: city.country,
    citySlug: slug,
  }));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
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
                item: `${SITE_URL}/country/${countryToSlug(city.country)}`,
              },
              {
                "@type": "ListItem",
                position: 3,
                name: city.city,
                item: `${SITE_URL}/city/${slug}`,
              },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `NBIM-owned properties in ${city.city}, ${city.country}`,
            numberOfItems: propertyCount,
            itemListElement: city.properties.map((prop, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url: `${SITE_URL}/property/${prop.id}`,
              item: {
                "@type": "Place",
                name: prop.name ?? prop.address ?? `Property ${index + 1}`,
                ...(prop.address ? { address: prop.address } : {}),
                ...(typeof prop.lat === "number" && typeof prop.lng === "number"
                  ? {
                      geo: {
                        "@type": "GeoCoordinates",
                        latitude: prop.lat,
                        longitude: prop.lng,
                      },
                    }
                  : {}),
              },
            })),
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
              href={`/country/${countryToSlug(city.country)}`}
              className="hover:text-slate-900 hover:underline"
            >
              {city.country}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="font-medium text-slate-900">{city.city}</li>
        </ol>
      </nav>

      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
          {city.city}, {city.country}
        </h1>
        <p className="text-base text-slate-700 sm:text-lg">
          Norway&apos;s sovereign wealth fund (NBIM) owns{" "}
          <strong>{propertyCount}</strong>{" "}
          {propertyCount === 1 ? "property" : "properties"} in {city.city}
          {sectors.length > 0 ? (
            <>. Sectors include {sectors.join(", ").toLowerCase()}.</>
          ) : (
            "."
          )}{" "}
          See{" "}
          <Link
            href={`/country/${countryToSlug(city.country)}`}
            className="text-blue-700 hover:underline"
          >
            all NBIM real estate in {city.country}
          </Link>
          .
        </p>
      </header>

      <section aria-labelledby="properties-heading" className="flex flex-col gap-4">
        <h2 id="properties-heading" className="text-xl font-semibold text-slate-900">
          Properties
        </h2>
        <PropertiesTable
          rows={rows}
          siteUrl={SITE_URL}
          showCityColumn={false}
          showCountryColumn={false}
          showCountryFilter={false}
        />
      </section>

      <section aria-labelledby="map-heading" className="flex flex-col gap-3">
        <h2 id="map-heading" className="text-xl font-semibold text-slate-900">
          On the map
        </h2>
        <div className="relative h-[65svh] w-full overflow-hidden rounded-xl border border-slate-200">
          <CityMap
            googleMapsEmbedApiKey={getGoogleMapsEmbedApiKey()}
            initialFocus={{ kind: "city", cityId: city.id }}
          />
        </div>
      </section>

      {otherCitiesInCountry.length > 0 ? (
        <section aria-labelledby="other-cities" className="flex flex-col gap-3">
          <h2 id="other-cities" className="text-xl font-semibold text-slate-900">
            Other NBIM cities in {city.country}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {otherCitiesInCountry.map((other) => (
              <li key={other.id}>
                <Link
                  href={`/city/${cityToSlug(other.city, other.country)}`}
                  className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
                >
                  {other.city} ({other.properties.length})
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
