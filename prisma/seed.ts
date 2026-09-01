// Seeds the database with sample data derived from the source CRM sales-report
// spreadsheet (master lists, customers, sales transactions, monthly KPI targets).
// Re-run any time with `npm run db:seed` — it wipes and reloads all tables.
import { PrismaClient } from "@prisma/client";
import customerRows from "./seed-data/customer.json";
import saleRows from "./seed-data/sale.json";
import kpiRows from "./seed-data/kpi.json";
import {
  DEFAULT_SCORING_CONFIG,
  serialiseScoringConfig,
  scoreSubject,
  dealHealth,
  dealProbability,
  type FitSubject,
} from "../lib/scoring";

const prisma = new PrismaClient();

// Deterministic PRNG (mulberry32) so re-seeding produces the same demo data.
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);

// Fixed "today" this whole app is built around (see AGENTS/system context: 2026-08-31),
// so demo tasks land as a realistic mix of overdue / due-soon / upcoming / done.
const TODAY = new Date(2026, 7, 31);

const TASK_TEMPLATES = [
  "Gọi điện tư vấn lại {name}",
  "Gửi báo giá cho {name}",
  "Hẹn gặp demo sản phẩm với {name}",
  "Follow up sau buổi tư vấn với {name}",
  "Chốt hợp đồng với {name}",
  "Xử lý phản hồi/khiếu nại của {name}",
  "Gửi tài liệu giới thiệu sản phẩm cho {name}",
  "Chăm sóc định kỳ khách hàng {name}",
];

const CARE_STATUSES: { name: string; sortOrder: number; color: string }[] = [
  { name: "Không quan tâm", sortOrder: 0, color: "#94a3b8" },
  { name: "Quan tâm", sortOrder: 1, color: "#60a5fa" },
  { name: "Đang chăm sóc", sortOrder: 2, color: "#fbbf24" },
  { name: "Tiềm năng", sortOrder: 3, color: "#fb923c" },
  { name: "Thành công", sortOrder: 4, color: "#34d399" },
];

// Months the synthetic sales/KPI history is replicated across, matching the
// "today" reference date used throughout the app (Aug 31, 2026).
const HISTORY_MONTHS = [
  "2026-01-01",
  "2026-02-01",
  "2026-03-01",
  "2026-04-01",
  "2026-05-01",
  "2026-06-01",
  "2026-07-01",
  "2026-08-01",
];

function empCode(name: string) {
  const digits = name.match(/\d+/)?.[0] ?? "000";
  return `NV${digits}`;
}
function productCode(name: string) {
  const digits = name.match(/\d+/)?.[0] ?? "000";
  return `SP${digits}`;
}
function shiftToMonth(dateStr: string, monthStr: string) {
  const d = new Date(dateStr);
  const m = new Date(monthStr);
  const lastDay = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  const day = Math.min(d.getDate(), lastDay);
  return new Date(m.getFullYear(), m.getMonth(), day);
}

type CustomerRow = [
  number | null,
  string,
  string,
  string | null,
  string | null,
  string | null,
  string | null,
  string | null,
  string | null,
  string | null,
  string | null,
  string | null,
  number | null,
  number | null,
  number | null,
  number | null,
];
type SaleRow = [
  string,
  string,
  string | null,
  string,
  string | null,
  string | null,
  string | null,
  string | null,
  string | null,
  string | null,
  string | null,
  string | null,
  string | null,
  string | null,
  string | null,
  number | null,
];
type KpiRow = [string, string, string, number, number, number, null];

async function main() {
  console.log("Clearing existing data...");
  await prisma.activity.deleteMany();
  await prisma.dealFollower.deleteMany();
  await prisma.workRhythmLog.deleteMany();
  await prisma.workRhythmTask.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.pipelineStage.deleteMany();
  await prisma.scoringConfig.deleteMany();
  await prisma.roleConfig.deleteMany();
  await prisma.user.deleteMany();
  await prisma.task.deleteMany();
  await prisma.kpiTarget.deleteMany();
  await prisma.order.deleteMany();
  await prisma.careLog.deleteMany();
  await prisma.customerDocument.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.province.deleteMany();
  await prisma.productGroup.deleteMany();
  await prisma.source.deleteMany();
  await prisma.careStatus.deleteMany();

  const sales = saleRows as unknown as SaleRow[];
  const customers = customerRows as unknown as CustomerRow[];
  const kpis = kpiRows as unknown as KpiRow[];

  const employeeNames = new Set<string>();
  const productNames = new Set<string>();
  const provinceNames = new Set<string>();
  const sourceNames = new Set<string>();
  for (const r of sales) {
    if (r[14]) employeeNames.add(r[14]);
    if (r[7]) productNames.add(r[7]);
    if (r[5]) provinceNames.add(r[5]);
    if (r[8]) sourceNames.add(r[8]);
  }
  for (const r of customers) if (r[6]) provinceNames.add(r[6]);
  // Ensure the full Nhân viên 001..010 / Sản phẩm 001..005 rosters from "Set up" exist,
  // even if a particular one has no transactions yet.
  for (let i = 1; i <= 10; i++) employeeNames.add(`Nhân viên ${String(i).padStart(3, "0")}`);
  for (let i = 1; i <= 5; i++) productNames.add(`Sản phẩm ${String(i).padStart(3, "0")}`);

  console.log("Seeding master data...");
  await prisma.employee.createMany({
    data: [...employeeNames].sort().map((name) => ({ code: empCode(name), name })),
  });
  await prisma.productGroup.createMany({
    data: [...productNames].sort().map((name) => ({ code: productCode(name), name })),
  });
  await prisma.province.createMany({
    data: [...provinceNames].sort().map((name) => ({ name })),
  });
  await prisma.source.createMany({
    data: [...sourceNames].sort().map((name) => ({ name })),
  });
  await prisma.careStatus.createMany({ data: CARE_STATUSES });

  const employees = await prisma.employee.findMany();
  const products = await prisma.productGroup.findMany();
  const provinces = await prisma.province.findMany();
  const sources = await prisma.source.findMany();
  const statuses = await prisma.careStatus.findMany();
  const empByName = new Map(employees.map((e) => [e.name, e]));
  const prodByName = new Map(products.map((p) => [p.name, p]));
  const provByName = new Map(provinces.map((p) => [p.name, p]));
  const srcByName = new Map(sources.map((s) => [s.name, s]));
  const statusByName = new Map(statuses.map((s) => [s.name, s]));

  console.log("Seeding customers + care logs...");
  // Latest sales interaction per customer code drives the CRM-facing fields
  // (assigned rep, source, funnel status, new/old) that only live in Data SALE.
  const latestSaleByCustomer = new Map<string, SaleRow>();
  for (const r of sales) {
    const code = r[1];
    const prev = latestSaleByCustomer.get(code);
    if (!prev || new Date(r[0]) >= new Date(prev[0])) latestSaleByCustomer.set(code, r);
  }

  for (const r of customers) {
    const [, code, name, gender, dob, phone, provinceName, district, lastContact, content, feedback, resolution] = r;
    const latest = latestSaleByCustomer.get(code);
    const customer = await prisma.customer.create({
      data: {
        code,
        name,
        gender: gender ?? undefined,
        dob: dob ? new Date(dob) : undefined,
        phone: phone ?? undefined,
        provinceId: (latest ? provByName.get(latest[5] ?? "") : provByName.get(provinceName ?? ""))?.id,
        district: latest?.[6] ?? district ?? undefined,
        sourceId: latest?.[8] ? srcByName.get(latest[8])?.id : undefined,
        employeeId: latest?.[14] ? empByName.get(latest[14])?.id : undefined,
        careStatusId: latest?.[11] ? statusByName.get(latest[11])?.id : undefined,
        isNew: latest ? latest[2] === "Mới" : true,
        latestContactDate: lastContact ? new Date(lastContact) : undefined,
        storeName: latest?.[9] ?? undefined,
        storeAddress: latest?.[10] ?? undefined,
      },
    });
    if (content || feedback || resolution) {
      await prisma.careLog.create({
        data: {
          customerId: customer.id,
          date: lastContact ? new Date(lastContact) : new Date(),
          content: content ?? undefined,
          feedback: feedback ?? undefined,
          resolution: resolution ?? undefined,
        },
      });
    }
  }
  // Sales referencing a customer code absent from the Customer sheet — create a
  // minimal record so the transaction still links to a real customer.
  for (const r of sales) {
    const code = r[1];
    const exists = await prisma.customer.findUnique({ where: { code } });
    if (exists) continue;
    await prisma.customer.create({
      data: {
        code,
        name: r[3],
        phone: r[4] ?? undefined,
        provinceId: r[5] ? provByName.get(r[5])?.id : undefined,
        district: r[6] ?? undefined,
        sourceId: r[8] ? srcByName.get(r[8])?.id : undefined,
        employeeId: r[14] ? empByName.get(r[14])?.id : undefined,
        careStatusId: r[11] ? statusByName.get(r[11])?.id : undefined,
        isNew: r[2] === "Mới",
        storeName: r[9] ?? undefined,
        storeAddress: r[10] ?? undefined,
      },
    });
  }
  const customerByCode = new Map((await prisma.customer.findMany()).map((c) => [c.code, c]));

  // --- taxCode / industry cho ~55% khách hàng (giúp deal fit có chiều sâu) ---
  console.log("Seeding customer tax codes, industries & contacts...");
  const INDUSTRIES = ["Bán lẻ", "F&B", "Sản xuất", "Dịch vụ", "Xây dựng", "Giáo dục", "Logistics", "Thời trang"];
  const CONTACT_TITLES = ["Giám đốc", "Trưởng phòng Mua hàng", "Chủ cửa hàng", "Kế toán trưởng", "Phó giám đốc", "Nhân viên phụ trách"];
  const CONTACT_FIRST = ["An", "Bình", "Chi", "Dũng", "Hà", "Hải", "Hoa", "Khánh", "Lan", "Long", "Mai", "Nam", "Nga", "Phúc", "Quang", "Tâm", "Thu", "Trung", "Vy", "Yến"];
  const CONTACT_LAST = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ", "Đặng", "Bùi", "Đỗ", "Hồ"];
  const contactByCustomer = new Map<string, { id: string }[]>();
  for (const c of customerByCode.values()) {
    if (rand() < 0.55) {
      await prisma.customer.update({
        where: { id: c.id },
        data: {
          taxCode: `${Math.floor(1000000000 + rand() * 8999999999)}`,
          industry: INDUSTRIES[Math.floor(rand() * INDUSTRIES.length)],
        },
      });
    }
    if (rand() < 0.6) {
      const n = rand() < 0.35 ? 2 : 1;
      const made: { id: string }[] = [];
      for (let i = 0; i < n; i++) {
        const nm = `${CONTACT_LAST[Math.floor(rand() * CONTACT_LAST.length)]} Thị ${CONTACT_FIRST[Math.floor(rand() * CONTACT_FIRST.length)]}`;
        const ct = await prisma.contact.create({
          data: {
            name: nm,
            title: CONTACT_TITLES[Math.floor(rand() * CONTACT_TITLES.length)],
            phone: `09${Math.floor(10000000 + rand() * 89999999)}`,
            email: `${nm.split(" ").pop()?.toLowerCase()}${i}@${c.code.toLowerCase()}.vn`,
            customerId: c.id,
          },
        });
        made.push({ id: ct.id });
      }
      contactByCustomer.set(c.id, made);
    }
  }

  console.log("Seeding sales transactions across the Jan-Aug 2026 history window...");
  const orderData: {
    date: Date;
    customerId?: string;
    employeeId?: string;
    productGroupId?: string;
    provinceId?: string;
    sourceId?: string;
    careStatusId?: string;
    storeName?: string;
    storeAddress?: string;
    isClosed: boolean;
    value: number | null;
  }[] = [];
  for (const month of HISTORY_MONTHS) {
    for (const r of sales) {
      const [date, code, , , , province, , product, source, storeName, storeAddress, careStatus, , , employee, value] = r;
      const scale = 0.7 + rand() * 0.6;
      const scaledValue = value != null ? Math.round((value * scale) / 1000) * 1000 : null;
      orderData.push({
        date: shiftToMonth(date, month),
        customerId: customerByCode.get(code)?.id,
        employeeId: employee ? empByName.get(employee)?.id : undefined,
        productGroupId: product ? prodByName.get(product)?.id : undefined,
        provinceId: province ? provByName.get(province)?.id : undefined,
        sourceId: source ? srcByName.get(source)?.id : undefined,
        careStatusId: careStatus ? statusByName.get(careStatus)?.id : undefined,
        storeName: storeName ?? undefined,
        storeAddress: storeAddress ?? undefined,
        isClosed: careStatus === "Thành công" && scaledValue != null,
        value: scaledValue,
      });
    }
  }
  // createMany in chunks (SQLite has a bound-variable limit)
  for (let i = 0; i < orderData.length; i += 100) {
    await prisma.order.createMany({ data: orderData.slice(i, i + 100) });
  }

  console.log("Seeding monthly KPI targets...");
  const kpiData: { employeeId: string; month: Date; productGroupId: string; targetRevenue: number }[] = [];
  for (const month of HISTORY_MONTHS) {
    for (const r of kpis) {
      const [employee, , product, target] = r;
      const emp = empByName.get(employee);
      const prod = product ? prodByName.get(product) : undefined;
      if (!emp || !prod) continue;
      const scale = 0.85 + rand() * 0.3;
      kpiData.push({
        employeeId: emp.id,
        month: new Date(month),
        productGroupId: prod.id,
        targetRevenue: Math.round((target * scale) / 1000) * 1000,
      });
    }
  }
  // Some (employee, month, product) combos repeat in the source sheet — keep the last one.
  const dedup = new Map<string, (typeof kpiData)[number]>();
  for (const k of kpiData) dedup.set(`${k.employeeId}|${k.month.toISOString()}|${k.productGroupId}`, k);
  await prisma.kpiTarget.createMany({ data: [...dedup.values()] });

  console.log("Seeding employee tasks on the sale pipeline...");
  const pipelineCustomers = [...customerByCode.values()].filter((c) => c.employeeId);
  const taskData: {
    title: string;
    employeeId: string;
    customerId: string;
    status: string;
    priority: string;
    dueDate: Date;
    completedAt: Date | null;
  }[] = [];
  for (const c of pipelineCustomers) {
    const taskCount = rand() < 0.55 ? (rand() < 0.5 ? 1 : 2) : 0;
    for (let i = 0; i < taskCount; i++) {
      const template = TASK_TEMPLATES[Math.floor(rand() * TASK_TEMPLATES.length)];
      const statusRoll = rand();
      const status = statusRoll < 0.4 ? "Cần làm" : statusRoll < 0.7 ? "Đang làm" : "Hoàn thành";
      const dueOffsetDays = Math.floor(rand() * 26) - 10; // -10..+15 days around "today"
      const dueDate = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + dueOffsetDays);
      const completedAt =
        status === "Hoàn thành"
          ? new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - Math.floor(rand() * 10))
          : null;
      taskData.push({
        title: template.replace("{name}", c.name),
        employeeId: c.employeeId!,
        customerId: c.id,
        status,
        priority: rand() < 0.2 ? "Cao" : rand() < 0.6 ? "Bình thường" : "Thấp",
        dueDate,
        completedAt,
      });
    }
  }
  for (let i = 0; i < taskData.length; i += 100) {
    await prisma.task.createMany({ data: taskData.slice(i, i + 100) });
  }

  // ==========================================================================
  // Pipeline stages, scoring config, leads, deals, activities, nhịp công việc
  // ==========================================================================
  const nowSeed = new Date(TODAY);
  const ACT_TITLE: Record<string, string> = {
    form_submit: "Khách điền biểu mẫu",
    chat_inbound: "Khách chủ động nhắn tin",
    call: "Cuộc gọi",
    note: "Ghi chú",
    email: "Email",
    meeting: "Cuộc họp",
    quotation: "Đã gửi báo giá",
    checkin: "Check-in tại chỗ khách",
    deal_created: "Đã mở cơ hội bán",
  };

  console.log("Seeding pipeline stages + scoring config...");
  await prisma.pipelineStage.createMany({
    data: [
      { name: "Lead Mới", sortOrder: 0, color: "#60a5fa", baseWinRate: 0.05 },
      { name: "Đã gặp", sortOrder: 1, color: "#818cf8", baseWinRate: 0.15 },
      { name: "Tiềm năng", sortOrder: 2, color: "#fb923c", baseWinRate: 0.25 },
      { name: "Nóng", sortOrder: 3, color: "#ef4444", baseWinRate: 0.3 },
      { name: "Thắng", sortOrder: 4, color: "#10b981", baseWinRate: 1, isWon: true },
      { name: "Mất", sortOrder: 5, color: "#94a3b8", baseWinRate: 0, isLost: true },
    ],
  });
  const stages = await prisma.pipelineStage.findMany({ orderBy: { sortOrder: "asc" } });
  const openStages = stages.filter((s) => !s.isWon && !s.isLost);
  const wonStage = stages.find((s) => s.isWon)!;
  const lostStage = stages.find((s) => s.isLost)!;

  await prisma.scoringConfig.create({
    data: { name: "default", ...serialiseScoringConfig(DEFAULT_SCORING_CONFIG) },
  });
  const cfg = DEFAULT_SCORING_CONFIG;

  console.log("Seeding leads...");
  const industries = ["Bán lẻ", "F&B", "Sản xuất", "Dịch vụ", "Xây dựng", "Giáo dục", "Logistics", "Thời trang"];
  const titlesPool = ["Giám đốc", "Trưởng phòng Kinh doanh", "Chủ cửa hàng", "Nhân viên mua hàng", "Phó giám đốc", "", ""];
  const objectivesPool = [
    "Tăng doanh số online",
    "Mở rộng chi nhánh",
    "Chuẩn hoá quy trình bán hàng",
    "Quản lý tồn kho",
    "",
  ];
  const firstNames = ["An", "Bình", "Cường", "Dung", "Giang", "Hà", "Hải", "Hoa", "Hùng", "Lan", "Linh", "Minh", "Nam", "Nga", "Phong", "Quân", "Sơn", "Thảo", "Trang", "Việt"];
  const lastNames = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Vũ", "Đặng", "Bùi", "Đỗ"];
  const companyKind = ["Công ty TNHH", "Cửa hàng", "Hộ kinh doanh", "Công ty CP", "Doanh nghiệp"];
  const leadActTypes = ["form_submit", "chat_inbound", "call", "note", "email", "meeting"];

  const LEAD_COUNT = 36;
  for (let i = 0; i < LEAD_COUNT; i++) {
    const fn = firstNames[Math.floor(rand() * firstNames.length)];
    const ln = lastNames[Math.floor(rand() * lastNames.length)];
    const person = `${ln} Văn ${fn}`;
    const company = rand() < 0.8 ? `${companyKind[Math.floor(rand() * companyKind.length)]} ${fn} ${ln}` : null;
    const province = provinces[Math.floor(rand() * provinces.length)];
    const source = sources[Math.floor(rand() * sources.length)];
    const title = titlesPool[Math.floor(rand() * titlesPool.length)];
    const statusRoll = rand();
    const status =
      statusRoll < 0.15 ? "Đã chuyển đổi" : statusRoll < 0.22 ? "Rác" : statusRoll < 0.55 ? "Đang liên hệ" : statusRoll < 0.8 ? "Mới" : "Đủ điều kiện";

    const subject: FitSubject = {
      phone: rand() < 0.85 ? `09${Math.floor(10000000 + rand() * 89999999)}` : null,
      email: rand() < 0.6 ? `lead${i + 1}@example.com` : null,
      companyName: company,
      taxCode: rand() < 0.4 ? `${Math.floor(1000000000 + rand() * 8999999999)}` : null,
      title: title || null,
      industry: rand() < 0.7 ? industries[Math.floor(rand() * industries.length)] : null,
      provinceName: province?.name ?? null,
      objective: rand() < 0.5 ? objectivesPool[Math.floor(rand() * objectivesPool.length)] || null : null,
      partnerReferred: rand() < 0.25,
      sourceName: source?.name ?? null,
      campaign: rand() < 0.5 ? `CD-2026-${Math.ceil(rand() * 6)}` : null,
    };

    const acts: { type: string; occurredAt: Date }[] = [];
    // Nhiều lead ít tương tác, một số "nóng" tương tác dày & gần đây.
    const engaged = rand() < 0.4;
    const actCount = engaged ? 4 + Math.floor(rand() * 6) : Math.floor(rand() * 4);
    for (let a = 0; a < actCount; a++) {
      const daysAgo = engaged ? Math.floor(rand() * 25) + 1 : Math.floor(rand() * 55) + 1;
      acts.push({
        type: leadActTypes[Math.floor(rand() * leadActTypes.length)],
        occurredAt: new Date(nowSeed.getTime() - daysAgo * 86_400_000),
      });
    }
    if (engaged && rand() < 0.6) {
      acts.push({ type: "meeting", occurredAt: new Date(nowSeed.getTime() - Math.floor(rand() * 10) * 86_400_000) });
    }
    const r = scoreSubject(subject, acts, cfg, nowSeed);
    const owner = employees[Math.floor(rand() * employees.length)];

    const lead = await prisma.lead.create({
      data: {
        code: `L${String(i + 1).padStart(4, "0")}`,
        name: person,
        companyName: company,
        phone: subject.phone,
        email: subject.email,
        title: subject.title,
        taxCode: subject.taxCode,
        industry: subject.industry,
        provinceId: province?.id,
        sourceId: source?.id,
        campaign: subject.campaign,
        objective: subject.objective,
        partnerReferred: subject.partnerReferred ?? false,
        employeeId: owner.id,
        status,
        fitScore: r.fitScore,
        fitPercent: r.fitPercent,
        fitGrade: r.fitGrade,
        engagementScore: r.engagementScore,
        engagementGrade: r.engagementGrade,
        label: r.label,
        scoredAt: nowSeed,
      },
    });
    for (const ac of acts) {
      await prisma.activity.create({
        data: {
          leadId: lead.id,
          type: ac.type,
          title: ACT_TITLE[ac.type] ?? ac.type,
          occurredAt: ac.occurredAt,
          employeeId: owner.id,
        },
      });
    }
  }

  console.log("Seeding deals + activity timelines...");
  const dealCustomers = pipelineCustomers.slice(0, 40);
  const dealTitleTpl = [
    "Triển khai CRM cho {n}",
    "Gói phần mềm bán hàng — {n}",
    "Nâng cấp hệ thống {n}",
    "Hợp đồng năm {n}",
    "Dự án số hoá {n}",
  ];
  const forecastCats = ["Cam kết", "Khả năng cao", "Tiềm năng", "Rủi ro", null];
  const closeBuckets = ["Trong tuần", "Trong tháng", "Quý này", null];
  const dealActTypes = ["meeting", "call", "email", "note", "quotation", "checkin"];
  const DEAL_COUNT = Math.min(18, dealCustomers.length);

  for (let i = 0; i < DEAL_COUNT; i++) {
    const cust = dealCustomers[Math.floor(rand() * dealCustomers.length)];
    // ~1/3 số deal chưa gắn công ty (giống màn hình Deals mẫu).
    const noCompany = i >= 4 && rand() < 0.33;
    const outcome = i < 2 ? "won" : i < 4 ? "lost" : "open";
    const stage = outcome === "won" ? wonStage : outcome === "lost" ? lostStage : openStages[Math.floor(rand() * openStages.length)];
    const value = Math.round(10 + rand() * 190) * 1_000_000;
    const owner = employees[Math.floor(rand() * employees.length)];
    const createdDaysAgo = 20 + Math.floor(rand() * 90);
    const createdAt = new Date(nowSeed.getTime() - createdDaysAgo * 86_400_000);

    const acts: { type: string; occurredAt: Date; title: string; meta?: string }[] = [
      { type: "deal_created", occurredAt: createdAt, title: ACT_TITLE.deal_created },
    ];
    const nSteps = Math.min(openStages.length - 1, 1 + Math.floor(rand() * 3));
    for (let s = 0; s < nSteps; s++) {
      const d = createdDaysAgo - Math.floor(((s + 1) / (nSteps + 1)) * createdDaysAgo);
      acts.push({
        type: "stage_change",
        occurredAt: new Date(nowSeed.getTime() - d * 86_400_000),
        title: `Chuyển giai đoạn: ${openStages[s].name} → ${openStages[s + 1].name}`,
        meta: JSON.stringify({ fromName: openStages[s].name, toName: openStages[s + 1].name }),
      });
    }
    const extra = 4 + Math.floor(rand() * 8);
    for (let a = 0; a < extra; a++) {
      const daysAgo = Math.floor(rand() * Math.max(1, createdDaysAgo));
      const t = dealActTypes[Math.floor(rand() * dealActTypes.length)];
      acts.push({
        type: t,
        occurredAt: new Date(nowSeed.getTime() - daysAgo * 86_400_000),
        title: ACT_TITLE[t] ?? t,
        meta:
          t === "checkin"
            ? JSON.stringify({ lat: 10.7 + rand() * 0.25, lng: 106.6 + rand() * 0.25 })
            : t === "quotation"
              ? JSON.stringify({ value })
              : undefined,
      });
    }

    const subject: FitSubject = noCompany ? {} : { phone: cust.phone, companyName: cust.name };
    const r = scoreSubject(subject, acts, cfg, nowSeed);
    const health = dealHealth(r.engagementGrade);
    const baseWin = stage.isWon ? 1 : stage.isLost ? 0 : stage.baseWinRate;
    const probability = outcome === "won" ? 100 : outcome === "lost" ? 0 : dealProbability(baseWin, health);

    const deal = await prisma.deal.create({
      data: {
        code: `D${String(i + 1).padStart(4, "0")}`,
        title: noCompany
          ? `Deal - ${["Trần Thị Linh", "Anh Nam 2D", "Chị Hoa", "Lê Văn Sơn", "Mai Phương Thảo"][i % 5]}`
          : dealTitleTpl[Math.floor(rand() * dealTitleTpl.length)].replace("{n}", cust.name),
        value,
        customerId: noCompany ? null : cust.id,
        contactId: noCompany ? null : (contactByCustomer.get(cust.id)?.[0]?.id ?? null),
        ownerId: owner.id,
        stageId: stage.id,
        status: outcome === "won" ? "Thắng" : outcome === "lost" ? "Thua" : "Đang mở",
        probability,
        healthLabel: outcome === "won" ? "Nóng" : outcome === "lost" ? "Lạnh" : health.healthLabel,
        healthScore: r.engagementScore,
        forecastCategory: outcome === "open" ? forecastCats[Math.floor(rand() * forecastCats.length)] : null,
        closeBucket: outcome === "open" ? closeBuckets[Math.floor(rand() * closeBuckets.length)] : null,
        expectedCloseDate: new Date(nowSeed.getTime() + (Math.floor(rand() * 40) - 5) * 86_400_000),
        fitScore: r.fitScore,
        engagementScore: r.engagementScore,
        label: r.label,
        stageEnteredAt: new Date(nowSeed.getTime() - Math.floor(rand() * 15) * 86_400_000),
        wonAt: outcome === "won" ? new Date(nowSeed.getTime() - Math.floor(rand() * 10) * 86_400_000) : null,
        lostAt: outcome === "lost" ? new Date(nowSeed.getTime() - Math.floor(rand() * 10) * 86_400_000) : null,
        lostReason: outcome === "lost" ? "Khách chọn nhà cung cấp khác" : null,
        createdAt,
        scoredAt: nowSeed,
      },
    });

    for (const ac of acts) {
      await prisma.activity.create({
        data: {
          dealId: deal.id,
          type: ac.type,
          title: ac.title,
          meta: ac.meta,
          occurredAt: ac.occurredAt,
          employeeId: owner.id,
        },
      });
    }

    const pickedFollowers = new Set<string>([owner.id]);
    const followerN = 1 + Math.floor(rand() * 3);
    for (let f = 0; f < followerN; f++) {
      const emp = employees[Math.floor(rand() * employees.length)];
      if (pickedFollowers.has(emp.id)) continue;
      pickedFollowers.add(emp.id);
      await prisma.dealFollower.create({ data: { dealId: deal.id, employeeId: emp.id } });
    }

    if (outcome === "won") {
      await prisma.order.create({
        data: {
          date: deal.wonAt ?? nowSeed,
          customerId: cust.id,
          employeeId: owner.id,
          dealId: deal.id,
          isClosed: true,
          value,
        },
      });
    }
  }

  console.log("Seeding nhịp công việc...");
  const rhythmTasks = await Promise.all([
    prisma.workRhythmTask.create({
      data: { title: "[Demo] Báo cáo doanh số cuối ngày", category: "Báo cáo", cadence: "daily", sortOrder: 0, color: "#3b82f6" },
    }),
    prisma.workRhythmTask.create({
      data: {
        title: "[Demo] Đăng 5 bài Facebook + Zalo",
        cadence: "daily",
        sortOrder: 1,
        color: "#22c55e",
        channels: JSON.stringify(["Facebook", "Zalo"]),
        evidenceMin: 5,
      },
    }),
    prisma.workRhythmTask.create({
      data: { title: "[Demo] Gọi chăm sóc 10 lead mới", cadence: "daily", sortOrder: 2, color: "#a855f7", targetCount: 10 },
    }),
  ]);

  type RLog = {
    taskId: string;
    employeeId: string;
    date: Date;
    done: boolean;
    doneCount: number;
    evidenceCount: number;
    completedAt: Date | null;
  };
  const rhythmLogs: RLog[] = [];
  for (let d = 13; d >= 0; d--) {
    const day = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - d);
    for (const emp of employees) {
      for (const rt of rhythmTasks) {
        if (rand() < 0.25) continue;
        const done = rand() < 0.7;
        const doneCount = rt.targetCount ? (done ? rt.targetCount : Math.floor(rand() * rt.targetCount)) : done ? 1 : 0;
        const evidenceCount = rt.evidenceMin
          ? done
            ? rt.evidenceMin + Math.floor(rand() * 3)
            : Math.floor(rand() * rt.evidenceMin)
          : 0;
        rhythmLogs.push({ taskId: rt.id, employeeId: emp.id, date: day, done, doneCount, evidenceCount, completedAt: done ? day : null });
      }
    }
  }
  for (let i = 0; i < rhythmLogs.length; i += 100) {
    await prisma.workRhythmLog.createMany({ data: rhythmLogs.slice(i, i + 100) });
  }

  // --- Users (tài khoản đăng nhập) ---
  console.log("Seeding users...");
  const adminEmail =
    (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim().toLowerCase() || "admin@demo.local";
  function slugEmail(name: string) {
    const digits = name.match(/\d+/)?.[0] ?? "000";
    return `nv${digits}@demo.local`;
  }
  await prisma.user.create({
    data: {
      email: adminEmail,
      name: "Quản trị hệ thống",
      title: "Administrator",
      role: "ADMIN",
      active: true,
    },
  });
  await prisma.user.createMany({
    data: employees.map((e, i) => {
      const manager = i % 3 === 0;
      return {
        email: slugEmail(e.name),
        name: e.name,
        title: manager ? "Quản lý kinh doanh" : "Nhân viên kinh doanh",
        phone: e.phone ?? `09${String(10000000 + i * 111111).slice(0, 8)}`,
        role: manager ? "MANAGER" : "SALES",
        active: true,
        employeeId: e.id,
      };
    }),
    skipDuplicates: true,
  });

  const { DEFAULT_ROLE_PERMS } = await import("../lib/permissions");
  await prisma.roleConfig.createMany({
    data: (["ADMIN", "MANAGER", "SALES"] as const).map((role) => ({
      role,
      perms: JSON.stringify(DEFAULT_ROLE_PERMS[role]),
    })),
    skipDuplicates: true,
  });

  const [leadTotal, dealTotal, activityTotal, contactTotal, userTotal] = await Promise.all([
    prisma.lead.count(),
    prisma.deal.count(),
    prisma.activity.count(),
    prisma.contact.count(),
    prisma.user.count(),
  ]);

  console.log(
    `Done. ${employees.length} employees, ${userTotal} users, ${customerByCode.size} customers, ${contactTotal} contacts, ${orderData.length} orders, ${dedup.size} KPI targets, ${taskData.length} tasks, ` +
      `${leadTotal} leads, ${dealTotal} deals, ${activityTotal} activities, ${rhythmTasks.length} rhythm tasks, ${rhythmLogs.length} rhythm logs.`,
  );
  console.log(`\n  → Đăng nhập demo: chọn "${adminEmail}" (ADMIN) hoặc bất kỳ nv0XX@demo.local.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
