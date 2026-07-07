"use client";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
};

/**
 * The explore query input — shared by the desktop filter bar and the mobile
 * filter sheet. The native WebKit clear button is suppressed globally (see
 * globals.css) so this custom one is the only ✕.
 */
export default function SearchInput({
  value,
  onChange,
  id,
  placeholder = "Search property, city, country or partner",
}: SearchInputProps) {
  return (
    <div className="relative">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400">
        <circle cx="11" cy="11" r="7" />
        <path strokeLinecap="round" d="m20 20-3-3" />
      </svg>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search properties"
        inputMode="search"
        enterKeyHint="search"
        className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-9 text-base text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 sm:text-sm"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Clear search"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="h-4 w-4">
            <path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
