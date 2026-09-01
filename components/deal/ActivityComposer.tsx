"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { addActivity } from "@/lib/deal-actions";

type TabKey = "meeting" | "note" | "email" | "call" | "document" | "checkin" | "quotation";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "meeting", label: "Hoạt động", icon: "🗓️" },
  { key: "note", label: "Ghi chú", icon: "📝" },
  { key: "email", label: "Email", icon: "✉️" },
  { key: "call", label: "Cuộc gọi", icon: "📞" },
  { key: "document", label: "Tài liệu", icon: "📎" },
  { key: "quotation", label: "Báo giá", icon: "💵" },
];

export default function ActivityComposer({
  dealId,
  leadId,
  employeeId,
}: {
  dealId?: string;
  leadId?: string;
  employeeId?: string | null;
}) {
  const [tab, setTab] = useState<TabKey>("meeting");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoMsg, setGeoMsg] = useState<string>("");
  const formRef = useRef<HTMLFormElement>(null);

  function locate() {
    if (!navigator.geolocation) {
      setGeoMsg("Trình duyệt không hỗ trợ định vị");
      return;
    }
    setGeoMsg("Đang lấy vị trí…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoMsg("");
      },
      () => setGeoMsg("Không lấy được vị trí (đã từ chối quyền?)"),
    );
  }

  return (
    <div className="card">
      <div className="flex items-center gap-1 border-b border-slate-100 px-2 py-2 overflow-x-auto thin-scroll">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition",
              tab === t.key ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50",
            )}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setTab("checkin")}
          className={clsx(
            "ml-auto inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition",
            tab === "checkin"
              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
              : "border-slate-200 text-slate-600 hover:bg-slate-50",
          )}
        >
          📍 Đã tới — Check-in
        </button>
      </div>

      <form ref={formRef} action={addActivity} className="p-3 space-y-3">
        {dealId && <input type="hidden" name="dealId" value={dealId} />}
        {leadId && <input type="hidden" name="leadId" value={leadId} />}
        {employeeId && <input type="hidden" name="employeeId" value={employeeId} />}
        <input type="hidden" name="type" value={tab} />

        {(tab === "meeting" || tab === "note") && (
          <>
            <input
              name="title"
              placeholder={tab === "note" ? "Tiêu đề ghi chú" : "Tiêu đề hoạt động"}
              className="input"
            />
            <textarea
              name="body"
              rows={3}
              required
              placeholder={tab === "note" ? "Nội dung ghi chú…" : "Mô tả hoạt động, kết quả…"}
              className="input"
            />
          </>
        )}

        {(tab === "email" || tab === "call") && (
          <>
            <div className="flex gap-2">
              <select name="direction" defaultValue="out" className="input" style={{ maxWidth: 130 }}>
                <option value="out">Gửi đi / Gọi đi</option>
                <option value="in">Nhận về / Gọi đến</option>
              </select>
              <input name="title" placeholder={tab === "email" ? "Tiêu đề email" : "Chủ đề cuộc gọi"} className="input" />
            </div>
            <textarea name="body" rows={3} placeholder="Nội dung / tóm tắt trao đổi…" className="input" />
          </>
        )}

        {tab === "document" && (
          <>
            <input name="title" required placeholder="Tên tài liệu (VD: Hợp đồng nguyên tắc)" className="input" />
            <input name="link" placeholder="Đường dẫn tài liệu (URL)" className="input" />
            <textarea name="body" rows={2} placeholder="Ghi chú thêm…" className="input" />
          </>
        )}

        {tab === "quotation" && (
          <>
            <div className="flex gap-2">
              <input name="title" defaultValue="Đã gửi báo giá" className="input" />
              <input name="quotationValue" type="number" min={0} step={1000} placeholder="Giá trị báo giá" className="input" style={{ maxWidth: 180 }} />
            </div>
            <textarea name="body" rows={2} placeholder="Phạm vi báo giá, điều kiện…" className="input" />
          </>
        )}

        {tab === "checkin" && (
          <>
            <input name="title" defaultValue="Check-in tại chỗ khách" className="input" />
            <div className="flex items-center gap-2">
              <button type="button" onClick={locate} className="btn btn-ghost btn-sm">
                📍 Lấy toạ độ
              </button>
              <span className="text-xs text-slate-500">
                {coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : geoMsg || "Chưa xác minh toạ độ"}
              </span>
            </div>
            {coords && (
              <>
                <input type="hidden" name="lat" value={coords.lat} />
                <input type="hidden" name="lng" value={coords.lng} />
              </>
            )}
            <textarea name="body" rows={2} placeholder="Ghi chú buổi gặp tại chỗ khách…" className="input" />
          </>
        )}

        <div className="flex items-center justify-between gap-2">
          <label className="text-xs text-slate-400">
            Thời điểm
            <input type="datetime-local" name="occurredAt" className="input ml-2" style={{ maxWidth: 210 }} />
          </label>
          <button type="submit" className="btn btn-primary btn-sm">
            Thêm vào lịch sử
          </button>
        </div>
      </form>
    </div>
  );
}
