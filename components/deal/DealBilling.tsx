import ActionForm from "@/components/ActionForm";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { billingForDeal, cycleStart } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { type AuthContext, canEdit } from "@/lib/auth";
import { createServiceContract, createBillingPeriod, recordServicePayment, updateServiceContract } from "@/lib/billing-actions";
import { formatCurrency } from "@/lib/format";
const day = (d: Date) => d.toISOString().slice(0,10);
function Field({ name, label, value = 0, max }: { name: string; label: string; value?: number; max?: number }) {
  return <label className="text-xs text-slate-600">{label}<input className="input" name={name} type="number" min="0" max={max} step="1" required defaultValue={value} /></label>;
}
export default async function DealBilling({ ctx, dealId }: { ctx: AuthContext; dealId: string }) {
  const [contract, deal, products] = await Promise.all([
    billingForDeal(ctx, dealId), prisma.deal.findUniqueOrThrow({ where: { id: dealId }, include: { followers: true, orders: true } }), prisma.productGroup.findMany({ orderBy: { name: "asc" } }),
  ]);
  const editable = canEdit(ctx, deal);
  const today = day(new Date());
  const closed = deal.orders.filter(o => o.isClosed);
  return <section className="card card-pad space-y-4">
    <h2 className="font-semibold">Hợp đồng · Kỳ thu · Công nợ</h2>
    <p className="text-sm text-slate-500">Doanh số/KPI = phí dịch vụ đã thu. VAT trên phí dịch vụ và tiền media thu hộ được theo dõi riêng. Giá trị deal là dự kiến, chưa phải tiền đã thu.</p>
    {deal.status === "Thắng" && !closed.length && <p className="rounded bg-amber-50 p-3 text-amber-800">Deal thắng chưa ghi nhận doanh thu. Lập hợp đồng và phiếu thu bên dưới, hoặc <Link className="underline" href={`/sales/new?dealId=${dealId}`}>ghi nhận giao dịch một lần</Link>.</p>}
    {closed.length > 0 && <div className="text-sm">Đã ghi nhận {closed.length} giao dịch · Phí dịch vụ: <b>{formatCurrency(closed.reduce((s,o)=>s+(o.value??0),0))}</b></div>}
    {!contract && deal.status === "Thắng" && editable && <ActionForm action={createServiceContract} className="grid sm:grid-cols-3 gap-3">
      <input type="hidden" name="dealId" value={dealId}/>
      <label className="text-xs">Tên hợp đồng<input className="input" name="title" defaultValue={deal.title} required/></label>
      <label className="text-xs">Dịch vụ<select className="input" name="productGroupId" required><option value="">Chọn dịch vụ</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="text-xs">Chu kỳ<select className="input" name="cadenceMonths"><option value="0">Một lần</option>{[1,3,6,12].map(n=><option key={n} value={n}>{n} tháng</option>)}</select></label>
      <label className="text-xs">Bắt đầu<input className="input" name="startsOn" type="date" defaultValue={today} required/></label>
      <label className="text-xs">Hết hạn (không bao gồm ngày này)<input className="input" name="endsOn" type="date"/></label>
      <Field name="agencyFee" label="Phí dịch vụ mỗi kỳ (VND)"/>
      <Field name="mediaBudget" label="Tiền media mỗi kỳ (VND)"/>
      <label className="text-xs">VAT phí dịch vụ (%)<input className="input" name="vatRate" type="number" min="0" max="100" step="0.01" defaultValue="0" required/></label>
      <button className="btn btn-primary">Tạo hợp đồng</button>
    </ActionForm>}
    {contract && <>
      <p className="text-sm"><b>{contract.title}</b> · {contract.cadenceMonths ? `${contract.cadenceMonths} tháng/kỳ` : "Một lần"} · {contract.status} · {day(contract.startsOn)} → {contract.endsOn ? day(contract.endsOn) : "Chưa đặt hạn"}</p>
      <p className="text-sm">Mỗi kỳ: phí {formatCurrency(Number(contract.agencyFee))} · media {formatCurrency(Number(contract.mediaBudget))} · VAT {Number(contract.vatRate)}%</p>
      {editable && <ActionForm action={updateServiceContract} className="flex flex-wrap gap-2 items-end">
        <input type="hidden" name="contractId" value={contract.id}/>
        <label className="text-xs">Gia hạn đến<input type="date" name="endsOn" className="input" required defaultValue={contract.endsOn ? day(contract.endsOn) : ""}/></label>
        <label className="text-xs">Trạng thái<select name="status" className="input" defaultValue={contract.status}><option value="ACTIVE">Đang chạy</option><option value="PAUSED">Tạm dừng</option><option value="CANCELLED">Kết thúc</option></select></label>
        <button className="btn btn-ghost">Lưu gia hạn / trạng thái</button>
      </ActionForm>}
      {editable && contract.status === "ACTIVE" && (contract.cadenceMonths > 0 || !contract.periods.length) && <ActionForm action={createBillingPeriod} className="flex gap-2 items-end">
        <input type="hidden" name="contractId" value={contract.id}/><input type="hidden" name="cycle" value={contract.periods.length}/>
        <label className="text-xs">Hạn thu kỳ {contract.periods.length+1}<input className="input" type="date" name="dueOn" required defaultValue={day(cycleStart(contract.startsOn, contract.cadenceMonths*contract.periods.length))}/></label>
        <button className="btn btn-primary">Lập kỳ thu tiếp theo</button>
      </ActionForm>}
      {contract.periods.map(period=>{
        const sum=(key: "agencyAmount"|"mediaAmount"|"vatAmount")=>period.payments.reduce((s,p)=>s+Number(p[key]),0);
        const fee=Number(period.agencyFee)-sum("agencyAmount"), media=Number(period.mediaBudget)-sum("mediaAmount"), vat=Number(period.vatAmount)-sum("vatAmount");
        const debt=fee+media+vat;
        return <div key={period.id} className="rounded border border-slate-200 p-4 space-y-3">
          <h3 className="font-medium">Kỳ {period.cycle+1} · {day(period.startsOn)}{period.endsOn && ` → ${day(period.endsOn)}`} · Hạn {day(period.dueOn)}</h3>
          <p className={debt>0 && day(period.dueOn)<today ? "text-rose-600" : "text-slate-600"}>Còn phải thu: <b>{formatCurrency(debt)}</b> (phí {formatCurrency(fee)} · media {formatCurrency(media)} · VAT {formatCurrency(vat)}){debt===0 ? " · Đã thu đủ" : day(period.dueOn)<today ? " · Quá hạn" : ""}</p>
          <ul className="text-xs space-y-1">{period.payments.map(p=><li key={p.id}>{day(p.paidOn)} · {p.reference} · phí {formatCurrency(Number(p.agencyAmount))} · media {formatCurrency(Number(p.mediaAmount))} · VAT {formatCurrency(Number(p.vatAmount))}</li>)}</ul>
          {editable && debt>0 && <ActionForm action={recordServicePayment} className="grid sm:grid-cols-3 gap-2">
            <input type="hidden" name="periodId" value={period.id}/><input type="hidden" name="receiptKey" value={randomUUID()}/>
            <label className="text-xs">Ngày thu<input name="paidOn" type="date" className="input" defaultValue={today} required/></label>
            <label className="text-xs">Mã giao dịch ngân hàng / phiếu thu<input name="reference" className="input" maxLength={150} required/></label>
            <Field name="agencyAmount" label="Thu phí dịch vụ" max={fee}/><Field name="mediaAmount" label="Thu tiền media" max={media}/><Field name="vatAmount" label="Thu VAT" max={vat}/>
            <button className="btn btn-primary">Ghi phiếu thu</button>
          </ActionForm>}
        </div>;
      })}
    </>}
  </section>;
}
