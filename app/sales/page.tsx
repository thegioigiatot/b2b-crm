import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { getOrders, getMasterData, getAvailableMonths } from "@/lib/queries";
import { formatCurrency, formatDate, monthLabel } from "@/lib/format";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; employeeId?: string; productGroupId?: string; statusId?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const [orders, master, months] = await Promise.all([getOrders(sp), getMasterData(), getAvailableMonths()]);
  const totalRevenue = orders.filter((o) => o.isClosed).reduce((s, o) => s + (o.value ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="💰 Doanh số bán hàng"
        subtitle={`${orders.length} giao dịch · Doanh thu ${formatCurrency(totalRevenue)}`}
        actions={
          <Link href="/sales/new" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
            + Ghi nhận đơn hàng
          </Link>
        }
      />
      <div className="p-6 space-y-4">
        <form className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <select name="month" defaultValue={sp.month ?? ""} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            <option value="">Tất cả các tháng</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
          <select name="employeeId" defaultValue={sp.employeeId ?? ""} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            <option value="">Tất cả nhân viên</option>
            {master.employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <select name="productGroupId" defaultValue={sp.productGroupId ?? ""} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            <option value="">Tất cả nhóm hàng</option>
            {master.productGroups.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select name="statusId" defaultValue={sp.statusId ?? ""} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            <option value="">Tất cả trạng thái</option>
            {master.careStatuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
            Lọc
          </button>
        </form>

        <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Ngày</th>
                <th className="text-left font-medium px-4 py-2.5">Khách hàng</th>
                <th className="text-left font-medium px-4 py-2.5">Nhóm hàng</th>
                <th className="text-left font-medium px-4 py-2.5">Nhân viên</th>
                <th className="text-left font-medium px-4 py-2.5">Tỉnh/thành</th>
                <th className="text-left font-medium px-4 py-2.5">Trạng thái</th>
                <th className="text-right font-medium px-4 py-2.5">Giá trị</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-600">{formatDate(o.date)}</td>
                  <td className="px-4 py-2.5">
                    {o.customer ? (
                      <Link href={`/customers/${o.customer.id}`} className="text-indigo-600 hover:underline">
                        {o.customer.name}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{o.productGroup?.name ?? "-"}</td>
                  <td className="px-4 py-2.5 text-slate-500">{o.employee?.name ?? "-"}</td>
                  <td className="px-4 py-2.5 text-slate-500">{o.province?.name ?? "-"}</td>
                  <td className="px-4 py-2.5 text-slate-500">{o.careStatus?.name ?? "-"}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-900">{o.isClosed ? formatCurrency(o.value) : "-"}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    Không có giao dịch nào
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
