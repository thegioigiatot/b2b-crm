// Union target groups with actual revenue groups: missing targets must never hide cash collected.
export type KpiTargetInput = { id: string; employeeId: string; productGroupId: string; targetRevenue: number };
export type KpiActualInput = { employeeId: string | null; productGroupId: string | null; actual: number };
export function buildKpiRows(targets: KpiTargetInput[], actuals: KpiActualInput[], employees: { id: string; name: string }[], groups: { id: string; name: string }[]) {
  const employeeNames = new Map(employees.map(e => [e.id, e.name]));
  const groupNames = new Map(groups.map(g => [g.id, g.name]));
  const key = (e: string | null, g: string | null) => JSON.stringify([e, g]);
  const rows = new Map<string, { id: string; employeeId: string | null; productGroupId: string | null; employeeName: string; productGroupName: string; target: number; actual: number; rate: number; hasTarget: boolean }>();
  const row = (employeeId: string | null, productGroupId: string | null) => ({
    id: `actual:${key(employeeId, productGroupId)}`, employeeId, productGroupId,
    employeeName: employeeNames.get(employeeId ?? "") ?? "Chưa gán nhân viên",
    productGroupName: groupNames.get(productGroupId ?? "") ?? "Chưa gán dịch vụ",
    target: 0, actual: 0, rate: 0, hasTarget: false,
  });
  for (const t of targets) rows.set(key(t.employeeId, t.productGroupId), { ...row(t.employeeId, t.productGroupId), id: t.id, target: t.targetRevenue, hasTarget: true });
  for (const a of actuals) {
    const k = key(a.employeeId, a.productGroupId);
    if (!rows.has(k) && a.actual === 0) continue;
    const r = rows.get(k) ?? row(a.employeeId, a.productGroupId);
    r.actual += a.actual;
    r.rate = r.target > 0 ? r.actual / r.target : 0;
    rows.set(k, r);
  }
  return [...rows.values()].sort((a,b) => a.employeeName.localeCompare(b.employeeName, "vi") || a.productGroupName.localeCompare(b.productGroupName, "vi"));
}
export function parseKpiInput(month: string, revenue: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Tháng KPI phải có dạng YYYY-MM hợp lệ.");
  const targetRevenue = Number(revenue);
  if (!revenue.trim() || !Number.isSafeInteger(targetRevenue) || targetRevenue < 0 || targetRevenue > 1_000_000_000_000) throw new Error("Chỉ tiêu KPI phải là số nguyên VND không âm, tối đa 1.000 tỷ.");
  const [year, m] = month.split("-").map(Number);
  if (year < 1000) throw new Error("Năm KPI không hợp lệ.");
  return { monthDate: new Date(year, m - 1, 1), targetRevenue };
}
