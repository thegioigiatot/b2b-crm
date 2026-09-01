"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";
import { requirePerm } from "./auth";

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

const PALETTE = ["#6366f1", "#0ea5e9", "#f59e0b", "#fb923c", "#ef4444", "#10b981", "#8b5cf6", "#14b8a6"];

export async function createStage(formData: FormData) {
  await requirePerm("managePipeline");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const count = await prisma.pipelineStage.count();
  const kind = str(formData.get("kind")); // "won" | "lost" | undefined
  await prisma.pipelineStage.create({
    data: {
      name,
      sortOrder: count,
      color: str(formData.get("color")) ?? PALETTE[count % PALETTE.length],
      baseWinRate: (num(formData.get("baseWinRate")) ?? 10) / 100,
      isWon: kind === "won",
      isLost: kind === "lost",
    },
  });
  revalidatePath("/settings");
  revalidatePath("/deals");
}

export async function updateStage(id: string, formData: FormData) {
  await requirePerm("managePipeline");
  const data: Record<string, unknown> = {};
  const name = str(formData.get("name"));
  if (name) data.name = name;
  const color = str(formData.get("color"));
  if (color) data.color = color;
  const bwr = num(formData.get("baseWinRate"));
  if (bwr != null) data.baseWinRate = bwr / 100;
  await prisma.pipelineStage.update({ where: { id }, data });
  revalidatePath("/settings");
  revalidatePath("/deals");
}

export async function deleteStage(id: string) {
  await requirePerm("managePipeline");
  const [dealCount, total] = await Promise.all([
    prisma.deal.count({ where: { stageId: id } }),
    prisma.pipelineStage.count(),
  ]);
  if (dealCount > 0) throw new Error("Giai đoạn còn deal, không thể xoá.");
  if (total <= 2) throw new Error("Cần giữ tối thiểu 2 giai đoạn.");
  await prisma.pipelineStage.delete({ where: { id } });
  revalidatePath("/settings");
  revalidatePath("/deals");
}

export async function reorderStages(orderedIds: string[]) {
  await requirePerm("managePipeline");
  await prisma.$transaction(
    orderedIds.map((id, i) => prisma.pipelineStage.update({ where: { id }, data: { sortOrder: i } })),
  );
  revalidatePath("/settings");
  revalidatePath("/deals");
}

// Đẩy một giai đoạn lên (-1) hoặc xuống (+1) một bậc.
export async function nudgeStage(id: string, dir: "up" | "down") {
  await requirePerm("managePipeline");
  const stages = await prisma.pipelineStage.findMany({ orderBy: { sortOrder: "asc" } });
  const idx = stages.findIndex((s) => s.id === id);
  const swapWith = dir === "up" ? idx - 1 : idx + 1;
  if (idx === -1 || swapWith < 0 || swapWith >= stages.length) return;
  const ordered = [...stages];
  [ordered[idx], ordered[swapWith]] = [ordered[swapWith], ordered[idx]];
  await prisma.$transaction(
    ordered.map((s, i) => prisma.pipelineStage.update({ where: { id: s.id }, data: { sortOrder: i } })),
  );
  revalidatePath("/settings");
  revalidatePath("/deals");
}
