import type { Metadata } from "next";
import Link from "next/link";

import CurrencyValue from "@/components/CurrencyValue";
import PropertiesTable, { type PropertyRow } from "@/components/PropertiesTable";
import JsonLd from "@/components/seo/JsonLd";
import { formatCountryWithFlag } from "@/components/map/formatCountryWithFlag";
import { cityToSlug } from "@/lib/citySlug";
import { getAttomMarketUsd } from "@/lib/attomValue";
import {
  PORTFOLIO_TOTAL_VALUE_NOK,
  getInvestmentCities,
  getInvestmentCountries,
  getPortfolioCounts,
} from "@/lib/portfolio";
import { DATASET_YEAR, SITE_NAME, SITE_URL } from "@/app/siteMetadata";

const numberFormatter = new Intl.NumberFormat("en-US");

function buildRows(): PropertyRow[] {
  const rows: PropertyRow[] = [];
  for (const city of getInvestmentCities()) {
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

const rows = buildRows();
const { cityCount, countryCount } = getPortfolioCounts();

const countryChips = getInvestmentCountries()
  .map((group) => ({
    country: group.country,
    slug: group.slug,
    propertyCount: group.cities.reduce((sum, c) => sum + c.properties.length, 0),
  }))
  .sort((a, b) => b.propertyCount - a.propertyCount);

export const metadata: Metadata = {
  title: `All NBIM real estate properties (${numberFormatter.format(rows.length)}) — full list ${DATASET_YEAR}`,
  description: `Complete, searchable list of all ${numberFormatter.format(rows.length)} unlisted real estate properties owned by Norges Bank Investment Management (NBIM), Norway's sovereign wealth fund — filter by country and sector (office, retail, logistics) across ${cityCount} cities in ${countryCount} countries.`,
  alternates: { canonical: "/properties" },
  openGraph: {
    type: "website",
    url: "/properties",
    title: `All NBIM real estate properties — full list`,
    description: `Searchable list of all ${numberFormatter.format(rows.length)} NBIM-owned properties across ${cityCount} cities in ${countryCount} countries.`,
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: `All NBIM real estate properties`,
    description: `Searchable list of ${numberFormatter.format(rows.length)} NBIM-owned properties.`,
  },
};

export default function PropertiesPage() {
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
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "Dataset",
            name: "NBIM unlisted real estate properties",
            description: `Full list of ${rows.length} unlisted real estate properties owned by Norges Bank Investment Management (NBIM), with city, country, sector and ownership stake.`,
            creator: {
              "@type": "Organization",
              name: "Norges Bank Investment Management",
              alternateName: "NBIM",
            },
            url: `${SITE_URL}/properties`,
            keywords: [
              "NBIM",
              "Norges Bank Investment Management",
              "real estate",
              "sovereign wealth fund",
              "Government Pension Fund Global",
            ],
          },
        ]}
      />

      <nav className="text-sm text-slate-600" aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-2">
          <li className="font-medium text-slate-900">All properties</li>
        </ol>
      </nav>

      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
          All NBIM real estate properties ({DATASET_YEAR} disclosure)
        </h1>
        <p className="max-w-3xl text-base text-slate-700 sm:text-lg">
          <strong>{numberFormatter.format(rows.length)}</strong>{" "}unlisted real
          estate properties, across{" "}
          <strong>{numberFormatter.format(cityCount)}</strong> cities in{" "}
          <strong>{countryCount}</strong>{" "}countries. NBIM&apos;s total unlisted
          real estate was valued at{" "}
          <strong>
            <CurrencyValue nok={PORTFOLIO_TOTAL_VALUE_NOK} />
          </strong>{" "}
          in the {DATASET_YEAR} disclosure. Per-property values are not reported by
          NBIM; where available, US properties show an ATTOM tax-assessor market
          estimate.
        </p>
      </header>

      <section aria-labelledby="by-country" className="flex flex-col gap-2">
        <h2 id="by-country" className="text-sm font-semibold text-slate-700">
          Jump to a country
        </h2>
        <ul className="flex flex-wrap gap-2">
          {countryChips.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/country/${c.slug}`}
                className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
              >
                {formatCountryWithFlag(c.country)}{" "}
                <span className="ml-1 text-slate-400">({c.propertyCount})</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <PropertiesTable rows={rows} siteUrl={SITE_URL} />
    </main>
  );
}
