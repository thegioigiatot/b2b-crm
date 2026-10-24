import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import MonthPicker from "@/components/MonthPicker";
import ProgressBar from "@/components/ProgressBar";
import EmployeeKpiChart from "@/components/charts/EmployeeKpiChart";
import { getAvailableMonths, getKpiTable } from "@/lib/queries";
import { setKpiTarget, deleteKpiTarget } from "@/lib/actions";
import { formatCurrency, monthValue } from "@/lib/format";
import { requireUser, hasPerm } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function KpiPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const ctx = await requireUser();
  const canEditKpi = hasPerm(ctx, "manageKpi");
  const sp = await searchParams;
  let months = await getAvailableMonths();
  const currentMonth = monthValue(new Date());
  if (!months.includes(currentMonth)) months = [...months, currentMonth].sort();
  const month = sp.month && months.includes(sp.month) ? sp.month : months.includes(currentMonth) ? currentMonth : months.at(-1)!;
  const { rows, employeeSummary, employees, productGroups } = await getKpiTable(month);

  const totalTarget = rows.reduce((s, r) => s + r.target, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);
  const withoutTarget = rows.filter(r => !r.hasTarget);
  const overallRate = totalTarget > 0 ? totalActual / totalTarget : 0;

  return (
    <div>
      <PageHeader
        title="🎯 Thiết lập KPI hàng tháng cho nhân viên"
        subtitle="Đặt chỉ tiêu doanh số theo từng nhân viên và nhóm hàng, theo dõi tỷ lệ đạt KPI"
        actions={<MonthPicker months={months} current={month} />}
      />
      <div className="p-6 space-y-6">
        {withoutTarget.length > 0 && <p role="status" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          {withoutTarget.length} nhóm doanh số chưa có chỉ tiêu, tổng {formatCurrency(withoutTarget.reduce((s,r)=>s+r.actual,0))}. Đã tính đủ vào doanh số thực tế và tổng chung. Quản trị viên cần đặt chỉ tiêu cho các nhóm này; hệ thống không tự tạo chỉ tiêu.
        </p>}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Tổng KPI mục tiêu" value={formatCurrency(totalTarget)} />
          <StatCard label="Tổng doanh số thực tế" value={formatCurrency(totalActual)} accent="indigo" />
          <StatCard
            label="Tỷ lệ đạt KPI chung"
            value={totalTarget > 0 ? new Intl.NumberFormat("vi-VN", { style: "percent", maximumFractionDigits: 1 }).format(overallRate) : "Chưa có chỉ tiêu"}
            accent={overallRate >= 1 ? "emerald" : overallRate >= 0.7 ? "amber" : "rose"}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-2">Hiệu suất theo nhân viên (KPI vs thực tế)</h2>
            {employeeSummary.length === 0 ? (
              <p className="text-sm text-slate-400 py-12 text-center">Chưa có KPI nào được thiết lập cho tháng này</p>
            ) : (
              <EmployeeKpiChart data={employeeSummary} />
            )}
          </div>

          <div className={canEditKpi ? "rounded-xl border border-slate-200 bg-white p-4" : "hidden"}>
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Thiết lập KPI mới</h2>
            <form action={setKpiTarget} className="space-y-3">
              <input type="hidden" name="month" value={month} />
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nhân viên phụ trách</label>
                <select name="employeeId" required className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nhóm hàng</label>
                <select name="productGroupId" required className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
                  {productGroups.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">KPI doanh số (tự thiết lập)</label>
                <input
                  name="targetRevenue"
                  type="number"
                  min={0}
                  max={1_000_000_000_000}
                  step={1}
                  required
                  placeholder="VD: 200000"
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Lưu KPI
              </button>
              <p className="text-xs text-slate-400">
                Đặt lại KPI cho cùng nhân viên + nhóm hàng + tháng sẽ cập nhật chỉ tiêu hiện có.
              </p>
            </form>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Nhân viên phụ trách</th>
                <th className="text-left font-medium px-4 py-2.5">Nhóm hàng</th>
                <th className="text-right font-medium px-4 py-2.5">KPI doanh số</th>
                <th className="text-right font-medium px-4 py-2.5">Doanh số thực tế</th>
                <th className="text-left font-medium px-4 py-2.5">Tỷ lệ đạt KPI</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 text-slate-800 font-medium">{r.employeeName}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.productGroupName}</td>
                  <td className="px-4 py-2.5 text-right text-slate-700">{r.hasTarget ? formatCurrency(r.target) : <span className="text-amber-700">Chưa có chỉ tiêu</span>}</td>
                  <td className="px-4 py-2.5 text-right text-slate-900 font-medium">{formatCurrency(r.actual)}</td>
                  <td className="px-4 py-2.5">
                    {r.hasTarget && r.target > 0 ? <ProgressBar rate={r.rate} /> : <span className="text-xs text-slate-500">Chưa tính tỷ lệ</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {canEditKpi && r.hasTarget && (
                      <form action={deleteKpiTarget.bind(null, r.id)}>
                        <button type="submit" className="text-xs text-slate-400 hover:text-rose-600">
                          Xoá
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    Chưa có KPI nào được thiết lập cho tháng này
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
