import type { SearchResult } from "@/components/map/mapTypes";

type GlobalSearchSectionProps = {
  searchQuery: string;
  searchResults: SearchResult[];
  onSelectSearchResult: (result: SearchResult) => void;
};

export default function GlobalSearchSection({
  searchQuery,
  searchResults,
  onSelectSearchResult,
}: GlobalSearchSectionProps) {
  if (searchQuery.trim().length < 2) {
    return <p className="mt-2 text-xs text-slate-600">Search in NBIM dataset. Select a result to zoom and open details.</p>;
  }

  return (
    <>
      <p className="mt-2 text-xs text-slate-600">Search in NBIM dataset. Select a result to zoom and open details.</p>
      <div className="mt-2 max-h-[32svh] space-y-2 overflow-y-auto overscroll-contain pr-1 md:max-h-[calc(100svh-15rem)]">
        {searchResults.length === 0 && (
          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            No local matches. Try another city, property name, or address.
          </p>
        )}

        {searchResults.map((result) => (
          <button
            key={result.id}
            type="button"
            className="pointer-events-auto w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            onClick={() => onSelectSearchResult(result)}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {result.type === "city" ? "City" : "Property"}
            </p>
            <h3 className="text-sm font-semibold text-slate-900 text-balance">{result.name}</h3>
            {result.subtitle && <p className="mt-1 text-xs text-slate-700">{result.subtitle}</p>}
          </button>
        ))}
      </div>
    </>
  );
}
