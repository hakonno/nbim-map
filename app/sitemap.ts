import type { MetadataRoute } from "next";

import { SITE_URL } from "./siteMetadata";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
