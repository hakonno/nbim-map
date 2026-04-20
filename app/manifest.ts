import type { MetadataRoute } from "next";

import { SITE_DESCRIPTION, SITE_NAME } from "./siteMetadata";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "NBIM Map",
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "minimal-ui",
    background_color: "#e7edf3",
    theme_color: "#e7edf3",
    lang: "en",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
