import Link from "next/link";
import clsx from "clsx";
import { formatDate } from "@/lib/format";
import { deleteTask } from "@/lib/actions";

export type TaskCardData = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  employeeName: string | null;
  customer: { id: string; code: string; name: string } | null;
  deal: { id: string; title: string } | null;
};

export default function TaskCard({ task }: { task: TaskCardData }) {
  const overdue = task.status !== "Hoàn thành" && task.dueDate && new Date(task.dueDate) < new Date();
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm text-slate-800 leading-snug">{task.title}</div>
        <span
          className={clsx(
            "chip shrink-0",
            task.priority === "Cao" ? "chip-hot" : task.priority === "Thấp" ? "chip-slate" : "chip-warm",
          )}
        >
          {task.priority}
        </span>
      </div>
      {task.deal ? (
        <Link href={`/deals/${task.deal.id}`} className="mt-1 block text-xs text-indigo-600 hover:underline truncate">
          💲 {task.deal.title}
        </Link>
      ) : task.customer ? (
        <Link
          href={`/customers/${task.customer.id}`}
          className="mt-1 block text-xs text-indigo-600 hover:underline truncate"
        >
          {task.customer.code} · {task.customer.name}
        </Link>
      ) : null}
      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="text-slate-500">{task.employeeName ?? "-"}</span>
        <span className={clsx(overdue ? "text-rose-600 font-medium" : "text-slate-400")}>
          {task.dueDate ? `Hạn ${formatDate(task.dueDate)}` : "Không hạn"}
          {overdue && " · Quá hạn"}
        </span>
      </div>
      <div className="mt-2 flex justify-end">
        <form action={deleteTask.bind(null, task.id)}>
          <button type="submit" className="text-[11px] text-slate-300 hover:text-rose-600">
            Xoá
          </button>
        </form>
      </div>
    </div>
  );
}
