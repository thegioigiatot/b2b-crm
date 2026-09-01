import Link from "next/link";
import type { User } from "@prisma/client";
import AvatarUpload from "@/components/admin/AvatarUpload";
import { createUser, updateUser } from "@/lib/user-actions";
import { ROLES } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";

type Emp = { id: string; name: string };

export default function UserForm({
  user,
  employees,
  currentUserId,
}: {
  user?: User | null;
  employees: Emp[];
  currentUserId?: string;
}) {
  const isEdit = !!user;
  const action = isEdit ? updateUser.bind(null, user.id) : createUser;
  const isSelf = isEdit && user.id === currentUserId;

  return (
    <form action={action} className="card card-pad space-y-5 max-w-2xl">
      <AvatarUpload defaultValue={user?.photoUrl ?? null} displayName={user?.name ?? user?.email ?? "?"} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="field-label">Họ tên</label>
          <input name="name" defaultValue={user?.name ?? ""} placeholder="Nguyễn Văn A" className="input" />
        </div>
        <div>
          <label className="field-label">
            Email {isEdit ? "" : <span className="text-rose-500">*</span>}
            <span className="text-slate-400"> — Gmail dùng để đăng nhập Firebase</span>
          </label>
          <input
            name="email"
            type="email"
            required={!isEdit}
            defaultValue={user?.email ?? ""}
            placeholder="ten@gmail.com"
            className="input"
          />
        </div>
        <div>
          <label className="field-label">Số điện thoại</label>
          <input name="phone" defaultValue={user?.phone ?? ""} placeholder="09xx xxx xxx" className="input" />
        </div>
        <div>
          <label className="field-label">Chức danh</label>
          <input name="title" defaultValue={user?.title ?? ""} placeholder="VD: Trưởng nhóm KD" className="input" />
        </div>
        <div>
          <label className="field-label">Vai trò</label>
          <select name="role" defaultValue={user?.role ?? "SALES"} disabled={isSelf} className="input">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {isSelf && <p className="text-[11px] text-slate-400 mt-1">Không thể tự đổi vai trò của mình.</p>}
        </div>
        <div>
          <label className="field-label">Nối với nhân viên bán hàng</label>
          <select name="employeeId" defaultValue={user?.employeeId ?? ""} className="input">
            <option value="">— chưa nối —</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isSelf ? (
        <div className="text-sm text-slate-600">
          <input type="hidden" name="active" value={user.active ? "on" : "off"} />
          Trạng thái: <b>{user.active ? "Đang hoạt động" : "Chờ duyệt"}</b>
          <span className="text-[11px] text-slate-400"> (không thể tự khoá tài khoản của mình)</span>
        </div>
      ) : (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="hidden" name="active" value="off" />
          <input type="checkbox" name="active" value="on" defaultChecked={user?.active ?? true} />
          Tài khoản đang hoạt động
        </label>
      )}

      {isEdit && (
        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500 space-y-0.5">
          <div>Firebase: {user.firebaseUid ? "đã liên kết" : "chưa đăng nhập lần nào"}</div>
          <div>Đăng nhập gần nhất: {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "—"}</div>
          <div>Tạo lúc: {formatDateTime(user.createdAt)}</div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button type="submit" className="btn btn-primary">
          {isEdit ? "Lưu thay đổi" : "Tạo người dùng"}
        </button>
        <Link href="/admin/users" className="btn btn-ghost">
          Quay lại
        </Link>
      </div>
    </form>
  );
}
