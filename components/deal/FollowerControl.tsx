"use client";

import { useState, useTransition } from "react";
import { addFollower, removeFollower } from "@/lib/deal-actions";
import { initials } from "@/lib/format";

type Emp = { id: string; name: string };

export default function FollowerControl({
  dealId,
  followers,
  employees,
}: {
  dealId: string;
  followers: { id: string; name: string }[];
  employees: Emp[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const followerIds = new Set(followers.map((f) => f.id));
  const candidates = employees.filter((e) => !followerIds.has(e.id));

  return (
    <div className="relative flex items-center gap-1.5">
      {followers.map((f) => (
        <button
          key={f.id}
          type="button"
          title={`Bỏ theo dõi: ${f.name}`}
          disabled={isPending}
          onClick={() => startTransition(() => removeFollower(dealId, f.id))}
          className="avatar hover:ring-2 hover:ring-rose-300"
        >
          {initials(f.name)}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-500"
      >
        +
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 w-52 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {candidates.length === 0 && <p className="px-2 py-2 text-xs text-slate-400">Tất cả đã theo dõi</p>}
          {candidates.map((e) => (
            <button
              key={e.id}
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(() => {
                  addFollower(dealId, e.id);
                  setOpen(false);
                })
              }
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50"
            >
              <span className="avatar">{initials(e.name)}</span>
              {e.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
