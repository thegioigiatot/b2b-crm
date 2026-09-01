import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { getCustomers, getMasterData } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statusId?: string; employeeId?: string; provinceId?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const [customers, master] = await Promise.all([getCustomers(sp), getMasterData()]);

  return (
    <div>
      <PageHeader
        title="👥 Khách hàng"
        subtitle={`${customers.length} khách hàng`}
        actions={
          <Link
            href="/customers/new"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + Thêm khách hàng
          </Link>
        }
      />
      <div className="p-6 space-y-4">
        <form className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <input
            name="q"
            defaultValue={sp.q}
            placeholder="Tìm theo tên, mã KH, SĐT..."
            className="flex-1 min-w-[180px] rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
          />
          <select name="statusId" defaultValue={sp.statusId ?? ""} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            <option value="">Tất cả trạng thái</option>
            {master.careStatuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
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
          <select name="provinceId" defaultValue={sp.provinceId ?? ""} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
            <option value="">Tất cả tỉnh/thành</option>
            {master.provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
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
                <th className="text-left font-medium px-4 py-2.5">Mã KH</th>
                <th className="text-left font-medium px-4 py-2.5">Tên khách hàng</th>
                <th className="text-left font-medium px-4 py-2.5">SĐT</th>
                <th className="text-left font-medium px-4 py-2.5">Tỉnh/Thành</th>
                <th className="text-left font-medium px-4 py-2.5">Nhân viên phụ trách</th>
                <th className="text-left font-medium px-4 py-2.5">Trạng thái</th>
                <th className="text-left font-medium px-4 py-2.5">Liên hệ gần nhất</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/customers/${c.id}`} className="text-indigo-600 font-medium hover:underline">
                      {c.code}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-800">{c.name}</td>
                  <td className="px-4 py-2.5 text-slate-500">{c.phone ?? "-"}</td>
                  <td className="px-4 py-2.5 text-slate-500">{c.province?.name ?? "-"}</td>
                  <td className="px-4 py-2.5 text-slate-500">{c.employee?.name ?? "-"}</td>
                  <td className="px-4 py-2.5">
                    {c.careStatus ? (
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: `${c.careStatus.color}22`, color: c.careStatus.color ?? undefined }}
                      >
                        {c.careStatus.name}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{formatDate(c.latestContactDate)}</td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    Không tìm thấy khách hàng nào
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
