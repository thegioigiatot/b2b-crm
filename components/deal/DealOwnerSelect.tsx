"use client";

import { useTransition } from "react";
import { setDealOwner } from "@/lib/deal-actions";
import { initials } from "@/lib/format";

type Emp = { id: string; name: string };

export default function DealOwnerSelect({
  dealId,
  ownerId,
  ownerName,
  employees,
}: {
  dealId: string;
  ownerId: string | null;
  ownerName: string | null;
  employees: Emp[];
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-2">
      {ownerName && <span className="avatar">{initials(ownerName)}</span>}
      <select
        defaultValue={ownerId ?? ""}
        disabled={isPending}
        onChange={(e) => {
          const v = e.target.value;
          startTransition(() => setDealOwner(dealId, v));
        }}
        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm"
      >
        <option value="">Chưa gán</option>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
    </div>
  );
}
