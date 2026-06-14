import Link from "next/link";

import { countryToSlug } from "@/lib/citySlug";
import { getInvestmentCountries } from "@/lib/portfolio";
import { SITE_NAME } from "@/app/siteMetadata";

function topCountries() {
  return getInvestmentCountries()
    .map((group) => ({
      country: group.country,
      slug: group.slug,
      propertyCount: group.cities.reduce(
        (sum, city) => sum + city.properties.length,
        0
      ),
    }))
    .sort((a, b) => b.propertyCount - a.propertyCount)
    .slice(0, 8);
}

export default function SiteFooter() {
  const countries = topCountries();

  return (
    <footer className="mt-auto border-t border-slate-200 bg-slate-50">
      <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-slate-900">{SITE_NAME}</p>
          <p className="text-sm text-slate-600">
            An independent visualisation of the unlisted real estate held by
            Norges Bank Investment Management (NBIM), Norway&apos;s sovereign
            wealth fund. Data reflects the 2025 disclosure.
          </p>
        </div>

        <nav aria-label="Site" className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-slate-900">Explore</p>
          <ul className="flex flex-col gap-1.5 text-sm">
            <li>
              <Link href="/" className="text-slate-600 hover:text-slate-900 hover:underline">
                Interactive map
              </Link>
            </li>
            <li>
              <Link href="/properties" className="text-slate-600 hover:text-slate-900 hover:underline">
                All properties
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Top countries" className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-slate-900">Top countries</p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {countries.map((country) => (
              <li key={country.slug}>
                <Link
                  href={`/country/${countryToSlug(country.country)}`}
                  className="text-slate-600 hover:text-slate-900 hover:underline"
                >
                  {country.country}{" "}
                  <span className="text-slate-400">({country.propertyCount})</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
