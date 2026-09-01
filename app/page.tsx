import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import MonthPicker from "@/components/MonthPicker";
import RevenueVsKpiChart from "@/components/charts/RevenueVsKpiChart";
import StatusFunnelChart from "@/components/charts/StatusFunnelChart";
import SimpleBarChart from "@/components/charts/SimpleBarChart";
import { getAvailableMonths, getDashboardData, getDealSnapshot, getLeadSnapshot, getMyAlerts } from "@/lib/queries";
import { formatCurrency, formatDate, formatNumber, formatPercent, monthValue } from "@/lib/format";
import { requireUser, hasPerm } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const ctx = await requireUser();
  const scopeToMe = !hasPerm(ctx, "viewAllDashboard");
  const viewer = scopeToMe ? ctx : undefined;
  const sp = await searchParams;
  const months = await getAvailableMonths();
  const currentMonth = monthValue(new Date());
  const month = sp.month && months.includes(sp.month) ? sp.month : months.includes(currentMonth) ? currentMonth : months.at(-1)!;
  const [data, dealSnap, leadSnap, alerts] = await Promise.all([
    getDashboardData(month),
    getDealSnapshot(viewer),
    getLeadSnapshot(viewer),
    getMyAlerts(ctx),
  ]);

  const t = data.totals;
  const kpiRate = t.kpiTarget > 0 ? t.revenue / t.kpiTarget : null;

  return (
    <div>
      <PageHeader
        title="📊 Tổng quan bán hàng"
        subtitle="Công ty cổ phần ABC"
        actions={<MonthPicker months={months} current={month} />}
      />
      <div className="p-6 space-y-6">
        {alerts.total > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
              🔔 Cần chú ý ({alerts.total})
            </div>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div>
                <span className="font-semibold text-amber-800">{alerts.deals.length}</span> deal quá hạn chốt
                {alerts.deals.slice(0, 3).map((d) => (
                  <Link key={d.id} href={`/deals/${d.id}`} className="block text-xs text-amber-700 hover:underline truncate">
                    · {d.title}
                  </Link>
                ))}
              </div>
              <div>
                <span className="font-semibold text-amber-800">{alerts.tasks.length}</span> việc quá hạn
                {alerts.tasks.slice(0, 3).map((t2) => (
                  <span key={t2.id} className="block text-xs text-amber-700 truncate">
                    · {t2.title}
                  </span>
                ))}
              </div>
              <div>
                <span className="font-semibold text-amber-800">{alerts.leads.length}</span> lead đủ điều kiện đang nguội
                {alerts.leads.slice(0, 3).map((l) => (
                  <Link key={l.id} href={`/leads/${l.id}`} className="block text-xs text-amber-700 hover:underline truncate">
                    · {l.companyName ?? l.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard label="Tổng khách hàng" value={formatNumber(t.totalCustomers)} accent="indigo" />
          <StatCard label="KH mới trong tháng" value={formatNumber(t.newCustomersThisMonth)} accent="emerald" />
          <StatCard label="Khách hàng cũ" value={formatNumber(t.oldCustomers)} />
          <StatCard label="Số đơn tương tác" value={formatNumber(t.orderCount)} hint={`${formatNumber(t.closedCount)} đã chốt`} />
          <StatCard label="Doanh thu tháng" value={formatCurrency(t.revenue)} accent="indigo" />
          <StatCard
            label="Tỷ lệ đạt KPI"
            value={kpiRate == null ? "-" : formatPercent(kpiRate)}
            hint={t.kpiTarget ? `Mục tiêu ${formatCurrency(t.kpiTarget)}` : "Chưa thiết lập KPI"}
            accent={kpiRate == null ? "slate" : kpiRate >= 1 ? "emerald" : kpiRate >= 0.7 ? "amber" : "rose"}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard label="Deal đang mở" value={formatNumber(dealSnap.openCount)} accent="indigo" />
          <StatCard label="Giá trị deal đang mở" value={formatCurrency(dealSnap.openValue)} />
          <StatCard label="Dự báo có trọng số" value={formatCurrency(dealSnap.weightedValue)} accent="amber" />
          <StatCard
            label="Deal đã thắng"
            value={formatNumber(dealSnap.wonCount)}
            hint={formatCurrency(dealSnap.wonValue)}
            accent="emerald"
          />
          <StatCard label="Tổng lead" value={formatNumber(leadSnap.total)} />
          <StatCard label="Lead Nóng" value={formatNumber(leadSnap.hot)} accent="rose" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-2">Phễu Sale Pipeline (deal đang mở)</h2>
            {dealSnap.funnel.length === 0 || dealSnap.funnel.every((f) => f.count === 0) ? (
              <p className="text-sm text-slate-400 py-10 text-center">Chưa có deal nào</p>
            ) : (
              <SimpleBarChart
                data={dealSnap.funnel.map((f) => ({ name: f.name, value: f.value, count: f.count }))}
                dataKey="value"
                horizontal
              />
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-2">Lead theo nhãn</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {(["Nóng", "Ấm", "Nguội"] as const).map((l) => (
                <li key={l} className="flex items-center justify-between">
                  <span className="text-slate-600">{l}</span>
                  <span className="font-semibold text-slate-900 tabular-nums">{leadSnap.byLabel[l] ?? 0}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-2">Kết quả deal</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span className="text-slate-600">Đã thắng</span>
                <span className="font-semibold text-emerald-600 tabular-nums">{dealSnap.wonCount}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-slate-600">Đã thua</span>
                <span className="font-semibold text-rose-600 tabular-nums">{dealSnap.lostCount}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-slate-600">Đang mở</span>
                <span className="font-semibold text-slate-900 tabular-nums">{dealSnap.openCount}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-2">Doanh thu thực tế so với KPI theo tháng</h2>
            <RevenueVsKpiChart data={data.revenueVsKpiByMonth} />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-2">Số khách hàng theo trạng thái chăm sóc</h2>
            <StatusFunnelChart data={data.customersByStatus} />
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">🏆 Top nhân viên bán hàng trong tháng</h2>
            {data.topSales.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">Chưa có dữ liệu bán hàng</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                    <th className="py-1.5 font-medium">Top</th>
                    <th className="py-1.5 font-medium">Nhân viên</th>
                    <th className="py-1.5 font-medium text-right">SL</th>
                    <th className="py-1.5 font-medium text-right">Doanh thu</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topSales.map((s, i) => (
                    <tr key={s.name} className="border-b border-slate-50 last:border-0">
                      <td className="py-1.5">{["🥇", "🥈", "🥉"][i] ?? i + 1}</td>
                      <td className="py-1.5 text-slate-700">{s.name}</td>
                      <td className="py-1.5 text-right text-slate-600">{s.qty}</td>
                      <td className="py-1.5 text-right font-medium text-slate-900">{formatCurrency(s.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-2">Doanh thu theo nhóm sản phẩm</h2>
            <SimpleBarChart data={data.revenueByProduct} />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-2">Lượt tương tác theo nguồn</h2>
            <SimpleBarChart data={data.interactionsBySource} dataKey="count" valueType="count" horizontal />
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-2">Doanh thu theo Tỉnh/Thành phố</h2>
            <SimpleBarChart data={data.revenueByProvince} horizontal />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">🎂 Sinh nhật khách hàng tháng này</h2>
            {data.birthdays.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">Không có khách hàng nào</p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-auto pr-1">
                {data.birthdays.map((c) => (
                  <li key={c.id}>
                    <Link href={`/customers/${c.id}`} className="flex items-center justify-between text-sm hover:bg-slate-50 rounded px-1.5 py-1 -mx-1.5">
                      <span className="text-slate-700">
                        {c.code} · {c.name}
                      </span>
                      <span className="text-slate-400 text-xs">{formatDate(c.dob)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
