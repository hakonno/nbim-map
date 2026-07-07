"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import CurrencyToggle from "@/components/CurrencyToggle";
import MapSkeleton from "@/components/MapSkeleton";
import AboutPopover from "@/components/explore/AboutPopover";
import RateInfoModal from "@/components/map/RateInfoModal";
import { useCurrency } from "@/components/map/hooks/useCurrencyPreference";
import { useUsdToNokRate } from "@/components/map/hooks/useExchangeRate";
import { formatNokValue } from "@/utils/formatCurrency";
import { useIsDesktop, useWebglSupported } from "@/components/explore/useClientEnv";
import { onExploreViewRequest, setExploreView } from "@/components/explore/useExploreView";
import CompareTray, { MAX_COMPARE } from "@/components/explore/CompareTray";
import FilterBar from "@/components/explore/FilterBar";
import FilterSheet from "@/components/explore/FilterSheet";
import PropertyList from "@/components/explore/PropertyList";
import {
  DEFAULT_FILTERS,
  applyFilters,
  countActiveFilters,
  filtersFromSearchParams,
  filtersToSearchParams,
  summarize,
} from "@/components/explore/filtering";
import type { ExploreData, Filters } from "@/components/explore/types";

const ExploreMap = dynamic(() => import("@/components/explore/ExploreMap"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

type View = "split" | "map" | "list";

type ExploreAppProps = {
  data: ExploreData;
  maptilerApiKey: string;
  datasetYear: string;
};

// A crafted URL with malformed percent-encoding must not crash the app.
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default function ExploreApp({ data, maptilerApiKey, datasetYear }: ExploreAppProps) {
  const { properties, facets, totals } = data;

  const router = useRouter();
  const pathname = usePathname();
  // Selection is URL-driven: while the intercepted /property/[id] panel is
  // open the pathname carries the id; the explore page stays mounted beneath.
  const routeSelectedId = pathname?.startsWith("/property/")
    ? safeDecode(pathname.slice("/property/".length))
    : null;

  // "Soft" selection: the property stays highlighted (list ring, map marker,
  // camera) after the panel is dismissed via "Explore the map"/close — carried
  // through the ?sel= param so it also survives the remount that happens when
  // the panel was reached from a content page (children slot default → page).
  const [softSelectedId, setSoftSelectedId] = useState<string | null>(null);
  const selectedId = routeSelectedId ?? softSelectedId;

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [comparedIds, setComparedIds] = useState<string[]>([]);
  const [view, setView] = useState<View>("split");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);

  const isDesktop = useIsDesktop();
  const webglOk = useWebglSupported();

  // The dataset has no per-property values, so the fund's disclosed
  // real-estate total is the one headline number we can honestly show.
  const currency = useCurrency();
  const rate = useUsdToNokRate();
  const nokToUsd = rate.status === "success" ? rate.nokToUsd : null;
  const headlineValue = formatNokValue(totals.portfolioValueNok, currency, nokToUsd);

  const propertyMap = useMemo(
    () => new Map(properties.map((property) => [property.id, property])),
    [properties]
  );

  const filtered = useMemo(() => applyFilters(properties, filters), [properties, filters]);

  const selected = selectedId ? propertyMap.get(selectedId) ?? null : null;
  const compared = useMemo(
    () =>
      comparedIds
        .map((id) => propertyMap.get(id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p)),
    [comparedIds, propertyMap]
  );

  const mapEnabled = Boolean(maptilerApiKey) && webglOk && !mapFailed;
  // Without a usable map, the list is the only sensible surface.
  const effectiveView: View = mapEnabled ? view : "list";

  // Let the detail panel (a separate route-slot tree) adapt to the view.
  useEffect(() => {
    setExploreView(effectiveView);
  }, [effectiveView]);

  const handleChange = useCallback((patch: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleClear = useCallback(() => {
    setFilters((prev) => ({ ...DEFAULT_FILTERS, sort: prev.sort }));
  }, []);

  // Selecting a property (card, callout, compare chip) navigates to its real
  // URL; the intercepted route renders the panel while this page stays live.
  // While the panel is already open, selections REPLACE the history entry —
  // otherwise Back would walk through every previously viewed property.
  const handleSelect = useCallback(
    (id: string) => {
      const href = `/property/${encodeURIComponent(id)}`;
      if (routeSelectedId) {
        router.replace(href, { scroll: false });
      } else {
        router.push(href, { scroll: false });
      }
      // Keep the soft id in sync so the callout/highlight never flickers
      // during the route transition (and stays if the panel closes later).
      setSoftSelectedId(id);
    },
    [router, routeSelectedId]
  );

  // Airbnb-style two-step everywhere: a marker click/tap peeks (callout card
  // + highlight, no navigation); clicking the callout commits to the panel.
  // Tap IS mobile's hover, so peek-first matters even more there — a blind
  // tap shouldn't cover the whole map with the sheet. With a panel already
  // open, marker clicks switch it directly.
  const handlePeek = useCallback(
    (id: string) => {
      if (routeSelectedId) {
        handleSelect(id);
        return;
      }
      setSoftSelectedId(id);
    },
    [routeSelectedId, handleSelect]
  );

  const handleClearPeek = useCallback(() => {
    setSoftSelectedId(null);
  }, []);

  // Adopt ?sel= (set by the panel's close/"Explore the map" actions) whenever
  // we're back on the homepage — keyed on pathname so it works both without a
  // remount (in-app) and after one (content-page arrivals).
  useEffect(() => {
    if (pathname !== "/") return;
    const params = new URLSearchParams(window.location.search);
    const sel = params.get("sel");
    if (!sel) return;
    params.delete("sel");
    const rest = params.toString();
    window.history.replaceState(null, "", rest ? `/?${rest}` : "/");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot URL adoption, same as the filters init above
    setSoftSelectedId(sel);
  }, [pathname]);

  // --- URL state ------------------------------------------------------------
  // The server always renders the default view; shared filter links
  // (/?country=France) apply here after hydration.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const focus = params.get("focus");
    if (focus) {
      // ?focus=<id> deep link ("View on map" from a property page): strip the
      // param so Back never re-triggers it, then open the panel in-app.
      params.delete("focus");
      const rest = params.toString();
      window.history.replaceState(null, "", rest ? `/?${rest}` : "/");
    }
    if ([...params.keys()].length > 0) {
      // One-time adoption of URL params after hydration: the server always
      // renders the default view, so this is the earliest the shared-link
      // state can apply. A single, guarded setState — not a render loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFilters(filtersFromSearchParams(params, facets));
    }
    if (focus) {
      router.push(`/property/${encodeURIComponent(focus)}`, { scroll: false });
    }
    // Runs once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror filters to the URL (replace, not push — tweaking filters shouldn't
  // pollute history; this Next version integrates native replaceState with the
  // router). Written onto the current pathname so an open property panel keeps
  // its canonical /property/[id] URL. The reference check makes this a no-op
  // until filters actually change (setFilters always creates a new object), so
  // it can never strip URL params before the mount effect above adopts them —
  // even under Strict Mode double-invocation.
  useEffect(() => {
    if (filters === DEFAULT_FILTERS) return;
    const qs = filtersToSearchParams(filters).toString();
    const target = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== target) {
      window.history.replaceState(null, "", target);
    }
  }, [filters]);

  const handleToggleCompare = useCallback((id: string) => {
    setComparedIds((prev) =>
      prev.includes(id)
        ? prev.filter((existing) => existing !== id)
        : prev.length >= MAX_COMPARE
          ? prev
          : [...prev, id]
    );
  }, []);

  const handleUnavailable = useCallback((reason: string) => {
    console.warn(`[explore] map unavailable (${reason}); showing list only.`);
    setMapFailed(true);
  }, []);

  // View switches rearrange the surfaces around the current selection — they
  // never navigate, so the map instance, filters and open panel all survive.
  const handleViewChange = useCallback((next: View) => {
    setView(next);
  }, []);

  // The detail panel (a separate route-slot tree) can request view changes
  // ("Show on map").
  useEffect(() => onExploreViewRequest(handleViewChange), [handleViewChange]);

  const activeFilterCount = countActiveFilters(filters);
  const summary = useMemo(() => summarize(filtered), [filtered]);
  const compareFull = comparedIds.length >= MAX_COMPARE;

  // Camera padding only needs to clear chrome that overlays the map itself:
  // on desktop the list is a flex sibling (not an overlay), so padding is
  // uniform; on mobile the floating search pill (top) and Map/List pill
  // (bottom) float over the canvas.
  // In map view with the panel open, the panel overlays the map's left edge —
  // the camera must center in the remaining visible area and the controls
  // must slide out from under it (ExploreMap handles the latter).
  const mapPanelInset = isDesktop && effectiveView === "map" && Boolean(routeSelectedId);
  const mapPadding = useMemo(
    () =>
      isDesktop
        ? { top: 24, right: 24, bottom: 24, left: mapPanelInset ? 476 : 24 }
        : { top: 76, right: 24, bottom: 96, left: 24 },
    [isDesktop, mapPanelInset]
  );

  const listColumn = (layout: "column" | "grid") => (
    <PropertyList
      properties={filtered}
      selectedId={selectedId}
      comparedIds={comparedIds}
      compareFull={compareFull}
      layout={layout}
      replaceOnSelect={Boolean(routeSelectedId)}
      onToggleCompare={handleToggleCompare}
    />
  );

  return (
    <div className="flex h-[100svh] w-full min-w-0 flex-1 flex-col overflow-hidden bg-[var(--explore-canvas,#eef1f4)] text-slate-900">
      <RateInfoModal />

      {/* Top bar */}
      <header className="z-30 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 sm:px-4">
        <Link
          href="/"
          className="flex min-w-0 flex-col rounded-lg leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          aria-label="NBIM Real Estate Map — home"
        >
          <span className="truncate text-[12px] font-bold uppercase tracking-[0.14em] text-slate-900">
            NBIM Real Estate
          </span>
          {/* The one-liner that tells a first-time visitor what this is. */}
          <span
            className="truncate text-[11px] text-slate-400"
            title="NBIM's disclosed real-estate total — the fund does not publish per-property values."
          >
            <span className="font-medium tabular-nums text-slate-500">{headlineValue}</span>
            {" of Norway’s oil-fund property, mapped"}
          </span>
        </Link>

        <div className="mx-1 hidden h-7 w-px bg-slate-200 lg:block" />

        <p className="hidden text-sm text-slate-500 lg:block" aria-live="polite">
          <span className="font-semibold tabular-nums text-slate-800">
            {summary.count.toLocaleString("en-US")}
          </span>{" "}
          {summary.count === 1 ? "property" : "properties"}
          {summary.avgOwnership != null ? (
            <>
              {" · avg "}
              <span className="font-semibold tabular-nums text-slate-800">
                {Math.round(summary.avgOwnership)}%
              </span>{" "}
              NBIM stake
            </>
          ) : null}
          {summary.countryCount > 0 ? (
            <>
              {" · "}
              <span className="font-semibold tabular-nums text-slate-800">
                {summary.countryCount}
              </span>{" "}
              {summary.countryCount === 1 ? "country" : "countries"}
            </>
          ) : null}
        </p>

        <div className="ml-auto flex items-center gap-2">
          {/* Desktop view switch */}
          {mapEnabled ? (
            <div className="hidden items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 md:flex">
              {(["list", "split", "map"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleViewChange(option)}
                  aria-pressed={view === option}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                    view === option
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : null}

          <CurrencyToggle />
          {/* Last in the row so the popover's right edge anchors near the
              viewport edge on phones. The /properties index is a crawl/SEO
              surface, not primary nav — About links it for the curious. */}
          <AboutPopover datasetYear={datasetYear} />
        </div>
      </header>

      {/* Body */}
      <div className="relative flex min-h-0 flex-1">
        {/* List / split pane */}
        {effectiveView !== "map" ? (
          <section
            className={`relative z-10 min-h-0 flex-col bg-white ${
              effectiveView === "list"
                ? // With the panel open, the grid shifts right so panel + list
                  // sit side by side instead of the panel covering the grid.
                  `flex w-full ${routeSelectedId ? "md:pl-[408px] lg:pl-[452px]" : ""}`
                : "hidden md:flex md:w-[408px] md:border-r md:border-slate-200 lg:w-[452px]"
            }`}
          >
            <FilterBar
              filters={filters}
              facets={facets}
              resultCount={filtered.length}
              totalCount={totals.propertyCount}
              onChange={handleChange}
              onClear={handleClear}
            />
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {listColumn(effectiveView === "list" ? "grid" : "column")}
            </div>
          </section>
        ) : null}

        {/* Map pane */}
        {effectiveView !== "list" ? (
          <div className="relative min-h-0 min-w-0 flex-1">
            {mapEnabled ? (
              <ExploreMap
                properties={filtered}
                selected={selected}
                maptilerApiKey={maptilerApiKey}
                onSelect={handleSelect}
                onPeek={handlePeek}
                onClearPeek={handleClearPeek}
                onUnavailable={handleUnavailable}
                padding={mapPadding}
                panelInset={mapPanelInset}
              />
            ) : null}

            {/* Mobile floating filter bar over the map */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-2 p-3 md:hidden">
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="pointer-events-auto flex flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-4 py-2.5 text-sm text-slate-500 shadow-md backdrop-blur"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-4 w-4 text-slate-400">
                  <circle cx="11" cy="11" r="7" />
                  <path strokeLinecap="round" d="m20 20-3-3" />
                </svg>
                <span className="truncate">
                  {filters.query || "Search & filter properties"}
                </span>
                {activeFilterCount > 0 ? (
                  <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[11px] font-semibold text-white">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
            </div>
          </div>
        ) : null}

        {/* The detail panel renders via the intercepted /property/[id] route
            (the @modal slot in app/(explore)), not here. */}
      </div>

      {/* Mobile Map/List toggle */}
      {mapEnabled ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center md:hidden">
          <div className="pointer-events-auto flex items-center rounded-full border border-slate-200 bg-white/95 p-1 shadow-lg backdrop-blur">
            <button
              type="button"
              onClick={() => handleViewChange("map")}
              aria-pressed={effectiveView !== "list"}
              className={`flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-medium transition-colors active:scale-95 motion-reduce:active:scale-100 ${
                effectiveView !== "list" ? "bg-slate-900 text-white" : "text-slate-600"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 4 6 2 5-2v14l-5 2-6-2-5 2V6l5-2Zm0 0v14m6-12v14" />
              </svg>
              Map
            </button>
            <button
              type="button"
              onClick={() => handleViewChange("list")}
              aria-pressed={effectiveView === "list"}
              className={`flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-medium transition-colors active:scale-95 motion-reduce:active:scale-100 ${
                effectiveView === "list" ? "bg-slate-900 text-white" : "text-slate-600"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
              </svg>
              List
              <span className="tabular-nums text-xs opacity-70">{filtered.length}</span>
            </button>
          </div>
        </div>
      ) : null}

      <CompareTray
        properties={compared}
        onRemove={handleToggleCompare}
        onClear={() => setComparedIds([])}
        onSelect={handleSelect}
      />

      {filtersOpen ? (
        <FilterSheet
          filters={filters}
          facets={facets}
          resultCount={filtered.length}
          onChange={handleChange}
          onClear={handleClear}
          onClose={() => setFiltersOpen(false)}
        />
      ) : null}
    </div>
  );
}
