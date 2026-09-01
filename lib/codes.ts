import { prisma } from "./prisma";

// Sinh mã tuần tự dạng tiền tố + số 4 chữ số (D0007, L0042) cho Deal / Lead.
export async function nextCode(kind: "deal" | "lead") {
  const prefix = kind === "deal" ? "D" : "L";
  const rows =
    kind === "deal"
      ? await prisma.deal.findMany({ select: { code: true } })
      : await prisma.lead.findMany({ select: { code: true } });
  let max = 0;
  for (const r of rows) {
    const m = r.code?.match(/(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}
