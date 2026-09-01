"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { initials } from "@/lib/format";

export type TopBarUser = {
  name: string | null;
  email: string;
  role: string;
  photoUrl: string | null;
  employeeName: string | null;
  canManageUsers: boolean;
};

const ROLE_LABEL: Record<string, string> = { ADMIN: "Quản trị", MANAGER: "Quản lý", SALES: "Sales" };

export default function TopBar({ user, alertCount }: { user: TopBarUser; alertCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      const { firebaseClientConfigured } = await import("@/lib/firebase-client");
      if (firebaseClientConfigured) {
        const { clientAuth } = await import("@/lib/firebase-client");
        const { signOut: fbSignOut } = await import("firebase/auth");
        await fbSignOut(clientAuth()).catch(() => {});
      }
    } catch {
      /* ignore */
    }
    await fetch("/api/auth/session", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="h-12 shrink-0 border-b border-slate-200 bg-white px-4 flex items-center justify-end gap-3">
      <Link
        href="/?alerts=1"
        className="relative text-slate-400 hover:text-slate-700"
        title="Việc / deal cần chú ý"
      >
        <span className="text-lg">🔔</span>
        {alertCount > 0 && (
          <span className="absolute -right-1.5 -top-1 rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {alertCount > 99 ? "99+" : alertCount}
          </span>
        )}
      </Link>

      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-50"
        >
          {user.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.photoUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
          ) : (
            <span className="avatar" style={{ width: 28, height: 28 }}>
              {initials(user.name ?? user.email)}
            </span>
          )}
          <span className="hidden sm:block text-left leading-tight">
            <span className="block text-xs font-medium text-slate-800">{user.name ?? user.email}</span>
            <span className="block text-[10px] text-slate-400">
              {ROLE_LABEL[user.role] ?? user.role}
              {user.employeeName ? ` · ${user.employeeName}` : ""}
            </span>
          </span>
        </button>
        {open && (
          <div className="absolute right-0 top-11 z-30 w-52 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
            <div className="px-3 py-2 text-xs text-slate-400 border-b border-slate-100">{user.email}</div>
            {user.canManageUsers && (
              <Link
                href="/admin/users"
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2 text-sm hover:bg-slate-50"
              >
                Quản lý người dùng
              </Link>
            )}
            <button
              onClick={signOut}
              disabled={busy}
              className={clsx("block w-full rounded-md px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50")}
            >
              Đăng xuất
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
