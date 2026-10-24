import { prisma } from "./prisma";
import { monthRange, monthValue, daysSince, initials } from "./format";
import { parseScoringConfig } from "./scoring";
import type { AuthContext } from "./auth";
import { requireUser, customerVisibilityWhere, salesVisibilityWhere, dealVisibilityWhere, leadVisibilityWhere, taskVisibilityWhere } from "./auth";

// ---------- Cảnh báo "cần chú ý" cho người dùng hiện tại ----------
export async function getMyAlerts(ctx: AuthContext) {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - 7 * 86_400_000);
  const [deals, tasks, leads] = await Promise.all([
    prisma.deal.findMany({
      where: { status: "Đang mở", expectedCloseDate: { lt: now }, ...dealVisibilityWhere(ctx) },
      include: { customer: { select: { name: true } } },
      orderBy: { expectedCloseDate: "asc" },
      take: 50,
    }),
    prisma.task.findMany({
      where: { status: { not: "Hoàn thành" }, dueDate: { lt: now }, ...taskVisibilityWhere(ctx) },
      orderBy: { dueDate: "asc" },
      take: 50,
    }),
    prisma.lead.findMany({
      where: { status: "Đủ điều kiện", updatedAt: { lt: staleBefore }, ...leadVisibilityWhere(ctx) },
      orderBy: { updatedAt: "asc" },
      take: 50,
    }),
  ]);
  return { deals, tasks, leads, total: deals.length + tasks.length + leads.length };
}

export async function getAlertCount(ctx: AuthContext) {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - 7 * 86_400_000);
  const [d, t, l] = await Promise.all([
    prisma.deal.count({ where: { status: "Đang mở", expectedCloseDate: { lt: now }, ...dealVisibilityWhere(ctx) } }),
    prisma.task.count({ where: { status: { not: "Hoàn thành" }, dueDate: { lt: now }, ...taskVisibilityWhere(ctx) } }),
    prisma.lead.count({ where: { status: "Đủ điều kiện", updatedAt: { lt: staleBefore }, ...leadVisibilityWhere(ctx) } }),
  ]);
  return d + t + l;
}

export async function getMasterData() {
  const [employees, provinces, productGroups, sources, careStatuses] = await Promise.all([
    prisma.employee.findMany({ orderBy: { name: "asc" } }),
    prisma.province.findMany({ orderBy: { name: "asc" } }),
    prisma.productGroup.findMany({ orderBy: { name: "asc" } }),
    prisma.source.findMany({ orderBy: { name: "asc" } }),
    prisma.careStatus.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  return { employees, provinces, productGroups, sources, careStatuses };
}

export async function getAvailableMonths() {
  const ctx = await requireUser();
  const [orders, kpis] = await Promise.all([
    prisma.order.findMany({ where: salesVisibilityWhere(ctx), select: { date: true }, distinct: ["date"] }),
    prisma.kpiTarget.findMany({ where: ctx.perms.viewAllSales ? {} : { employeeId: ctx.employee?.id ?? "__none__" }, select: { month: true }, distinct: ["month"] }),
  ]);
  const set = new Set<string>();
  for (const o of orders) set.add(`${o.date.getFullYear()}-${String(o.date.getMonth() + 1).padStart(2, "0")}`);
  for (const k of kpis) set.add(`${k.month.getFullYear()}-${String(k.month.getMonth() + 1).padStart(2, "0")}`);
  // A new production database has no sales/KPI months yet.
  if (set.size === 0) set.add(monthValue(new Date()));
  return [...set].sort();
}

export async function getDashboardData(monthStr: string) {
  const ctx = await requireUser();
  const { start, end } = monthRange(monthStr);

  const [totalCustomers, oldCustomers, monthOrders, allOrders, statuses, firstOrderPerCustomer] = await Promise.all([
    prisma.customer.count({ where: customerVisibilityWhere(ctx) }),
    prisma.customer.count({ where: { isNew: false, ...customerVisibilityWhere(ctx) } }),
    prisma.order.findMany({
      where: { ...salesVisibilityWhere(ctx), date: { gte: start, lt: end } },
      include: { employee: true, productGroup: true, province: true, source: true, careStatus: true },
    }),
    prisma.order.findMany({
      where: { ...salesVisibilityWhere(ctx), date: { gte: new Date(start.getFullYear(), 0, 1), lt: new Date(start.getFullYear() + 1, 0, 1) } },
      select: { date: true, value: true, isClosed: true },
    }),
    prisma.careStatus.findMany({ orderBy: { sortOrder: "asc" }, include: { customers: { where: customerVisibilityWhere(ctx), select: { id: true } } } }),
    prisma.order.groupBy({ by: ["customerId"], where: { ...salesVisibilityWhere(ctx), customerId: { not: null } }, _min: { date: true } }),
  ]);
  // "Khách hàng mới trong tháng": customers whose earliest recorded interaction falls in this month.
  const newCustomersThisMonth = firstOrderPerCustomer.filter(
    (f) => f._min.date && f._min.date >= start && f._min.date < end,
  ).length;

  const closedMonthOrders = monthOrders.filter((o) => o.isClosed && o.value != null);
  const revenue = closedMonthOrders.reduce((s, o) => s + (o.value ?? 0), 0);
  const orderCount = monthOrders.length;
  const closedCount = closedMonthOrders.length;

  const kpiTargets = await prisma.kpiTarget.aggregate({
    where: { ...salesVisibilityWhere(ctx), month: start },
    _sum: { targetRevenue: true },
  });

  // revenue by month for the year (actual vs KPI)
  const monthsInYear = Array.from({ length: 12 }, (_, i) => i);
  const revenueByMonthMap = new Map<number, number>();
  for (const o of allOrders) {
    if (!o.isClosed || o.value == null) continue;
    const m = o.date.getMonth();
    revenueByMonthMap.set(m, (revenueByMonthMap.get(m) ?? 0) + o.value);
  }
  const kpiByMonth = await prisma.kpiTarget.groupBy({
    by: ["month"],
    where: { ...salesVisibilityWhere(ctx), month: { gte: new Date(start.getFullYear(), 0, 1), lt: new Date(start.getFullYear() + 1, 0, 1) } },
    _sum: { targetRevenue: true },
  });
  const kpiByMonthMap = new Map(kpiByMonth.map((k) => [k.month.getMonth(), k._sum.targetRevenue ?? 0]));
  const revenueVsKpiByMonth = monthsInYear.map((m) => ({
    month: `Th${m + 1}`,
    actual: revenueByMonthMap.get(m) ?? 0,
    kpi: kpiByMonthMap.get(m) ?? 0,
  }));

  // top sales this month
  const salesByEmployee = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const o of closedMonthOrders) {
    if (!o.employee) continue;
    const cur = salesByEmployee.get(o.employee.id) ?? { name: o.employee.name, qty: 0, revenue: 0 };
    cur.qty += 1;
    cur.revenue += o.value ?? 0;
    salesByEmployee.set(o.employee.id, cur);
  }
  const topSales = [...salesByEmployee.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  // revenue by product group this month
  const byProduct = new Map<string, number>();
  for (const o of closedMonthOrders) {
    if (!o.productGroup) continue;
    byProduct.set(o.productGroup.name, (byProduct.get(o.productGroup.name) ?? 0) + (o.value ?? 0));
  }
  const revenueByProduct = [...byProduct.entries()].map(([name, revenue]) => ({ name, revenue }));

  // revenue by source this month
  const bySource = new Map<string, number>();
  for (const o of monthOrders) {
    if (!o.source) continue;
    bySource.set(o.source.name, (bySource.get(o.source.name) ?? 0) + 1);
  }
  const interactionsBySource = [...bySource.entries()].map(([name, count]) => ({ name, count }));

  // revenue by province this month
  const byProvince = new Map<string, number>();
  for (const o of closedMonthOrders) {
    if (!o.province) continue;
    byProvince.set(o.province.name, (byProvince.get(o.province.name) ?? 0) + (o.value ?? 0));
  }
  const revenueByProvince = [...byProvince.entries()]
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // customers by funnel status (overall)
  const customersByStatus = statuses.map((s) => ({ name: s.name, count: s.customers.length, color: s.color }));

  // birthdays this month
  const monthNum = start.getMonth() + 1;
  const allCustomers = await prisma.customer.findMany({ where: { ...customerVisibilityWhere(ctx), dob: { not: null } }, select: { id: true, code: true, name: true, dob: true } });
  const birthdays = allCustomers
    .filter((c) => c.dob && c.dob.getMonth() + 1 === monthNum)
    .sort((a, b) => (a.dob!.getDate() - b.dob!.getDate()));

  return {
    totals: {
      totalCustomers,
      newCustomersThisMonth,
      oldCustomers,
      orderCount,
      closedCount,
      revenue,
      kpiTarget: kpiTargets._sum.targetRevenue ?? 0,
    },
    revenueVsKpiByMonth,
    topSales,
    revenueByProduct,
    interactionsBySource,
    revenueByProvince,
    customersByStatus,
    birthdays,
  };
}

export async function getCustomers(filters: { q?: string; statusId?: string; employeeId?: string; provinceId?: string }) {
  const ctx = await requireUser();
  return prisma.customer.findMany({
    where: {
      AND: [
        customerVisibilityWhere(ctx),
        filters.q
          ? {
              OR: [
                { name: { contains: filters.q, mode: "insensitive" } },
                { code: { contains: filters.q, mode: "insensitive" } },
                { phone: { contains: filters.q } },
              ],
            }
          : {},
        filters.statusId ? { careStatusId: filters.statusId } : {},
        filters.employeeId ? { employeeId: filters.employeeId } : {},
        filters.provinceId ? { provinceId: filters.provinceId } : {},
      ],
    },
    include: { province: true, employee: true, careStatus: true, source: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getCustomerDetail(id: string) {
  const ctx = await requireUser();
  const customer = await prisma.customer.findFirst({
    where: { id, ...customerVisibilityWhere(ctx) },
    include: {
      province: true,
      employee: true,
      careStatus: true,
      source: true,
      careLogs: { orderBy: { date: "desc" } },
      orders: { where: salesVisibilityWhere(ctx), orderBy: { date: "desc" }, include: { productGroup: true, employee: true, careStatus: true } },
      tasks: { where: taskVisibilityWhere(ctx), orderBy: [{ status: "asc" }, { dueDate: "asc" }], include: { employee: true } },
      deals: { where: dealVisibilityWhere(ctx), include: { stage: true, owner: true }, orderBy: { updatedAt: "desc" } },
      leads: { where: leadVisibilityWhere(ctx), select: { id: true, code: true, label: true } },
      contacts: { orderBy: { name: "asc" } },
    },
  });
  return customer;
}

export async function getOrders(filters: { month?: string; employeeId?: string; productGroupId?: string; statusId?: string }) {
  const ctx = await requireUser();
  const where: Record<string, unknown> = {};
  if (filters.month) {
    const { start, end } = monthRange(filters.month);
    where.date = { gte: start, lt: end };
  }
  if (filters.employeeId) where.employeeId = filters.employeeId;
  if (filters.productGroupId) where.productGroupId = filters.productGroupId;
  if (filters.statusId) where.careStatusId = filters.statusId;

  return prisma.order.findMany({
    where: { AND: [where, salesVisibilityWhere(ctx)] },
    include: { customer: true, deal: true, employee: true, productGroup: true, careStatus: true, province: true },
    orderBy: { date: "desc" },
    take: 300,
  });
}

// Bảng trạng thái chăm sóc khách hàng (account funnel) — vẫn dùng cho trang Khách hàng.
export async function getCustomerStatusBoard(employeeId?: string) {
  const ctx = await requireUser();
  const [statuses, employees, customers] = await Promise.all([
    prisma.careStatus.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.employee.findMany({ orderBy: { name: "asc" } }),
    prisma.customer.findMany({
      where: { AND: [customerVisibilityWhere(ctx), employeeId ? { employeeId } : {}] },
      include: {
        employee: true,
        orders: { where: { isClosed: true }, select: { value: true } },
        tasks: { where: { status: { not: "Hoàn thành" } }, select: { id: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const columns = statuses.map((status) => {
    const items = customers
      .filter((c) => c.careStatusId === status.id)
      .map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        phone: c.phone,
        employeeName: c.employee?.name ?? null,
        openTaskCount: c.tasks.length,
        latestContactDate: c.latestContactDate,
        revenue: c.orders.reduce((s, o) => s + (o.value ?? 0), 0),
      }));
    return {
      status,
      items,
      totalRevenue: items.reduce((s, i) => s + i.revenue, 0),
    };
  });
  const uncategorized = customers.filter((c) => !c.careStatusId);

  return { columns, uncategorized, employees, statuses };
}

export async function getTasks(filters: { employeeId?: string; status?: string }, viewer?: AuthContext) {
  return prisma.task.findMany({
    where: {
      AND: [
        { employeeId: filters.employeeId || undefined, status: filters.status || undefined },
        viewer ? taskVisibilityWhere(viewer) : {},
      ],
    },
    include: {
      employee: true,
      customer: { select: { id: true, code: true, name: true } },
      deal: { select: { id: true, title: true } },
    },
    orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });
}

export async function getTaskProgressByEmployee() {
  const ctx = await requireUser();
  const [employees, tasks] = await Promise.all([
    prisma.employee.findMany({ orderBy: { name: "asc" } }),
    prisma.task.findMany({ where: taskVisibilityWhere(ctx), select: { employeeId: true, status: true, dueDate: true } }),
  ]);
  const now = new Date();
  return employees
    .map((e) => {
      const own = tasks.filter((t) => t.employeeId === e.id);
      const done = own.filter((t) => t.status === "Hoàn thành").length;
      const overdue = own.filter((t) => t.status !== "Hoàn thành" && t.dueDate && t.dueDate < now).length;
      return { id: e.id, name: e.name, total: own.length, done, overdue, rate: own.length > 0 ? done / own.length : 0 };
    })
    .filter((e) => e.total > 0);
}

export async function getKpiTable(monthStr: string) {
  const ctx = await requireUser();
  const { start, end } = monthRange(monthStr);
  const [targets, employees, productGroups] = await Promise.all([
    prisma.kpiTarget.findMany({
      where: { month: start, ...salesVisibilityWhere(ctx) },
      include: { employee: true, productGroup: true },
      orderBy: [{ employee: { name: "asc" } }, { productGroup: { name: "asc" } }],
    }),
    prisma.employee.findMany({ where: ctx.perms.viewAllSales ? {} : { id: ctx.employee?.id ?? "__none__" }, orderBy: { name: "asc" } }),
    prisma.productGroup.findMany({ orderBy: { name: "asc" } }),
  ]);

  const actuals = await prisma.order.groupBy({
    by: ["employeeId", "productGroupId"],
    where: { ...salesVisibilityWhere(ctx), date: { gte: start, lt: end }, isClosed: true },
    _sum: { value: true },
  });
  const actualMap = new Map(actuals.map((a) => [`${a.employeeId}|${a.productGroupId}`, a._sum.value ?? 0]));

  const rows = targets.map((t) => {
    const actual = actualMap.get(`${t.employeeId}|${t.productGroupId}`) ?? 0;
    return {
      id: t.id,
      employeeId: t.employeeId,
      employeeName: t.employee.name,
      productGroupId: t.productGroupId,
      productGroupName: t.productGroup?.name ?? "Tất cả nhóm hàng",
      target: t.targetRevenue,
      actual,
      rate: t.targetRevenue > 0 ? actual / t.targetRevenue : 0,
    };
  });

  const byEmployee = new Map<string, { name: string; target: number; actual: number }>();
  for (const r of rows) {
    const cur = byEmployee.get(r.employeeId) ?? { name: r.employeeName, target: 0, actual: 0 };
    cur.target += r.target;
    cur.actual += r.actual;
    byEmployee.set(r.employeeId, cur);
  }
  const employeeSummary = [...byEmployee.values()]
    .map((e) => ({ ...e, rate: e.target > 0 ? e.actual / e.target : 0 }))
    .sort((a, b) => b.actual - a.actual);

  return { rows, employeeSummary, employees, productGroups };
}

// ============================================================================
// Leads / Deals / Scoring / Nhịp công việc
// ============================================================================

export async function getStages() {
  return prisma.pipelineStage.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function getScoringConfig() {
  const row = await prisma.scoringConfig.findUnique({ where: { name: "default" } });
  return { row, config: parseScoringConfig(row) };
}

const HOT = ["Nóng", "Ấm", "Nguội"];
function labelRank(l: string) {
  const i = HOT.indexOf(l);
  return i === -1 ? 99 : i;
}

// ----- Sale Pipeline (Deal board) -----
export async function getPipelineBoard(opts: { ownerId?: string } = {}, viewer?: AuthContext) {
  const [stages, deals, employees, customers, sources] = await Promise.all([
    prisma.pipelineStage.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.deal.findMany({
      where: {
        AND: [opts.ownerId ? { ownerId: opts.ownerId } : {}, viewer ? dealVisibilityWhere(viewer) : {}],
      },
      include: {
        owner: true,
        customer: { select: { id: true, name: true, code: true } },
        contact: { select: { name: true } },
        followers: { select: { id: true } },
        tasks: { where: { status: { not: "Hoàn thành" } }, select: { id: true } },
      },
      orderBy: [{ label: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.customer.findMany({ where: customerVisibilityWhere(await requireUser()), orderBy: { name: "asc" }, select: { id: true, code: true, name: true } }),
    prisma.source.findMany({ orderBy: { name: "asc" } }),
  ]);

  const toCard = (d: (typeof deals)[number]) => ({
    id: d.id,
    code: d.code,
    title: d.title,
    value: d.value ?? 0,
    status: d.status,
    customerName: d.customer?.name ?? "-",
    customerId: d.customer?.id ?? null,
    ownerName: d.owner?.name ?? null,
    ownerInitials: d.owner ? initials(d.owner.name) : null,
    label: d.label,
    healthLabel: d.healthLabel,
    probability: d.probability,
    forecastCategory: d.forecastCategory,
    daysInStage: daysSince(d.stageEnteredAt),
    openTaskCount: d.tasks.length,
    followerCount: d.followers.length,
    stageId: d.stageId,
  });

  const columns = stages.map((stage) => {
    const items = deals
      .filter((d) => d.stageId === stage.id)
      .map(toCard)
      .sort((a, b) => labelRank(a.label) - labelRank(b.label) || b.value - a.value);
    return {
      stage,
      items,
      totalValue: items.reduce((s, i) => s + i.value, 0),
      weighted: items.reduce((s, i) => s + (i.value * i.probability) / 100, 0),
    };
  });

  const openDeals = deals.filter((d) => d.status === "Đang mở");
  const totals = {
    openCount: openDeals.length,
    openValue: openDeals.reduce((s, d) => s + (d.value ?? 0), 0),
    weightedValue: openDeals.reduce((s, d) => s + ((d.value ?? 0) * d.probability) / 100, 0),
    wonValue: deals.filter((d) => d.status === "Thắng").reduce((s, d) => s + (d.value ?? 0), 0),
    wonCount: deals.filter((d) => d.status === "Thắng").length,
    lostCount: deals.filter((d) => d.status === "Thua").length,
  };

  return { columns, stages, employees, customers, sources, totals };
}

export type DealListTab = "all" | "open" | "commit" | "risk" | "overdue" | "won" | "lost";

export async function getDeals(
  filters: { tab?: DealListTab; ownerId?: string; q?: string; pipelineId?: string } = {},
  viewer?: AuthContext,
) {
  const now = new Date();
  const rows = await prisma.deal.findMany({
    where: {
      AND: [
        filters.ownerId ? { ownerId: filters.ownerId } : {},
        viewer ? dealVisibilityWhere(viewer) : {},
        filters.q
          ? {
              OR: [
                { title: { contains: filters.q, mode: "insensitive" } },
                { code: { contains: filters.q, mode: "insensitive" } },
                { customer: { name: { contains: filters.q, mode: "insensitive" } } },
                { contact: { name: { contains: filters.q, mode: "insensitive" } } },
              ],
            }
          : {},
      ],
    },
    include: {
      stage: true,
      owner: true,
      customer: { select: { id: true, name: true, phone: true } },
      contact: { select: { name: true, phone: true } },
      followers: { select: { id: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  const withMeta = rows.map((d) => {
    const overdue = d.status === "Đang mở" && !!d.expectedCloseDate && d.expectedCloseDate < now;
    return { ...d, overdue };
  });

  const counts = {
    all: withMeta.length,
    open: withMeta.filter((d) => d.status === "Đang mở").length,
    commit: withMeta.filter((d) => d.forecastCategory === "Cam kết").length,
    risk: withMeta.filter((d) => d.forecastCategory === "Rủi ro").length,
    overdue: withMeta.filter((d) => d.overdue).length,
    won: withMeta.filter((d) => d.status === "Thắng").length,
    lost: withMeta.filter((d) => d.status === "Thua").length,
  };

  const tab = filters.tab ?? "all";
  const filtered = withMeta.filter((d) => {
    switch (tab) {
      case "open":
        return d.status === "Đang mở";
      case "commit":
        return d.forecastCategory === "Cam kết";
      case "risk":
        return d.forecastCategory === "Rủi ro";
      case "overdue":
        return d.overdue;
      case "won":
        return d.status === "Thắng";
      case "lost":
        return d.status === "Thua";
      default:
        return true;
    }
  });

  return { deals: filtered, counts };
}

export async function getDealDetail(id: string) {
  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      stage: true,
      owner: true,
      source: true,
      contact: true,
      customer: { include: { province: true } },
      followers: { include: { employee: true } },
      activities: { include: { employee: true }, orderBy: { occurredAt: "desc" } },
      tasks: { include: { employee: true }, orderBy: [{ status: "asc" }, { sortOrder: "asc" }] },
      orders: { include: { productGroup: true }, orderBy: { date: "desc" } },
    },
  });
  const [stages, employees, customerContacts] = await Promise.all([
    prisma.pipelineStage.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    deal?.customerId
      ? prisma.contact.findMany({ where: { customerId: deal.customerId }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);
  return { deal, stages, employees, customerContacts };
}

export async function getContacts(customerId: string) {
  const { assertCustomerAccess } = await import("./record-access");
  await assertCustomerAccess(await requireUser(), customerId);
  return prisma.contact.findMany({ where: { customerId }, orderBy: { name: "asc" } });
}

// ----- Leads -----
export async function getLeads(
  filters: { q?: string; status?: string; label?: string; employeeId?: string } = {},
  viewer?: AuthContext,
) {
  const leads = await prisma.lead.findMany({
    where: {
      AND: [
        viewer ? leadVisibilityWhere(viewer) : {},
        filters.q
          ? {
              OR: [
                { name: { contains: filters.q, mode: "insensitive" } },
                { companyName: { contains: filters.q, mode: "insensitive" } },
                { phone: { contains: filters.q, mode: "insensitive" } },
                { code: { contains: filters.q, mode: "insensitive" } },
              ],
            }
          : {},
        filters.status ? { status: filters.status } : {},
        filters.label ? { label: filters.label } : {},
        filters.employeeId ? { employeeId: filters.employeeId } : {},
      ],
    },
    include: { province: true, source: true, employee: true },
    orderBy: [{ label: "asc" }, { fitPercent: "desc" }, { updatedAt: "desc" }],
  });
  return leads;
}

export const LEAD_STATUSES = ["Mới", "Đang liên hệ", "Đủ điều kiện", "Đã chuyển đổi", "Rác"] as const;

export async function getLeadsBoard(filters: { employeeId?: string } = {}, viewer?: AuthContext) {
  const leads = await getLeads(filters, viewer);
  const columns = LEAD_STATUSES.map((status) => ({
    status,
    items: leads.filter((l) => l.status === status),
  }));
  return { columns, leads };
}

export async function getLeadDetail(id: string) {
  const [lead, provinces, sources, employees, { config }] = await Promise.all([
    prisma.lead.findUnique({
      where: { id },
      include: {
        province: true,
        source: true,
        employee: true,
        convertedCustomer: true,
        activities: { include: { employee: true }, orderBy: { occurredAt: "desc" } },
      },
    }),
    prisma.province.findMany({ orderBy: { name: "asc" } }),
    prisma.source.findMany({ orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    getScoringConfig(),
  ]);
  return { lead, provinces, sources, employees, config };
}

export async function getDealSnapshot(viewer?: AuthContext) {
  const [stages, deals] = await Promise.all([
    prisma.pipelineStage.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.deal.findMany({
      where: viewer ? dealVisibilityWhere(viewer) : {},
      select: { stageId: true, value: true, status: true, probability: true },
    }),
  ]);
  const open = deals.filter((d) => d.status === "Đang mở");
  const funnel = stages
    .filter((s) => !s.isWon && !s.isLost)
    .map((s) => {
      const items = deals.filter((d) => d.stageId === s.id && d.status === "Đang mở");
      return {
        name: s.name,
        color: s.color,
        count: items.length,
        value: items.reduce((sum, d) => sum + (d.value ?? 0), 0),
      };
    });
  return {
    openCount: open.length,
    openValue: open.reduce((s, d) => s + (d.value ?? 0), 0),
    weightedValue: open.reduce((s, d) => s + ((d.value ?? 0) * d.probability) / 100, 0),
    wonCount: deals.filter((d) => d.status === "Thắng").length,
    wonValue: deals.filter((d) => d.status === "Thắng").reduce((s, d) => s + (d.value ?? 0), 0),
    lostCount: deals.filter((d) => d.status === "Thua").length,
    funnel,
  };
}

export async function getLeadSnapshot(viewer?: AuthContext) {
  const leads = await prisma.lead.findMany({
    where: viewer ? leadVisibilityWhere(viewer) : {},
    select: { label: true, status: true, fitPercent: true },
  });
  const byLabel = { Nóng: 0, Ấm: 0, Nguội: 0 } as Record<string, number>;
  for (const l of leads) byLabel[l.label] = (byLabel[l.label] ?? 0) + 1;
  return {
    total: leads.length,
    open: leads.filter((l) => !["Đã chuyển đổi", "Rác"].includes(l.status)).length,
    converted: leads.filter((l) => l.status === "Đã chuyển đổi").length,
    hot: byLabel["Nóng"] ?? 0,
    byLabel,
  };
}

// ----- Nhịp công việc -----
export async function getWorkRhythmTasks() {
  return prisma.workRhythmTask.findMany({
    include: { employee: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function getWorkRhythmToday(employeeId: string, dateISO: string) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  const [tasks, logs] = await Promise.all([
    prisma.workRhythmTask.findMany({
      where: { active: true, OR: [{ employeeId: null }, { employeeId }] },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.workRhythmLog.findMany({ where: { employeeId, date } }),
  ]);
  const logByTask = new Map(logs.map((l) => [l.taskId, l]));
  return tasks.map((t) => ({ task: t, log: logByTask.get(t.id) ?? null }));
}

export async function getWorkRhythmTracking(days: number, employeeId?: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates: Date[] = [];
  for (let i = days - 1; i >= 0; i--) {
    dates.push(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i));
  }
  const from = dates[0];

  const [employees, tasks, logs] = await Promise.all([
    prisma.employee.findMany({
      where: { active: true, ...(employeeId ? { id: employeeId } : {}) },
      orderBy: { name: "asc" },
    }),
    prisma.workRhythmTask.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.workRhythmLog.findMany({ where: { date: { gte: from } }, select: { employeeId: true, taskId: true, date: true, done: true, doneCount: true, evidenceCount: true } }),
  ]);

  const logSet = new Map<string, { done: boolean; doneCount: number; evidenceCount: number }>();
  for (const l of logs) {
    logSet.set(`${l.employeeId}|${l.taskId}|${dayKey(l.date)}`, {
      done: l.done,
      doneCount: l.doneCount,
      evidenceCount: l.evidenceCount,
    });
  }

  const rows = employees.map((e) => {
    const applicable = tasks.filter((t) => t.employeeId == null || t.employeeId === e.id);
    const cells = dates.map((d) => {
      const dk = dayKey(d);
      let done = 0;
      for (const t of applicable) {
        if (logSet.get(`${e.id}|${t.id}|${dk}`)?.done) done++;
      }
      return { date: d, done, total: applicable.length };
    });
    const totalSlots = applicable.length * dates.length;
    const totalDone = cells.reduce((s, c) => s + c.done, 0);
    return { employee: e, cells, rate: totalSlots > 0 ? totalDone / totalSlots : 0, totalDone, totalSlots };
  });

  return { dates, tasks, rows };
}
