import PageHeader from "@/components/PageHeader";
import { getMasterData } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { createOrder } from "@/lib/actions";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function createOrderAndRedirect(formData: FormData) {
  "use server";
  await createOrder(formData);
  redirect("/sales");
}

export default async function NewOrderPage() {
  await requireUser();
  const [master, customers] = await Promise.all([
    getMasterData(),
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, code: true, name: true } }),
  ]);

  return (
    <div>
      <PageHeader title="+ Ghi nhận đơn hàng / tương tác bán hàng" />
      <div className="p-6 max-w-3xl">
        <form action={createOrderAndRedirect} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-xs font-medium text-slate-500 mb-1">
                Ngày <span className="text-rose-500">*</span>
              </span>
              <input type="date" name="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="input" />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-500 mb-1">Khách hàng</span>
              <select name="customerId" className="input">
                <option value="">-</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-500 mb-1">Nhân viên kinh doanh</span>
              <select name="employeeId" className="input">
                <option value="">-</option>
                {master.employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-500 mb-1">Nhóm sản phẩm quan tâm</span>
              <select name="productGroupId" className="input">
                <option value="">-</option>
                {master.productGroups.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-500 mb-1">Nguồn</span>
              <select name="sourceId" className="input">
                <option value="">-</option>
                {master.sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-500 mb-1">Tỉnh/thành phố</span>
              <select name="provinceId" className="input">
                <option value="">-</option>
                {master.provinces.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-500 mb-1">Trạng thái chăm sóc</span>
              <select name="careStatusId" className="input">
                <option value="">-</option>
                {master.careStatuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-500 mb-1">Tên cửa hàng</span>
              <input name="storeName" className="input" />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-500 mb-1">Địa chỉ cửa hàng</span>
              <input name="storeAddress" className="input" />
            </label>
          </div>
          <div className="flex items-center gap-4 rounded-lg bg-slate-50 p-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="isClosed" />
              Đơn hàng đã chốt
            </label>
            <label className="flex-1 flex items-center gap-2 text-sm text-slate-700">
              Giá trị đơn hàng
              <input name="value" type="number" min={0} step={1000} placeholder="VD: 45000" className="input" />
            </label>
          </div>
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Lưu giao dịch
          </button>
        </form>
      </div>
    </div>
  );
}
