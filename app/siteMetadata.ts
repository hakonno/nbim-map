const DEFAULT_SITE_URL = "http://localhost:3000";

function normalizeSiteUrl(rawValue: string): string {
  const withProtocol =
    rawValue.startsWith("http://") || rawValue.startsWith("https://")
      ? rawValue
      : `https://${rawValue}`;

  return withProtocol.endsWith("/") ? withProtocol.slice(0, -1) : withProtocol;
}

function resolveSiteUrl(): string {
  const candidate =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    DEFAULT_SITE_URL;

  return normalizeSiteUrl(candidate);
}

export const SITE_URL = resolveSiteUrl();

export const SITE_NAME = "NBIM Real Estate Map";

export const SITE_DESCRIPTION =
  "Explore where Norway's sovereign wealth fund (NBIM) invests in real estate, with a simple world map of cities, countries, and properties.";
