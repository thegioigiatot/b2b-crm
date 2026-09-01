"use client";

import { useTransition } from "react";
import { moveCustomerStage } from "@/lib/actions";

export default function StageSelect({
  customerId,
  currentStatusId,
  statuses,
}: {
  customerId: string;
  currentStatusId: string;
  statuses: { id: string; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={currentStatusId}
      disabled={isPending}
      onChange={(e) => {
        const value = e.target.value;
        startTransition(() => {
          moveCustomerStage(customerId, value);
        });
      }}
      className="w-full rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1 text-[11px] text-slate-600 disabled:opacity-50"
    >
      {statuses.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
