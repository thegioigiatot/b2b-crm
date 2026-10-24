import DealBilling from "@/components/deal/DealBilling";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import ScoreBadge from "@/components/ScoreBadge";
import TaskStatusSelect from "@/components/TaskStatusSelect";
import DealStageBar from "@/components/deal/DealStageBar";
import DealHealthPanel from "@/components/deal/DealHealthPanel";
import DealWonLost from "@/components/deal/DealWonLost";
import DealOwnerSelect from "@/components/deal/DealOwnerSelect";
import FollowerControl from "@/components/deal/FollowerControl";
import ActivityComposer from "@/components/deal/ActivityComposer";
import ActivityTimeline from "@/components/deal/ActivityTimeline";
import DealContactSelect from "@/components/deal/DealContactSelect";
import { getDealDetail } from "@/lib/queries";
import { updateDeal, deleteDeal } from "@/lib/deal-actions";
import { createTask } from "@/lib/actions";
import { formatCurrency, formatDate, daysUntil } from "@/lib/format";
import { requireUser, canRead, hasPerm } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireUser();
  const { id } = await params;
  const { deal, stages, employees, customerContacts } = await getDealDetail(id);
  if (!deal) notFound();
  if (!canRead(ctx, "deal", { ownerId: deal.ownerId, followers: deal.followers.map((f) => ({ employeeId: f.employeeId })) })) {
    redirect("/403");
  }
  const privileged = hasPerm(ctx, "changeDealOwner");

  const stage = deal.stage;
  const baseWinRate = stage?.isWon ? 1 : stage?.isLost ? 0 : stage?.baseWinRate ?? 0.1;
  const wonRevenue = deal.orders.filter((o) => o.isClosed).reduce((s, o) => s + (o.value ?? 0), 0);
  const daysLeft = daysUntil(deal.expectedCloseDate);

  return (
    <div>
      <PageHeader
        title={`💲 ${deal.title}`}
        subtitle={
          <>
            {deal.customer ? (
              <Link href={`/customers/${deal.customerId}`} className="hover:underline">
                {deal.customer.name}
              </Link>
            ) : (
              <span className="text-slate-400">Chưa gắn công ty</span>
            )}{" "}
            · {deal.code}
          </>
        }
        actions={
          <form action={deleteDeal.bind(null, deal.id)}>
            <button type="submit" className="btn btn-danger-outline btn-sm">
              Xoá deal
            </button>
          </form>
        }
      />

      <div className="p-6 space-y-5">
        <DealBilling ctx={ctx} dealId={id} />
        {/* top summary */}
        <div className="card card-pad">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-2xl font-bold text-indigo-600 tabular-nums">{formatCurrency(deal.value)}</div>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={
                    deal.status === "Thắng"
                      ? "chip chip-green"
                      : deal.status === "Thua"
                        ? "chip chip-hot"
                        : "chip chip-neutral"
                  }
                >
                  {deal.status}
                </span>
                <ScoreBadge label={deal.label} />
              </div>
            </div>
            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-[11px] text-slate-400">Sở hữu</div>
                  {privileged ? (
                    <DealOwnerSelect
                      dealId={deal.id}
                      ownerId={deal.ownerId}
                      ownerName={deal.owner?.name ?? null}
                      employees={employees}
                    />
                  ) : (
                    <div className="text-sm font-medium text-slate-700">{deal.owner?.name ?? "Chưa gán"}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-400">Theo dõi</div>
                  <FollowerControl
                    dealId={deal.id}
                    followers={deal.followers.map((f) => ({ id: f.employeeId, name: f.employee.name }))}
                    employees={employees}
                  />
                </div>
              </div>
              <DealWonLost dealId={deal.id} status={deal.status} />
            </div>
          </div>
        </div>

        <DealStageBar dealId={deal.id} stages={stages} currentStageId={deal.stageId} status={deal.status} />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* left: health + edit + tasks */}
          <div className="space-y-5">
            <DealHealthPanel
              dealId={deal.id}
              probability={deal.probability}
              baseWinRate={baseWinRate}
              healthLabel={deal.healthLabel}
              forecastCategory={deal.forecastCategory}
              closeBucket={deal.closeBucket}
              daysLeft={daysLeft}
              status={deal.status}
            />

            <DealContactSelect
              dealId={deal.id}
              contactId={deal.contactId}
              contacts={customerContacts.map((c) => ({ id: c.id, name: c.name, title: c.title, phone: c.phone }))}
            />

            <details className="card card-pad">
              <summary className="section-title cursor-pointer">Chỉnh sửa thông tin</summary>
              <form action={updateDeal.bind(null, deal.id)} className="mt-3 space-y-3">
                <div>
                  <label className="field-label">Tên deal</label>
                  <input name="title" defaultValue={deal.title} className="input" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">Giá trị (đ)</label>
                    <input name="value" type="number" step={1000} defaultValue={deal.value ?? ""} className="input" />
                  </div>
                  <div>
                    <label className="field-label">Ngày chốt dự kiến</label>
                    <input
                      type="date"
                      name="expectedCloseDate"
                      defaultValue={deal.expectedCloseDate ? deal.expectedCloseDate.toISOString().slice(0, 10) : ""}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="field-label">Chiến dịch</label>
                    <input name="campaign" defaultValue={deal.campaign ?? ""} className="input" />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary btn-sm">
                  Lưu
                </button>
              </form>
            </details>

            <div className="card card-pad">
              <h2 className="section-title mb-3">Công việc</h2>
              <form action={createTask} className="flex flex-wrap gap-2 mb-3">
                <input type="hidden" name="dealId" value={deal.id} />
                {deal.ownerId && <input type="hidden" name="employeeId" value={deal.ownerId} />}
                <input name="title" required placeholder="Thêm việc cần làm…" className="input flex-1 min-w-[140px]" />
                <input type="date" name="dueDate" className="input" style={{ maxWidth: 150 }} />
                <button type="submit" className="btn btn-primary btn-sm">
                  Thêm
                </button>
              </form>
              {deal.tasks.length === 0 ? (
                <p className="text-sm text-slate-400 py-3 text-center">Chưa có công việc</p>
              ) : (
                <ul className="space-y-2">
                  {deal.tasks.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm"
                    >
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

            {deal.orders.length > 0 && (
              <div className="card card-pad">
                <h2 className="section-title mb-2">Đơn hàng gắn với deal</h2>
                <div className="text-sm text-slate-600">
                  {deal.orders.length} đơn · doanh thu {formatCurrency(wonRevenue)}
                </div>
              </div>
            )}
          </div>

          {/* right: composer + timeline */}
          <div className="xl:col-span-2 space-y-5">
            <ActivityComposer dealId={deal.id} employeeId={deal.ownerId} />
            <ActivityTimeline
              activities={deal.activities.map((a) => ({
                id: a.id,
                type: a.type,
                title: a.title,
                body: a.body,
                direction: a.direction,
                meta: a.meta,
                occurredAt: a.occurredAt.toISOString(),
                employeeName: a.employee?.name ?? null,
              }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
