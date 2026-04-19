const COUNTRY_ISO_BY_NAME: Record<string, string> = {
  belgium: "BE",
  "czech republic": "CZ",
  france: "FR",
  germany: "DE",
  hungary: "HU",
  italy: "IT",
  japan: "JP",
  netherlands: "NL",
  poland: "PL",
  spain: "ES",
  sweden: "SE",
  switzerland: "CH",
  "united kingdom": "GB",
  "united states": "US",
};

function countryCodeToFlagEmoji(countryCode: string) {
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return "";
  }

  const flagOffset = 0x1f1e6;
  const asciiOffset = 65;

  return countryCode
    .split("")
    .map((char) => String.fromCodePoint(flagOffset + char.charCodeAt(0) - asciiOffset))
    .join("");
}

export function formatCountryWithFlag(country: string) {
  const trimmedCountry = country.trim();
  if (!trimmedCountry) {
    return "";
  }

  const normalizedCountry = trimmedCountry.toLowerCase();
  if (normalizedCountry === "international fund") {
    return `${String.fromCodePoint(0x1f310)} ${trimmedCountry}`;
  }

  const countryCode = COUNTRY_ISO_BY_NAME[normalizedCountry];
  if (!countryCode) {
    return trimmedCountry;
  }

  const flag = countryCodeToFlagEmoji(countryCode);
  return flag ? `${flag} ${trimmedCountry}` : trimmedCountry;
}
