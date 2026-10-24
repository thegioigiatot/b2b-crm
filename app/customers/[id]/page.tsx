import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import CustomerForm from "@/components/CustomerForm";
import { getCustomerDetail, getMasterData } from "@/lib/queries";
import { addCareLog, createTask, deleteOrder } from "@/lib/actions";
import { createContact, deleteContact } from "@/lib/deal-actions";
import TaskStatusSelect from "@/components/TaskStatusSelect";
import { formatCurrency, formatDate } from "@/lib/format";
import ActionForm from "@/components/ActionForm";
import { deleteCustomerForm } from "@/lib/customer-form-actions";
import { requireUser, canDelete } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireUser();
  const { id } = await params;
  const [customer, master] = await Promise.all([getCustomerDetail(id), getMasterData()]);
  if (!customer) notFound();

  const totalOrders = customer.orders.length;
  const closedOrders = customer.orders.filter((o) => o.isClosed);
  const totalValue = closedOrders.reduce((s, o) => s + (o.value ?? 0), 0);

  return (
    <div>
      <PageHeader
        title={`${customer.code} · ${customer.name}`}
        subtitle={customer.careStatus?.name ?? "Chưa có trạng thái"}
        actions={
          canDelete(ctx, customer) ? <details className="text-sm">
            <summary className="cursor-pointer text-rose-600">Xoá khách hàng</summary>
            <ActionForm action={deleteCustomerForm.bind(null, customer.id)} className="mt-2 space-y-2 max-w-xs">
              <p>Chỉ xoá hồ sơ trống, chưa có dữ liệu liên quan. Nhập mã {customer.code} để xác nhận.</p>
              <input name="confirmedCode" required className="input" placeholder="Mã khách hàng xác nhận xoá" />
              <button type="submit" className="btn btn-danger-outline">Xác nhận xoá khách hàng</button>
            </ActionForm>
          </details> : undefined
        }
      />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">Tổng số đơn hàng</div>
            <div className="text-xl font-semibold mt-1">{totalOrders}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">Đơn hàng đã chốt</div>
            <div className="text-xl font-semibold mt-1">{closedOrders.length}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">Giá trị đơn hàng</div>
            <div className="text-xl font-semibold mt-1 text-indigo-600">{formatCurrency(totalValue)}</div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Người liên hệ</h2>
          <form action={createContact} className="flex flex-wrap gap-2 mb-3">
            <input type="hidden" name="customerId" value={customer.id} />
            <input name="name" required placeholder="Họ tên *" className="input" style={{ maxWidth: 180 }} />
            <input name="title" placeholder="Chức danh" className="input" style={{ maxWidth: 150 }} />
            <input name="phone" placeholder="SĐT" className="input" style={{ maxWidth: 130 }} />
            <input name="email" placeholder="Email" className="input" style={{ maxWidth: 170 }} />
            <button type="submit" className="btn btn-primary btn-sm">
              Thêm
            </button>
          </form>
          {customer.contacts.length === 0 ? (
            <p className="text-sm text-slate-400 py-2 text-center">Chưa có người liên hệ</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {customer.contacts.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    <span className="font-medium text-slate-800">{c.name}</span>
                    <span className="text-xs text-slate-400">
                      {c.title ? ` · ${c.title}` : ""}
                      {c.phone ? ` · ${c.phone}` : ""}
                      {c.email ? ` · ${c.email}` : ""}
                    </span>
                  </span>
                  {canDelete(ctx, customer) && c._count.deals === 0 && <form action={deleteContact.bind(null, c.id, customer.id)}>
                    <button type="submit" className="text-xs text-slate-400 hover:text-rose-600">
                      Xoá
                    </button>
                  </form>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-800">Deals</h2>
            <Link href={`/deals?new=1&customerId=${customer.id}`} className="btn btn-primary btn-sm">
              + Mở deal
            </Link>
          </div>
          {customer.leads.length > 0 && (
            <p className="mb-2 text-xs text-slate-400">
              Chuyển đổi từ lead: {customer.leads.map((l) => l.code).join(", ")}
            </p>
          )}
          {customer.deals.length === 0 ? (
            <p className="text-sm text-slate-400 py-3 text-center">Chưa có deal nào</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {customer.deals.map((d) => (
                <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                  <Link href={`/deals/${d.id}`} className="text-indigo-600 hover:underline">
                    {d.title}
                  </Link>
                  <span className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{d.stage?.name}</span>
                    <span className="tabular-nums">{formatCurrency(d.value)}</span>
                    <span
                      className={
                        d.status === "Thắng"
                          ? "chip chip-green"
                          : d.status === "Thua"
                            ? "chip chip-hot"
                            : "chip chip-neutral"
                      }
                    >
                      {d.status}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Thông tin khách hàng</h2>
            <CustomerForm customer={customer} master={master} />
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-800 mb-3">Thêm lịch sử chăm sóc</h2>
              <form action={addCareLog} className="space-y-3">
                <input type="hidden" name="customerId" value={customer.id} />
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Ngày liên hệ</label>
                  <input type="date" name="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Ngày / Nội dung trao đổi</label>
                  <textarea name="content" rows={2} className="input" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Phản hồi / Góp ý / Vấn đề</label>
                  <textarea name="feedback" rows={2} className="input" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Phương án xử lý</label>
                  <textarea name="resolution" rows={2} className="input" />
                </div>
                <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                  Lưu lịch sử chăm sóc
                </button>
              </form>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-800 mb-3">Lịch sử chăm sóc khách hàng</h2>
              {customer.careLogs.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Chưa có lịch sử chăm sóc</p>
              ) : (
                <ul className="space-y-3 max-h-96 overflow-auto pr-1">
                  {customer.careLogs.map((log) => (
                    <li key={log.id} className="border-l-2 border-indigo-200 pl-3 text-sm">
                      <div className="text-xs text-slate-400">{formatDate(log.date)}</div>
                      {log.content && <div className="text-slate-700 whitespace-pre-line">{log.content}</div>}
                      {log.feedback && <div className="text-slate-500 whitespace-pre-line">Phản hồi: {log.feedback}</div>}
                      {log.resolution && <div className="text-slate-500 whitespace-pre-line">Xử lý: {log.resolution}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-800 mb-3">Công việc trên Sale Pipeline</h2>
              <form action={createTask} className="flex flex-wrap gap-2 mb-3">
                <input type="hidden" name="customerId" value={customer.id} />
                {customer.employeeId && <input type="hidden" name="employeeId" value={customer.employeeId} />}
                <input name="title" required placeholder="Thêm việc cần làm..." className="input flex-1 min-w-[140px]" />
                <input type="date" name="dueDate" className="input" style={{ maxWidth: 150 }} />
                <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 whitespace-nowrap">
                  Thêm
                </button>
              </form>
              {!customer.employeeId && (
                <p className="text-xs text-amber-600 mb-2">Khách hàng chưa có nhân viên phụ trách — hãy gán trước khi giao việc.</p>
              )}
              {customer.tasks.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Chưa có công việc nào</p>
              ) : (
                <ul className="space-y-2 max-h-72 overflow-auto pr-1">
                  {customer.tasks.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm">
                      <div>
                        <div className="text-slate-700">{t.title}</div>
                        <div className="text-xs text-slate-400">
                          {t.employee?.name ?? "-"} {t.dueDate && `· Hạn ${formatDate(t.dueDate)}`}
                        </div>
                      </div>
                      <TaskStatusSelect taskId={t.id} status={t.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <h2 className="text-sm font-semibold text-slate-800 px-5 pt-4 pb-2">Lịch sử đơn hàng / doanh số</h2>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Ngày</th>
                <th className="text-left font-medium px-4 py-2.5">Nhóm hàng</th>
                <th className="text-left font-medium px-4 py-2.5">Nhân viên</th>
                <th className="text-left font-medium px-4 py-2.5">Trạng thái</th>
                <th className="text-right font-medium px-4 py-2.5">Giá trị</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {customer.orders.map((o) => (
                <tr key={o.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 text-slate-600">{formatDate(o.date)}</td>
                  <td className="px-4 py-2.5 text-slate-700">{o.productGroup?.name ?? "-"}</td>
                  <td className="px-4 py-2.5 text-slate-500">{o.employee?.name ?? "-"}</td>
                  <td className="px-4 py-2.5 text-slate-500">{o.careStatus?.name ?? "-"}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-900">{o.isClosed ? formatCurrency(o.value) : "-"}</td>
                  <td className="px-4 py-2.5 text-right">
                    {canDelete(ctx, o) && !o.paymentId && <form action={deleteOrder.bind(null, o.id)}>
                      <button type="submit" className="text-xs text-slate-400 hover:text-rose-600">
                        Xoá
                      </button>
                    </form>}
                  </td>
                </tr>
              ))}
              {customer.orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Chưa có đơn hàng nào
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
