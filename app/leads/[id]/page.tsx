import { notFound, redirect } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import ScoreBadge from "@/components/ScoreBadge";
import LeadForm from "@/components/leads/LeadForm";
import FitChecklist from "@/components/leads/FitChecklist";
import LeadConvertButton from "@/components/leads/LeadConvertButton";
import ActivityComposer from "@/components/deal/ActivityComposer";
import ActivityTimeline from "@/components/deal/ActivityTimeline";
import { getLeadDetail } from "@/lib/queries";
import { deleteLead } from "@/lib/lead-actions";
import { computeFit, fitBreakdown, type FitSubject } from "@/lib/scoring";
import { requireUser, canRead } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireUser();
  const { id } = await params;
  const { lead, provinces, sources, employees, config } = await getLeadDetail(id);
  if (!lead) notFound();
  if (!canRead(ctx, "lead", { employeeId: lead.employeeId })) redirect("/403");

  const subject: FitSubject = {
    phone: lead.phone,
    email: lead.email,
    companyName: lead.companyName,
    taxCode: lead.taxCode,
    title: lead.title,
    industry: lead.industry,
    provinceName: lead.province?.name ?? null,
    objective: lead.objective,
    partnerReferred: lead.partnerReferred,
    sourceName: lead.source?.name ?? null,
    campaign: lead.campaign,
  };
  const breakdown = fitBreakdown(subject, config.fitWeights);
  const fit = computeFit(subject, config.fitWeights);
  const converted = lead.status === "Đã chuyển đổi";

  return (
    <div>
      <PageHeader
        title={`🌱 ${lead.companyName || lead.name}`}
        subtitle={`${lead.code} · ${lead.name}`}
        actions={
          <div className="flex items-center gap-2">
            <LeadConvertButton
              leadId={lead.id}
              leadName={lead.companyName || lead.name}
              alreadyConverted={converted}
              customerId={lead.convertedCustomerId}
            />
            <form action={deleteLead.bind(null, lead.id)}>
              <button type="submit" className="btn btn-danger-outline btn-sm">
                Xoá
              </button>
            </form>
          </div>
        }
      />

      <div className="p-6 space-y-5">
        <div className="card card-pad flex flex-wrap items-center gap-x-8 gap-y-3">
          <div>
            <div className="text-[11px] text-slate-400">Nhãn</div>
            <ScoreBadge label={lead.label} grade={`${lead.fitGrade}${lead.engagementGrade}`} />
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Độ phù hợp</div>
            <div className="text-lg font-semibold text-slate-800 tabular-nums">
              {Math.round(lead.fitPercent)}% <span className="text-xs text-slate-400">hạng {lead.fitGrade}</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Mức tương tác</div>
            <div className="text-lg font-semibold text-slate-800 tabular-nums">
              {lead.engagementScore} <span className="text-xs text-slate-400">hạng {lead.engagementGrade}</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Trạng thái</div>
            <div className="text-sm font-medium text-slate-700">{lead.status}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2 space-y-5">
            <div className="card card-pad">
              <h2 className="section-title mb-3">Thông tin lead</h2>
              <LeadForm lead={lead} provinces={provinces} sources={sources} employees={employees} />
            </div>
            <ActivityComposer leadId={lead.id} employeeId={lead.employeeId} />
            <ActivityTimeline
              activities={lead.activities.map((a) => ({
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
          <div className="space-y-5">
            <FitChecklist items={breakdown} percent={fit.percent} score={fit.score} max={fit.maxScore} />
          </div>
        </div>
      </div>
    </div>
  );
}
