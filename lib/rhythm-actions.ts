"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { requireUser, requirePerm, hasPerm } from "./auth";

function str(v: FormDataEntryValue | null) {
  const s = (v ?? "").toString().trim();
  return s.length ? s : undefined;
}
function int(v: FormDataEntryValue | null) {
  const s = (v ?? "").toString().trim();
  if (!s) return undefined;
  const n = Math.trunc(Number(s));
  return Number.isFinite(n) ? n : undefined;
}

// yyyy-mm-dd -> Date nửa đêm địa phương
function parseDay(dateISO: string) {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function channelsJson(formData: FormData) {
  const multi = formData.getAll("channels").map((c) => String(c).trim());
  const csv = String(formData.get("channelsCsv") ?? "")
    .split(/[,;]/)
    .map((c) => c.trim());
  const raw = [...multi, ...csv].filter(Boolean);
  return raw.length ? JSON.stringify([...new Set(raw)]) : null;
}

export async function createRhythmTask(formData: FormData) {
  await requirePerm("manageWorkRhythm");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const count = await prisma.workRhythmTask.count();
  await prisma.workRhythmTask.create({
    data: {
      title,
      category: str(formData.get("category")) ?? null,
      cadence: str(formData.get("cadence")) ?? "daily",
      employeeId: str(formData.get("employeeId")) ?? null,
      channels: channelsJson(formData),
      evidenceMin: int(formData.get("evidenceMin")) ?? 0,
      targetCount: int(formData.get("targetCount")) ?? null,
      color: str(formData.get("color")) ?? null,
      sortOrder: count,
    },
  });
  revalidatePath("/work-rhythm");
}

export async function updateRhythmTask(id: string, formData: FormData) {
  await requirePerm("manageWorkRhythm");
  const data: Record<string, unknown> = {};
  const title = str(formData.get("title"));
  if (title) data.title = title;
  if (formData.has("category")) data.category = str(formData.get("category")) ?? null;
  if (formData.has("cadence")) data.cadence = str(formData.get("cadence")) ?? "daily";
  if (formData.has("employeeId")) data.employeeId = str(formData.get("employeeId")) ?? null;
  if (formData.has("channelsCsv") || formData.has("channels")) data.channels = channelsJson(formData);
  if (formData.has("evidenceMin")) data.evidenceMin = int(formData.get("evidenceMin")) ?? 0;
  if (formData.has("targetCount")) data.targetCount = int(formData.get("targetCount")) ?? null;
  if (formData.has("active")) data.active = formData.get("active") === "on" || formData.get("active") === "true";
  await prisma.workRhythmTask.update({ where: { id }, data });
  revalidatePath("/work-rhythm");
}

export async function deleteRhythmTask(id: string) {
  await requirePerm("manageWorkRhythm");
  await prisma.workRhythmTask.delete({ where: { id } });
  revalidatePath("/work-rhythm");
}

export async function toggleRhythmLog(taskId: string, employeeId: string, dateISO: string) {
  const ctx = await requireUser();
  // SALES chỉ chấm nhịp của chính mình.
  if (!hasPerm(ctx, "manageWorkRhythm")) employeeId = ctx.employee?.id ?? "";
  if (!employeeId) return;
  const date = parseDay(dateISO);
  const existing = await prisma.workRhythmLog.findUnique({
    where: { taskId_employeeId_date: { taskId, employeeId, date } },
  });
  const done = !existing?.done;
  await prisma.workRhythmLog.upsert({
    where: { taskId_employeeId_date: { taskId, employeeId, date } },
    create: { taskId, employeeId, date, done, completedAt: done ? new Date() : null },
    update: { done, completedAt: done ? new Date() : null },
  });
  revalidatePath("/work-rhythm");
}

export async function setRhythmProgress(formData: FormData) {
  const ctx = await requireUser();
  const taskId = String(formData.get("taskId"));
  const employeeId = hasPerm(ctx, "manageWorkRhythm")
    ? String(formData.get("employeeId"))
    : (ctx.employee?.id ?? "");
  const dateISO = String(formData.get("date"));
  if (!taskId || !employeeId || !dateISO) return;
  const date = parseDay(dateISO);
  const doneCount = int(formData.get("doneCount")) ?? 0;
  const evidenceCount = int(formData.get("evidenceCount")) ?? 0;
  const note = str(formData.get("note")) ?? null;

  const task = await prisma.workRhythmTask.findUnique({ where: { id: taskId } });
  const target = task?.targetCount ?? 0;
  const evMin = task?.evidenceMin ?? 0;
  const done = (target > 0 ? doneCount >= target : doneCount > 0) && evidenceCount >= evMin;

  await prisma.workRhythmLog.upsert({
    where: { taskId_employeeId_date: { taskId, employeeId, date } },
    create: { taskId, employeeId, date, doneCount, evidenceCount, note, done, completedAt: done ? new Date() : null },
    update: { doneCount, evidenceCount, note, done, completedAt: done ? new Date() : null },
  });
  revalidatePath("/work-rhythm");
}
