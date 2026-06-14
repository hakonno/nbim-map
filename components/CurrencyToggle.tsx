"use client";

import { setRateInfoOpen } from "@/components/map/hooks/useExchangeRate";
import {
  setCurrency,
  useCurrency,
} from "@/components/map/hooks/useCurrencyPreference";

// Reusable USD/NOK switch + exchange-rate info button. Shared by the map and
// the list pages; requires <RateInfoModal /> to be mounted somewhere for the
// info button to render its dialog.
export default function CurrencyToggle({ className = "" }: { className?: string }) {
  const currency = useCurrency();
  const next = currency === "USD" ? "NOK" : "USD";

  return (
    <div
      className={`inline-flex items-stretch overflow-hidden rounded-lg border border-slate-300 bg-white ${className}`}
    >
      <button
        type="button"
        onClick={() => setCurrency(next)}
        className="px-2.5 py-1.5 text-xs font-semibold tabular-nums text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        aria-label={`Switch to ${next}`}
        title={`Switch to ${next}`}
      >
        {currency}
      </button>
      <button
        type="button"
        onClick={() => setRateInfoOpen(true)}
        aria-label="Exchange rate info"
        aria-haspopup="dialog"
        className="flex items-center border-l border-slate-200 px-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-3.5 w-3.5"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="11" x2="12" y2="16" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </button>
    </div>
  );
}
