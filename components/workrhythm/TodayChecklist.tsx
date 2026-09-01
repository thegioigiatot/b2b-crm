"use client";

import { useTransition } from "react";
import clsx from "clsx";
import { toggleRhythmLog, setRhythmProgress } from "@/lib/rhythm-actions";

type Task = {
  id: string;
  title: string;
  category: string | null;
  channels: string | null;
  evidenceMin: number;
  targetCount: number | null;
  employeeId: string | null;
};
type Log = { done: boolean; doneCount: number; evidenceCount: number } | null;

export default function TodayChecklist({
  items,
  employeeId,
  dateISO,
}: {
  items: { task: Task; log: Log }[];
  employeeId: string;
  dateISO: string;
}) {
  const [isPending, startTransition] = useTransition();

  if (items.length === 0) {
    return <p className="text-sm text-slate-400 py-6 text-center">Chưa có việc lặp lại nào được thiết lập.</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map(({ task, log }) => {
        const channels: string[] = task.channels ? safeArr(task.channels) : [];
        const done = !!log?.done;
        const needsDetail = task.evidenceMin > 0 || (task.targetCount ?? 0) > 0;
        return (
          <li key={task.id} className={clsx("card p-3", done && "bg-emerald-50/50 border-emerald-200")}>
            <div className="flex items-start gap-3">
              <button
                type="button"
                disabled={isPending}
                onClick={() => startTransition(() => toggleRhythmLog(task.id, employeeId, dateISO))}
                className={clsx(
                  "mt-0.5 flex h-5 w-5 items-center justify-center rounded border text-xs",
                  done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent hover:border-indigo-400",
                )}
              >
                ✓
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={clsx("text-sm font-medium", done ? "text-slate-500 line-through" : "text-slate-800")}>
                    {task.title}
                  </span>
                  {task.category && <span className="chip chip-neutral">{task.category}</span>}
                  {task.evidenceMin > 0 && <span className="chip chip-warm">Bằng chứng ≥{task.evidenceMin}</span>}
                  {task.targetCount ? <span className="chip chip-slate">Mục tiêu {task.targetCount}</span> : null}
                </div>
                <div className="mt-0.5 text-xs text-slate-400">
                  {task.employeeId ? "Riêng bạn" : "Tất cả"}
                  {channels.length > 0 && ` · ${channels.join(" · ")}`}
                </div>

                {needsDetail && (
                  <form
                    action={setRhythmProgress}
                    className="mt-2 flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="taskId" value={task.id} />
                    <input type="hidden" name="employeeId" value={employeeId} />
                    <input type="hidden" name="date" value={dateISO} />
                    {(task.targetCount ?? 0) > 0 && (
                      <label className="text-xs text-slate-500">
                        Đã làm
                        <input
                          name="doneCount"
                          type="number"
                          min={0}
                          defaultValue={log?.doneCount ?? 0}
                          className="input ml-1"
                          style={{ width: 70, display: "inline-block" }}
                        />
                        <span className="ml-1">/ {task.targetCount}</span>
                      </label>
                    )}
                    {task.evidenceMin > 0 && (
                      <label className="text-xs text-slate-500">
                        Bằng chứng
                        <input
                          name="evidenceCount"
                          type="number"
                          min={0}
                          defaultValue={log?.evidenceCount ?? 0}
                          className="input ml-1"
                          style={{ width: 70, display: "inline-block" }}
                        />
                      </label>
                    )}
                    <button type="submit" className="btn btn-ghost btn-sm">
                      Cập nhật
                    </button>
                  </form>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function safeArr(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
