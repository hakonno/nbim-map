"use client";

import Link from "next/link";

import Popover from "@/components/explore/Popover";

const GITHUB_URL = "https://github.com/hakonno/nbim-map";
const NBIM_URL = "https://www.nbim.no/";
const NBIM_DATASOURCE = "https://www.nbim.no/en/investments/all-investments#/2025-12-31/2-real_estate";
const ATTOM_URL = "https://www.attomdata.com/";

type AboutPopoverProps = {
  datasetYear: string;
};

/**
 * The full-viewport explore app has no footer, so this popover is where the
 * "what am I looking at?" content lives: purpose, unofficial status, data
 * caveats, the marker-colour legend, and source links.
 */
export default function AboutPopover({ datasetYear }: AboutPopoverProps) {
  return (
    <Popover
      label="About this site"
      align="right"
      triggerClassName="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:h-auto sm:w-auto sm:gap-1.5 sm:px-2.5 sm:py-1.5 sm:text-sm sm:font-medium sm:text-slate-600"
      panelClassName="w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-2xl ring-1 ring-black/[0.04]"
      trigger={
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="h-4 w-4">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="11" x2="12" y2="16" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <span className="sr-only sm:not-sr-only">About</span>
        </>
      }
    >
      <p className="text-sm font-semibold text-slate-900">About this site</p>
      <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
        An independent map of the unlisted real estate owned by Norges Bank
        Investment Management (NBIM) — Norway&apos;s sovereign wealth fund, often
        called the oil fund. Built from NBIM&apos;s {datasetYear} disclosure.
        Unofficial: not affiliated with or endorsed by NBIM.
      </p>

      <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
        <span className="font-medium text-slate-900">
          Open source and independently maintained.
        </span>{" "}
        Information is compiled from public and 3rd-party sources and may be
        inaccurate, incomplete, or outdated. verify details on{" "}
        <a
          href={NBIM_DATASOURCE}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-slate-700 hover:text-slate-950 hover:underline"
        >
          nbim.no
        </a>
        .
      </p>

      <ul className="mt-3 flex flex-col gap-1.5 border-t border-slate-100 pt-3 text-[13px] leading-relaxed text-slate-600">
        <li className="flex gap-2">
          <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
          NBIM discloses values per country only — per-property values are never
          shown here because they are not published.
        </li>
        <li className="flex gap-2">
          <span
            aria-hidden="true"
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{
              background: "linear-gradient(90deg, hsl(0,70%,45%), hsl(60,70%,45%), hsl(120,70%,45%))",
            }}
          />
          Map markers are coloured by NBIM&apos;s ownership stake — red for small
          stakes through green for wholly owned.
        </li>
      </ul>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-slate-100 pt-3 text-[13px]">
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-slate-700 hover:text-slate-950 hover:underline"
        >
          Source code (GitHub) ↗
        </a>
        <a
          href={NBIM_DATASOURCE}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-slate-700 hover:text-slate-950 hover:underline"
        >
          Data: nbim.no ↗
        </a>
        <a
          href={ATTOM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-slate-700 hover:text-slate-950 hover:underline"
        >
          ATTOM US market data ↗
        </a>
        <Link
          href="/properties"
          className="font-medium text-slate-700 hover:text-slate-950 hover:underline"
        >
          Full property index ↗
        </Link>
      </div>
    </Popover>
  );
}
