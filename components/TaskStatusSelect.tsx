"use client";

import { useTransition } from "react";
import { setTaskStatus } from "@/lib/actions";

const STATUSES = ["Cần làm", "Đang làm", "Hoàn thành"];

export default function TaskStatusSelect({ taskId, status }: { taskId: string; status: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={status}
      disabled={isPending}
      onChange={(e) => {
        const value = e.target.value;
        startTransition(() => {
          setTaskStatus(taskId, value);
        });
      }}
      className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-600 disabled:opacity-50"
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
