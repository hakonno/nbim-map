import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import CountryCitiesSection from "@/components/CountryCitiesSection";
import CurrencyValue from "@/components/CurrencyValue";
import JsonLd from "@/components/seo/JsonLd";
import { cityToSlug } from "@/lib/citySlug";
import {
  findInvestmentCountryBySlug,
  getInvestmentCountrySlugs,
} from "@/lib/portfolio";
import { getCountryValueNok } from "@/lib/portfolioValue";
import { DATASET_YEAR, SITE_NAME, SITE_URL } from "@/app/siteMetadata";

export const dynamicParams = false;

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return getInvestmentCountrySlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const country = findInvestmentCountryBySlug(slug);
  if (!country) {
    return { title: "Country not found" };
  }

  const cityCount = country.cities.length;
  const propertyCount = country.cities.reduce(
    (sum, city) => sum + city.properties.length,
    0
  );

  const title = `${country.country} – NBIM-owned real estate`;
  const description = `${propertyCount} properties across ${cityCount} ${
    cityCount === 1 ? "city" : "cities"
  } in ${country.country} owned by Norway's sovereign wealth fund (NBIM), with sectors, partnerships and ownership stakes.`;

  return {
    title,
    description,
    alternates: { canonical: `/country/${slug}` },
    openGraph: {
      type: "website",
      url: `/country/${slug}`,
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

export default async function CountryPage({ params }: { params: Params }) {
  const { slug } = await params;
  const country = findInvestmentCountryBySlug(slug);
  if (!country) {
    notFound();
  }

  const sortedCities = [...country.cities].sort(
    (a, b) => b.properties.length - a.properties.length
  );
  const totalProperties = country.cities.reduce(
    (sum, city) => sum + city.properties.length,
    0
  );
  const countryValueNok = getCountryValueNok(country.cities);
  const cityCount = country.cities.length;

  // Alphabetical by city, then name — a readable, fully crawlable index of
  // every property in the country (the old table only server-rendered the
  // first page and scrolled horizontally on phones).
  const cityIndex = [...country.cities]
    .sort((a, b) => a.city.localeCompare(b.city, "en"))
    .map((city) => ({
      city: city.city,
      slug: cityToSlug(city.city, city.country),
      entries: [...city.properties]
        .map((prop) => ({
          id: prop.id,
          name: prop.name?.trim() || prop.address?.trim() || "Property",
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "en")),
    }));

  const mapHref = `/?country=${encodeURIComponent(country.country)}`;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
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
                name: country.country,
                item: `${SITE_URL}/country/${slug}`,
              },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `NBIM-owned cities in ${country.country}`,
            numberOfItems: cityCount,
            itemListElement: sortedCities.map((city, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url: `${SITE_URL}/city/${cityToSlug(city.city, city.country)}`,
              item: {
                "@type": "Place",
                name: city.city,
                ...(typeof city.lat === "number" && typeof city.lng === "number"
                  ? {
                      geo: {
                        "@type": "GeoCoordinates",
                        latitude: city.lat,
                        longitude: city.lng,
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
          <li className="font-medium text-slate-900">{country.country}</li>
        </ol>
      </nav>

      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
          NBIM real estate in {country.country}
        </h1>
        <p className="max-w-3xl text-base text-slate-700 sm:text-lg">
          Norway&apos;s sovereign wealth fund (NBIM) owns{" "}
          <strong>{totalProperties}</strong>{" "}
          {totalProperties === 1 ? "property" : "properties"} across{" "}
          <strong>{cityCount}</strong> {cityCount === 1 ? "city" : "cities"} in{" "}
          {country.country}
          {countryValueNok != null ? (
            <>
              . NBIM&apos;s reported real estate in {country.country} is{" "}
              <strong>
                <CurrencyValue nok={countryValueNok} />
              </strong>{" "}
              ({DATASET_YEAR} disclosure).
            </>
          ) : (
            "."
          )}
        </p>
        <p>
          <Link
            href={mapHref}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700"
          >
            View {country.country} on the interactive map
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 17 17 7M9 7h8v8" />
            </svg>
          </Link>
        </p>
      </header>

      <section aria-labelledby="cities-heading" className="flex flex-col gap-2">
        <CountryCitiesSection
          cities={sortedCities.map((city) => ({
            id: city.id,
            city: city.city,
            slug: cityToSlug(city.city, city.country),
            propertyCount: city.properties.length,
          }))}
        />
      </section>

      <section aria-labelledby="properties-heading" className="flex flex-col gap-6">
        <h2 id="properties-heading" className="text-xl font-semibold text-slate-900">
          Properties
        </h2>
        {cityIndex.map((city) => (
          <div key={city.slug}>
            <h3 className="mb-2 border-b border-slate-200 pb-1.5 text-base font-semibold text-slate-800">
              <Link href={`/city/${city.slug}`} className="hover:underline">
                {city.city}
              </Link>{" "}
              <span className="text-sm font-normal text-slate-400">
                ({city.entries.length})
              </span>
            </h3>
            <ul className="sm:columns-2 lg:columns-3 [&>li]:break-inside-avoid">
              {city.entries.map((entry) => (
                <li key={entry.id} className="py-1 text-sm leading-snug">
                  <Link
                    href={`/property/${entry.id}`}
                    className="text-slate-800 hover:text-slate-950 hover:underline"
                  >
                    {entry.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <p className="text-sm text-slate-600">
        <Link href="/properties" className="text-blue-700 hover:underline">
          View all NBIM properties across every country →
        </Link>
      </p>
    </main>
  );
}
