"use client";

import { useState } from "react";
import { convertLead } from "@/lib/lead-actions";

export default function LeadConvertButton({
  leadId,
  leadName,
  suggestedValue,
  alreadyConverted,
  customerId,
}: {
  leadId: string;
  leadName: string;
  suggestedValue?: number | null;
  alreadyConverted?: boolean;
  customerId?: string | null;
}) {
  const [open, setOpen] = useState(false);

  if (alreadyConverted) {
    return (
      <a href={customerId ? `/customers/${customerId}` : "#"} className="btn btn-ghost btn-sm">
        ✓ Đã chuyển đổi — xem khách hàng
      </a>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary btn-sm">
        ⇢ Chuyển đổi thành Deal
      </button>
      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-800">Chuyển đổi lead “{leadName}”</h3>
            <p className="mt-1 text-xs text-slate-500">
              Tạo (hoặc liên kết) một khách hàng từ lead này. Có thể mở luôn một deal.
            </p>
            <form action={convertLead.bind(null, leadId)} className="mt-4 space-y-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="openDeal" defaultChecked />
                Mở một deal ngay
              </label>
              <div>
                <label className="field-label">Tên deal</label>
                <input name="dealTitle" defaultValue={`Deal ${leadName}`} className="input" />
              </div>
              <div>
                <label className="field-label">Giá trị dự kiến (đ)</label>
                <input
                  name="dealValue"
                  type="number"
                  step={1000}
                  defaultValue={suggestedValue ?? ""}
                  placeholder="VD: 50000000"
                  className="input"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">
                  Huỷ
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Chuyển đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
