"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { rescoreLead, rescoreDeal } from "./scoring-actions";
import { nextCode } from "./codes";
import { requireUser, can, canDelete, hasPerm, isPrivileged, type AuthContext } from "./auth";

import { assertCustomerAccess } from "./record-access";

function str(v: FormDataEntryValue | null) {
  const s = (v ?? "").toString().trim();
  return s.length ? s : undefined;
}
function num(v: FormDataEntryValue | null) {
  const s = (v ?? "").toString().trim();
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function leadFields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    companyName: str(formData.get("companyName")) ?? null,
    phone: str(formData.get("phone")) ?? null,
    email: str(formData.get("email")) ?? null,
    title: str(formData.get("title")) ?? null,
    taxCode: str(formData.get("taxCode")) ?? null,
    industry: str(formData.get("industry")) ?? null,
    provinceId: str(formData.get("provinceId")) ?? null,
    sourceId: str(formData.get("sourceId")) ?? null,
    campaign: str(formData.get("campaign")) ?? null,
    objective: str(formData.get("objective")) ?? null,
    partnerReferred: formData.get("partnerReferred") === "on" || formData.get("partnerReferred") === "true",
    employeeId: str(formData.get("employeeId")) ?? null,
    notes: str(formData.get("notes")) ?? null,
  };
}

async function assertLeadWrite(ctx: AuthContext, leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { employeeId: true } });
  if (!lead) throw new Error("Không tìm thấy lead.");
  if (!can(ctx, "record:write", lead)) throw new Error("Bạn không có quyền trên lead này.");
  return lead;
}

export async function createLead(formData: FormData) {
  const ctx = await requireUser();
  const fields = leadFields(formData);
  if (!fields.name) return;
  // SALES luôn phụ trách lead mình tạo.
  if (!isPrivileged(ctx)) fields.employeeId = ctx.employee?.id ?? null;
  const lead = await prisma.lead.create({
    data: { code: await nextCode("lead"), status: str(formData.get("status")) ?? "Mới", ...fields },
  });
  await rescoreLead(lead.id);
  revalidatePath("/leads");
  redirect(`/leads/${lead.id}`);
}

export async function updateLead(id: string, formData: FormData) {
  const ctx = await requireUser();
  await assertLeadWrite(ctx, id);
  const fields = leadFields(formData);
  if (!isPrivileged(ctx)) delete (fields as Partial<typeof fields>).employeeId;
  await prisma.lead.update({ where: { id }, data: fields });
  await rescoreLead(id);
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
}

export async function setLeadStatus(id: string, status: string) {
  const ctx = await requireUser();
  await assertLeadWrite(ctx, id);
  await prisma.lead.update({ where: { id }, data: { status } });
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
}

export async function deleteLead(id: string) {
  const ctx = await requireUser();
  const lead = await assertLeadWrite(ctx, id);
  if (!canDelete(ctx, lead)) throw new Error("Bạn không có quyền xoá lead.");
  await prisma.lead.delete({ where: { id } });
  revalidatePath("/leads");
  redirect("/leads");
}

// Chuyển đổi Lead -> Customer (+ Contact) (+ tuỳ chọn mở Deal).
export async function convertLead(id: string, formData: FormData) {
  const ctx = await requireUser();
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return;
  if (!can(ctx, "record:write", lead)) throw new Error("Bạn không có quyền trên lead này.");
  if (!hasPerm(ctx, "convertLead")) throw new Error("Bạn không có quyền chuyển đổi lead.");
  if (lead.convertedCustomerId) redirect(`/customers/${lead.convertedCustomerId}`);

  let customer = lead.phone ? await prisma.customer.findFirst({ where: { phone: lead.phone } }) : null;
  if (customer) await assertCustomerAccess(ctx, customer.id, true);
  if (!customer) {
    const count = await prisma.customer.count();
    customer = await prisma.customer.create({
      data: {
        code: `KH${String(count + 1).padStart(4, "0")}`,
        name: lead.companyName || lead.name,
        phone: lead.phone,
        taxCode: lead.taxCode,
        industry: lead.industry,
        provinceId: lead.provinceId,
        sourceId: lead.sourceId,
        employeeId: lead.employeeId,
        isNew: true,
        latestContactDate: new Date(),
        notes: lead.objective ? `Mục tiêu: ${lead.objective}` : null,
      },
    });
  }

  // Người liên hệ từ lead.
  const contact = await prisma.contact.create({
    data: {
      name: lead.name,
      title: lead.title,
      phone: lead.phone,
      email: lead.email,
      customerId: customer.id,
    },
  });

  let dealId: string | null = null;
  if (formData.get("openDeal") === "on" || formData.get("openDeal") === "1") {
    const stage = await prisma.pipelineStage.findFirst({
      where: { isWon: false, isLost: false },
      orderBy: { sortOrder: "asc" },
    });
    if (stage) {
      const deal = await prisma.deal.create({
        data: {
          code: await nextCode("deal"),
          title: str(formData.get("dealTitle")) ?? `Deal ${lead.companyName || lead.name}`,
          value: num(formData.get("dealValue")) ?? null,
          customerId: customer.id,
          contactId: contact.id,
          ownerId: lead.employeeId ?? ctx.employee?.id ?? null,
          stageId: stage.id,
          sourceId: lead.sourceId,
          campaign: lead.campaign,
          stageEnteredAt: new Date(),
        },
      });
      dealId = deal.id;
      await prisma.activity.create({
        data: {
          dealId: deal.id,
          type: "deal_created",
          title: "Đã mở cơ hội bán (từ Lead)",
          employeeId: lead.employeeId ?? ctx.employee?.id ?? null,
        },
      });
      await prisma.activity.updateMany({ where: { leadId: id }, data: { dealId: deal.id, leadId: null } });
      await rescoreDeal(deal.id);
    }
  }

  await prisma.lead.update({
    where: { id },
    data: { status: "Đã chuyển đổi", convertedCustomerId: customer.id, convertedDealId: dealId },
  });

  revalidatePath("/leads");
  revalidatePath("/deals");
  revalidatePath("/customers");
  redirect(dealId ? `/deals/${dealId}` : `/customers/${customer.id}`);
}
