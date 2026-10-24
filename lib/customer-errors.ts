export class CustomerInputError extends Error {}
export function customerText(v: FormDataEntryValue | null, limit = 10000) {
  const s = String(v ?? "").trim();
  if (s.length > limit) throw new CustomerInputError(`Nội dung vượt quá ${limit} ký tự.`);
  return s || null;
}
export function customerDob(v: FormDataEntryValue | null) {
  const s = customerText(v, 10);
  if (!s) return null;
  const d = new Date(`${s}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(+d) || d.toISOString().slice(0,10) !== s) throw new CustomerInputError("Ngày sinh không hợp lệ.");
  return d;
}
