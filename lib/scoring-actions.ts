"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { requirePerm } from "./auth";
import {
  DEFAULT_SCORING_CONFIG,
  ENGAGEMENT_EVENT_KEYS,
  FIT_WEIGHT_KEYS,
  dealHealth,
  dealProbability,
  distributionThresholds,
  parseScoringConfig,
  scoreSubject,
  serialiseScoringConfig,
  type FitSubject,
  type ScoringConfigShape,
} from "./scoring";

// Đọc (hoặc tạo lười) dòng cấu hình chấm điểm singleton.
export async function ensureScoringConfigRow() {
  const existing = await prisma.scoringConfig.findUnique({ where: { name: "default" } });
  if (existing) return existing;
  return prisma.scoringConfig.create({
    data: { name: "default", ...serialiseScoringConfig(DEFAULT_SCORING_CONFIG) },
  });
}

async function loadConfig(): Promise<ScoringConfigShape> {
  return parseScoringConfig(await ensureScoringConfigRow());
}

// ---------- rescore một Lead ----------
export async function rescoreLead(id: string, cfg?: ScoringConfigShape) {
  const config = cfg ?? (await loadConfig());
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { province: true, source: true, activities: { select: { type: true, occurredAt: true } } },
  });
  if (!lead) return;

  const subject: FitSubject = {
    phone: lead.phone,
    email: lead.email,
    companyName: lead.companyName,
    taxCode: lead.taxCode,
    title: lead.title,
    industry: lead.industry,
    provinceName: lead.province?.name ?? null,
    objective: lead.objective,
    partnerReferred: lead.partnerReferred,
    sourceName: lead.source?.name ?? null,
    campaign: lead.campaign,
  };
  const r = scoreSubject(subject, lead.activities, config);
  await prisma.lead.update({
    where: { id },
    data: {
      fitScore: r.fitScore,
      fitPercent: r.fitPercent,
      fitGrade: r.fitGrade,
      engagementScore: r.engagementScore,
      engagementGrade: r.engagementGrade,
      label: r.label,
      scoredAt: new Date(),
    },
  });
}

// ---------- rescore một Deal ----------
export async function rescoreDeal(id: string, cfg?: ScoringConfigShape) {
  const config = cfg ?? (await loadConfig());
  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      stage: true,
      source: true,
      contact: true,
      customer: { include: { province: true, source: true } },
      activities: { select: { type: true, occurredAt: true } },
    },
  });
  if (!deal) return;

  const c = deal.customer;
  const subject: FitSubject = {
    phone: c?.phone ?? deal.contact?.phone ?? null,
    email: deal.contact?.email ?? null,
    companyName: c?.name,
    taxCode: c?.taxCode ?? null,
    title: deal.contact?.title ?? null,
    industry: c?.industry ?? null,
    provinceName: c?.province?.name ?? null,
    objective: deal.title,
    partnerReferred: null,
    sourceName: deal.source?.name ?? c?.source?.name ?? null,
    campaign: deal.campaign,
  };
  const r = scoreSubject(subject, deal.activities, config);
  const health = dealHealth(r.engagementGrade);
  const baseWinRate = deal.stage?.isWon ? 1 : deal.stage?.isLost ? 0 : deal.stage?.baseWinRate ?? 0.1;
  const probability = deal.status === "Thắng" ? 100 : deal.status === "Thua" ? 0 : dealProbability(baseWinRate, health);

  await prisma.deal.update({
    where: { id },
    data: {
      fitScore: r.fitScore,
      engagementScore: r.engagementScore,
      label: r.label,
      healthLabel: health.healthLabel,
      healthScore: Math.round(r.engagementScore * 10) / 10,
      probability,
      scoredAt: new Date(),
    },
  });
}

// ---------- rescore tất cả ----------
export async function rescoreAll() {
  await requirePerm("manageScoring");
  let cfg = await loadConfig();
  const [leads, deals] = await Promise.all([
    prisma.lead.findMany({ select: { id: true } }),
    prisma.deal.findMany({ select: { id: true } }),
  ]);

  // Chế độ "Nắn theo phân bố thật": lấy ngưỡng A/B/C và 1/2/3 từ phân vị thực tế
  // của toàn bộ lead & deal thay vì thang điểm cố định.
  if (cfg.mode === "distribution") {
    const [leadRows, dealRows] = await Promise.all([
      prisma.lead.findMany({ select: { fitPercent: true, engagementScore: true } }),
      prisma.deal.findMany({ select: { engagementScore: true } }),
    ]);
    const fitVals = leadRows.map((r) => r.fitPercent);
    const engVals = [...leadRows.map((r) => r.engagementScore), ...dealRows.map((r) => r.engagementScore)];
    if (fitVals.length >= 10) {
      const ft = distributionThresholds(fitVals);
      cfg = { ...cfg, fitThresholds: { A: ft.A, B: ft.B, C: ft.C } };
    }
    if (engVals.length >= 10) {
      const et = distributionThresholds(engVals);
      cfg = { ...cfg, engagementThresholds: { g1: et.A, g2: et.B, g3: et.C } };
    }
  }

  for (const l of leads) await rescoreLead(l.id, cfg);
  for (const d of deals) await rescoreDeal(d.id, cfg);
}

// ---------- lưu cấu hình từ form ----------
function readNumberMap<T extends string>(fd: FormData, prefix: string, keys: readonly T[]): Record<T, number> {
  const out = {} as Record<T, number>;
  for (const k of keys) {
    const raw = fd.get(`${prefix}.${k}`);
    const n = raw == null ? NaN : Number(String(raw));
    out[k] = Number.isFinite(n) ? n : 0;
  }
  return out;
}

export async function saveScoringConfig(formData: FormData) {
  await requirePerm("manageScoring");
  const row = await ensureScoringConfigRow();
  const current = parseScoringConfig(row);

  const fitWeights = readNumberMap(formData, "fit", FIT_WEIGHT_KEYS);
  const engagementEvents = { ...current.engagementEvents };
  for (const k of ENGAGEMENT_EVENT_KEYS) {
    engagementEvents[k] = {
      points: num(formData.get(`ev.${k}.points`), engagementEvents[k].points),
      halfLife: num(formData.get(`ev.${k}.halfLife`), engagementEvents[k].halfLife),
      cap: num(formData.get(`ev.${k}.cap`), engagementEvents[k].cap),
    };
  }
  const fitThresholds = {
    A: num(formData.get("ft.A"), current.fitThresholds.A),
    B: num(formData.get("ft.B"), current.fitThresholds.B),
    C: num(formData.get("ft.C"), current.fitThresholds.C),
  };
  const engagementThresholds = {
    g1: num(formData.get("et.g1"), current.engagementThresholds.g1),
    g2: num(formData.get("et.g2"), current.engagementThresholds.g2),
    g3: num(formData.get("et.g3"), current.engagementThresholds.g3),
  };
  const mode = formData.get("mode") === "distribution" ? "distribution" : "fixed";

  const next: ScoringConfigShape = {
    fitWeights,
    engagementEvents,
    fitThresholds,
    engagementThresholds,
    labelMatrix: current.labelMatrix,
    mode,
  };

  await prisma.scoringConfig.update({
    where: { name: "default" },
    data: serialiseScoringConfig(next),
  });
  await rescoreAll();
  revalidatePath("/settings");
  revalidatePath("/leads");
  revalidatePath("/deals");
}

function num(v: FormDataEntryValue | null, fallback: number) {
  const n = v == null ? NaN : Number(String(v));
  return Number.isFinite(n) ? n : fallback;
}
