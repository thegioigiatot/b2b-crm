"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { openContract, issuePeriod, collectPayment, changeContract } from "./billing";
const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
async function result(work: () => Promise<unknown>) {
  try { await work(); refresh(); return { ok: true }; }
  catch (error) {
    if (error instanceof Error && error.message.startsWith("NEXT_REDIRECT")) throw error;
    return { error: error instanceof Error && !("code" in error) ? error.message : "Không lưu được. Tải lại trang và kiểm tra giao dịch trước khi thử lại." };
  }
}
function refresh() { for (const p of ["/deals", "/sales", "/kpi", "/"]) revalidatePath(p, "layout"); }
export async function createServiceContract(f: FormData) {
  const ctx = await requireUser();
  return result(() => openContract(ctx, { dealId: text(f,"dealId"), title: text(f,"title"), startsOn: text(f,"startsOn"), endsOn: text(f,"endsOn"), cadenceMonths: Number(text(f,"cadenceMonths")), agencyFee: Number(text(f,"agencyFee")), mediaBudget: Number(text(f,"mediaBudget")), vatRate: Number(text(f,"vatRate")), productGroupId: text(f,"productGroupId") }));
}
export async function createBillingPeriod(f: FormData) {
  const ctx = await requireUser();
  return result(() => issuePeriod(ctx, text(f,"contractId"), text(f,"dueOn"), Number(text(f,"cycle"))));
}
export async function recordServicePayment(f: FormData) {
  const ctx = await requireUser();
  return result(() => collectPayment(ctx, { periodId: text(f,"periodId"), receiptKey: text(f,"receiptKey"), reference: text(f,"reference"), paidOn: text(f,"paidOn"), agencyAmount: Number(text(f,"agencyAmount")), mediaAmount: Number(text(f,"mediaAmount")), vatAmount: Number(text(f,"vatAmount")) }));
}
export async function updateServiceContract(f: FormData) {
  const ctx = await requireUser();
  return result(() => changeContract(ctx, text(f,"contractId"), text(f,"endsOn"), text(f,"status")));
}
