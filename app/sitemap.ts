import type { MetadataRoute } from "next";

import { getInvestmentCitySlugs, getInvestmentCountrySlugs } from "@/lib/portfolio";
import { getAllPropertyIds } from "@/lib/propertyLookup";
import { SITE_URL } from "./siteMetadata";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/properties`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];

  const countryRoutes: MetadataRoute.Sitemap = getInvestmentCountrySlugs().map(
    (slug) => ({
      url: `${SITE_URL}/country/${slug}`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.7,
    })
  );

  const cityRoutes: MetadataRoute.Sitemap = getInvestmentCitySlugs().map((slug) => ({
    url: `${SITE_URL}/city/${slug}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const propertyRoutes: MetadataRoute.Sitemap = getAllPropertyIds().map((id) => ({
    url: `${SITE_URL}/property/${id}`,
    lastModified,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...staticRoutes, ...countryRoutes, ...cityRoutes, ...propertyRoutes];
}
