"use client";

import KanbanBoard, { type KanbanColumn } from "@/components/kanban/KanbanBoard";
import TaskCard, { type TaskCardData } from "@/components/tasks/TaskCard";
import { moveTask } from "@/lib/actions";

const STATUSES = ["Cần làm", "Đang làm", "Hoàn thành"] as const;
const ACCENT: Record<string, string> = {
  "Cần làm": "#94a3b8",
  "Đang làm": "#f59e0b",
  "Hoàn thành": "#10b981",
};

export default function TaskBoard({ tasks }: { tasks: TaskCardData[] }) {
  const columns: KanbanColumn<TaskCardData>[] = STATUSES.map((status) => ({
    id: status,
    title: status,
    accent: ACCENT[status],
    items: tasks.filter((t) => t.status === status),
  }));

  return (
    <KanbanBoard
      columns={columns}
      renderCard={(task) => <TaskCard task={task} />}
      onMove={(itemId, toColumnId, orderedIds) => moveTask(itemId, toColumnId, orderedIds)}
    />
  );
}
