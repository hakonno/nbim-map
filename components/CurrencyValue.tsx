"use client";

import { useUsdToNokRate } from "@/components/map/hooks/useExchangeRate";
import { useCurrency } from "@/components/map/hooks/useCurrencyPreference";
import { formatNokValue, formatUsdValue } from "@/utils/formatCurrency";

// Renders a monetary value in the user's chosen currency, reacting to the shared
// currency toggle and live exchange rate. Pass the value in whichever currency
// it is natively stored (`nok` for NBIM figures, `usd` for ATTOM figures).
export default function CurrencyValue({
  nok,
  usd,
  fallback = "—",
  className,
}: {
  nok?: number | null;
  usd?: number | null;
  fallback?: string;
  className?: string;
}) {
  const currency = useCurrency();
  const rate = useUsdToNokRate();
  const usdToNok = rate.status === "success" ? rate.usdToNok : null;
  const nokToUsd = rate.status === "success" ? rate.nokToUsd : null;

  let text = fallback;
  if (typeof nok === "number" && nok > 0) {
    text = formatNokValue(nok, currency, nokToUsd);
  } else if (typeof usd === "number" && usd > 0) {
    text = formatUsdValue(usd, currency, usdToNok);
  }

  return <span className={className}>{text}</span>;
}
