import Link from "next/link";
import ScoreBadge from "@/components/ScoreBadge";
import { initials } from "@/lib/format";

export type LeadCardData = {
  id: string;
  code: string;
  name: string;
  companyName: string | null;
  label: string;
  fitGrade: string;
  fitPercent: number;
  engagementGrade: number;
  employeeName: string | null;
  sourceName: string | null;
};

export default function LeadCard({ lead }: { lead: LeadCardData }) {
  return (
    <Link
      href={`/leads/${lead.id}`}
      className="block rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-indigo-300 hover:shadow-md transition"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-800 truncate">{lead.companyName || lead.name}</div>
          {lead.companyName && <div className="text-xs text-slate-500 truncate">{lead.name}</div>}
        </div>
        <ScoreBadge label={lead.label} grade={`${lead.fitGrade}${lead.engagementGrade}`} showIcon={false} />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
        <span>Fit {lead.fitPercent}%</span>
        {lead.sourceName && <span className="truncate max-w-[110px]">{lead.sourceName}</span>}
      </div>

      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500">
        {lead.employeeName ? (
          <>
            <span className="avatar" style={{ width: 16, height: 16, fontSize: 8 }}>
              {initials(lead.employeeName)}
            </span>
            <span className="truncate">{lead.employeeName}</span>
          </>
        ) : (
          <span className="text-amber-600">Chưa gán nhân viên</span>
        )}
      </div>
    </Link>
  );
}
