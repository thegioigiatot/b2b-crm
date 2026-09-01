import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import ProgressBar from "@/components/ProgressBar";
import TaskBoard from "@/components/tasks/TaskBoard";
import type { TaskCardData } from "@/components/tasks/TaskCard";
import { getTasks, getTaskProgressByEmployee, getMasterData } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { createTask } from "@/lib/actions";
import { requireUser, hasPerm } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string }>;
}) {
  const ctx = await requireUser();
  const privileged = hasPerm(ctx, "viewAllTasks");
  const sp = await searchParams;
  const [tasks, progress, master, customers, deals] = await Promise.all([
    getTasks({ employeeId: privileged ? sp.employeeId : undefined }, ctx),
    getTaskProgressByEmployee(),
    getMasterData(),
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, code: true, name: true } }),
    prisma.deal.findMany({ orderBy: { updatedAt: "desc" }, select: { id: true, title: true }, take: 100 }),
  ]);

  const cards: TaskCardData[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    employeeName: t.employee?.name ?? null,
    customer: t.customer ?? null,
    deal: t.deal ?? null,
  }));

  return (
    <div>
      <PageHeader
        title="✅ Công việc"
        subtitle="Kéo thả thẻ giữa các cột để cập nhật trạng thái xử lý"
        actions={
          privileged ? (
            <form className="flex items-center gap-2">
              <select
                name="employeeId"
                defaultValue={sp.employeeId ?? ""}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
              >
                <option value="">Tất cả nhân viên</option>
                {master.employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn btn-ghost btn-sm">
                Lọc
              </button>
            </form>
          ) : null
        }
      />
      <div className="p-6 space-y-5">
        <div className="card card-pad">
          <h2 className="section-title mb-3">Tiến trình công việc theo nhân viên</h2>
          {progress.length === 0 ? (
            <p className="text-sm text-slate-400 py-3 text-center">Chưa có công việc nào</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {progress.map((p) => (
                <Link
                  key={p.id}
                  href={`/tasks?employeeId=${p.id}`}
                  className="rounded-lg border border-slate-100 p-3 hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-800">{p.name}</span>
                    <span className="text-xs text-slate-400">
                      {p.done}/{p.total} hoàn thành
                    </span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar rate={p.rate} />
                  </div>
                  {p.overdue > 0 && <div className="mt-1 text-xs text-rose-600">{p.overdue} việc quá hạn</div>}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
          <div className="xl:col-span-3">
            <TaskBoard tasks={cards} />
          </div>

          <div className="card card-pad h-fit">
            <h2 className="section-title mb-3">Giao việc mới</h2>
            <form action={createTask} className="space-y-3">
              <div>
                <label className="field-label">Tên công việc</label>
                <input name="title" required placeholder="VD: Gọi điện tư vấn lại" className="input" />
              </div>
              {privileged ? (
                <div>
                  <label className="field-label">Nhân viên phụ trách</label>
                  <select name="employeeId" required className="input">
                    {master.employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Việc sẽ được giao cho bạn.</p>
              )}
              <div>
                <label className="field-label">Deal liên quan</label>
                <select name="dealId" className="input">
                  <option value="">-</option>
                  {deals.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Khách hàng liên quan</label>
                <select name="customerId" className="input">
                  <option value="">-</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Hạn xử lý</label>
                <input type="date" name="dueDate" className="input" />
              </div>
              <div>
                <label className="field-label">Mức độ ưu tiên</label>
                <select name="priority" defaultValue="Bình thường" className="input">
                  <option value="Thấp">Thấp</option>
                  <option value="Bình thường">Bình thường</option>
                  <option value="Cao">Cao</option>
                </select>
              </div>
              <div>
                <label className="field-label">Ghi chú</label>
                <textarea name="description" rows={2} className="input" />
              </div>
              <button type="submit" className="btn btn-primary w-full">
                Giao việc
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
