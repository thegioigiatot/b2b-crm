"use client";

import { useTransition } from "react";
import { setDealContact } from "@/lib/deal-actions";

type Contact = { id: string; name: string; title: string | null; phone: string | null };

export default function DealContactSelect({
  dealId,
  contactId,
  contacts,
  disabled,
}: {
  dealId: string;
  contactId: string | null;
  contacts: Contact[];
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const current = contacts.find((c) => c.id === contactId);

  return (
    <div className="card card-pad">
      <h2 className="section-title mb-2">Người liên hệ</h2>
      {contacts.length === 0 ? (
        <p className="text-xs text-slate-400">
          Khách hàng này chưa có người liên hệ. Thêm ở trang khách hàng.
        </p>
      ) : (
        <select
          defaultValue={contactId ?? ""}
          disabled={disabled || pending}
          onChange={(e) => start(() => setDealContact(dealId, e.target.value))}
          className="input"
        >
          <option value="">— chưa chọn —</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.title ? ` · ${c.title}` : ""}
            </option>
          ))}
        </select>
      )}
      {current && (current.phone || current.title) && (
        <p className="mt-1.5 text-xs text-slate-500">
          {current.title}
          {current.title && current.phone ? " · " : ""}
          {current.phone}
        </p>
      )}
    </div>
  );
}
