import type { Metadata } from "next";
import Link from "next/link";

import CurrencyValue from "@/components/CurrencyValue";
import JsonLd from "@/components/seo/JsonLd";
import { formatCountryWithFlag } from "@/components/map/formatCountryWithFlag";
import { cityToSlug, countryToSlug } from "@/lib/citySlug";
import {
  PORTFOLIO_TOTAL_VALUE_NOK,
  getInvestmentCities,
  getInvestmentCountries,
  getPortfolioCounts,
} from "@/lib/portfolio";
import { DATASET_YEAR, SITE_NAME, SITE_URL } from "@/app/siteMetadata";

const numberFormatter = new Intl.NumberFormat("en-US");

// A lean, fully server-rendered index: every property as a plain link, grouped
// by country. Interactive browsing (search, filters, map) lives in the explore
// app at / — this page's job is to be fast, crawlable and readable anywhere,
// including phones (no table, no horizontal scroll).

type IndexEntry = {
  id: string;
  name: string;
  city: string;
  citySlug: string;
};

type CountryGroup = {
  country: string;
  slug: string;
  entries: IndexEntry[];
};

function buildIndex(): CountryGroup[] {
  const byCountry = new Map<string, CountryGroup>();
  for (const city of getInvestmentCities()) {
    const citySlug = cityToSlug(city.city, city.country);
    let group = byCountry.get(city.country);
    if (!group) {
      group = { country: city.country, slug: countryToSlug(city.country), entries: [] };
      byCountry.set(city.country, group);
    }
    for (const prop of city.properties) {
      group.entries.push({
        id: prop.id,
        name: prop.name?.trim() || prop.address?.trim() || "Property",
        city: city.city,
        citySlug,
      });
    }
  }
  const groups = Array.from(byCountry.values());
  for (const group of groups) {
    group.entries.sort(
      (a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name)
    );
  }
  groups.sort((a, b) => b.entries.length - a.entries.length || a.country.localeCompare(b.country));
  return groups;
}

const groups = buildIndex();
const propertyCount = groups.reduce((sum, g) => sum + g.entries.length, 0);
const { cityCount, countryCount } = getPortfolioCounts();

const countryChips = getInvestmentCountries()
  .map((group) => ({
    country: group.country,
    slug: group.slug,
    propertyCount: group.cities.reduce((sum, c) => sum + c.properties.length, 0),
  }))
  .sort((a, b) => b.propertyCount - a.propertyCount);

export const metadata: Metadata = {
  title: `All NBIM real estate properties (${numberFormatter.format(propertyCount)}) — full list ${DATASET_YEAR}`,
  description: `Complete list of all ${numberFormatter.format(propertyCount)} unlisted real estate properties owned by Norges Bank Investment Management (NBIM), Norway's sovereign wealth fund — grouped by country across ${cityCount} cities in ${countryCount} countries.`,
  alternates: { canonical: "/properties" },
  openGraph: {
    type: "website",
    url: "/properties",
    title: `All NBIM real estate properties — full list`,
    description: `Full index of all ${numberFormatter.format(propertyCount)} NBIM-owned properties across ${cityCount} cities in ${countryCount} countries.`,
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: `All NBIM real estate properties`,
    description: `Full index of ${numberFormatter.format(propertyCount)} NBIM-owned properties.`,
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
            description: `Full list of ${propertyCount} unlisted real estate properties owned by Norges Bank Investment Management (NBIM), with city, country, sector and ownership stake.`,
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
          <strong>{numberFormatter.format(propertyCount)}</strong>{" "}unlisted real
          estate properties, across{" "}
          <strong>{numberFormatter.format(cityCount)}</strong> cities in{" "}
          <strong>{countryCount}</strong>{" "}countries. NBIM&apos;s total unlisted
          real estate was valued at{" "}
          <strong>
            <CurrencyValue nok={PORTFOLIO_TOTAL_VALUE_NOK} />
          </strong>{" "}
          in the {DATASET_YEAR} disclosure. Per-property values are not reported by
          NBIM.
        </p>
        <p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700"
          >
            Search &amp; filter on the interactive map
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 17 17 7M9 7h8v8" />
            </svg>
          </Link>
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
                href={`#${c.slug}`}
                className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
              >
                {formatCountryWithFlag(c.country)}{" "}
                <span className="ml-1 text-slate-400">({c.propertyCount})</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-10">
        {groups.map((group) => (
          <section key={group.slug} id={group.slug} aria-labelledby={`${group.slug}-heading`} className="scroll-mt-20">
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-slate-200 pb-2">
              <h2 id={`${group.slug}-heading`} className="text-xl font-semibold text-slate-900">
                <Link href={`/country/${group.slug}`} className="hover:underline">
                  {formatCountryWithFlag(group.country)}
                </Link>
              </h2>
              <span className="text-sm text-slate-500">
                {numberFormatter.format(group.entries.length)}{" "}
                {group.entries.length === 1 ? "property" : "properties"}
              </span>
            </div>
            <ul className="sm:columns-2 lg:columns-3 [&>li]:break-inside-avoid">
              {group.entries.map((entry) => (
                <li key={entry.id} className="py-1 text-sm leading-snug">
                  <Link
                    href={`/property/${entry.id}`}
                    className="text-slate-800 hover:text-slate-950 hover:underline"
                  >
                    {entry.name}
                  </Link>{" "}
                  <span className="whitespace-nowrap text-slate-400">· {entry.city}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
