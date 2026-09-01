"use client";

import Link from "next/link";
import { useTransition } from "react";
import clsx from "clsx";
import { moveDealStage } from "@/lib/deal-actions";

type Stage = {
  id: string;
  name: string;
  color: string | null;
  baseWinRate: number;
  isWon: boolean;
  isLost: boolean;
  sortOrder: number;
};

export default function DealStageBar({
  dealId,
  stages,
  currentStageId,
  status,
}: {
  dealId: string;
  stages: Stage[];
  currentStageId: string;
  status: string;
}) {
  const [isPending, startTransition] = useTransition();
  const ordered = [...stages].sort((a, b) => a.sortOrder - b.sortOrder);
  const currentIdx = ordered.findIndex((s) => s.id === currentStageId);
  const current = ordered[currentIdx];

  return (
    <div className="card card-pad">
      <div className="flex flex-wrap items-center gap-1.5">
        {ordered.map((s, i) => {
          const done = i < currentIdx && !s.isWon && !s.isLost;
          const active = s.id === currentStageId;
          return (
            <div key={s.id} className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={isPending || active}
                onClick={() => startTransition(() => moveDealStage(dealId, s.id))}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition disabled:opacity-100",
                  active
                    ? "text-white shadow-sm"
                    : done
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200",
                )}
                style={active ? { backgroundColor: s.color ?? "#4f46e5" } : undefined}
              >
                <span className="text-xs">{done ? "✓" : active ? "◉" : s.isLost ? "✕" : s.isWon ? "🏆" : "○"}</span>
                {s.name}
              </button>
              {i < ordered.length - 1 && <span className="text-slate-300">›</span>}
            </div>
          );
        })}
        <Link href="/settings#pipeline" className="ml-1 text-xs text-indigo-500 hover:underline">
          + Giai đoạn
        </Link>
      </div>
      {current && status === "Đang mở" && (
        <p className="mt-2 text-xs text-slate-400">
          Tỷ lệ thắng cơ sở của giai đoạn: {Math.round(current.baseWinRate * 100)}%
        </p>
      )}
    </div>
  );
}
