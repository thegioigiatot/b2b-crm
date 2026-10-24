"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CustomerInputError, customerText, customerDob } from "./customer-errors";
import { parseKpiInput } from "./kpi";
import { prisma } from "./prisma";
import { requireUser, requirePerm, can, canDelete, canEdit, isPrivileged } from "./auth";

import { assertCustomerAccess, assertDealAccess, assignedEmployee } from "./record-access";

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
  const { targetRevenue, monthDate } = parseKpiInput(month, String(formData.get("targetRevenue") ?? ""));
  const [employee, group] = await Promise.all([
    prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } }),
    prisma.productGroup.findUnique({ where: { id: productGroupId }, select: { id: true } }),
  ]);
  if (!employee || !group) throw new Error("Chọn nhân viên và dịch vụ hợp lệ.");

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
  const ctx = await requireUser();
  const id = str(formData.get("id"));
  const existing = id ? await assertCustomerAccess(ctx, id, true) : null;
  const code = customerText(formData.get("code"), 80);
  const name = customerText(formData.get("name"), 200);
  if (!code || !name) throw new CustomerInputError("Mã và tên khách hàng không được để trống.");
  const data = {
    code, name,
    gender: customerText(formData.get("gender"), 50),
    phone: customerText(formData.get("phone"), 50),
    dob: customerDob(formData.get("dob")),
    provinceId: str(formData.get("provinceId")) ?? null,
    district: customerText(formData.get("district"), 200),
    taxCode: customerText(formData.get("taxCode"), 80),
    industry: customerText(formData.get("industry"), 200),
    sourceId: str(formData.get("sourceId")) ?? null,
    employeeId: assignedEmployee(ctx, str(formData.get("employeeId"))),
    careStatusId: str(formData.get("careStatusId")) ?? null,
    isNew: formData.get("isNew") === "on",
    storeName: customerText(formData.get("storeName"), 200),
    storeAddress: customerText(formData.get("storeAddress"), 1000),
    notes: customerText(formData.get("notes")),
  };
  const customer = await prisma.$transaction(async tx => {
    if (!id) return tx.customer.create({ data });
    await tx.$queryRaw`SELECT id FROM "Customer" WHERE id = ${id} FOR UPDATE`;
    const row = await tx.customer.findUnique({ where: { id }, include: { _count: { select: { orders: true, deals: true, leads: true, tasks: true, contacts: true, careLogs: true, documents: true } } } });
    if (!row || !canEdit(ctx, row)) throw new CustomerInputError("Không có quyền với khách hàng này.");
    const version = str(formData.get("updatedAt"));
    if (!version || version !== row.updatedAt.toISOString()) throw new CustomerInputError("Hồ sơ đã thay đổi hoặc biểu mẫu đã cũ. Tải lại trang trước khi lưu để tránh ghi đè.");
    if (data.employeeId !== existing?.employeeId && Object.values(row._count).some(n => n > 0)) throw new CustomerInputError("Khách hàng có hồ sơ liên quan; chưa hỗ trợ chuyển đồng bộ nhân viên. Giữ người phụ trách hiện tại.");
    return tx.customer.update({ where: { id }, data });
  });
  revalidatePath("/customers", "layout");
  revalidatePath("/");
  redirect(`/customers/${customer.id}`);
}

export async function deleteCustomer(id: string, confirmedCode?: string) {
  const ctx = await requireUser();
  if (!ctx.perms.deleteRecords) throw new CustomerInputError("Không có quyền xoá khách hàng.");
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Customer" WHERE id = ${id} FOR UPDATE`;
    const row = await tx.customer.findUnique({ where: { id }, include: { _count: { select: { orders: true, deals: true, leads: true, tasks: true, contacts: true, careLogs: true, documents: true } } } });
    if (!row) return; // A repeated delete must not affect any other customer.
    if (!canDelete(ctx, row)) throw new CustomerInputError("Không có quyền xoá khách hàng.");
    if (confirmedCode !== row.code) throw new CustomerInputError("Nhập đúng mã khách hàng để xác nhận xoá.");
    if (Object.values(row._count).some(n => n > 0)) throw new CustomerInputError("Không thể xoá: khách hàng đã có Contact, deal, giao dịch hoặc lịch sử liên quan. Dữ liệu được giữ nguyên để đối soát.");
    await tx.customer.delete({ where: { id } });
  });
  revalidatePath("/customers", "layout");
  revalidatePath("/");
  redirect("/customers");
}

export async function addCareLog(formData: FormData) {
  const ctx = await requireUser();
  const customerId = String(formData.get("customerId"));
  await assertCustomerAccess(ctx, customerId, true);
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
  const ctx = await requireUser();
  const isClosed = formData.get("isClosed") === "on";
  const value = num(formData.get("value"));
  const dealId = str(formData.get("dealId"));
  const customerId = str(formData.get("customerId"));
  if (customerId) await assertCustomerAccess(ctx, customerId, true);
  const employeeId = assignedEmployee(ctx, str(formData.get("employeeId")));
  if (isClosed && (!dealId || !value || !Number.isSafeInteger(value) || value < 0)) throw new Error("Giao dịch thu tiền cần deal và phí dịch vụ VND lớn hơn 0.");
  const date = new Date(String(formData.get("date")));
  if (!Number.isFinite(+date)) throw new Error("Ngày không hợp lệ.");
  await prisma.$transaction(async tx => {
    if (dealId) {
      await assertDealAccess(ctx, dealId, true);
      await tx.$queryRaw`SELECT id FROM "Deal" WHERE id = ${dealId} FOR UPDATE`;
      const deal = await tx.deal.findUniqueOrThrow({ where: { id: dealId } });
      if (deal.customerId !== customerId || deal.ownerId !== employeeId) throw new Error("Khách hàng và nhân viên phải khớp deal.");
      if (isClosed && deal.status !== "Thắng") throw new Error("Chỉ ghi thu tiền cho deal thắng.");
      if (await tx.serviceContract.findUnique({ where: { dealId } })) throw new Error("Deal có hợp đồng; ghi thu theo kỳ trong chi tiết deal.");
      if (isClosed && await tx.order.findFirst({ where: { dealId, isClosed: true } })) return;
    }
    const key = str(formData.get("bookingKey"));
    if (!key || !/^[a-zA-Z0-9_-]{8,100}$/.test(key)) throw new Error("Tải lại biểu mẫu để ghi giao dịch.");
    await tx.order.upsert({
      where: { bookingKey: isClosed ? `deal:${dealId}` : `interaction:${key}` },
      update: {},
      create: {
        date, customerId: customerId ?? null, employeeId, dealId: dealId ?? null,
        bookingKey: isClosed ? `deal:${dealId}` : `interaction:${key}`,
        productGroupId: str(formData.get("productGroupId")) ?? null,
        provinceId: str(formData.get("provinceId")) ?? null,
        sourceId: str(formData.get("sourceId")) ?? null,
        careStatusId: str(formData.get("careStatusId")) ?? null,
        storeName: str(formData.get("storeName")), storeAddress: str(formData.get("storeAddress")),
        isClosed, value: isClosed ? value : null,
      },
    });
  });
  revalidatePath("/sales"); revalidatePath("/"); revalidatePath("/kpi"); revalidatePath("/deals", "layout");
}

// Reconcile historical transactions without creating revenue a second time.
export async function linkOrderToDeal(formData: FormData) {
  const ctx = await requireUser();
  const id = String(formData.get("orderId"));
  const dealId = String(formData.get("dealId"));
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${id} FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({ where: { id } });
    if (!canEdit(ctx, order)) throw new Error("Không có quyền với giao dịch.");
    const deal = await assertDealAccess(ctx, dealId, true);
    if (order.paymentId || order.dealId && order.dealId !== dealId || order.customerId !== deal.customerId || order.employeeId !== deal.ownerId || deal.status !== "Thắng") throw new Error("Giao dịch không khớp khách hàng/nhân viên/deal thắng.");
    if (await tx.serviceContract.findUnique({ where: { dealId } })) throw new Error("Đối chiếu giao dịch cũ trước khi tạo hợp đồng.");
    await tx.order.update({ where: { id }, data: { dealId } });
  });
  revalidatePath("/sales"); revalidatePath("/deals", "layout");
}

export async function deleteOrder(id: string) {
  const ctx = await requireUser();
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || !canDelete(ctx, order)) throw new Error("Không có quyền xoá doanh số.");
  if (order.paymentId) throw new Error("Giao dịch thanh toán phải được điều chỉnh trong sổ thu.");
  await prisma.order.delete({ where: { id } });
  revalidatePath("/sales");
  revalidatePath("/customers", "layout");
  revalidatePath("/");
}

// ---------- Sale Pipeline ----------
export async function moveCustomerStage(customerId: string, careStatusId: string) {
  const ctx = await requireUser();
  await assertCustomerAccess(ctx, customerId, true);
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
  const customerId = str(formData.get("customerId"));
  const dealId = str(formData.get("dealId"));
  if (customerId) await assertCustomerAccess(ctx, customerId, true);
  if (dealId) await assertDealAccess(ctx, dealId, true);
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
  const ids = [...new Set(orderedIds.length ? orderedIds : [taskId])];
  for (const id of ids) await assertTaskWrite(id);
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
