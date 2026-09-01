import clsx from "clsx";

export default function ProgressBar({ rate }: { rate: number }) {
  const pct = Math.min(rate, 1) * 100;
  const color = rate >= 1 ? "bg-emerald-500" : rate >= 0.7 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={clsx("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span
        className={clsx(
          "text-xs font-medium tabular-nums",
          rate >= 1 ? "text-emerald-600" : rate >= 0.7 ? "text-amber-600" : "text-rose-600",
        )}
      >
        {new Intl.NumberFormat("vi-VN", { style: "percent", maximumFractionDigits: 1 }).format(rate)}
      </span>
    </div>
  );
}
