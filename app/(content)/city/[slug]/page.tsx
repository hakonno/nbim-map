import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import JsonLd from "@/components/seo/JsonLd";
import { cityToSlug, countryToSlug } from "@/lib/citySlug";
import {
  findInvestmentCityBySlug,
  findInvestmentCountryBySlug,
  getInvestmentCitySlugs,
} from "@/lib/portfolio";
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

function ownershipText(value: number | null | undefined): string | null {
  if (value == null) return null;
  const pct = Number.isInteger(value) ? `${value}` : value.toFixed(1);
  return `${pct}% stake`;
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

  const entries = [...city.properties]
    .map((prop) => ({
      id: prop.id,
      name: prop.name?.trim() || prop.address?.trim() || "Property",
      address: prop.address?.trim() || null,
      sector: prop.sector ?? null,
      stake: ownershipText(prop.ownership_percent),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Deep link into the explore app pre-filtered to this city's country and
  // searched for the city name (the search haystack includes the city).
  const mapHref = `/?country=${encodeURIComponent(city.country)}&q=${encodeURIComponent(
    city.city
  )}`;

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
        <p>
          <Link
            href={mapHref}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700"
          >
            View {city.city} on the interactive map
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 17 17 7M9 7h8v8" />
            </svg>
          </Link>
        </p>
      </header>

      <section aria-labelledby="properties-heading" className="flex flex-col gap-4">
        <h2 id="properties-heading" className="text-xl font-semibold text-slate-900">
          Properties
        </h2>
        <ul className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {entries.map((entry) => (
            <li key={entry.id} className="text-sm leading-snug">
              <Link
                href={`/property/${entry.id}`}
                className="font-medium text-slate-900 hover:underline"
              >
                {entry.name}
              </Link>
              {entry.address && entry.address !== entry.name ? (
                <p className="mt-0.5 text-slate-500">{entry.address}</p>
              ) : null}
              {entry.sector || entry.stake ? (
                <p className="mt-0.5 text-xs text-slate-400">
                  {[entry.sector, entry.stake].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
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
