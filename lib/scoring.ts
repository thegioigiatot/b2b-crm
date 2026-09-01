// Bộ chấm điểm Lead / Deal — thuần hàm, không đụng Prisma nên dễ test và tái dùng
// cả ở server actions lẫn seed.
//
// Hai trục:
//   • Độ phù hợp (fit) — "họ là ai": các tiêu chí boolean có trọng số. Trọng số dương
//     cộng vào cả tử số lẫn điểm tối đa; trọng số âm chỉ trừ.
//   • Mức tương tác (engagement) — "họ làm gì": mỗi sự kiện có điểm, nửa đời (ngày) và
//     trần đếm. Giá trị một sự kiện = points * 0.5 ^ (tuổi_ngày / nửa_đời), chỉ tính
//     `cap` lần gần nhất cho mỗi loại.
//
// Chấm hạng fit A/B/C/D và engagement 1/2/3/4 theo ngưỡng, rồi tra ma trận 4×4 ra
// nhãn Nóng / Ấm / Nguội.

export type FitWeightKey =
  | "has_phone"
  | "has_email"
  | "has_company"
  | "has_tax_code"
  | "decision_maker"
  | "has_industry"
  | "has_province"
  | "objective_declared"
  | "partner_referred"
  | "source_high_intent"
  | "has_campaign"
  | "no_contact_channel";

export type EngagementEventKey =
  | "checkin"
  | "deal_created"
  | "quotation_sent"
  | "meeting"
  | "chat_inbound"
  | "form_submit"
  | "stage_forward"
  | "call"
  | "email"
  | "task"
  | "note";

export type EngagementEventCfg = { points: number; halfLife: number; cap: number };

export type ScoringConfigShape = {
  fitWeights: Record<FitWeightKey, number>;
  engagementEvents: Record<EngagementEventKey, EngagementEventCfg>;
  fitThresholds: { A: number; B: number; C: number };
  engagementThresholds: { g1: number; g2: number; g3: number };
  labelMatrix: LeadLabel[][]; // 4 rows (A..D) × 4 cols (1..4)
  mode: "fixed" | "distribution";
};

export type LeadLabel = "Nóng" | "Ấm" | "Nguội";
export type FitGrade = "A" | "B" | "C" | "D";
export type EngagementGrade = 1 | 2 | 3 | 4;

export const DEFAULT_SCORING_CONFIG: ScoringConfigShape = {
  fitWeights: {
    has_phone: 10,
    has_email: 5,
    has_company: 10,
    has_tax_code: 12,
    decision_maker: 15,
    has_industry: 6,
    has_province: 5,
    objective_declared: 8,
    partner_referred: 12,
    source_high_intent: 12,
    has_campaign: 5,
    no_contact_channel: -25,
  },
  engagementEvents: {
    checkin: { points: 30, halfLife: 45, cap: 3 },
    deal_created: { points: 35, halfLife: 90, cap: 1 },
    quotation_sent: { points: 25, halfLife: 60, cap: 3 },
    meeting: { points: 18, halfLife: 30, cap: 5 },
    chat_inbound: { points: 12, halfLife: 14, cap: 10 },
    form_submit: { points: 15, halfLife: 30, cap: 3 },
    stage_forward: { points: 10, halfLife: 30, cap: 5 },
    call: { points: 8, halfLife: 21, cap: 10 },
    email: { points: 4, halfLife: 21, cap: 10 },
    task: { points: 3, halfLife: 21, cap: 10 },
    note: { points: 2, halfLife: 14, cap: 10 },
  },
  fitThresholds: { A: 70, B: 50, C: 30 },
  engagementThresholds: { g1: 65, g2: 40, g3: 15 },
  labelMatrix: [
    ["Nóng", "Nóng", "Ấm", "Nguội"],
    ["Nóng", "Ấm", "Ấm", "Nguội"],
    ["Ấm", "Ấm", "Nguội", "Nguội"],
    ["Ấm", "Nguội", "Nguội", "Nguội"],
  ],
  mode: "fixed",
};

const FIT_LABELS: Record<FitWeightKey, string> = {
  has_phone: "Có số điện thoại",
  has_email: "Có email",
  has_company: "Có tên công ty",
  has_tax_code: "Có mã số thuế (pháp nhân thật)",
  decision_maker: "Chức danh có thẩm quyền quyết định",
  has_industry: "Đã khai ngành nghề",
  has_province: "Đã khai tỉnh/thành",
  objective_declared: "Đã khai mục tiêu bán hàng",
  partner_referred: "Do đối tác giới thiệu",
  source_high_intent: "Nguồn có ý định cao (giới thiệu / sự kiện / hội thảo)",
  has_campaign: "Gắn chiến dịch marketing",
  no_contact_channel: "Không có kênh liên hệ nào",
};

const ENGAGEMENT_LABELS: Record<EngagementEventKey, string> = {
  checkin: "Check-in tại chỗ khách (có xác minh toạ độ)",
  deal_created: "Đã mở cơ hội bán",
  quotation_sent: "Đã gửi báo giá",
  meeting: "Cuộc họp",
  chat_inbound: "Khách chủ động nhắn tin",
  form_submit: "Khách điền biểu mẫu",
  stage_forward: "Tiến sang giai đoạn sau",
  call: "Cuộc gọi",
  email: "Email",
  task: "Việc cần làm đã xong",
  note: "Ghi chú",
};

export const FIT_WEIGHT_KEYS = Object.keys(DEFAULT_SCORING_CONFIG.fitWeights) as FitWeightKey[];
export const ENGAGEMENT_EVENT_KEYS = Object.keys(
  DEFAULT_SCORING_CONFIG.engagementEvents,
) as EngagementEventKey[];

export function fitWeightLabel(key: string) {
  return FIT_LABELS[key as FitWeightKey] ?? key;
}
export function engagementEventLabel(key: string) {
  return ENGAGEMENT_LABELS[key as EngagementEventKey] ?? key;
}

// Loại Activity.type -> khoá sự kiện engagement.
export function activityTypeToEvent(type: string): EngagementEventKey | null {
  switch (type) {
    case "checkin":
      return "checkin";
    case "deal_created":
      return "deal_created";
    case "quotation":
    case "quotation_sent":
      return "quotation_sent";
    case "meeting":
      return "meeting";
    case "chat_inbound":
      return "chat_inbound";
    case "form_submit":
      return "form_submit";
    case "stage_change":
      return "stage_forward";
    case "call":
      return "call";
    case "email":
      return "email";
    case "task":
      return "task";
    case "note":
      return "note";
    default:
      return null;
  }
}

// ---------- parse / serialise ----------

function coerceNumberMap<T extends string>(raw: unknown, fallback: Record<T, number>): Record<T, number> {
  const out = { ...fallback };
  if (raw && typeof raw === "object") {
    for (const k of Object.keys(fallback) as T[]) {
      const v = (raw as Record<string, unknown>)[k];
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    }
  }
  return out;
}

export function parseScoringConfig(row: {
  fitWeights: string;
  engagementEvents: string;
  fitThresholds: string;
  engagementThresholds: string;
  labelMatrix: string;
  mode: string;
} | null): ScoringConfigShape {
  if (!row) return DEFAULT_SCORING_CONFIG;
  const safe = <T,>(s: string, fb: T): T => {
    try {
      return JSON.parse(s) as T;
    } catch {
      return fb;
    }
  };
  const events = safe<Record<string, Partial<EngagementEventCfg>>>(row.engagementEvents, {});
  const engagementEvents = { ...DEFAULT_SCORING_CONFIG.engagementEvents };
  for (const k of ENGAGEMENT_EVENT_KEYS) {
    const e = events[k];
    if (e) {
      engagementEvents[k] = {
        points: typeof e.points === "number" ? e.points : engagementEvents[k].points,
        halfLife: typeof e.halfLife === "number" && e.halfLife > 0 ? e.halfLife : engagementEvents[k].halfLife,
        cap: typeof e.cap === "number" && e.cap >= 0 ? e.cap : engagementEvents[k].cap,
      };
    }
  }
  const matrixRaw = safe<unknown>(row.labelMatrix, DEFAULT_SCORING_CONFIG.labelMatrix);
  const labelMatrix = Array.isArray(matrixRaw) && matrixRaw.length === 4
    ? (matrixRaw as LeadLabel[][])
    : DEFAULT_SCORING_CONFIG.labelMatrix;

  return {
    fitWeights: coerceNumberMap(safe(row.fitWeights, {}), DEFAULT_SCORING_CONFIG.fitWeights),
    engagementEvents,
    fitThresholds: coerceNumberMap(safe(row.fitThresholds, {}), DEFAULT_SCORING_CONFIG.fitThresholds),
    engagementThresholds: coerceNumberMap(
      safe(row.engagementThresholds, {}),
      DEFAULT_SCORING_CONFIG.engagementThresholds,
    ),
    labelMatrix,
    mode: row.mode === "distribution" ? "distribution" : "fixed",
  };
}

export function serialiseScoringConfig(cfg: ScoringConfigShape) {
  return {
    fitWeights: JSON.stringify(cfg.fitWeights),
    engagementEvents: JSON.stringify(cfg.engagementEvents),
    fitThresholds: JSON.stringify(cfg.fitThresholds),
    engagementThresholds: JSON.stringify(cfg.engagementThresholds),
    labelMatrix: JSON.stringify(cfg.labelMatrix),
    mode: cfg.mode,
  };
}

// ---------- fit ----------

const DECISION_MAKER_RE = /giám đốc|tổng giám đốc|phó giám đốc|trưởng phòng|trưởng nhóm|quản lý|chủ tịch|chủ cửa hàng|chủ shop|founder|co-?founder|ceo|coo|cfo|cto|owner|director|head of|manager/i;
const HIGH_INTENT_SOURCE_RE = /giới thiệu|đối tác|sự kiện|hội thảo|hội chợ|workshop|referral|event|seminar|webinar/i;

export type FitSubject = {
  phone?: string | null;
  email?: string | null;
  companyName?: string | null;
  taxCode?: string | null;
  title?: string | null;
  industry?: string | null;
  provinceName?: string | null;
  objective?: string | null;
  partnerReferred?: boolean | null;
  sourceName?: string | null;
  campaign?: string | null;
};

function predicate(key: FitWeightKey, s: FitSubject): boolean {
  const has = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  switch (key) {
    case "has_phone":
      return has(s.phone);
    case "has_email":
      return has(s.email);
    case "has_company":
      return has(s.companyName);
    case "has_tax_code":
      return has(s.taxCode);
    case "decision_maker":
      return has(s.title) && DECISION_MAKER_RE.test(s.title!);
    case "has_industry":
      return has(s.industry);
    case "has_province":
      return has(s.provinceName);
    case "objective_declared":
      return has(s.objective);
    case "partner_referred":
      return !!s.partnerReferred || (has(s.sourceName) && /giới thiệu|đối tác|referral/i.test(s.sourceName!));
    case "source_high_intent":
      return has(s.sourceName) && HIGH_INTENT_SOURCE_RE.test(s.sourceName!);
    case "has_campaign":
      return has(s.campaign);
    case "no_contact_channel":
      return !has(s.phone) && !has(s.email);
  }
}

// Chi tiết từng tiêu chí fit — dùng cho checklist trên trang lead.
export function fitBreakdown(subject: FitSubject, weights: Record<FitWeightKey, number>) {
  return FIT_WEIGHT_KEYS.map((key) => ({
    key,
    label: fitWeightLabel(key),
    weight: weights[key] ?? 0,
    met: predicate(key, subject),
  }));
}

export function computeFit(subject: FitSubject, weights: Record<FitWeightKey, number>) {
  let score = 0;
  let maxScore = 0;
  for (const key of FIT_WEIGHT_KEYS) {
    const w = weights[key] ?? 0;
    if (w > 0) maxScore += w;
    if (predicate(key, subject)) score += w;
  }
  const percent = maxScore > 0 ? Math.round((100 * Math.max(0, score)) / maxScore) : 0;
  return { score: Math.round(score), maxScore, percent };
}

// ---------- engagement ----------

export type EngagementActivity = { type: string; occurredAt: Date | string };

export function computeEngagement(
  activities: EngagementActivity[],
  events: Record<EngagementEventKey, EngagementEventCfg>,
  now: Date = new Date(),
) {
  const buckets = new Map<EngagementEventKey, number[]>(); // ages (ngày) mỗi loại
  for (const a of activities) {
    const key = activityTypeToEvent(a.type);
    if (!key) continue;
    const t = typeof a.occurredAt === "string" ? new Date(a.occurredAt) : a.occurredAt;
    const ageDays = Math.max(0, (now.getTime() - t.getTime()) / 86_400_000);
    const arr = buckets.get(key) ?? [];
    arr.push(ageDays);
    buckets.set(key, arr);
  }
  let total = 0;
  const perType: Partial<Record<EngagementEventKey, number>> = {};
  for (const [key, ages] of buckets) {
    const cfg = events[key];
    if (!cfg) continue;
    ages.sort((a, b) => a - b); // gần nhất trước
    let sub = 0;
    for (const age of ages.slice(0, cfg.cap)) {
      sub += cfg.points * Math.pow(0.5, age / cfg.halfLife);
    }
    perType[key] = Math.round(sub * 10) / 10;
    total += sub;
  }
  return { score: Math.round(total * 10) / 10, perType };
}

// ---------- grading + label ----------

// Giá trị tại phân vị "top `frac`" (vd frac=0.2 -> ngưỡng để lọt top 20%).
export function percentileFromTop(values: number[], frac: number): number {
  const sorted = [...values].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((1 - frac) * (sorted.length - 1))));
  return Math.round(sorted[idx] * 10) / 10;
}

// Ngưỡng A/B/C (hoặc g1/g2/g3) theo phân bố thật, mặc định top 20% / 50% / 80%.
export function distributionThresholds(
  values: number[],
  fracs: [number, number, number] = [0.2, 0.5, 0.8],
) {
  return {
    A: percentileFromTop(values, fracs[0]),
    B: percentileFromTop(values, fracs[1]),
    C: percentileFromTop(values, fracs[2]),
  };
}

export function gradeFit(percent: number, t: { A: number; B: number; C: number }): FitGrade {
  if (percent >= t.A) return "A";
  if (percent >= t.B) return "B";
  if (percent >= t.C) return "C";
  return "D";
}

export function gradeEngagement(score: number, t: { g1: number; g2: number; g3: number }): EngagementGrade {
  if (score >= t.g1) return 1;
  if (score >= t.g2) return 2;
  if (score >= t.g3) return 3;
  return 4;
}

export function resolveLabel(fit: FitGrade, eng: EngagementGrade, matrix: LeadLabel[][]): LeadLabel {
  const row = { A: 0, B: 1, C: 2, D: 3 }[fit];
  const col = eng - 1;
  return matrix[row]?.[col] ?? "Nguội";
}

// ---------- deal health / probability ----------

export type DealHealth = { healthLabel: "Nóng" | "Ấm" | "Lạnh"; healthFactor: number };

export function dealHealth(engGrade: EngagementGrade): DealHealth {
  if (engGrade === 1) return { healthLabel: "Nóng", healthFactor: 1 };
  if (engGrade === 2) return { healthLabel: "Ấm", healthFactor: 0.7 };
  return { healthLabel: "Lạnh", healthFactor: 0.4 };
}

// probability = tỷ lệ thắng cơ sở của giai đoạn × hệ số sức khỏe.
// Ví dụ: giai đoạn "Nóng" baseWinRate 0.30, sức khỏe Ấm (0.7) => 21%.
export function dealProbability(baseWinRate: number, health: DealHealth) {
  return Math.round(baseWinRate * health.healthFactor * 100);
}

// ---------- tính trọn gói cho một subject ----------

export function scoreSubject(
  subject: FitSubject,
  activities: EngagementActivity[],
  cfg: ScoringConfigShape,
  now: Date = new Date(),
) {
  const fit = computeFit(subject, cfg.fitWeights);
  const engagement = computeEngagement(activities, cfg.engagementEvents, now);
  const fitGrade = gradeFit(fit.percent, cfg.fitThresholds);
  const engagementGrade = gradeEngagement(engagement.score, cfg.engagementThresholds);
  const label = resolveLabel(fitGrade, engagementGrade, cfg.labelMatrix);
  return {
    fitScore: fit.score,
    fitMax: fit.maxScore,
    fitPercent: fit.percent,
    fitGrade,
    engagementScore: engagement.score,
    engagementGrade,
    engagementPerType: engagement.perType,
    label,
  };
}
