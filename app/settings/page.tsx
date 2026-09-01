import PageHeader from "@/components/PageHeader";
import { getMasterData, getStages, getScoringConfig } from "@/lib/queries";
import { createMasterItem, deleteMasterItem, toggleEmployeeActive } from "@/lib/actions";
import StageManager from "@/components/settings/StageManager";
import ScoringConfigForm from "@/components/scoring/ScoringConfigForm";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const ctx = await requireUser();
  const { manageCatalog, managePipeline, manageScoring } = ctx.perms;
  if (!manageCatalog && !managePipeline && !manageScoring) redirect("/403");
  const [master, stages, scoring] = await Promise.all([getMasterData(), getStages(), getScoringConfig()]);

  return (
    <div>
      <PageHeader title="⚙️ Danh mục cài đặt" subtitle="Dữ liệu dùng chung, giai đoạn pipeline và bộ chấm điểm Lead/Deal" />
      <div className="p-6 space-y-6">
        {manageCatalog && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MasterSection
          title="Nhân viên"
          entity="employee"
          items={master.employees.map((e) => ({ id: e.id, label: `${e.code} · ${e.name}`, active: e.active }))}
          extraField={{ name: "code", label: "Mã NV (tuỳ chọn)" }}
          onToggleActive={toggleEmployeeActive}
        />
        <MasterSection title="Tỉnh/Thành phố" entity="province" items={master.provinces.map((p) => ({ id: p.id, label: p.name }))} />
        <MasterSection
          title="Nhóm sản phẩm"
          entity="productGroup"
          items={master.productGroups.map((p) => ({ id: p.id, label: p.code ? `${p.code} · ${p.name}` : p.name }))}
          extraField={{ name: "code", label: "Mã nhóm hàng (tuỳ chọn)" }}
        />
        <MasterSection title="Nguồn" entity="source" items={master.sources.map((s) => ({ id: s.id, label: s.name }))} />
        <MasterSection
          title="Trạng thái chăm sóc"
          entity="careStatus"
          items={master.careStatuses.map((s) => ({ id: s.id, label: s.name, color: s.color }))}
          extraField={{ name: "color", label: "Màu (hex, tuỳ chọn)" }}
        />
        </div>
        )}

        {managePipeline && <StageManager stages={stages} />}

        {manageScoring && (
        <div>
          <h2 className="text-base font-semibold text-slate-900 mb-1">Chấm điểm Lead / Deal</h2>
          <p className="text-xs text-slate-400 mb-3">
            Điều chỉnh trọng số và ngưỡng; lưu xong hệ thống tự chấm điểm lại toàn bộ lead &amp; deal.
          </p>
          <ScoringConfigForm config={scoring.config} />
        </div>
        )}
      </div>
    </div>
  );
}

function MasterSection({
  title,
  entity,
  items,
  extraField,
  onToggleActive,
}: {
  title: string;
  entity: "employee" | "province" | "productGroup" | "source" | "careStatus";
  items: { id: string; label: string; active?: boolean; color?: string | null }[];
  extraField?: { name: string; label: string };
  onToggleActive?: (id: string, active: boolean) => Promise<void>;
}) {
  const createAction = createMasterItem.bind(null, entity);
  const deleteAction = deleteMasterItem.bind(null, entity);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-800 mb-3">{title}</h2>
      <form action={createAction} className="flex gap-2 mb-4">
        <input name="name" required placeholder={`Tên ${title.toLowerCase()} mới`} className="input" />
        {extraField && <input name={extraField.name} placeholder={extraField.label} className="input" style={{ maxWidth: 140 }} />}
        <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 whitespace-nowrap">
          Thêm
        </button>
      </form>
      <ul className="divide-y divide-slate-100 max-h-64 overflow-auto">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between py-2 text-sm">
            <span className="flex items-center gap-2 text-slate-700">
              {item.color && <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />}
              {item.label}
              {item.active === false && <span className="text-xs text-slate-400">(ngừng hoạt động)</span>}
            </span>
            <span className="flex items-center gap-3">
              {onToggleActive && (
                <form action={onToggleActive.bind(null, item.id, !(item.active ?? true))}>
                  <button type="submit" className="text-xs text-slate-400 hover:text-indigo-600">
                    {item.active === false ? "Kích hoạt" : "Ngừng"}
                  </button>
                </form>
              )}
              <form action={deleteAction.bind(null, item.id)}>
                <button type="submit" className="text-xs text-slate-400 hover:text-rose-600">
                  Xoá
                </button>
              </form>
            </span>
          </li>
        ))}
        {items.length === 0 && <li className="py-4 text-center text-sm text-slate-400">Chưa có dữ liệu</li>}
      </ul>
    </div>
  );
}
