import clsx from "clsx";
import { formatPercent } from "@/lib/format";

type Cell = { date: Date; done: number; total: number };
type Row = {
  employee: { id: string; name: string };
  cells: Cell[];
  rate: number;
  totalDone: number;
  totalSlots: number;
};

function tone(done: number, total: number) {
  if (total === 0) return "bg-slate-50 text-slate-300";
  const r = done / total;
  if (r === 0) return "bg-rose-50 text-rose-400";
  if (r < 0.5) return "bg-amber-100 text-amber-700";
  if (r < 1) return "bg-emerald-100 text-emerald-700";
  return "bg-emerald-500 text-white";
}

export default function TrackingBoard({ dates, rows }: { dates: Date[]; rows: Row[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400 py-6 text-center">Chưa có dữ liệu theo dõi.</p>;
  }
  return (
    <div className="card overflow-x-auto thin-scroll">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="text-slate-400">
            <th className="text-left font-medium px-3 py-2 sticky left-0 bg-white">Nhân viên</th>
            <th className="text-left font-medium px-3 py-2">Tỷ lệ {dates.length} ngày</th>
            {dates.map((d) => (
              <th key={d.toISOString()} className="font-medium px-1.5 py-2 text-center whitespace-nowrap">
                {d.getDate()}/{d.getMonth() + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.employee.id} className="border-t border-slate-100">
              <td className="px-3 py-2 font-medium text-slate-700 sticky left-0 bg-white whitespace-nowrap">
                {r.employee.name}
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={clsx("h-full", r.rate >= 0.8 ? "bg-emerald-500" : r.rate >= 0.5 ? "bg-amber-500" : "bg-rose-500")}
                      style={{ width: `${Math.round(r.rate * 100)}%` }}
                    />
                  </div>
                  <span className="tabular-nums text-slate-500">{formatPercent(r.rate)}</span>
                </div>
              </td>
              {r.cells.map((c) => (
                <td key={c.date.toISOString()} className="px-1 py-1 text-center">
                  <span
                    className={clsx(
                      "inline-flex h-6 w-6 items-center justify-center rounded tabular-nums",
                      tone(c.done, c.total),
                    )}
                    title={`${c.done}/${c.total}`}
                  >
                    {c.total === 0 ? "·" : c.done}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
