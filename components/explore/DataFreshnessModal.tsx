"use client";

type DataFreshnessModalProps = {
  datasetYear: string;
  currentYear: number;
  onClose: () => void;
};

function WarningGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export default function DataFreshnessModal({
  datasetYear,
  currentYear,
  onClose,
}: DataFreshnessModalProps) {
  return (
    <div
      className="fixed inset-0 z-[1050] flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-freshness-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600"
          >
            <WarningGlyph className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="data-freshness-title"
              className="text-lg font-semibold text-slate-900"
            >
              Data may be outdated
            </h2>
            <span className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {datasetYear} data · {currentYear}
            </span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          NBIM publishes its unlisted real-estate holdings once a year, typically
          after year-end. This map is still showing the {datasetYear} disclosure,
          so a newer release may already be available. We are working on getting
          the data updated.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
