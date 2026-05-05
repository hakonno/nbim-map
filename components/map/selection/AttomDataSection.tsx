"use client";

import { useUsdToNokRate } from "@/components/map/hooks/useExchangeRate";
import type { AttomSaleHistoryEntry } from "@/components/map/hooks/useAttomData";
import { useAttomData } from "@/components/map/hooks/useAttomData";
import { formatUsdValue } from "@/utils/formatCurrency";
import type { Currency } from "@/utils/formatCurrency";

export type { Currency };

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
  const hasMktValue = mktValue != null && mktValue > 0;
  const hasSale = saleAmt != null && saleAmt > 0 && saleDate;

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
          <SectionLabel>Estimated market value *</SectionLabel>
          {hasMktValue ? (
            <>
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
            </>
          ) : (
            <p className="mt-1.5 text-sm italic text-slate-500">Not available</p>
          )}

          {hasSale && (
            <p className="mt-2.5 text-xs text-slate-600">
              Last recorded sale:{" "}
              <span className="font-semibold tabular-nums text-slate-800">{fmt(saleAmt!)}</span>
              {saleDate && (
                <span className="text-slate-500"> · {formatDateShort(saleDate)}</span>
              )}
            </p>
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

      <div className="border-b border-slate-100 px-4 py-3.5">
        <SectionLabel>Estimated market value *</SectionLabel>
        {hasMktValue ? (
          <>
            <p className="mt-1.5 text-2xl font-bold tabular-nums text-slate-900">
              {fmt(mktValue!)}
            </p>
            {((mktLand != null && mktLand > 0) || (mktImpr != null && mktImpr > 0)) && (
              <div className="mt-1.5 flex gap-4 text-xs tabular-nums text-slate-600">
                {mktLand != null && mktLand > 0 && <span>Land: {fmt(mktLand)}</span>}
                {mktImpr != null && mktImpr > 0 && <span>Improvements: {fmt(mktImpr)}</span>}
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
          </>
        ) : (
          <p className="mt-1.5 text-sm italic text-slate-500">Not available</p>
        )}
      </div>

      <div className="border-b border-slate-100 px-4 py-3.5">
        <SectionLabel>Last recorded sale</SectionLabel>
        {hasSale ? (
          <>
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
          </>
        ) : (
          <p className="mt-1.5 text-sm italic text-slate-500">Not available</p>
        )}
      </div>

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

      {disclaimer}
    </div>
  );
}
