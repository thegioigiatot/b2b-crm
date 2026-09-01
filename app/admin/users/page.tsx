import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { requirePerm } from "@/lib/auth";
import { RoleSelect, EmployeeSelect, ActiveToggle, UserPermsButton } from "@/components/admin/UserControls";
import { formatDate, initials } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const { user: me, perms } = await requirePerm("manageUsers");
  const [users, employees] = await Promise.all([
    prisma.user.findMany({ include: { employee: true }, orderBy: [{ active: "desc" }, { createdAt: "asc" }] }),
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const emps = employees.map((e) => ({ id: e.id, name: e.name }));

  return (
    <div>
      <PageHeader
        title="🔐 Người dùng"
        subtitle="Quản lý tài khoản: hồ sơ, vai trò, trạng thái và quyền hạn"
        actions={
          <div className="flex items-center gap-2">
            {perms.managePermissions && (
              <Link href="/admin/roles" className="btn btn-ghost btn-sm">
                🛡️ Vai trò &amp; quyền
              </Link>
            )}
            <Link href="/admin/users/new" className="btn btn-primary btn-sm">
              + Thêm người dùng
            </Link>
          </div>
        }
      />
      <div className="p-6">
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="text-left font-medium px-4 py-3">Người dùng</th>
                <th className="text-left font-medium px-4 py-3">Liên hệ</th>
                <th className="text-left font-medium px-4 py-3">Vai trò</th>
                <th className="text-left font-medium px-4 py-3">Nhân viên</th>
                <th className="text-left font-medium px-4 py-3">Trạng thái</th>
                <th className="text-left font-medium px-4 py-3">Đăng nhập</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${u.id}`} className="flex items-center gap-2 group">
                      {u.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <span className="avatar" style={{ width: 32, height: 32 }}>
                          {initials(u.name ?? u.email)}
                        </span>
                      )}
                      <span>
                        <span className="block font-medium text-slate-800 group-hover:text-indigo-600">
                          {u.name ?? "—"} {u.id === me.id && <span className="text-xs text-slate-400">(bạn)</span>}
                        </span>
                        <span className="block text-xs text-slate-400">{u.title ?? u.email}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    <div>{u.email}</div>
                    {u.phone && <div className="text-xs text-slate-400">{u.phone}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <RoleSelect userId={u.id} value={u.role} disabled={u.id === me.id} />
                  </td>
                  <td className="px-4 py-3">
                    <EmployeeSelect userId={u.id} value={u.employeeId ?? ""} employees={emps} />
                  </td>
                  <td className="px-4 py-3">
                    <ActiveToggle userId={u.id} active={u.active} disabled={u.id === me.id} />
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {u.lastLoginAt ? formatDate(u.lastLoginAt) : "chưa"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {perms.managePermissions && (
                        <UserPermsButton userId={u.id} role={u.role} extraPerms={u.extraPerms} />
                      )}
                      <Link href={`/admin/users/${u.id}`} className="text-xs text-slate-400 hover:text-indigo-600">
                        Sửa
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Email trong <code>ADMIN_EMAILS</code> tự thành ADMIN &amp; kích hoạt khi đăng nhập lần đầu.
          Nhấn tên/“Sửa” để mở hồ sơ đầy đủ (ảnh đại diện, SĐT, chức danh…).
        </p>
      </div>
    </div>
  );
}
