"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { rescoreDeal } from "./scoring-actions";
import { nextCode } from "./codes";
import { requireUser, can, canDelete, hasPerm, isPrivileged, type AuthContext } from "./auth";

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

function revalidateDeal(id?: string) {
  revalidatePath("/deals");
  if (id) revalidatePath(`/deals/${id}`);
  revalidatePath("/");
}

async function firstOpenStageId() {
  const stage = await prisma.pipelineStage.findFirst({
    where: { isWon: false, isLost: false },
    orderBy: { sortOrder: "asc" },
  });
  return stage?.id;
}

// Nạp deal + kiểm quyền ghi; ném lỗi nếu không đủ quyền.
async function assertDealWrite(ctx: AuthContext, dealId: string) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { followers: { select: { employeeId: true } } },
  });
  if (!deal) throw new Error("Không tìm thấy deal.");
  if (!can(ctx, "record:write", deal)) throw new Error("Bạn không có quyền sửa deal này.");
  return deal;
}

// ---------- CRUD ----------
export async function createDeal(formData: FormData) {
  const ctx = await requireUser();
  const customerId = str(formData.get("customerId"));
  const contactId = str(formData.get("contactId"));
  const title = str(formData.get("title"));
  if (!title) return;
  const stageId = str(formData.get("stageId")) ?? (await firstOpenStageId());
  if (!stageId) throw new Error("Chưa có giai đoạn pipeline nào.");

  // SALES luôn sở hữu deal mình tạo; ADMIN/MANAGER được chọn.
  const ownerId = isPrivileged(ctx) ? (str(formData.get("ownerId")) ?? null) : (ctx.employee?.id ?? null);

  const deal = await prisma.deal.create({
    data: {
      code: await nextCode("deal"),
      title,
      value: num(formData.get("value")) ?? null,
      customerId: customerId ?? null,
      contactId: contactId ?? null,
      ownerId,
      stageId,
      sourceId: str(formData.get("sourceId")) ?? null,
      campaign: str(formData.get("campaign")) ?? null,
      forecastCategory: str(formData.get("forecastCategory")) ?? null,
      closeBucket: str(formData.get("closeBucket")) ?? null,
      expectedCloseDate: str(formData.get("expectedCloseDate"))
        ? new Date(String(formData.get("expectedCloseDate")))
        : null,
      stageEnteredAt: new Date(),
    },
  });
  await prisma.activity.create({
    data: { dealId: deal.id, type: "deal_created", title: "Đã mở cơ hội bán", employeeId: deal.ownerId },
  });
  await rescoreDeal(deal.id);
  revalidateDeal(deal.id);
  if (formData.get("redirect") === "1") redirect(`/deals/${deal.id}`);
}

export async function updateDeal(id: string, formData: FormData) {
  const ctx = await requireUser();
  await assertDealWrite(ctx, id);
  const data: Record<string, unknown> = {};
  const title = str(formData.get("title"));
  if (title) data.title = title;
  if (formData.has("value")) data.value = num(formData.get("value")) ?? null;
  if (formData.has("contactId")) data.contactId = str(formData.get("contactId")) ?? null;
  if (formData.has("customerId")) data.customerId = str(formData.get("customerId")) ?? null;
  if (formData.has("ownerId") && hasPerm(ctx, "changeDealOwner")) data.ownerId = str(formData.get("ownerId")) ?? null;
  if (formData.has("sourceId")) data.sourceId = str(formData.get("sourceId")) ?? null;
  if (formData.has("campaign")) data.campaign = str(formData.get("campaign")) ?? null;
  if (formData.has("expectedCloseDate")) {
    data.expectedCloseDate = str(formData.get("expectedCloseDate"))
      ? new Date(String(formData.get("expectedCloseDate")))
      : null;
  }
  await prisma.deal.update({ where: { id }, data });
  await rescoreDeal(id);
  revalidateDeal(id);
}

export async function deleteDeal(id: string) {
  const ctx = await requireUser();
  const deal = await assertDealWrite(ctx, id);
  if (!canDelete(ctx, deal)) throw new Error("Bạn không có quyền xoá deal.");
  await prisma.deal.delete({ where: { id } });
  revalidateDeal();
  redirect("/deals");
}

// ---------- di chuyển giai đoạn ----------
export async function moveDealStage(dealId: string, stageId: string) {
  const ctx = await requireUser();
  await assertDealWrite(ctx, dealId);
  const [deal, toStage] = await Promise.all([
    prisma.deal.findUnique({ where: { id: dealId }, include: { stage: true } }),
    prisma.pipelineStage.findUnique({ where: { id: stageId } }),
  ]);
  if (!deal || !toStage || deal.stageId === stageId) return;

  await prisma.deal.update({
    where: { id: dealId },
    data: {
      stageId,
      stageEnteredAt: new Date(),
      status: toStage.isWon ? "Thắng" : toStage.isLost ? "Thua" : "Đang mở",
      wonAt: toStage.isWon ? new Date() : deal.wonAt,
      lostAt: toStage.isLost ? new Date() : deal.lostAt,
    },
  });
  await prisma.activity.create({
    data: {
      dealId,
      type: "stage_change",
      title: `Chuyển giai đoạn: ${deal.stage?.name ?? "?"} → ${toStage.name}`,
      employeeId: ctx.employee?.id ?? null,
      meta: JSON.stringify({
        fromId: deal.stageId,
        fromName: deal.stage?.name ?? null,
        toId: stageId,
        toName: toStage.name,
      }),
    },
  });
  await rescoreDeal(dealId);
  revalidateDeal(dealId);
}

export async function markDealWon(dealId: string) {
  const ctx = await requireUser();
  await assertDealWrite(ctx, dealId);
  const stage = await prisma.pipelineStage.findFirst({ where: { isWon: true }, orderBy: { sortOrder: "asc" } });
  await prisma.deal.update({
    where: { id: dealId },
    data: { status: "Thắng", wonAt: new Date(), stageId: stage?.id, stageEnteredAt: new Date() },
  });
  await prisma.activity.create({
    data: { dealId, type: "won", title: "Đánh dấu Thắng", employeeId: ctx.employee?.id ?? null },
  });
  await rescoreDeal(dealId);
  revalidateDeal(dealId);
}

export async function markDealLost(dealId: string, formData: FormData) {
  const ctx = await requireUser();
  await assertDealWrite(ctx, dealId);
  const reason = str(formData.get("lostReason"));
  const stage = await prisma.pipelineStage.findFirst({ where: { isLost: true }, orderBy: { sortOrder: "asc" } });
  await prisma.deal.update({
    where: { id: dealId },
    data: {
      status: "Thua",
      lostAt: new Date(),
      lostReason: reason ?? null,
      stageId: stage?.id,
      stageEnteredAt: new Date(),
    },
  });
  await prisma.activity.create({
    data: { dealId, type: "lost", title: "Đánh dấu Thua", body: reason ?? null, employeeId: ctx.employee?.id ?? null },
  });
  await rescoreDeal(dealId);
  revalidateDeal(dealId);
}

export async function reopenDeal(dealId: string) {
  const ctx = await requireUser();
  await assertDealWrite(ctx, dealId);
  const stageId = await firstOpenStageId();
  await prisma.deal.update({
    where: { id: dealId },
    data: { status: "Đang mở", wonAt: null, lostAt: null, lostReason: null, stageId, stageEnteredAt: new Date() },
  });
  await rescoreDeal(dealId);
  revalidateDeal(dealId);
}

// ---------- dự báo / mốc về / sở hữu ----------
export async function setDealForecast(dealId: string, category: string) {
  const ctx = await requireUser();
  await assertDealWrite(ctx, dealId);
  await prisma.deal.update({ where: { id: dealId }, data: { forecastCategory: category || null } });
  revalidateDeal(dealId);
}

export async function setDealCloseBucket(dealId: string, bucket: string) {
  const ctx = await requireUser();
  await assertDealWrite(ctx, dealId);
  await prisma.deal.update({ where: { id: dealId }, data: { closeBucket: bucket || null } });
  revalidateDeal(dealId);
}

export async function setDealOwner(dealId: string, ownerId: string) {
  const ctx = await requireUser();
  if (!hasPerm(ctx, "changeDealOwner")) throw new Error("Bạn không có quyền đổi người sở hữu deal.");
  await prisma.deal.update({ where: { id: dealId }, data: { ownerId: ownerId || null } });
  revalidateDeal(dealId);
}

// ---------- người theo dõi ----------
export async function addFollower(dealId: string, employeeId: string) {
  const ctx = await requireUser();
  await assertDealWrite(ctx, dealId);
  if (!employeeId) return;
  await prisma.dealFollower.upsert({
    where: { dealId_employeeId: { dealId, employeeId } },
    create: { dealId, employeeId },
    update: {},
  });
  revalidateDeal(dealId);
}

export async function removeFollower(dealId: string, employeeId: string) {
  const ctx = await requireUser();
  await assertDealWrite(ctx, dealId);
  await prisma.dealFollower.delete({ where: { dealId_employeeId: { dealId, employeeId } } }).catch(() => {});
  revalidateDeal(dealId);
}

// ---------- hoạt động ----------
export async function addActivity(formData: FormData) {
  const ctx = await requireUser();
  const dealId = str(formData.get("dealId")) ?? null;
  const leadId = str(formData.get("leadId")) ?? null;
  const type = str(formData.get("type")) ?? "note";
  if (!dealId && !leadId) return;

  if (dealId) await assertDealWrite(ctx, dealId);
  if (leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { employeeId: true } });
    if (!lead || !can(ctx, "record:write", lead)) throw new Error("Bạn không có quyền trên lead này.");
  }

  const titleByType: Record<string, string> = {
    note: "Ghi chú",
    call: "Cuộc gọi",
    email: "Email",
    meeting: "Cuộc họp",
    checkin: "Check-in tại chỗ khách",
    document: "Tài liệu",
    quotation: "Đã gửi báo giá",
  };
  const title = str(formData.get("title")) ?? titleByType[type] ?? "Hoạt động";

  const meta: Record<string, unknown> = {};
  const link = str(formData.get("link"));
  if (link) meta.link = link;
  const lat = num(formData.get("lat"));
  const lng = num(formData.get("lng"));
  if (lat != null && lng != null) {
    meta.lat = lat;
    meta.lng = lng;
  }
  const qvalue = num(formData.get("quotationValue"));
  if (qvalue != null) meta.value = qvalue;

  await prisma.activity.create({
    data: {
      dealId,
      leadId,
      type,
      title,
      body: str(formData.get("body")) ?? null,
      direction: str(formData.get("direction")) ?? null,
      employeeId: ctx.employee?.id ?? str(formData.get("employeeId")) ?? null,
      meta: Object.keys(meta).length ? JSON.stringify(meta) : null,
      occurredAt: str(formData.get("occurredAt")) ? new Date(String(formData.get("occurredAt"))) : new Date(),
    },
  });

  if (dealId) {
    await rescoreDeal(dealId);
    revalidateDeal(dealId);
  }
  if (leadId) {
    const { rescoreLead } = await import("./scoring-actions");
    await rescoreLead(leadId);
    revalidatePath(`/leads/${leadId}`);
    revalidatePath("/leads");
  }
}

export async function deleteActivity(id: string) {
  const ctx = await requireUser();
  const act = await prisma.activity.findUnique({ where: { id } });
  if (!act) return;
  if (act.dealId) await assertDealWrite(ctx, act.dealId);
  if (act.leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: act.leadId }, select: { employeeId: true } });
    if (!lead || !can(ctx, "record:write", lead)) throw new Error("Không đủ quyền.");
  }
  await prisma.activity.delete({ where: { id } });
  if (act.dealId) {
    await rescoreDeal(act.dealId);
    revalidateDeal(act.dealId);
  }
  if (act.leadId) {
    const { rescoreLead } = await import("./scoring-actions");
    await rescoreLead(act.leadId);
    revalidatePath(`/leads/${act.leadId}`);
  }
}

// ---------- Contact ----------
export async function createContact(formData: FormData) {
  await requireUser();
  const name = str(formData.get("name"));
  if (!name) return;
  await prisma.contact.create({
    data: {
      name,
      title: str(formData.get("title")) ?? null,
      phone: str(formData.get("phone")) ?? null,
      email: str(formData.get("email")) ?? null,
      customerId: str(formData.get("customerId")) ?? null,
    },
  });
  const cid = str(formData.get("customerId"));
  if (cid) revalidatePath(`/customers/${cid}`);
}

export async function updateContact(id: string, formData: FormData) {
  await requireUser();
  await prisma.contact.update({
    where: { id },
    data: {
      name: str(formData.get("name")) ?? undefined,
      title: str(formData.get("title")) ?? null,
      phone: str(formData.get("phone")) ?? null,
      email: str(formData.get("email")) ?? null,
    },
  });
  const cid = str(formData.get("customerId"));
  if (cid) revalidatePath(`/customers/${cid}`);
}

export async function deleteContact(id: string, customerId?: string) {
  await requireUser();
  await prisma.contact.delete({ where: { id } });
  if (customerId) revalidatePath(`/customers/${customerId}`);
}

export async function setDealContact(dealId: string, contactId: string) {
  const ctx = await requireUser();
  await assertDealWrite(ctx, dealId);
  await prisma.deal.update({ where: { id: dealId }, data: { contactId: contactId || null } });
  revalidateDeal(dealId);
}
