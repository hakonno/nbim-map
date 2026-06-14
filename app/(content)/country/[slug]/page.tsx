import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import CityMap from "@/components/CityMap";
import CountryCitiesSection from "@/components/CountryCitiesSection";
import CurrencyValue from "@/components/CurrencyValue";
import PropertiesTable, { type PropertyRow } from "@/components/PropertiesTable";
import JsonLd from "@/components/seo/JsonLd";
import { cityToSlug } from "@/lib/citySlug";
import {
  findInvestmentCountryBySlug,
  getInvestmentCountrySlugs,
} from "@/lib/portfolio";
import { getAttomMarketUsd } from "@/lib/attomValue";
import { getCountryValueNok } from "@/lib/portfolioValue";
import { getGoogleMapsEmbedApiKey } from "@/lib/googleMapsKey";
import { DATASET_YEAR, SITE_NAME, SITE_URL } from "@/app/siteMetadata";
import type { CityNode } from "@/types/cities";

export const dynamicParams = false;

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return getInvestmentCountrySlugs().map((slug) => ({ slug }));
}

function buildRows(cities: CityNode[]): PropertyRow[] {
  const rows: PropertyRow[] = [];
  for (const city of cities) {
    const citySlug = cityToSlug(city.city, city.country);
    for (const prop of city.properties) {
      rows.push({
        propId: prop.id,
        name: prop.name ?? "",
        address: prop.address ?? "",
        sector: prop.sector ?? "",
        partnership: prop.partnership ?? "",
        ownershipPercent: prop.ownership_percent,
        attomMarketUsd: getAttomMarketUsd(prop.id),
        city: city.city,
        country: city.country,
        citySlug,
      });
    }
  }
  return rows;
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
  } in ${country.country} owned by Norway's sovereign wealth fund (NBIM). Searchable list with sectors, partnerships and ownership stakes.`;

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
  const rows = buildRows(country.cities);
  const totalProperties = rows.length;
  const countryValueNok = getCountryValueNok(country.cities);
  const cityCount = country.cities.length;

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

      <section aria-labelledby="properties-heading" className="flex flex-col gap-4">
        <h2 id="properties-heading" className="text-xl font-semibold text-slate-900">
          Properties
        </h2>
        <PropertiesTable
          rows={rows}
          siteUrl={SITE_URL}
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
            initialFocus={{ kind: "country", country: country.country }}
          />
        </div>
      </section>

      <p className="text-sm text-slate-600">
        <Link href="/properties" className="text-blue-700 hover:underline">
          View all NBIM properties across every country →
        </Link>
      </p>
    </main>
  );
}
