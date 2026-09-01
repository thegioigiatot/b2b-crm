"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { requireUser, requirePerm, can, canDelete, isPrivileged } from "./auth";

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

// ---------- KPI ----------
export async function setKpiTarget(formData: FormData) {
  await requirePerm("manageKpi");
  const employeeId = String(formData.get("employeeId"));
  const month = String(formData.get("month")); // yyyy-mm
  const productGroupId = String(formData.get("productGroupId"));
  const targetRevenue = num(formData.get("targetRevenue")) ?? 0;
  const [y, m] = month.split("-").map(Number);
  const monthDate = new Date(y, m - 1, 1);

  await prisma.kpiTarget.upsert({
    where: { employeeId_month_productGroupId: { employeeId, month: monthDate, productGroupId } },
    create: { employeeId, month: monthDate, productGroupId, targetRevenue },
    update: { targetRevenue },
  });
  revalidatePath("/kpi");
  revalidatePath("/");
}

export async function deleteKpiTarget(id: string) {
  await requirePerm("manageKpi");
  await prisma.kpiTarget.delete({ where: { id } });
  revalidatePath("/kpi");
  revalidatePath("/");
}

// ---------- Customers ----------
export async function upsertCustomer(formData: FormData) {
  await requireUser();
  const id = str(formData.get("id"));
  const data = {
    code: String(formData.get("code")).trim(),
    name: String(formData.get("name")).trim(),
    gender: str(formData.get("gender")),
    phone: str(formData.get("phone")),
    dob: str(formData.get("dob")) ? new Date(String(formData.get("dob"))) : null,
    provinceId: str(formData.get("provinceId")) ?? null,
    district: str(formData.get("district")),
    taxCode: str(formData.get("taxCode")) ?? null,
    industry: str(formData.get("industry")) ?? null,
    sourceId: str(formData.get("sourceId")) ?? null,
    employeeId: str(formData.get("employeeId")) ?? null,
    careStatusId: str(formData.get("careStatusId")) ?? null,
    isNew: formData.get("isNew") === "on",
    storeName: str(formData.get("storeName")),
    storeAddress: str(formData.get("storeAddress")),
    notes: str(formData.get("notes")),
  };
  const customer = id
    ? await prisma.customer.update({ where: { id }, data })
    : await prisma.customer.create({ data });
  revalidatePath("/customers");
  revalidatePath("/");
  redirect(`/customers/${customer.id}`);
}

export async function deleteCustomer(id: string) {
  await requirePerm("editAnyRecord");
  await prisma.customer.delete({ where: { id } });
  revalidatePath("/customers", "layout");
  redirect("/customers");
}

export async function addCareLog(formData: FormData) {
  await requireUser();
  const customerId = String(formData.get("customerId"));
  const date = str(formData.get("date"));
  await prisma.careLog.create({
    data: {
      customerId,
      date: date ? new Date(date) : new Date(),
      content: str(formData.get("content")),
      feedback: str(formData.get("feedback")),
      resolution: str(formData.get("resolution")),
    },
  });
  await prisma.customer.update({
    where: { id: customerId },
    data: { latestContactDate: date ? new Date(date) : new Date() },
  });
  revalidatePath("/customers", "layout");
}

// ---------- Orders / Sales ----------
export async function createOrder(formData: FormData) {
  await requireUser();
  const isClosed = formData.get("isClosed") === "on";
  const value = num(formData.get("value"));
  await prisma.order.create({
    data: {
      date: new Date(String(formData.get("date"))),
      customerId: str(formData.get("customerId")) ?? null,
      employeeId: str(formData.get("employeeId")) ?? null,
      productGroupId: str(formData.get("productGroupId")) ?? null,
      provinceId: str(formData.get("provinceId")) ?? null,
      sourceId: str(formData.get("sourceId")) ?? null,
      careStatusId: str(formData.get("careStatusId")) ?? null,
      storeName: str(formData.get("storeName")),
      storeAddress: str(formData.get("storeAddress")),
      isClosed,
      value: isClosed ? (value ?? 0) : null,
    },
  });
  revalidatePath("/sales");
  revalidatePath("/");
  revalidatePath("/kpi");
}

export async function deleteOrder(id: string) {
  await requireUser();
  await prisma.order.delete({ where: { id } });
  revalidatePath("/sales");
  revalidatePath("/customers", "layout");
  revalidatePath("/");
}

// ---------- Sale Pipeline ----------
export async function moveCustomerStage(customerId: string, careStatusId: string) {
  await requireUser();
  await prisma.customer.update({ where: { id: customerId }, data: { careStatusId } });
  revalidatePath("/deals");
  revalidatePath("/customers", "layout");
  revalidatePath("/");
}

// ---------- Employee Tasks ----------
async function assertTaskWrite(taskId: string) {
  const ctx = await requireUser();
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { employeeId: true } });
  if (!task) throw new Error("Không tìm thấy công việc.");
  if (!can(ctx, "record:write", task)) throw new Error("Bạn không có quyền với công việc này.");
  return ctx;
}

export async function createTask(formData: FormData) {
  const ctx = await requireUser();
  const dueDate = str(formData.get("dueDate"));
  // SALES chỉ giao việc cho chính mình.
  const employeeId = isPrivileged(ctx)
    ? (str(formData.get("employeeId")) ?? null)
    : (ctx.employee?.id ?? null);
  await prisma.task.create({
    data: {
      title: String(formData.get("title")).trim(),
      description: str(formData.get("description")),
      employeeId,
      customerId: str(formData.get("customerId")) ?? null,
      dealId: str(formData.get("dealId")) ?? null,
      priority: str(formData.get("priority")) ?? "Bình thường",
      dueDate: dueDate ? new Date(dueDate) : null,
    },
  });
  revalidatePath("/tasks");
  revalidatePath("/deals");
}

export async function setTaskStatus(id: string, status: string) {
  await assertTaskWrite(id);
  await prisma.task.update({
    where: { id },
    data: { status, completedAt: status === "Hoàn thành" ? new Date() : null },
  });
  revalidatePath("/tasks");
  revalidatePath("/deals");
  revalidatePath("/customers", "layout");
}

// Kéo thả một thẻ việc sang cột `status` mới; `orderedIds` là thứ tự thẻ trong cột đích.
export async function moveTask(taskId: string, status: string, orderedIds: string[]) {
  await assertTaskWrite(taskId);
  await prisma.task.update({
    where: { id: taskId },
    data: { status, completedAt: status === "Hoàn thành" ? new Date() : null },
  });
  const ids = orderedIds.length ? orderedIds : [taskId];
  await prisma.$transaction(
    ids.map((id, i) => prisma.task.update({ where: { id }, data: { sortOrder: i } })),
  );
  revalidatePath("/tasks");
  revalidatePath("/deals");
  revalidatePath("/customers", "layout");
}

export async function deleteTask(id: string) {
  const ctx = await assertTaskWrite(id);
  const task = await prisma.task.findUnique({ where: { id }, select: { employeeId: true } });
  if (!canDelete(ctx, task ?? undefined)) throw new Error("Bạn không có quyền xoá công việc.");
  await prisma.task.delete({ where: { id } });
  revalidatePath("/tasks");
  revalidatePath("/deals");
}

// ---------- Master data (Danh mục) ----------
type MasterEntity = "employee" | "province" | "productGroup" | "source" | "careStatus";

export async function createMasterItem(entity: MasterEntity, formData: FormData) {
  await requirePerm("manageCatalog");
  const name = String(formData.get("name")).trim();
  const code = str(formData.get("code"));
  if (entity === "employee") await prisma.employee.create({ data: { name, code: code ?? name } });
  if (entity === "province") await prisma.province.create({ data: { name } });
  if (entity === "productGroup") await prisma.productGroup.create({ data: { name, code } });
  if (entity === "source") await prisma.source.create({ data: { name } });
  if (entity === "careStatus") {
    const count = await prisma.careStatus.count();
    await prisma.careStatus.create({ data: { name, sortOrder: count, color: str(formData.get("color")) ?? "#94a3b8" } });
  }
  revalidatePath("/settings");
}

export async function deleteMasterItem(entity: MasterEntity, id: string) {
  await requirePerm("manageCatalog");
  if (entity === "employee") await prisma.employee.delete({ where: { id } });
  if (entity === "province") await prisma.province.delete({ where: { id } });
  if (entity === "productGroup") await prisma.productGroup.delete({ where: { id } });
  if (entity === "source") await prisma.source.delete({ where: { id } });
  if (entity === "careStatus") await prisma.careStatus.delete({ where: { id } });
  revalidatePath("/settings");
}

export async function toggleEmployeeActive(id: string, active: boolean) {
  await requirePerm("manageCatalog");
  await prisma.employee.update({ where: { id }, data: { active } });
  revalidatePath("/settings");
}
