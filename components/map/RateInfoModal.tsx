"use client";

import { useEffect } from "react";

import {
  REPORTING_DATE,
  setRateInfoOpen,
  setRateMode,
  useRateInfoOpen,
  useRateMode,
} from "@/components/map/hooks/useExchangeRate";

export default function RateInfoModal() {
  const isOpen = useRateInfoOpen();
  const rateMode = useRateMode();

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setRateInfoOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 px-4"
      onClick={() => setRateInfoOpen(false)}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rate-info-title"
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="rate-info-title" className="text-base font-semibold text-slate-900">
            About the exchange rate
          </h2>
          <button
            type="button"
            onClick={() => setRateInfoOpen(false)}
            aria-label="Close"
            className="-m-1 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="h-4 w-4"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          USD values are converted from NOK using the USD/NOK rate from NBIM&apos;s reporting date
          ({REPORTING_DATE}), so totals match NBIM&apos;s published figures rather than today&apos;s
          fluctuating spot rate.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Rates sourced from{" "}
          <a
            href="https://www.frankfurter.dev/"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-slate-700"
          >
            Frankfurter
          </a>
          , a free European Central Bank exchange rate API.
        </p>

        <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <input
            type="checkbox"
            checked={rateMode === "live"}
            onChange={(e) => setRateMode(e.target.checked ? "live" : "reporting")}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-slate-700"
          />
          <span className="text-xs leading-snug text-slate-700">
            <span className="block font-medium text-slate-900">
              Use today&apos;s exchange rate instead
            </span>
            <span className="mt-0.5 block text-[11px] text-slate-500">
              Live USD/NOK from Frankfurter. Totals will drift from NBIM&apos;s figures.
            </span>
          </span>
        </label>

        <button
          type="button"
          onClick={() => setRateInfoOpen(false)}
          className="mt-4 w-full rounded-xl bg-slate-900 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
