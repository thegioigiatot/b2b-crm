"use client";

import { useTransition } from "react";
import clsx from "clsx";
import { setDealForecast, setDealCloseBucket } from "@/lib/deal-actions";

const FORECASTS = [
  { key: "Cam kết", flag: "🚩", title: "Cam kết về trong tháng", desc: "Chắc chắn chốt trong kỳ — đã chốt miệng / chờ ký / chờ chuyển tiền." },
  { key: "Khả năng cao", flag: "📈", title: "Khả năng cao", desc: "Nhiều khả năng về, đang đẩy mạnh — nhưng chưa chắc 100%." },
  { key: "Tiềm năng", flag: "🌱", title: "Tiềm năng (còn sớm)", desc: "Mới liên hệ / đang nuôi, chưa rõ kết quả — chưa cam kết gì." },
  { key: "Rủi ro", flag: "⚠️", title: "Rủi ro (đang tuột)", desc: "Có dấu hiệu tuột — khách im, lùi hẹn, đòi giảm sâu, sắp mất." },
];

const HEALTH_CHIP: Record<string, string> = { Nóng: "chip-hot", Ấm: "chip-warm", Lạnh: "chip-cold" };
const HEALTH_ICON: Record<string, string> = { Nóng: "🔥", Ấm: "🌤️", Lạnh: "❄️" };

export default function DealHealthPanel({
  dealId,
  probability,
  baseWinRate,
  healthLabel,
  forecastCategory,
  closeBucket,
  daysLeft,
  status,
}: {
  dealId: string;
  probability: number;
  baseWinRate: number;
  healthLabel: string;
  forecastCategory: string | null;
  closeBucket: string | null;
  daysLeft: number | null;
  status: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="card card-pad space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">Sức khỏe deal</span>
        </div>
        <span className={clsx("chip", HEALTH_CHIP[healthLabel] ?? "chip-slate")}>
          {HEALTH_ICON[healthLabel] ?? ""} {healthLabel}
        </span>
      </div>

      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-indigo-600 tabular-nums">{probability}%</span>
          <span className="text-xs text-slate-500">khả năng chốt</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, probability)}%` }} />
        </div>
        {status === "Đang mở" && (
          <p className="mt-1 text-xs text-slate-400">Tỷ lệ thắng cơ sở của giai đoạn: {Math.round(baseWinRate * 100)}%</p>
        )}
      </div>

      <div>
        <div className="text-xs font-medium text-slate-500 mb-2">
          🎯 Dự báo chốt <span className="text-slate-400">— sales tự đánh giá</span>
        </div>
        <div className="space-y-1.5">
          {FORECASTS.map((f) => (
            <button
              key={f.key}
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(() => setDealForecast(dealId, forecastCategory === f.key ? "" : f.key))
              }
              className={clsx(
                "w-full text-left rounded-lg border px-3 py-2 transition",
                forecastCategory === f.key
                  ? "border-indigo-300 bg-indigo-50/60"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              <div className="text-[13px] font-semibold text-slate-800">
                {f.flag} {f.title}
              </div>
              <div className="text-[11px] text-slate-500 leading-snug">{f.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-500">Mốc về</span>
        <select
          defaultValue={closeBucket ?? ""}
          disabled={isPending}
          onChange={(e) => {
            const v = e.target.value;
            startTransition(() => setDealCloseBucket(dealId, v));
          }}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs"
        >
          <option value="">Chưa đặt</option>
          <option>Trong tuần</option>
          <option>Trong tháng</option>
          <option>Quý này</option>
        </select>
      </div>
      {daysLeft != null && (
        <p className="text-[11px] text-slate-400 -mt-2">
          {daysLeft >= 0 ? `Còn ${daysLeft} ngày đến ngày chốt dự kiến` : `Quá hạn chốt ${-daysLeft} ngày`}
        </p>
      )}
    </div>
  );
}
