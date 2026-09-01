import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import ScoreBadge from "@/components/ScoreBadge";
import LeadBoard from "@/components/leads/LeadBoard";
import { getLeads, getLeadsBoard, getLeadSnapshot, getMasterData, LEAD_STATUSES } from "@/lib/queries";
import { formatNumber } from "@/lib/format";
import type { LeadCardData } from "@/components/leads/LeadCard";
import { requireUser, hasPerm } from "@/lib/auth";

export const dynamic = "force-dynamic";

const LABELS = ["Nóng", "Ấm", "Nguội"];

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; status?: string; label?: string; employeeId?: string }>;
}) {
  const ctx = await requireUser();
  const sp = await searchParams;
  const board = sp.view === "board";
  const [master, snap, list] = await Promise.all([
    getMasterData(),
    getLeadSnapshot(ctx),
    getLeads(sp, ctx),
  ]);
  const showEmployeeFilter = hasPerm(ctx, "viewAllLeads");

  const toCard = (l: Awaited<ReturnType<typeof getLeads>>[number]): LeadCardData => ({
    id: l.id,
    code: l.code,
    name: l.name,
    companyName: l.companyName,
    label: l.label,
    fitGrade: l.fitGrade,
    fitPercent: Math.round(l.fitPercent),
    engagementGrade: l.engagementGrade,
    employeeName: l.employee?.name ?? null,
    sourceName: l.source?.name ?? null,
  });

  return (
    <div>
      <PageHeader
        title="🌱 Leads"
        subtitle="Khách hàng tiềm năng thô — được chấm điểm tự động, chưa chắc thành deal"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={board ? "/leads" : "/leads?view=board"}
              className="btn btn-ghost btn-sm"
            >
              {board ? "▤ Danh sách" : "▦ Bảng"}
            </Link>
            <Link href="/leads/new" className="btn btn-primary btn-sm">
              + Thêm lead
            </Link>
          </div>
        }
      />
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Tổng lead" value={formatNumber(snap.total)} accent="indigo" />
          <StatCard label="Đang xử lý" value={formatNumber(snap.open)} />
          <StatCard label="Lead Nóng" value={formatNumber(snap.hot)} accent="rose" />
          <StatCard label="Đã chuyển đổi" value={formatNumber(snap.converted)} accent="emerald" />
        </div>

        {board ? (
          <LeadBoard columns={(await getLeadsBoard({ employeeId: sp.employeeId }, ctx)).columns.map((c) => ({ status: c.status, items: c.items.map(toCard) }))} />
        ) : (
          <>
            <form className="flex flex-wrap gap-2 card p-3">
              <input
                name="q"
                defaultValue={sp.q}
                placeholder="Tìm theo tên, công ty, SĐT, mã…"
                className="flex-1 min-w-[180px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              />
              <select name="status" defaultValue={sp.status ?? ""} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
                <option value="">Tất cả trạng thái</option>
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select name="label" defaultValue={sp.label ?? ""} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
                <option value="">Tất cả nhãn</option>
                {LABELS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {showEmployeeFilter && (
                <select name="employeeId" defaultValue={sp.employeeId ?? ""} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
                  <option value="">Tất cả nhân viên</option>
                  {master.employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              )}
              <button type="submit" className="btn btn-dark btn-sm">
                Lọc
              </button>
            </form>

            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="text-left font-medium px-4 py-2.5">Mã</th>
                    <th className="text-left font-medium px-4 py-2.5">Công ty / Người liên hệ</th>
                    <th className="text-left font-medium px-4 py-2.5">Nguồn</th>
                    <th className="text-left font-medium px-4 py-2.5">Nhân viên</th>
                    <th className="text-left font-medium px-4 py-2.5">Trạng thái</th>
                    <th className="text-right font-medium px-4 py-2.5">Fit</th>
                    <th className="text-left font-medium px-4 py-2.5">Nhãn</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((l) => (
                    <tr key={l.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <Link href={`/leads/${l.id}`} className="text-indigo-600 font-medium hover:underline">
                          {l.code}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="text-slate-800">{l.companyName || l.name}</div>
                        {l.companyName && <div className="text-xs text-slate-400">{l.name}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{l.source?.name ?? "-"}</td>
                      <td className="px-4 py-2.5 text-slate-500">{l.employee?.name ?? "-"}</td>
                      <td className="px-4 py-2.5 text-slate-500">{l.status}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">
                        {Math.round(l.fitPercent)}% <span className="text-xs text-slate-400">{l.fitGrade}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <ScoreBadge label={l.label} grade={l.engagementGrade} showIcon={false} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {list.length === 0 && <p className="px-4 py-10 text-center text-slate-400">Không có lead nào</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
