import PageHeader from "@/components/PageHeader";
import CustomerForm from "@/components/CustomerForm";
import { getMasterData } from "@/lib/queries";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  await requireUser();
  const master = await getMasterData();
  return (
    <div>
      <PageHeader title="+ Thêm khách hàng mới" />
      <div className="p-6 max-w-3xl">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <CustomerForm master={master} />
        </div>
      </div>
    </div>
  );
}
