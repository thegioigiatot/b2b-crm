import Link from "next/link";
import clsx from "clsx";
import PageHeader from "@/components/PageHeader";
import RhythmTaskForm from "@/components/workrhythm/RhythmTaskForm";
import TodayChecklist from "@/components/workrhythm/TodayChecklist";
import TrackingBoard from "@/components/workrhythm/TrackingBoard";
import {
  getMasterData,
  getWorkRhythmTasks,
  getWorkRhythmToday,
  getWorkRhythmTracking,
} from "@/lib/queries";
import { deleteRhythmTask } from "@/lib/rhythm-actions";
import { requireUser, hasPerm } from "@/lib/auth";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "today", label: "Việc hôm nay", icon: "◷" },
  { key: "tracking", label: "Bảng theo dõi", icon: "▦" },
  { key: "setup", label: "Thiết lập", icon: "⚙" },
];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function WorkRhythmPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; me?: string }>;
}) {
  const ctx = await requireUser();
  const privileged = hasPerm(ctx, "manageWorkRhythm");
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "today";
  const master = await getMasterData();
  const activeEmployees = master.employees.filter((e) => e.active);
  // SALES luôn xem nhịp của chính mình; ADMIN/MANAGER được chọn.
  const me = privileged
    ? (sp.me && activeEmployees.some((e) => e.id === sp.me) ? sp.me : activeEmployees[0]?.id)
    : ctx.employee?.id;

  const q = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ tab, ...(me ? { me } : {}), ...extra });
    return `/work-rhythm?${p.toString()}`;
  };

  return (
    <div>
      <PageHeader
        title="🗓️ Nhịp công việc hằng ngày"
        subtitle="Theo dõi thói quen / kỷ luật ngày của sales (đăng bài, gọi chăm sóc, báo cáo…)"
      />
      <div className="p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200">
          <div className="flex gap-1">
            {TABS.filter((t) => t.key !== "setup" || privileged).map((t) => (
              <Link
                key={t.key}
                href={q({ tab: t.key })}
                className={clsx(
                  "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition",
                  tab === t.key
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800",
                )}
              >
                {t.icon} {t.label}
              </Link>
            ))}
          </div>
          {tab === "today" && privileged && (
            <form className="flex items-center gap-2 pb-2">
              <input type="hidden" name="tab" value={tab} />
              <span className="text-xs text-slate-400">Nhân viên</span>
              <select name="me" defaultValue={me ?? ""} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm">
                {activeEmployees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn btn-ghost btn-sm">
                Xem
              </button>
            </form>
          )}
        </div>

        {tab === "today" && me && <TodaySection employeeId={me} />}
        {tab === "today" && !me && (
          <p className="text-sm text-slate-400 py-6 text-center">
            Tài khoản của bạn chưa được nối với một nhân viên — nhờ quản trị viên gán trong mục Người dùng.
          </p>
        )}
        {tab === "tracking" && <TrackingSection />}
        {tab === "setup" && privileged && <SetupSection employees={activeEmployees} />}
      </div>
    </div>
  );
}

async function TodaySection({ employeeId }: { employeeId: string }) {
  const iso = todayISO();
  const items = await getWorkRhythmToday(employeeId, iso);
  const done = items.filter((i) => i.log?.done).length;
  return (
    <div className="space-y-3">
      <div className="text-sm text-slate-500">
        Hoàn thành {done}/{items.length} việc hôm nay ({new Date().toLocaleDateString("vi-VN")})
      </div>
      <TodayChecklist
        items={items.map((i) => ({
          task: {
            id: i.task.id,
            title: i.task.title,
            category: i.task.category,
            channels: i.task.channels,
            evidenceMin: i.task.evidenceMin,
            targetCount: i.task.targetCount,
            employeeId: i.task.employeeId,
          },
          log: i.log ? { done: i.log.done, doneCount: i.log.doneCount, evidenceCount: i.log.evidenceCount } : null,
        }))}
        employeeId={employeeId}
        dateISO={iso}
      />
    </div>
  );
}

async function TrackingSection() {
  const { dates, rows } = await getWorkRhythmTracking(14);
  return <TrackingBoard dates={dates} rows={rows} />;
}

async function SetupSection({ employees }: { employees: { id: string; name: string }[] }) {
  const tasks = await getWorkRhythmTasks();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Định nghĩa việc lặp lại cho sales. Để trống nhân viên = áp dụng cho tất cả.</p>
        <RhythmTaskForm employees={employees} />
      </div>
      {tasks.length === 0 ? (
        <div className="card card-pad text-center text-sm text-slate-400">Chưa có việc nào</div>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => {
            let channels: string[] = [];
            try {
              channels = t.channels ? (JSON.parse(t.channels) as string[]) : [];
            } catch {
              channels = [];
            }
            return (
              <li key={t.id} className="card p-4 flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{t.title}</span>
                    {t.category && <span className="chip chip-neutral">{t.category}</span>}
                    {t.evidenceMin > 0 && <span className="chip chip-warm">Bằng chứng ≥{t.evidenceMin}</span>}
                    {t.targetCount ? <span className="chip chip-slate">Mục tiêu {t.targetCount}</span> : null}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {t.cadence === "weekly" ? "Hằng tuần" : "Hằng ngày"} · {t.employee?.name ?? "Tất cả"}
                    {channels.length > 0 && ` · ${channels.join(" · ")}`}
                  </div>
                </div>
                <form action={deleteRhythmTask.bind(null, t.id)}>
                  <button type="submit" className="text-xs text-slate-300 hover:text-rose-600">
                    Xoá
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
