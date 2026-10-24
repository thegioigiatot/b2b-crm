import "server-only";
import { prisma } from "./prisma";
import { canEdit, canRead, type AuthContext } from "./auth";

export async function assertCustomerAccess(ctx: AuthContext, id: string, write = false) {
  const row = await prisma.customer.findUnique({ where: { id } });
  if (!row || !(write ? canEdit(ctx, row) : canRead(ctx, "customer", row)))
    throw new Error("Không có quyền với khách hàng này.");
  return row;
}
export async function assertContactAccess(ctx: AuthContext, id: string) {
  const row = await prisma.contact.findUnique({ where: { id } });
  if (!row?.customerId) throw new Error("Contact phải thuộc khách hàng được giao.");
  await assertCustomerAccess(ctx, row.customerId, true);
  return row;
}
export async function assertDealAccess(ctx: AuthContext, id: string, write = false) {
  const row = await prisma.deal.findUnique({ where: { id }, include: { followers: true } });
  if (!row || !(write ? canEdit(ctx, row) : canRead(ctx, "deal", row)))
    throw new Error("Không có quyền với deal này.");
  return row;
}
export async function assertContactMatches(ctx: AuthContext, contactId?: string | null, customerId?: string | null) {
  if (!contactId) return;
  const contact = await assertContactAccess(ctx, contactId);
  if (!customerId || contact.customerId !== customerId) throw new Error("Contact không thuộc khách hàng của deal.");
}
export function assignedEmployee(ctx: AuthContext, requested?: string | null) {
  if (ctx.perms.editAnyRecord) return requested || null;
  if (!ctx.employee) throw new Error("Tài khoản chưa được gán nhân viên.");
  if (requested && requested !== ctx.employee.id) throw new Error("Không được gán hồ sơ cho nhân viên khác.");
  return ctx.employee.id;
}
