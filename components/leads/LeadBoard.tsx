"use client";

import KanbanBoard, { type KanbanColumn } from "@/components/kanban/KanbanBoard";
import LeadCard, { type LeadCardData } from "@/components/leads/LeadCard";
import { setLeadStatus } from "@/lib/lead-actions";

type Col = { status: string; items: LeadCardData[] };

const ACCENT: Record<string, string> = {
  "Mới": "#60a5fa",
  "Đang liên hệ": "#fbbf24",
  "Đủ điều kiện": "#fb923c",
  "Đã chuyển đổi": "#34d399",
  "Rác": "#94a3b8",
};

export default function LeadBoard({ columns }: { columns: Col[] }) {
  const kcols: KanbanColumn<LeadCardData>[] = columns.map((c) => ({
    id: c.status,
    title: c.status,
    accent: ACCENT[c.status] ?? "#94a3b8",
    items: c.items,
  }));
  return (
    <KanbanBoard
      columns={kcols}
      renderCard={(lead) => <LeadCard lead={lead} />}
      onMove={(itemId, toColumnId) => setLeadStatus(itemId, toColumnId)}
    />
  );
}
