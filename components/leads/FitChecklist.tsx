import clsx from "clsx";

export default function FitChecklist({
  items,
  percent,
  score,
  max,
}: {
  items: { key: string; label: string; weight: number; met: boolean }[];
  percent: number;
  score: number;
  max: number;
}) {
  return (
    <div className="card card-pad">
      <div className="flex items-center justify-between mb-3">
        <h2 className="section-title">Trục độ phù hợp — họ là ai</h2>
        <span className="text-sm font-semibold text-indigo-600">
          {percent}% <span className="text-xs font-normal text-slate-400">({score}/{max})</span>
        </span>
      </div>
      <ul className="space-y-1">
        {items.map((it) => (
          <li
            key={it.key}
            className={clsx(
              "flex items-center justify-between rounded-md px-2 py-1 text-sm",
              it.met ? "bg-emerald-50/60" : "opacity-60",
            )}
          >
            <span className="flex items-center gap-2">
              <span className={it.met ? "text-emerald-600" : "text-slate-300"}>{it.met ? "✓" : "○"}</span>
              {it.label}
            </span>
            <span className={clsx("tabular-nums text-xs", it.weight < 0 ? "text-rose-500" : "text-slate-400")}>
              {it.weight > 0 ? `+${it.weight}` : it.weight}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
