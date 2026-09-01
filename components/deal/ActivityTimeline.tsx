"use client";

import { useMemo, useState, useTransition } from "react";
import clsx from "clsx";
import { deleteActivity } from "@/lib/deal-actions";
import { formatDateTime, relativeTime, formatCurrency } from "@/lib/format";

export type TimelineActivity = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  direction: string | null;
  meta: string | null;
  occurredAt: string;
  employeeName: string | null;
};

const ICON: Record<string, string> = {
  note: "📝",
  call: "📞",
  email: "✉️",
  meeting: "🗓️",
  task: "✅",
  checkin: "📍",
  document: "📎",
  quotation: "💵",
  stage_change: "🔀",
  form_submit: "🧾",
  chat_inbound: "💬",
  deal_created: "✨",
  won: "🏆",
  lost: "🚫",
};

const FILTERS: { key: string; label: string; types: string[] }[] = [
  { key: "all", label: "Tất cả", types: [] },
  {
    key: "activity",
    label: "Hoạt động",
    types: ["meeting", "checkin", "task", "form_submit", "chat_inbound", "deal_created", "won", "lost", "stage_change"],
  },
  { key: "note", label: "Ghi chú", types: ["note"] },
  { key: "call", label: "Cuộc gọi", types: ["call"] },
  { key: "email", label: "Email", types: ["email"] },
  { key: "document", label: "Tài liệu", types: ["document", "quotation"] },
];

function metaLine(a: TimelineActivity) {
  if (!a.meta) return null;
  try {
    const m = JSON.parse(a.meta) as Record<string, unknown>;
    if (a.type === "stage_change" && m.fromName && m.toName) {
      return `${m.fromName} → ${m.toName}`;
    }
    if (a.type === "checkin" && typeof m.lat === "number" && typeof m.lng === "number") {
      return `Toạ độ: ${(m.lat as number).toFixed(5)}, ${(m.lng as number).toFixed(5)}`;
    }
    if (a.type === "quotation" && typeof m.value === "number") {
      return `Giá trị: ${formatCurrency(m.value as number)}`;
    }
    if (m.link) return String(m.link);
  } catch {
    /* ignore */
  }
  return null;
}

export default function ActivityTimeline({ activities }: { activities: TimelineActivity[] }) {
  const [filter, setFilter] = useState("all");
  const [isPending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: activities.length };
    for (const f of FILTERS) {
      if (f.key === "all") continue;
      c[f.key] = activities.filter((a) => f.types.includes(a.type)).length;
    }
    return c;
  }, [activities]);

  const active = FILTERS.find((f) => f.key === filter)!;
  const shown = filter === "all" ? activities : activities.filter((a) => active.types.includes(a.type));

  return (
    <div className="card card-pad">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-4">
        <span className="text-sm font-semibold text-slate-800">Lịch sử</span>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={clsx(
              "text-sm transition",
              filter === f.key ? "font-semibold text-indigo-600" : "text-slate-500 hover:text-slate-800",
            )}
          >
            {f.label}
            {f.key === "all" ? ` (${counts.all})` : counts[f.key] ? ` (${counts[f.key]})` : ""}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-slate-400 py-8 text-center">Chưa có hoạt động nào</p>
      ) : (
        <ul className="space-y-0">
          {shown.map((a, i) => {
            const ml = metaLine(a);
            return (
              <li key={a.id} className="group relative flex gap-3 pb-4">
                <div className="flex flex-col items-center">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-sm">
                    {ICON[a.type] ?? "•"}
                  </span>
                  {i < shown.length - 1 && <span className="w-px flex-1 bg-slate-200 mt-1" />}
                </div>
                <div className="flex-1 min-w-0 -mt-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-slate-800">
                      {a.type === "stage_change" ? (
                        <>
                          <span className="font-medium">Chuyển giai đoạn:</span> {ml}
                        </>
                      ) : (
                        <>
                          <span className="font-medium">{a.title}</span>
                          {a.direction && (
                            <span className="ml-1.5 chip chip-slate">{a.direction === "in" ? "Đến" : "Đi"}</span>
                          )}
                        </>
                      )}
                    </p>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => startTransition(() => deleteActivity(a.id))}
                      className="opacity-0 group-hover:opacity-100 text-xs text-slate-300 hover:text-rose-600 transition"
                      title="Xoá"
                    >
                      ✕
                    </button>
                  </div>
                  {a.body && <p className="text-xs text-slate-600 whitespace-pre-line mt-0.5">{a.body}</p>}
                  {ml && a.type !== "stage_change" && (
                    <p className="text-xs text-slate-400 mt-0.5 break-all">{ml}</p>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1" title={formatDateTime(a.occurredAt)}>
                    {a.employeeName ? `${a.employeeName} · ` : ""}
                    lúc {formatDateTime(a.occurredAt)} · {relativeTime(a.occurredAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
