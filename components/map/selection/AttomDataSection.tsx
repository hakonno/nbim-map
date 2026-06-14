"use client";

import { useUsdToNokRate } from "@/components/map/hooks/useExchangeRate";
import type { AttomSaleHistoryEntry } from "@/components/map/hooks/useAttomData";
import { useAttomData } from "@/components/map/hooks/useAttomData";
import { formatUsdValue } from "@/utils/formatCurrency";
import type { Currency } from "@/utils/formatCurrency";

export type { Currency };

function cx(...tokens: Array<string | false | null | undefined>) {
  return tokens.filter(Boolean).join(" ");
}

// ATTOM occasionally returns placeholder amounts like $1 or $4 in place of a
// real figure. Anything below this floor is treated as "no value" so we never
// headline a nonsense valuation or sale.
const MIN_VALUE_USD = 1000;
function isRealAmount(n: number | null | undefined): n is number {
  return n != null && n >= MIN_VALUE_USD;
}

function formatYear(dateStr: string): string {
  return dateStr.slice(0, 4);
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{children}</p>
  );
}

// A tax-assessor estimate (gauge glyph). Signals a modelled value, not a real price.
function EstimateGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 12a5.5 5.5 0 1 1 11 0" />
      <path d="M8 12l2.6-3" />
    </svg>
  );
}

// An actual recorded transaction (price-tag glyph). Signals real money changed hands.
function SaleTagGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.4 2H13v4.6L7.2 12.4 2.6 7.8 8.4 2Z" />
      <circle cx="10.4" cy="5.6" r="0.9" />
    </svg>
  );
}

// Each metric carries a distinct tone so an estimate is never mistaken for a sale.
const METRIC_TONES = {
  estimate: "border-blue-100 bg-blue-50 text-blue-700",
  sale: "border-emerald-100 bg-emerald-50 text-emerald-700",
} as const;

function MetricBadge({
  icon: Icon,
  label,
  tone,
}: {
  icon: ({ className }: { className?: string }) => React.ReactElement;
  label: string;
  tone: keyof typeof METRIC_TONES;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        METRIC_TONES[tone]
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function SaleHistoryRow({
  entry,
  currency,
  usdToNok,
}: {
  entry: AttomSaleHistoryEntry;
  currency: Currency;
  usdToNok: number | null;
}) {
  const saleAmt = entry.amount?.saleAmt;
  const transType = entry.amount?.saleTransType ?? entry.amount?.saleDocType ?? "";
  const isFinancing =
    transType.toLowerCase().includes("finance") || transType.toLowerCase().includes("mortgage");

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="w-10 shrink-0 text-xs font-semibold tabular-nums text-slate-700">
        {entry.saleTransDate ? formatYear(entry.saleTransDate) : "—"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold tabular-nums text-slate-900">
            {saleAmt && saleAmt > 0 ? formatUsdValue(saleAmt, currency, usdToNok) : "—"}
          </span>
          {transType && <span className="break-words text-[11px] text-slate-600">{transType}</span>}
        </div>
        {isFinancing && entry.mortgage?.FirstConcurrent?.lenderLastName && (
          <p className="mt-0.5 break-words text-[11px] text-slate-600">
            Lender: {entry.mortgage.FirstConcurrent.lenderLastName}
          </p>
        )}
        {!isFinancing && entry.sellerName && (
          <p className="mt-0.5 break-words text-[11px] text-slate-600">
            {entry.sellerName.replace(/,$/, "")}
          </p>
        )}
      </div>
    </div>
  );
}

function NbimShareRow({
  fullUsd,
  ownershipPercent,
  label,
  currency,
  usdToNok,
}: {
  fullUsd: number;
  ownershipPercent: number;
  label: string;
  currency: Currency;
  usdToNok: number | null;
}) {
  const share = (fullUsd * ownershipPercent) / 100;
  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
      <p className="text-xs font-semibold text-amber-900">
        NBIM {ownershipPercent}% share · est. {label}:{" "}
        <span className="tabular-nums">{formatUsdValue(share, currency, usdToNok)}</span>
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
        Rough estimate only — simply {ownershipPercent}% of the full property value above. Does not
        account for ownership structure, joint ventures, debt, or transaction costs.
      </p>
    </div>
  );
}

type Props = {
  propertyId: string;
  mode: "summary" | "full";
  currency: Currency;
  ownershipPercent?: number | null;
  onExpand?: () => void;
};

export default function AttomDataSection({
  propertyId,
  mode,
  currency,
  ownershipPercent,
  onExpand,
}: Props) {
  const result = useAttomData(propertyId);
  const rateState = useUsdToNokRate();
  const usdToNok = rateState.status === "success" ? rateState.usdToNok : null;

  const fmt = (usd: number) => formatUsdValue(usd, currency, usdToNok);
  const hasOwnership = ownershipPercent != null && ownershipPercent > 0 && ownershipPercent < 100;

  if (result === null || result.status === "loading") {
    return (
      <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-4 py-3.5">
          <SectionLabel>Market Data</SectionLabel>
          <div className="mt-2 flex flex-col gap-2">
            <div className="h-6 w-32 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-48 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  if (result.status === "error") {
    return (
      <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-4 py-3.5">
          <SectionLabel>Market Data</SectionLabel>
          <p className="mt-2 text-sm text-slate-600">Could not load market data.</p>
        </div>
      </div>
    );
  }

  if (!result.data) {
    return (
      <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-4 py-3.5">
          <SectionLabel>Market Data</SectionLabel>
          <p className="mt-2 text-sm italic text-slate-600">
            No market data available for this property.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            This may be a newly constructed property, part of a multi-parcel portfolio, or not yet
            indexed in our data source.
          </p>
        </div>
      </div>
    );
  }

  const data = result.data;
  const mktValue = data.assessment?.market?.mktttlvalue;
  const mktLand = data.assessment?.market?.mktlandvalue;
  const mktImpr = data.assessment?.market?.mktimprvalue;
  const saleAmt = data.sale?.amount?.saleamt;
  const saleDate = data.sale?.saleTransDate;
  const taxAmt = data.assessment?.tax?.taxamt;
  const taxYear = data.assessment?.tax?.taxyear;
  const saleHistory = data.saleHistory ?? [];
  const hasMktValue = isRealAmount(mktValue);
  const hasSale = isRealAmount(saleAmt) && !!saleDate;

  // For patchy properties ATTOM often has no top-level sale but does have a
  // priced sale history. Fall back to the most recent priced entry so the
  // preview can still surface a real sale instead of looking empty.
  const historySale = saleHistory.reduce<AttomSaleHistoryEntry | null>((best, entry) => {
    if (!isRealAmount(entry.amount?.saleAmt) || !entry.saleTransDate) return best;
    if (!best || (best.saleTransDate ?? "") < entry.saleTransDate) return entry;
    return best;
  }, null);

  const previewSale = hasSale
    ? { amount: saleAmt!, date: saleDate!, transType: data.sale?.amount?.saleTransType }
    : historySale
      ? {
          amount: historySale.amount!.saleAmt!,
          date: historySale.saleTransDate!,
          transType: historySale.amount?.saleTransType ?? historySale.amount?.saleDocType,
        }
      : null;

  const hasTax = taxAmt != null && taxAmt > 0;
  const hasAnyDetail = hasMktValue || hasSale || hasTax || saleHistory.length > 0;

  const disclaimer = (
    <div className="bg-slate-50 px-4 py-3 text-[11px] leading-relaxed text-slate-500">
      <p>
        * Estimated market value is based on tax assessor records and may <span className="font-semibold">significantly</span> differ from
        current market value. Sale prices may reflect portfolio-level transactions across multiple
        parcels.
      </p>
      <p className="mt-1">
        {/* Values shown are for the{" "}
        <span className="font-semibold">full property</span>. 
        Data from ATTOM Data Solutions */}
        {rateState.status === "success" && currency === "NOK"
          ? ` · USD/NOK rate: ${rateState.usdToNok.toFixed(2)} (${rateState.date})`
          : ""}.
      </p>
    </div>
  );

  if (mode === "summary") {
    return (
      <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-4 py-3.5">
          {hasMktValue ? (
            <>
              {/* Lead with the tax-assessor estimate, clearly badged as an estimate. */}
              <MetricBadge icon={EstimateGlyph} label="Estimated market value *" tone="estimate" />
              <p className="mt-1.5 text-xl font-bold tabular-nums text-slate-900">
                {fmt(mktValue!)}
              </p>
              <p className="mt-0.5 text-xs text-slate-600">
                Tax assessor estimate{taxYear ? ` · ${taxYear}` : ""}
              </p>
              {hasOwnership && (
                <NbimShareRow
                  fullUsd={mktValue!}
                  ownershipPercent={ownershipPercent!}
                  label="value"
                  currency={currency}
                  usdToNok={usdToNok}
                />
              )}

              {previewSale && (
                <div className="mt-3 border-t border-slate-100 pt-2.5">
                  <MetricBadge icon={SaleTagGlyph} label="Last recorded sale" tone="sale" />
                  <p className="mt-1 text-sm">
                    <span className="font-bold tabular-nums text-slate-900">
                      {fmt(previewSale.amount)}
                    </span>
                    <span className="text-slate-500"> · {formatDateShort(previewSale.date)}</span>
                  </p>
                </div>
              )}
            </>
          ) : previewSale ? (
            <>
              {/* No assessor estimate — lead with the real sale so the preview isn't empty. */}
              <MetricBadge icon={SaleTagGlyph} label="Last recorded sale" tone="sale" />
              <p className="mt-1.5 text-xl font-bold tabular-nums text-slate-900">
                {fmt(previewSale.amount)}
              </p>
              <p className="mt-0.5 text-xs text-slate-600">
                {formatDateShort(previewSale.date)}
                {previewSale.transType ? ` · ${previewSale.transType}` : ""}
              </p>
              {hasOwnership && (
                <NbimShareRow
                  fullUsd={previewSale.amount}
                  ownershipPercent={ownershipPercent!}
                  label="acquisition cost"
                  currency={currency}
                  usdToNok={usdToNok}
                />
              )}
            </>
          ) : (
            <>
              {/* No estimate and no sale — be honest rather than showing an empty value. */}
              <MetricBadge icon={EstimateGlyph} label="Market value" tone="estimate" />
              <p className="mt-1.5 text-sm italic text-slate-500">No valuation or sale on record.</p>
              {hasTax && (
                <p className="mt-1.5 text-xs text-slate-600">
                  Annual property tax:{" "}
                  <span className="font-semibold tabular-nums text-slate-800">{fmt(taxAmt!)}</span>
                  {taxYear ? <span className="text-slate-500"> · {taxYear}</span> : ""}
                </p>
              )}
            </>
          )}
        </div>

        {onExpand && (
          <div className="border-t border-slate-100 px-4 py-2.5">
            <button
              type="button"
              onClick={onExpand}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
            >
              View full market data →
            </button>
          </div>
        )}

        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] leading-relaxed text-slate-500">
          Values shown are for the <span className="font-semibold">full property</span>.{" "}
          Source: ATTOM Data Solutions.
        </div>
      </div>
    );
  }

  // Full mode
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-sm font-semibold text-slate-800">Market Data</p>
        <p className="mt-0.5 text-xs text-slate-500">Source: ATTOM Data Solutions</p>
      </div>

      {hasMktValue && (
        <div className="border-b border-slate-100 px-4 py-3.5">
          <MetricBadge icon={EstimateGlyph} label="Estimated market value *" tone="estimate" />
          <p className="mt-1.5 text-2xl font-bold tabular-nums text-slate-900">
            {fmt(mktValue!)}
          </p>
          {(isRealAmount(mktLand) || isRealAmount(mktImpr)) && (
            <div className="mt-1.5 flex gap-4 text-xs tabular-nums text-slate-600">
              {isRealAmount(mktLand) && <span>Land: {fmt(mktLand)}</span>}
              {isRealAmount(mktImpr) && <span>Improvements: {fmt(mktImpr)}</span>}
            </div>
          )}
          {hasOwnership && (
            <NbimShareRow
              fullUsd={mktValue!}
              ownershipPercent={ownershipPercent!}
              label="value"
              currency={currency}
              usdToNok={usdToNok}
            />
          )}
        </div>
      )}

      {hasSale && (
        <div className="border-b border-slate-100 px-4 py-3.5">
          <MetricBadge icon={SaleTagGlyph} label="Last recorded sale" tone="sale" />
          <p className="mt-1.5 text-lg font-bold tabular-nums text-slate-900">
            {fmt(saleAmt!)}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            {saleDate && formatDateShort(saleDate)}
            {data.sale?.amount?.saleTransType && (
              <span className="ml-2 text-slate-500">· {data.sale.amount.saleTransType}</span>
            )}
          </p>
          {data.sale?.sellerName && (
            <p className="mt-1 truncate text-xs text-slate-600">
              Seller: {data.sale.sellerName.replace(/,$/, "")}
            </p>
          )}
          {hasOwnership && (
            <NbimShareRow
              fullUsd={saleAmt!}
              ownershipPercent={ownershipPercent!}
              label="acquisition cost"
              currency={currency}
              usdToNok={usdToNok}
            />
          )}
        </div>
      )}

      {taxAmt != null && taxAmt > 0 && (
        <div className="border-b border-slate-100 px-4 py-3.5">
          <SectionLabel>Annual property tax</SectionLabel>
          <p className="mt-1.5 text-base font-semibold tabular-nums text-slate-900">
            {fmt(taxAmt)}
            {taxYear && (
              <span className="ml-2 text-sm font-normal text-slate-500">({taxYear})</span>
            )}
          </p>
        </div>
      )}

      {saleHistory.length > 0 && (
        <div className="border-b border-slate-100 px-4 py-3.5">
          <SectionLabel>Sale history</SectionLabel>
          <div className="mt-1 divide-y divide-slate-100">
            {saleHistory.map((entry, i) => (
              <SaleHistoryRow
                key={entry.sequence ?? i}
                entry={entry}
                currency={currency}
                usdToNok={usdToNok}
              />
            ))}
          </div>
        </div>
      )}

      {!hasAnyDetail && (
        <div className="border-b border-slate-100 px-4 py-3.5">
          <p className="text-sm italic text-slate-500">
            No valuation, sale, or tax records available for this property.
          </p>
        </div>
      )}

      {disclaimer}
    </div>
  );
}
