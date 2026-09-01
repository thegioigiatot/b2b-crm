"use client";

import { useState, useTransition } from "react";
import {
  setUserRole,
  setUserActive,
  linkUserEmployee,
  deleteUser,
  setUserPermOverride,
} from "@/lib/user-actions";
import { PERM_GROUPS } from "@/lib/permissions";

const ROLES = ["ADMIN", "MANAGER", "SALES"];

export function RoleSelect({ userId, value, disabled }: { userId: string; value: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <select
      defaultValue={value}
      disabled={disabled || pending}
      onChange={(e) => start(() => setUserRole(userId, e.target.value))}
      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm disabled:opacity-50"
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  );
}

export function EmployeeSelect({
  userId,
  value,
  employees,
}: {
  userId: string;
  value: string;
  employees: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();
  return (
    <select
      defaultValue={value}
      disabled={pending}
      onChange={(e) => start(() => linkUserEmployee(userId, e.target.value))}
      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm disabled:opacity-50"
    >
      <option value="">— chưa nối —</option>
      {employees.map((e) => (
        <option key={e.id} value={e.id}>
          {e.name}
        </option>
      ))}
    </select>
  );
}

export function ActiveToggle({ userId, active, disabled }: { userId: string; active: boolean; disabled?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={() => start(() => setUserActive(userId, !active))}
      className={active ? "chip chip-green" : "chip chip-slate"}
    >
      {active ? "Đang hoạt động" : "Chờ duyệt"}
    </button>
  );
}

export function UserPermsButton({
  userId,
  role,
  extraPerms,
}: {
  userId: string;
  role: string;
  extraPerms: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  let overrides: Record<string, boolean> = {};
  try {
    overrides = extraPerms ? JSON.parse(extraPerms) : {};
  } catch {
    overrides = {};
  }
  const count = Object.keys(overrides).length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-slate-400 hover:text-indigo-600"
        title="Quyền riêng cho user này"
      >
        Quyền riêng{count > 0 ? ` (${count})` : ""}
      </button>
      {open && (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-6" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-800">Quyền riêng của user</h3>
            <p className="mt-1 text-xs text-slate-400">
              Mặc định theo vai trò <b>{role}</b>. Đặt “Bật/Tắt” để ghi đè cho riêng user này.
            </p>
            <div className="mt-3 space-y-3 max-h-[60vh] overflow-y-auto">
              {PERM_GROUPS.map((g) => (
                <div key={g.title}>
                  <div className="text-[11px] font-semibold uppercase text-slate-400">{g.title}</div>
                  {g.keys.map((k) => {
                    const state = k.key in overrides ? (overrides[k.key] ? "on" : "off") : "role";
                    return (
                      <div key={k.key} className="flex items-center justify-between py-1 text-sm">
                        <span className="text-slate-700">{k.label}</span>
                        <select
                          defaultValue={state}
                          disabled={pending}
                          onChange={(e) =>
                            start(() => setUserPermOverride(userId, k.key, e.target.value as "role" | "on" | "off"))
                          }
                          className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-xs"
                        >
                          <option value="role">Theo vai trò</option>
                          <option value="on">Bật</option>
                          <option value="off">Tắt</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="mt-4 text-right">
              <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function DeleteUserButton({ userId }: { userId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm("Xoá tài khoản này?")) start(() => deleteUser(userId));
      }}
      className="text-xs text-slate-400 hover:text-rose-600"
    >
      Xoá
    </button>
  );
}
