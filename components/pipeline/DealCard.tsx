import Link from "next/link";
import clsx from "clsx";
import { formatCurrency } from "@/lib/format";
import ScoreBadge from "@/components/ScoreBadge";

export type DealCardData = {
  id: string;
  code: string;
  title: string;
  value: number;
  status: string;
  customerName: string;
  ownerName: string | null;
  ownerInitials: string | null;
  label: string;
  healthLabel: string;
  probability: number;
  forecastCategory: string | null;
  daysInStage: number;
  openTaskCount: number;
  followerCount: number;
};

export default function DealCard({ deal }: { deal: DealCardData }) {
  return (
    <Link
      href={`/deals/${deal.id}`}
      className="block rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-indigo-300 hover:shadow-md transition"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">{deal.title}</span>
        <ScoreBadge label={deal.label} showIcon={false} />
      </div>
      <div className="mt-1 text-xs text-slate-500 truncate">{deal.customerName}</div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-900 tabular-nums">{formatCurrency(deal.value)}</span>
        <span
          className={clsx(
            "text-xs font-medium tabular-nums",
            deal.probability >= 50 ? "text-emerald-600" : deal.probability >= 25 ? "text-amber-600" : "text-slate-400",
          )}
        >
          {deal.probability}%
        </span>
      </div>

      {deal.forecastCategory && (
        <div className="mt-1.5 text-[11px] text-indigo-600">🏁 {deal.forecastCategory}</div>
      )}

      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500">
        {deal.ownerName ? (
          <>
            <span className="avatar" style={{ width: 16, height: 16, fontSize: 8 }}>
              {deal.ownerInitials}
            </span>
            <span className="truncate">{deal.ownerName}</span>
          </>
        ) : (
          <span className="text-amber-600">Chưa gán NV</span>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
        <span>{deal.daysInStage > 0 ? `${deal.daysInStage}n trong giai đoạn` : ""}</span>
        <span className="flex items-center gap-2">
          {deal.openTaskCount > 0 && <span className="chip chip-neutral">{deal.openTaskCount} việc</span>}
          {deal.followerCount > 0 && <span>👁 {deal.followerCount}</span>}
        </span>
      </div>
    </Link>
  );
}
