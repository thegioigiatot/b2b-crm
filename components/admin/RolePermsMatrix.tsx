"use client";

import { Fragment } from "react";
import clsx from "clsx";
import { PERM_GROUPS, ROLES, ADMIN_LOCKED, type PermKey, type Role } from "@/lib/permissions";
import { saveRolePerms, resetRolePerms } from "@/lib/user-actions";

export default function RolePermsMatrix({ perms }: { perms: Record<Role, Record<PermKey, boolean>> }) {
  return (
    <form action={saveRolePerms} className="space-y-5">
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="text-left font-medium px-4 py-3 min-w-[240px]">Quyền</th>
              {ROLES.map((r) => (
                <th key={r} className="px-4 py-3 text-center font-medium">
                  {r}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERM_GROUPS.map((g) => (
              <Fragment key={g.title}>
                <tr className="bg-slate-50/60">
                  <td colSpan={4} className="px-4 py-1.5 text-[11px] font-semibold uppercase text-slate-400">
                    {g.title}
                  </td>
                </tr>
                {g.keys.map((k) => (
                  <tr key={k.key} className="border-t border-slate-100">
                    <td className="px-4 py-2.5">
                      <div className="text-slate-700">{k.label}</div>
                      {k.hint && <div className="text-[11px] text-slate-400">{k.hint}</div>}
                    </td>
                    {ROLES.map((r) => {
                      const locked = r === "ADMIN" && ADMIN_LOCKED.includes(k.key);
                      return (
                        <td key={r} className="px-4 py-2.5 text-center">
                          <input
                            type="checkbox"
                            name={`${r}.${k.key}`}
                            defaultChecked={locked ? true : perms[r][k.key]}
                            disabled={locked}
                            className={clsx("h-4 w-4 accent-indigo-600", locked && "opacity-40")}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <button type="submit" className="btn btn-primary">
          Lưu phân quyền
        </button>
        <button type="submit" formAction={resetRolePerms} className="btn btn-ghost">
          Khôi phục mặc định
        </button>
      </div>
      <p className="text-xs text-slate-400">
        ADMIN luôn giữ quyền “Quản lý người dùng” và “Sửa bảng phân quyền” để không tự khoá mình ra ngoài.
        Có thể ghi đè cho từng user ở trang Người dùng → “Quyền riêng”.
      </p>
    </form>
  );
}
