const COUNTRY_FLAG_BY_NAME: Record<string, string> = {
  belgium: "🇧🇪",
  "czech republic": "🇨🇿",
  france: "🇫🇷",
  germany: "🇩🇪",
  hungary: "🇭🇺",
  "international fund": "🌐",
  italy: "🇮🇹",
  japan: "🇯🇵",
  netherlands: "🇳🇱",
  poland: "🇵🇱",
  spain: "🇪🇸",
  sweden: "🇸🇪",
  switzerland: "🇨🇭",
  "united kingdom": "🇬🇧",
  "united states": "🇺🇸",
};

export function formatCountryWithFlag(country: string) {
  const trimmedCountry = country.trim();
  if (!trimmedCountry) {
    return "";
  }

  const flag = COUNTRY_FLAG_BY_NAME[trimmedCountry.toLowerCase()];
  if (!flag) {
    return trimmedCountry;
  }

  return `${flag} ${trimmedCountry}`;
}
