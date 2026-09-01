import clsx from "clsx";

export default function StatCard({
  label,
  value,
  hint,
  accent = "slate",
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "slate" | "indigo" | "emerald" | "amber" | "rose";
}) {
  const accents: Record<string, string> = {
    slate: "text-slate-900",
    indigo: "text-indigo-600",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    rose: "text-rose-600",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={clsx("mt-1.5 text-2xl font-semibold tabular-nums", accents[accent])}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}
