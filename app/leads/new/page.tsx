import PageHeader from "@/components/PageHeader";
import LeadForm from "@/components/leads/LeadForm";
import { getMasterData } from "@/lib/queries";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewLeadPage() {
  await requireUser();
  const master = await getMasterData();
  return (
    <div>
      <PageHeader title="+ Thêm lead mới" subtitle="Khai càng đủ thông tin, điểm độ phù hợp càng chính xác" />
      <div className="p-6 max-w-3xl">
        <div className="card card-pad">
          <LeadForm provinces={master.provinces} sources={master.sources} employees={master.employees} />
        </div>
      </div>
    </div>
  );
}
