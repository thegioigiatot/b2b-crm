import Link from "next/link";
import clsx from "clsx";
import PageHeader from "@/components/PageHeader";
import CreateDealModal from "@/components/deals/CreateDealModal";
import DealPipelineBoard from "@/components/pipeline/DealPipelineBoard";
import { prisma } from "@/lib/prisma";
import { getDeals, getPipelineBoard, getMasterData, getStages, type DealListTab } from "@/lib/queries";
import { formatCurrency, formatDate, daysSince } from "@/lib/format";
import { requireUser, hasPerm } from "@/lib/auth";

export const dynamic = "force-dynamic";

const TABS: { key: DealListTab; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "open", label: "Đang mở" },
  { key: "commit", label: "Cam kết tháng này" },
  { key: "risk", label: "Rủi ro" },
  { key: "overdue", label: "Gia hạn" },
  { key: "won", label: "Thắng" },
  { key: "lost", label: "Thua" },
];

function statusChip(status: string) {
  return status === "Thắng" ? "chip chip-green" : status === "Thua" ? "chip chip-hot" : "chip chip-neutral";
}

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; tab?: string; ownerId?: string; q?: string; new?: string; customerId?: string }>;
}) {
  const ctx = await requireUser();
  const sp = await searchParams;
  const view = sp.view === "board" ? "board" : "list";
  const tab = (TABS.find((t) => t.key === sp.tab)?.key ?? "all") as DealListTab;

  const [{ deals, counts }, board, master, stages, customers, contacts] = await Promise.all([
    getDeals({ tab, ownerId: sp.ownerId, q: sp.q }, ctx),
    view === "board" ? getPipelineBoard({ ownerId: sp.ownerId }, ctx) : Promise.resolve(null),
    getMasterData(),
    getStages(),
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, code: true, name: true } }),
    prisma.contact.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, customerId: true } }),
  ]);
  const openStages = stages.filter((s) => !s.isWon && !s.isLost);
  const canFilterOwner = hasPerm(ctx, "viewAllDeals");

  const qp = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (view === "board") p.set("view", "board");
    if (sp.ownerId) p.set("ownerId", sp.ownerId);
    if (sp.q) p.set("q", sp.q);
    p.set("tab", tab);
    for (const [k, v] of Object.entries(extra)) {
      if (v == null) p.delete(k);
      else p.set(k, v);
    }
    return `/deals?${p.toString()}`;
  };

  return (
    <div>
      <PageHeader
        title="💲 Deals"
        actions={
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-500">
              Tất cả pipeline
            </span>
            <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden">
              <Link
                href={qp({ view: undefined })}
                className={clsx("px-2.5 py-1.5 text-sm", view === "list" ? "bg-slate-100 text-slate-800" : "text-slate-400")}
                title="Danh sách"
              >
                ☰
              </Link>
              <Link
                href={qp({ view: "board" })}
                className={clsx(
                  "px-2.5 py-1.5 text-sm border-l border-slate-300",
                  view === "board" ? "bg-slate-100 text-slate-800" : "text-slate-400",
                )}
                title="Bảng"
              >
                ▦
              </Link>
            </div>
            <CreateDealModal
              customers={customers}
              contacts={contacts}
              employees={canFilterOwner ? master.employees.map((e) => ({ id: e.id, name: e.name })) : []}
              sources={master.sources.map((s) => ({ id: s.id, name: s.name }))}
              stages={openStages.map((s) => ({ id: s.id, name: s.name }))}
              defaultOpen={sp.new === "1"}
              defaultCustomerId={sp.customerId}
            />
          </div>
        }
      />

      <div className="px-6 pt-4">
        {/* tabs */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-slate-200 pb-0">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={qp({ tab: t.key })}
              className={clsx(
                "pb-2 text-sm font-medium border-b-2 -mb-px transition",
                tab === t.key
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              {t.label}
              <span className="ml-1 text-xs text-slate-400">{counts[t.key]}</span>
            </Link>
          ))}
          <form className="ml-auto flex items-center gap-2 pb-1.5">
            {view === "board" && <input type="hidden" name="view" value="board" />}
            <input type="hidden" name="tab" value={tab} />
            {canFilterOwner && (
              <select
                name="ownerId"
                defaultValue={sp.ownerId ?? ""}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm"
              >
                <option value="">Mọi nhân viên</option>
                {master.employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            )}
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Tìm deal…"
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm w-36"
            />
            <button type="submit" className="btn btn-ghost btn-sm">
              Lọc
            </button>
          </form>
        </div>
      </div>

      <div className="p-6 pt-4">
        {view === "board" && board ? (
          <DealPipelineBoard columns={board.columns} />
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Tên deal</th>
                  <th className="text-left font-medium px-4 py-3">Trạng thái</th>
                  <th className="text-left font-medium px-4 py-3">Công ty</th>
                  <th className="text-left font-medium px-4 py-3">Liên hệ</th>
                  <th className="text-right font-medium px-4 py-3">Giá trị</th>
                  <th className="text-left font-medium px-4 py-3">Giai đoạn</th>
                  <th className="text-left font-medium px-4 py-3">Cam kết</th>
                  <th className="text-left font-medium px-4 py-3">Mốc về</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => {
                  const overdueDays = d.overdue ? daysSince(d.expectedCloseDate) : 0;
                  return (
                    <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link href={`/deals/${d.id}`} className="font-medium text-slate-800 hover:text-indigo-600">
                          {d.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={statusChip(d.status)}>{d.status}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{d.customer?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {d.contact?.name ?? d.contact?.phone ?? d.customer?.phone ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600 tabular-nums">
                        {formatCurrency(d.value)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: `${d.stage?.color ?? "#94a3b8"}1a`,
                            color: d.stage?.color ?? "#475569",
                          }}
                        >
                          {d.stage?.name ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{d.forecastCategory ?? "—"}</td>
                      <td className="px-4 py-3">
                        {d.overdue ? (
                          <span className="chip border border-rose-200 text-rose-600 bg-rose-50">Quá hạn {overdueDays}</span>
                        ) : d.closeBucket ? (
                          <span className="chip border border-emerald-200 text-emerald-700 bg-emerald-50">
                            {d.closeBucket}
                          </span>
                        ) : d.expectedCloseDate ? (
                          <span className="text-xs text-slate-500">{formatDate(d.expectedCloseDate)}</span>
                        ) : (
                          <span className="text-xs text-slate-400">Chưa đặt</span>
                        )}
                        {d.expectedCloseDate && (
                          <div className="text-[11px] text-slate-400 mt-0.5">{formatDate(d.expectedCloseDate)}</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {deals.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      Không có deal nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
