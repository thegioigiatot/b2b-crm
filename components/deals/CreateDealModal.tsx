"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createDeal } from "@/lib/deal-actions";

type Opt = { id: string; name: string };

export default function CreateDealModal({
  customers,
  contacts,
  employees,
  sources,
  stages,
  defaultOpen = false,
  defaultCustomerId,
}: {
  customers: { id: string; code: string; name: string }[];
  contacts: { id: string; name: string; customerId: string | null }[];
  employees: Opt[];
  sources: Opt[];
  stages: Opt[];
  defaultOpen?: boolean;
  defaultCustomerId?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [customerId, setCustomerId] = useState(defaultCustomerId ?? "");
  const router = useRouter();
  const contactOptions = contacts.filter((c) => c.customerId === customerId);

  function close() {
    setOpen(false);
    if (defaultOpen) router.replace("/deals");
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
        + Tạo deal
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8"
          onClick={close}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-100 px-5 py-3.5">
              <h3 className="text-base font-semibold text-slate-900">Tạo deal</h3>
            </div>
            <form action={createDeal} className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-4">
              <input type="hidden" name="redirect" value="1" />

              <div>
                <label className="field-label">Tên deal *</label>
                <input name="title" required placeholder="VD: CNV Loyalty - FPT" className="input" />
              </div>

              <div>
                <label className="field-label">Pipeline *</label>
                <select name="pipeline" defaultValue="default" className="input">
                  <option value="default">Sales mặc định</option>
                </select>
              </div>

              <div>
                <label className="field-label">Giá trị (VNĐ)</label>
                <input name="value" type="number" min={0} step={1000} placeholder="150.000.000" className="input" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Công ty</label>
                  <select
                    name="customerId"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="input"
                  >
                    <option value="">Không gắn</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">Liên hệ</label>
                  <select name="contactId" className="input" disabled={!customerId}>
                    <option value="">{customerId ? "Không chọn" : "Chọn công ty trước"}</option>
                    {contactOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">Giai đoạn</label>
                  <select name="stageId" className="input">
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                {employees.length > 0 && (
                  <div>
                    <label className="field-label">Người sở hữu</label>
                    <select name="ownerId" className="input">
                      <option value="">Chưa gán</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Ngày dự kiến chốt</label>
                  <input type="date" name="expectedCloseDate" className="input" />
                </div>
                <div>
                  <label className="field-label">Mốc về</label>
                  <select name="closeBucket" className="input">
                    <option value="">Chưa đặt</option>
                    <option>Trong tuần</option>
                    <option>Trong tháng</option>
                    <option>Quý này</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="field-label">Nguồn *</label>
                <select name="sourceId" required className="input">
                  <option value="">Chọn nguồn…</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={close} className="btn btn-ghost">
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  ✓ Tạo deal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
