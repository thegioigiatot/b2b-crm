"use client";

import { useState } from "react";
import clsx from "clsx";
import {
  ENGAGEMENT_EVENT_KEYS,
  FIT_WEIGHT_KEYS,
  engagementEventLabel,
  fitWeightLabel,
  type ScoringConfigShape,
} from "@/lib/scoring";
import { saveScoringConfig } from "@/lib/scoring-actions";

const LABEL_CELL: Record<string, string> = {
  Nóng: "bg-rose-50 text-rose-600",
  Ấm: "bg-amber-50 text-amber-700",
  Nguội: "bg-slate-50 text-slate-500",
};

export default function ScoringConfigForm({ config }: { config: ScoringConfigShape }) {
  const [dist, setDist] = useState(config.mode === "distribution");

  return (
    <form action={saveScoringConfig} className="space-y-5">
      {/* Trục độ phù hợp */}
      <div className="card card-pad">
        <h3 className="section-title">Trục độ phù hợp — họ là ai</h3>
        <p className="text-xs text-slate-400 mt-1 mb-3">
          Trọng số dương cộng vào cả tử số lẫn điểm tối đa nên thêm tiêu chí mới không làm lệch ngưỡng đã đặt. Trọng số âm chỉ trừ.
        </p>
        <div className="divide-y divide-slate-100">
          {FIT_WEIGHT_KEYS.map((k) => (
            <div key={k} className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm text-slate-700">{fitWeightLabel(k)}</div>
                <div className="text-[11px] text-slate-400 font-mono">{k}</div>
              </div>
              <input
                type="number"
                name={`fit.${k}`}
                defaultValue={config.fitWeights[k]}
                className="input"
                style={{ width: 90 }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Trục mức tương tác */}
      <div className="card card-pad">
        <h3 className="section-title">Trục mức tương tác — họ làm gì</h3>
        <p className="text-xs text-slate-400 mt-1 mb-3">
          Nửa đời = sau bấy nhiêu ngày sự kiện chỉ còn nửa giá trị. Trần đếm chặn thổi điểm: 30 ghi chú vẫn chỉ tính đúng số lần cho phép.
        </p>
        <div className="overflow-x-auto thin-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                <th className="py-1.5 font-medium">Sự kiện</th>
                <th className="py-1.5 font-medium text-right">Điểm</th>
                <th className="py-1.5 font-medium text-right">Nửa đời</th>
                <th className="py-1.5 font-medium text-right">Trần đếm</th>
              </tr>
            </thead>
            <tbody>
              {ENGAGEMENT_EVENT_KEYS.map((k) => (
                <tr key={k} className="border-t border-slate-100">
                  <td className="py-2">
                    <div className="text-slate-700">{engagementEventLabel(k)}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{k}</div>
                  </td>
                  <td className="py-2 text-right">
                    <input type="number" name={`ev.${k}.points`} defaultValue={config.engagementEvents[k].points} className="input" style={{ width: 74 }} />
                  </td>
                  <td className="py-2 text-right">
                    <input type="number" name={`ev.${k}.halfLife`} defaultValue={config.engagementEvents[k].halfLife} className="input" style={{ width: 74 }} />
                  </td>
                  <td className="py-2 text-right">
                    <input type="number" name={`ev.${k}.cap`} defaultValue={config.engagementEvents[k].cap} className="input" style={{ width: 74 }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Điểm cắt hạng */}
      <div className="card card-pad">
        <div className="flex items-center justify-between">
          <h3 className="section-title">Điểm cắt hạng</h3>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <input
              type="checkbox"
              name="mode"
              value="distribution"
              checked={dist}
              onChange={(e) => setDist(e.target.checked)}
            />
            Nắn theo phân bố thật
          </label>
        </div>
        <p className="text-xs text-slate-400 mt-1 mb-3">
          Chế độ cố định hợp với tenant mới. Khi đã đủ lead thì chuyển sang theo phân bố thật để tỷ lệ nhãn không phụ thuộc thang điểm.
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="text-slate-500">Phù hợp</span>
          {(["A", "B", "C"] as const).map((g) => (
            <label key={g} className="flex items-center gap-1">
              {g} ≥
              <input type="number" name={`ft.${g}`} defaultValue={config.fitThresholds[g]} className="input" style={{ width: 64 }} />
            </label>
          ))}
          <span className="text-slate-500 ml-2">Tương tác</span>
          {(["g1", "g2", "g3"] as const).map((g, i) => (
            <label key={g} className="flex items-center gap-1">
              {i + 1} ≥
              <input type="number" name={`et.${g}`} defaultValue={config.engagementThresholds[g]} className="input" style={{ width: 64 }} />
            </label>
          ))}
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-medium text-slate-400 uppercase mb-1">Ma trận ra nhãn</div>
          <table className="text-xs border border-slate-200 rounded overflow-hidden">
            <thead>
              <tr className="bg-slate-50 text-slate-400">
                <th className="w-8" />
                {[1, 2, 3, 4].map((c) => (
                  <th key={c} className="px-4 py-1 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(["A", "B", "C", "D"] as const).map((row, ri) => (
                <tr key={row} className="border-t border-slate-200">
                  <td className="px-2 py-1 text-slate-400 font-medium bg-slate-50">{row}</td>
                  {config.labelMatrix[ri].map((cell, ci) => (
                    <td key={ci} className={clsx("px-4 py-1 text-center font-medium", LABEL_CELL[cell])}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button type="submit" className="btn btn-primary">
        Lưu cấu hình & chấm điểm lại toàn bộ
      </button>
    </form>
  );
}
