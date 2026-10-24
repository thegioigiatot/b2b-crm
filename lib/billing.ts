import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { type AuthContext, canEdit, canRead } from "./auth";

export function money(value: unknown) {
  const n = Number(value);
  if (value === "" || value == null || !Number.isSafeInteger(n) || n < 0 || n > 1_000_000_000_000)
    throw new Error("Số tiền phải là số nguyên VND không âm, tối đa 1.000 tỷ.");
  return n;
}
export function dateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Ngày không hợp lệ.");
  const d = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(+d) || d.toISOString().slice(0, 10) !== value) throw new Error("Ngày không hợp lệ.");
  return d;
}
// Anchor every cycle to the original start; Jan 31 -> Feb 28 -> Mar 31.
export function cycleStart(anchor: Date, months: number) {
  const d = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(anchor.getUTCDate(), last));
  return d;
}
async function lockedDeal(tx: Prisma.TransactionClient, ctx: AuthContext, id: string) {
  await tx.$queryRaw`SELECT id FROM "Deal" WHERE id = ${id} FOR UPDATE`;
  const d = await tx.deal.findUnique({ where: { id }, include: { followers: true } });
  if (!d || !canEdit(ctx, d)) throw new Error("Không có quyền với deal này.");
  return d;
}
export async function openContract(ctx: AuthContext, input: {
  dealId: string; title: string; startsOn: string; endsOn?: string;
  cadenceMonths: number; agencyFee: number; mediaBudget: number; vatRate: number; productGroupId: string;
}) {
  const startsOn = dateOnly(input.startsOn);
  const endsOn = input.endsOn ? dateOnly(input.endsOn) : null;
  if (endsOn && endsOn <= startsOn) throw new Error("Ngày hết hạn phải sau ngày bắt đầu.");
  if (![0, 1, 3, 6, 12].includes(input.cadenceMonths)) throw new Error("Chu kỳ không hợp lệ.");
  if (!Number.isFinite(input.vatRate) || input.vatRate < 0 || input.vatRate > 100 || new Prisma.Decimal(input.vatRate).decimalPlaces() > 2) throw new Error("VAT không hợp lệ.");
  const agencyFee = money(input.agencyFee), mediaBudget = money(input.mediaBudget);
  if (!input.title.trim() || agencyFee + mediaBudget <= 0) throw new Error("Nhập tên và giá trị hợp đồng.");
  return prisma.$transaction(async tx => {
    const deal = await lockedDeal(tx, ctx, input.dealId);
    if (deal.status !== "Thắng" || !deal.customerId || !deal.ownerId) throw new Error("Deal phải Thắng, có khách hàng và người phụ trách.");
    const existing = await tx.serviceContract.findUnique({ where: { dealId: deal.id } });
    if (existing) return existing.id; // One contract per deal, including concurrent retries.
    if (!await tx.productGroup.findUnique({ where: { id: input.productGroupId } })) throw new Error("Chọn dịch vụ hợp lệ.");
    const legacy = await tx.order.findFirst({ where: { dealId: deal.id, paymentId: null, isClosed: true }, orderBy: { date: "desc" } });
    if (legacy && startsOn <= legacy.date) throw new Error("Đã có doanh số cũ. Kỳ mới phải bắt đầu sau giao dịch cũ để tránh tính trùng.");
    const c = await tx.serviceContract.create({ data: {
      dealId: deal.id, title: input.title.trim(), startsOn, endsOn,
      cadenceMonths: input.cadenceMonths, agencyFee, mediaBudget, vatRate: input.vatRate, productGroupId: input.productGroupId,
    } });
    return c.id;
  });
}
export async function issuePeriod(ctx: AuthContext, contractId: string, dueOn: string, expectedCycle: number) {
  const due = dateOnly(dueOn);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "ServiceContract" WHERE id = ${contractId} FOR UPDATE`;
    const c = await tx.serviceContract.findUnique({ where: { id: contractId }, include: { periods: { orderBy: { cycle: "desc" }, take: 1 } } });
    if (!c) throw new Error("Không tìm thấy hợp đồng.");
    const deal = await lockedDeal(tx, ctx, c.dealId);
    if (c.status !== "ACTIVE" || deal.status !== "Thắng") throw new Error("Hợp đồng/deal chưa hoạt động.");
    if (!Number.isSafeInteger(expectedCycle) || expectedCycle < 0) throw new Error("Kỳ không hợp lệ.");
    const prior = await tx.billingPeriod.findUnique({ where: { contractId_cycle: { contractId, cycle: expectedCycle } } });
    if (prior) return prior.id;
    const cycle = (c.periods[0]?.cycle ?? -1) + 1;
    if (expectedCycle !== cycle) throw new Error("Tải lại để lập kỳ tiếp theo.");
    if (!c.cadenceMonths && cycle > 0) throw new Error("Hợp đồng một lần đã lập kỳ thu.");
    const startsOn = cycleStart(c.startsOn, c.cadenceMonths * cycle);
    const endsOn = c.cadenceMonths ? cycleStart(c.startsOn, c.cadenceMonths * (cycle + 1)) : c.endsOn;
    if (c.endsOn && (startsOn >= c.endsOn || (endsOn && endsOn > c.endsOn))) throw new Error("Hợp đồng hết hạn; gia hạn trước khi lập kỳ tiếp theo.");
    if (due < startsOn) throw new Error("Hạn thu không được trước ngày bắt đầu kỳ.");
    const period = await tx.billingPeriod.create({ data: { contractId, cycle, startsOn, endsOn, dueOn: due, agencyFee: c.agencyFee, mediaBudget: c.mediaBudget, vatAmount: new Prisma.Decimal(c.agencyFee).mul(c.vatRate).div(100).toDecimalPlaces(0) } });
    return period.id;
  });
}
export async function collectPayment(ctx: AuthContext, input: { periodId: string; receiptKey: string; reference: string; paidOn: string; agencyAmount: number; mediaAmount: number; vatAmount: number }) {
  const agencyAmount = money(input.agencyAmount), mediaAmount = money(input.mediaAmount), vatAmount = money(input.vatAmount);
  const paidOn = dateOnly(input.paidOn);
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(input.receiptKey) || !input.reference.trim() || input.reference.length > 150 || agencyAmount + mediaAmount + vatAmount <= 0) throw new Error("Nhập mã phiếu, tham chiếu và số tiền thu hợp lệ.");
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "BillingPeriod" WHERE id = ${input.periodId} FOR UPDATE`;
    const period = await tx.billingPeriod.findUnique({ where: { id: input.periodId }, include: { contract: true, payments: true } });
    if (!period) throw new Error("Không tìm thấy kỳ thu.");
    const deal = await lockedDeal(tx, ctx, period.contract.dealId);
    const previous = await tx.servicePayment.findUnique({ where: { receiptKey: input.receiptKey } });
    if (previous) {
      if (previous.periodId !== input.periodId || +previous.agencyAmount !== agencyAmount || +previous.mediaAmount !== mediaAmount || +previous.vatAmount !== vatAmount || +previous.paidOn !== +paidOn || previous.reference !== input.reference.trim()) throw new Error("Mã phiếu đã dùng cho nội dung khác.");
      return previous.id;
    }
    if (period.payments.some(p => p.reference === input.reference.trim())) throw new Error("Tham chiếu đã ghi nhận trong kỳ này.");
    const sum = (key: "agencyAmount" | "mediaAmount" | "vatAmount") => period.payments.reduce((n, p) => n + Number(p[key]), 0);
    if (sum("agencyAmount") + agencyAmount > Number(period.agencyFee) || sum("mediaAmount") + mediaAmount > Number(period.mediaBudget) || sum("vatAmount") + vatAmount > Number(period.vatAmount)) throw new Error("Số thu vượt công nợ của phí dịch vụ, media hoặc VAT.");
    const payment = await tx.servicePayment.create({ data: { ...input, reference: input.reference.trim(), paidOn, agencyAmount, mediaAmount, vatAmount, createdBy: ctx.user.id } });
    // VAT and pass-through advertising money never increase sales/KPI.
    await tx.order.create({ data: { date: paidOn, customerId: deal.customerId, employeeId: deal.ownerId, dealId: deal.id, productGroupId: period.contract.productGroupId, paymentId: payment.id, bookingKey: `receipt:${input.receiptKey}`, isClosed: true, value: agencyAmount } });
    return payment.id;
  });
}
export async function changeContract(ctx: AuthContext, id: string, endsOn: string, status: string) {
  if (!["ACTIVE", "PAUSED", "CANCELLED"].includes(status)) throw new Error("Trạng thái không hợp lệ.");
  const end = dateOnly(endsOn);
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "ServiceContract" WHERE id = ${id} FOR UPDATE`;
    const c = await tx.serviceContract.findUnique({ where: { id }, include: { periods: { orderBy: { cycle: "desc" }, take: 1 } } });
    if (!c) throw new Error("Không tìm thấy hợp đồng.");
    await lockedDeal(tx, ctx, c.dealId);
    if (end <= c.startsOn || (c.periods[0]?.endsOn && end < c.periods[0].endsOn)) throw new Error("Ngày hết hạn không được cắt kỳ đã lập.");
    await tx.serviceContract.update({ where: { id }, data: { endsOn: end, status } });
  });
}
export async function billingForDeal(ctx: AuthContext, dealId: string) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId }, include: { followers: true } });
  if (!deal || !canRead(ctx, "deal", deal)) throw new Error("Không có quyền xem deal.");
  return prisma.serviceContract.findUnique({ where: { dealId }, include: { periods: { orderBy: { cycle: "desc" }, include: { payments: { orderBy: { paidOn: "desc" } } } } } });
}
