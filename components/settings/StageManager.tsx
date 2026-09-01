import type { PipelineStage } from "@prisma/client";
import { createStage, updateStage, deleteStage, nudgeStage } from "@/lib/stage-actions";

export default function StageManager({ stages }: { stages: PipelineStage[] }) {
  return (
    <div className="card card-pad" id="pipeline">
      <h2 className="section-title mb-1">Giai đoạn Pipeline</h2>
      <p className="text-xs text-slate-400 mb-4">
        Các cột của bảng Sale Pipeline. “Tỷ lệ thắng cơ sở” (%) nhân với sức khỏe deal ra “% khả năng chốt”.
      </p>

      <ul className="space-y-2 mb-4">
        {stages.map((s, i) => (
          <li key={s.id} className="rounded-lg border border-slate-200 p-3">
            <form action={updateStage.bind(null, s.id)} className="flex flex-wrap items-end gap-2">
              <span className="h-3 w-3 rounded-full mb-2" style={{ backgroundColor: s.color ?? "#94a3b8" }} />
              <label className="text-xs text-slate-500">
                Tên
                <input name="name" defaultValue={s.name} className="input" style={{ width: 150 }} />
              </label>
              <label className="text-xs text-slate-500">
                Màu
                <input name="color" type="color" defaultValue={s.color ?? "#6366f1"} className="input" style={{ width: 56, padding: 2 }} />
              </label>
              <label className="text-xs text-slate-500">
                Tỷ lệ thắng %
                <input
                  name="baseWinRate"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={Math.round(s.baseWinRate * 100)}
                  disabled={s.isWon || s.isLost}
                  className="input"
                  style={{ width: 80 }}
                />
              </label>
              {(s.isWon || s.isLost) && (
                <span className={s.isWon ? "chip chip-green mb-2" : "chip chip-hot mb-2"}>
                  {s.isWon ? "Thắng" : "Thua"}
                </span>
              )}
              <button type="submit" className="btn btn-ghost btn-sm mb-0.5">
                Lưu
              </button>
            </form>
            <div className="mt-2 flex items-center gap-2">
              <form action={nudgeStage.bind(null, s.id, "up")}>
                <button type="submit" disabled={i === 0} className="text-xs text-slate-400 hover:text-indigo-600 disabled:opacity-30">
                  ↑ Lên
                </button>
              </form>
              <form action={nudgeStage.bind(null, s.id, "down")}>
                <button
                  type="submit"
                  disabled={i === stages.length - 1}
                  className="text-xs text-slate-400 hover:text-indigo-600 disabled:opacity-30"
                >
                  ↓ Xuống
                </button>
              </form>
              <form action={deleteStage.bind(null, s.id)}>
                <button type="submit" className="text-xs text-slate-400 hover:text-rose-600">
                  Xoá
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>

      <form action={createStage} className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
        <label className="text-xs text-slate-500">
          Giai đoạn mới
          <input name="name" required placeholder="Tên giai đoạn" className="input" style={{ width: 160 }} />
        </label>
        <label className="text-xs text-slate-500">
          Tỷ lệ thắng %
          <input name="baseWinRate" type="number" min={0} max={100} defaultValue={10} className="input" style={{ width: 80 }} />
        </label>
        <label className="text-xs text-slate-500">
          Loại
          <select name="kind" className="input" style={{ width: 120 }}>
            <option value="">Thường</option>
            <option value="won">Thắng</option>
            <option value="lost">Thua</option>
          </select>
        </label>
        <button type="submit" className="btn btn-primary btn-sm">
          Thêm
        </button>
      </form>
    </div>
  );
}
