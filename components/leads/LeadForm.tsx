import type { Lead, Province, Source, Employee } from "@prisma/client";
import { createLead, updateLead } from "@/lib/lead-actions";
import { LEAD_STATUSES } from "@/lib/queries";

export default function LeadForm({
  lead,
  provinces,
  sources,
  employees,
}: {
  lead?: Lead | null;
  provinces: Province[];
  sources: Source[];
  employees: Employee[];
}) {
  const action = lead ? updateLead.bind(null, lead.id) : createLead;

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="field-label">Người liên hệ *</label>
          <input name="name" required defaultValue={lead?.name ?? ""} className="input" />
        </div>
        <div>
          <label className="field-label">Tên công ty</label>
          <input name="companyName" defaultValue={lead?.companyName ?? ""} className="input" />
        </div>
        <div>
          <label className="field-label">Số điện thoại</label>
          <input name="phone" defaultValue={lead?.phone ?? ""} className="input" />
        </div>
        <div>
          <label className="field-label">Email</label>
          <input name="email" type="email" defaultValue={lead?.email ?? ""} className="input" />
        </div>
        <div>
          <label className="field-label">Chức danh</label>
          <input name="title" placeholder="VD: Giám đốc" defaultValue={lead?.title ?? ""} className="input" />
        </div>
        <div>
          <label className="field-label">Mã số thuế</label>
          <input name="taxCode" defaultValue={lead?.taxCode ?? ""} className="input" />
        </div>
        <div>
          <label className="field-label">Ngành nghề</label>
          <input name="industry" defaultValue={lead?.industry ?? ""} className="input" />
        </div>
        <div>
          <label className="field-label">Tỉnh/thành</label>
          <select name="provinceId" defaultValue={lead?.provinceId ?? ""} className="input">
            <option value="">-</option>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Nguồn</label>
          <select name="sourceId" defaultValue={lead?.sourceId ?? ""} className="input">
            <option value="">-</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Chiến dịch marketing</label>
          <input name="campaign" defaultValue={lead?.campaign ?? ""} className="input" />
        </div>
        <div>
          <label className="field-label">Nhân viên phụ trách</label>
          <select name="employeeId" defaultValue={lead?.employeeId ?? ""} className="input">
            <option value="">-</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        {lead && (
          <div>
            <label className="field-label">Trạng thái</label>
            <select name="status" defaultValue={lead.status} className="input">
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div>
        <label className="field-label">Mục tiêu bán hàng đã khai</label>
        <textarea name="objective" rows={2} defaultValue={lead?.objective ?? ""} className="input" />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" name="partnerReferred" defaultChecked={lead?.partnerReferred ?? false} />
        Do đối tác giới thiệu
      </label>
      <div>
        <label className="field-label">Ghi chú</label>
        <textarea name="notes" rows={2} defaultValue={lead?.notes ?? ""} className="input" />
      </div>
      <button type="submit" className="btn btn-primary">
        {lead ? "Lưu thay đổi" : "Thêm lead"}
      </button>
    </form>
  );
}
