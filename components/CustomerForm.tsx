import { requireUser } from "@/lib/auth";
import { upsertCustomer } from "@/lib/actions";
import type { Customer, Employee, Province, Source, CareStatus } from "@prisma/client";

export default async function CustomerForm({
  customer,
  master,
}: {
  customer?: Customer | null;
  master: { employees: Employee[]; provinces: Province[]; sources: Source[]; careStatuses: CareStatus[] };
}) {
  const ctx = await requireUser();
  const employees = master.employees.filter(e => ctx.perms.editAnyRecord || e.id === ctx.employee?.id);
  const dobValue = customer?.dob ? new Date(customer.dob).toISOString().slice(0, 10) : "";

  return (
    <form action={upsertCustomer} className="space-y-4">
      {customer && <input type="hidden" name="id" value={customer.id} />}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Mã khách hàng" required>
          <input name="code" defaultValue={customer?.code} required className="input" />
        </Field>
        <Field label="Tên khách hàng" required>
          <input name="name" defaultValue={customer?.name} required className="input" />
        </Field>
        <Field label="Giới tính">
          <select name="gender" defaultValue={customer?.gender ?? ""} className="input">
            <option value="">-</option>
            <option value="Nam">Nam</option>
            <option value="Nữ">Nữ</option>
          </select>
        </Field>
        <Field label="Ngày sinh">
          <input type="date" name="dob" defaultValue={dobValue} className="input" />
        </Field>
        <Field label="Số điện thoại">
          <input name="phone" defaultValue={customer?.phone ?? ""} className="input" />
        </Field>
        <Field label="Quận/huyện">
          <input name="district" defaultValue={customer?.district ?? ""} className="input" />
        </Field>
        <Field label="Mã số thuế">
          <input name="taxCode" defaultValue={customer?.taxCode ?? ""} className="input" />
        </Field>
        <Field label="Ngành nghề">
          <input name="industry" defaultValue={customer?.industry ?? ""} className="input" />
        </Field>
        <Field label="Tỉnh/thành phố">
          <select name="provinceId" defaultValue={customer?.provinceId ?? ""} className="input">
            <option value="">-</option>
            {master.provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nguồn">
          <select name="sourceId" defaultValue={customer?.sourceId ?? ""} className="input">
            <option value="">-</option>
            {master.sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nhân viên phụ trách">
          <select name="employeeId" defaultValue={customer?.employeeId ?? ctx.employee?.id ?? ""} className="input">
            <option value="">-</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Trạng thái chăm sóc">
          <select name="careStatusId" defaultValue={customer?.careStatusId ?? ""} className="input">
            <option value="">-</option>
            {master.careStatuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tên cửa hàng">
          <input name="storeName" defaultValue={customer?.storeName ?? ""} className="input" />
        </Field>
        <Field label="Địa chỉ cửa hàng">
          <input name="storeAddress" defaultValue={customer?.storeAddress ?? ""} className="input" />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" name="isNew" defaultChecked={customer?.isNew ?? true} />
        Khách hàng mới
      </label>
      <Field label="Ghi chú">
        <textarea name="notes" defaultValue={customer?.notes ?? ""} rows={3} className="input" />
      </Field>
      <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
        {customer ? "Lưu thay đổi" : "Thêm khách hàng"}
      </button>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-500 mb-1">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
