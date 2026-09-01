"use client";

import { useState, useTransition } from "react";
import { markDealWon, markDealLost, reopenDeal } from "@/lib/deal-actions";

export default function DealWonLost({ dealId, status }: { dealId: string; status: string }) {
  const [mode, setMode] = useState<"idle" | "lost">("idle");
  const [isPending, startTransition] = useTransition();

  if (status === "Thắng" || status === "Thua") {
    return (
      <div className="flex items-center gap-2">
        <span className={status === "Thắng" ? "chip chip-green" : "chip chip-hot"}>
          {status === "Thắng" ? "🏆 Đã thắng" : "🚫 Đã thua"}
        </span>
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => reopenDeal(dealId))}
          className="btn btn-ghost btn-sm"
        >
          Mở lại
        </button>
      </div>
    );
  }

  if (mode === "lost") {
    return (
      <form action={markDealLost.bind(null, dealId)} className="flex items-center gap-2">
        <input name="lostReason" placeholder="Lý do thua…" className="input" style={{ maxWidth: 220 }} autoFocus />
        <button type="submit" className="btn btn-danger-outline btn-sm">
          Xác nhận thua
        </button>
        <button type="button" onClick={() => setMode("idle")} className="btn btn-ghost btn-sm">
          Huỷ
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => markDealWon(dealId))}
        className="btn btn-success btn-sm"
      >
        🏆 Đánh dấu Thắng
      </button>
      <button type="button" onClick={() => setMode("lost")} className="btn btn-danger-outline btn-sm">
        ⊗ Đánh dấu Thua
      </button>
    </div>
  );
}
