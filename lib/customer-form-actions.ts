"use server";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { Prisma } from "@prisma/client";
import { upsertCustomer, deleteCustomer } from "./actions";
import { CustomerInputError } from "./customer-errors";
function message(error: unknown) {
  if (isRedirectError(error)) throw error;
  if (error instanceof CustomerInputError) return error.message;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return "Mã khách hàng đã tồn tại. Dùng mã khác hoặc mở hồ sơ hiện có để sửa.";
    if (error.code === "P2003") return "Dữ liệu liên quan đã thay đổi. Tải lại trang và chọn lại danh mục.";
    if (error.code === "P2025") return "Hồ sơ không còn tồn tại. Tải lại danh sách khách hàng.";
  }
  if (error instanceof Error && /^(Không có quyền|Tài khoản chưa|Không được gán)/.test(error.message)) return error.message;
  return "Không lưu được khách hàng. Kiểm tra dữ liệu và tải lại trang trước khi thử lại.";
}
export async function saveCustomerForm(f: FormData) {
  try { await upsertCustomer(f); return { ok: true }; }
  catch(error) { return { error: message(error) }; }
}
export async function deleteCustomerForm(id: string, f: FormData) {
  try { await deleteCustomer(id, String(f.get("confirmedCode") ?? "").trim()); return { ok: true }; }
  catch(error) { return { error: message(error) }; }
}
