"use client";

import KanbanBoard, { type KanbanColumn } from "@/components/kanban/KanbanBoard";
import DealCard, { type DealCardData } from "@/components/pipeline/DealCard";
import { moveDealStage } from "@/lib/deal-actions";
import { formatCurrency } from "@/lib/format";

type Col = {
  stage: { id: string; name: string; color: string | null; baseWinRate: number };
  items: DealCardData[];
  totalValue: number;
  weighted: number;
};

export default function DealPipelineBoard({ columns }: { columns: Col[] }) {
  const kcols: KanbanColumn<DealCardData>[] = columns.map((c) => ({
    id: c.stage.id,
    accent: c.stage.color,
    title: c.stage.name,
    headerRight: (
      <span className="text-[11px] text-slate-400 tabular-nums whitespace-nowrap">
        {formatCurrency(c.totalValue)}
      </span>
    ),
    footer:
      c.weighted > 0 ? (
        <div className="text-[11px] text-slate-400 px-1">Dự báo có trọng số: {formatCurrency(c.weighted)}</div>
      ) : undefined,
    items: c.items,
  }));

  return (
    <KanbanBoard
      columns={kcols}
      renderCard={(deal) => <DealCard deal={deal} />}
      onMove={(itemId, toColumnId) => moveDealStage(itemId, toColumnId)}
    />
  );
}
