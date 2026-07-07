"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import CurrencyToggle from "@/components/CurrencyToggle";
import PropertyShareButton from "@/components/PropertyShareButton";
import { formatCountryWithFlag } from "@/components/map/formatCountryWithFlag";
import { useCurrency } from "@/components/map/hooks/useCurrencyPreference";
import { useUsdToNokRate } from "@/components/map/hooks/useExchangeRate";
import AttomDataSection from "@/components/map/selection/AttomDataSection";
import {
  ownershipDotColor,
  ownershipLabel,
  sectorStyle,
} from "@/components/explore/sectorStyles";
import { useIsDesktop } from "@/components/explore/useClientEnv";
import { requestExploreView, useExploreView } from "@/components/explore/useExploreView";
import { useSheetDrag } from "@/components/explore/useSheetDrag";
import type { ExploreProperty } from "@/components/explore/types";
import { formatUsdValue } from "@/utils/formatCurrency";

type PropertyDetailProps = {
  property: ExploreProperty;
  googleMapsEmbedApiKey: string;
  siteUrl: string;
  onClose: () => void;
  /** Close the panel but stay in the app with the property still highlighted
   * (vs. onClose = history back, which may leave the app entirely). */
  onDismissInApp?: () => void;
};

function Stat({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 ${className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <div className="mt-1 text-sm font-medium text-slate-900">{children}</div>
    </div>
  );
}

export default function PropertyDetail({
  property,
  googleMapsEmbedApiKey,
  siteUrl,
  onClose,
  onDismissInApp,
}: PropertyDetailProps) {
  const currency = useCurrency();
  const rate = useUsdToNokRate();
  const usdToNok = rate.status === "success" ? rate.usdToNok : null;
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const sector = sectorStyle(property.sector);
  const isUs = property.country === "United States";
  const { sheetStyle, handleProps } = useSheetDrag(onClose);

  // On desktop the results always stay visible around the panel (list beside
  // it, map behind it, split's map next to it), so the one dismiss action is
  // "Close" — which keeps the property highlighted and never leaves the app.
  // On mobile the sheet covers everything, so "Back to results" (history) fits.
  const view = useExploreView();
  const isDesktop = useIsDesktop();
  const desktopClose = isDesktop && Boolean(onDismissInApp);
  const dismiss = desktopClose && onDismissInApp ? onDismissInApp : onClose;

  // "Show on map": desktop list switches to split (panel + map, selection
  // kept); mobile closes the sheet into map view with the marker highlighted.
  // Hidden on desktop split/map where the map is already visible.
  const showOnMapVisible = Boolean(onDismissInApp) && (!isDesktop || view === "list");
  const handleShowOnMap = () => {
    if (isDesktop) {
      requestExploreView("split");
    } else {
      requestExploreView("map");
      onDismissInApp?.();
    }
  };

  const streetViewUrl = googleMapsEmbedApiKey
    ? `https://www.google.com/maps/embed/v1/streetview?key=${encodeURIComponent(
        googleMapsEmbedApiKey
      )}&location=${property.lat},${property.lng}&source=outdoor&radius=120`
    : null;

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dismiss, property.id]);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-30 bg-slate-900/50 md:hidden"
      />
      <aside
        role="dialog"
        aria-label={`${property.name} details`}
        style={sheetStyle}
        className="fixed inset-x-0 bottom-0 top-[10vh] z-40 flex flex-col rounded-t-2xl border border-slate-200 bg-white shadow-2xl md:inset-x-auto md:left-0 md:top-14 md:bottom-0 md:w-[408px] md:translate-y-0 md:rounded-none md:border-y-0 md:border-l-0 md:border-r md:shadow-xl lg:w-[452px]"
      >
        {/* Mobile grab handle — drag down to dismiss */}
        <div
          {...handleProps}
          className="flex touch-none cursor-grab justify-center py-3 active:cursor-grabbing md:hidden"
          aria-hidden="true"
        >
          <span className="h-1.5 w-10 rounded-full bg-slate-300" />
        </div>

        <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          {desktopClose ? (
            <button
              ref={closeRef}
              type="button"
              onClick={onDismissInApp}
              aria-label="Close details"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-4 w-4">
                <path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" />
              </svg>
              Close
            </button>
          ) : (
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
              </svg>
              Back to results
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <CurrencyToggle />
            <PropertyShareButton
              url={`${siteUrl}/property/${property.id}`}
              title={`${property.name} — ${property.city}, ${property.country}`}
            />
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${sector.chip}`}>
              <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: sector.dot }} />
              {sector.label}
            </span>
          </div>

          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 text-balance">
            {property.name}
          </h2>
          {property.address ? (
            <p className="mt-1 text-sm text-slate-600">{property.address}</p>
          ) : null}
          <p className="mt-0.5 text-sm text-slate-500">
            {property.city}, {formatCountryWithFlag(property.country)}
          </p>

          {/* Above the fold on purpose — the obvious path from a card to the
              map for people who never discover the view toggle. */}
          {showOnMapVisible ? (
            <button
              type="button"
              onClick={handleShowOnMap}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 4 6 2 5-2v14l-5 2-6-2-5 2V6l5-2Zm0 0v14m6-12v14" />
              </svg>
              Show on map
            </button>
          ) : null}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Stat label="Ownership">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full ring-1 ring-black/5" style={{ backgroundColor: ownershipDotColor(property.ownership) }} />
                <span className="tabular-nums">{ownershipLabel(property.ownership)}</span>
              </span>
            </Stat>
            <Stat label="Partner / operator">
              {property.partner ??
                (property.ownership != null && property.ownership >= 100 ? (
                  <span className="text-slate-500">Wholly owned</span>
                ) : (
                  "—"
                ))}
            </Stat>
            {/* Only when data exists — an empty "Not available" tile (and the
                ATTOM explainer below) is noise for the non-US majority. */}
            {property.marketUsd != null ? (
              <Stat label="Market estimate">
                <span className="tabular-nums">
                  {formatUsdValue(property.marketUsd, currency, usdToNok)}
                  <span className="ml-1 text-[11px] font-normal text-slate-400">whole property</span>
                </span>
              </Stat>
            ) : null}
            <Stat
              label={`NBIM in ${property.country}`}
              className={property.marketUsd == null ? "col-span-2" : ""}
            >
              {property.countryValueUsd != null ? (
                <span className="tabular-nums">
                  {formatUsdValue(property.countryValueUsd, currency, usdToNok)}
                </span>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </Stat>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            NBIM does not disclose per-property values.{" "}
            {property.marketUsd != null ? (
              <>
                &ldquo;Market estimate&rdquo; is an ATTOM tax-assessor figure for the whole
                property (US only).{" "}
              </>
            ) : null}
            &ldquo;NBIM in {property.country}&rdquo; is the fund&apos;s disclosed country-level
            real-estate total.
          </p>

          {streetViewUrl ? (
            <div className="mt-4">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Street View
              </p>
              <iframe
                allowFullScreen
                className="h-52 w-full rounded-xl border border-slate-200"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={streetViewUrl}
                title={`Street View for ${property.name}`}
              />
              <p className="mt-1.5 text-[11px] text-slate-400">
                Approximate — may not point exactly at the property.
              </p>
            </div>
          ) : null}

          {isUs ? (
            <div className="mt-4">
              <AttomDataSection
                propertyId={property.id}
                mode="full"
                currency={currency}
                ownershipPercent={property.ownership}
              />
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
            {/* Plain <a>, not <Link>: when this panel is the intercepted route
                the URL already is /property/[id], so only a hard navigation
                reaches the full standalone page. */}
            <a
              href={`/property/${property.id}`}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              Full property page
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 17 17 7M9 7h8v8" />
              </svg>
            </a>
            <Link
              href={`/city/${property.citySlug}`}
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {property.city}
            </Link>
            <Link
              href={`/country/${property.countrySlug}`}
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {property.country}
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
