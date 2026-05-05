export type Currency = "USD" | "NOK";

const nbNo1 = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 1 });
const nbNo0 = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });
const enUs1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const enUsCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** NOK value → Norwegian compact: "3,6 mrd. kr", "381 mill. kr", "5 000 kr" */
export function formatCompactNok(nok: number): string {
  if (nok >= 1e9) return `${nbNo1.format(nok / 1e9)} mrd. kr`;
  if (nok >= 1e6) return `${nbNo1.format(nok / 1e6)} mill. kr`;
  return `${nbNo0.format(nok)} kr`;
}

/** USD value → US compact: "$3.6B", "$381M", "$5K" */
export function formatCompactUsd(usd: number): string {
  if (usd >= 1e12) return `$${enUs1.format(usd / 1e12)}T`;
  if (usd >= 1e9) return `$${enUs1.format(usd / 1e9)}B`;
  if (usd >= 1e6) return `$${enUs1.format(usd / 1e6)}M`;
  if (usd >= 1e3) return `$${enUs1.format(usd / 1e3)}K`;
  return enUsCurrency.format(usd);
}

/** Value stored in NOK → format in the user's chosen currency. */
export function formatNokValue(nok: number, currency: Currency, nokToUsd: number | null): string {
  if (currency === "USD" && nokToUsd != null) {
    return formatCompactUsd(nok * nokToUsd);
  }
  return formatCompactNok(nok);
}

/** Value stored in USD → format in the user's chosen currency. */
export function formatUsdValue(usd: number, currency: Currency, usdToNok: number | null): string {
  if (currency === "NOK" && usdToNok != null) {
    return formatCompactNok(usd * usdToNok);
  }
  return formatCompactUsd(usd);
}
