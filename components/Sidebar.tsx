"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export type SidebarPerms = {
  manageCatalog: boolean;
  managePipeline: boolean;
  manageScoring: boolean;
  manageUsers: boolean;
  managePermissions: boolean;
};

type Item = { href: string; label: string; icon: string; show?: (p: SidebarPerms) => boolean };
type Section = { title: string; items: Item[] };

const SECTIONS: Section[] = [
  {
    title: "Bán hàng",
    items: [
      { href: "/", label: "Tổng quan", icon: "📊" },
      { href: "/leads", label: "Leads", icon: "🌱" },
      { href: "/deals", label: "Deals", icon: "💲" },
      { href: "/tasks", label: "Công việc", icon: "✅" },
      { href: "/kpi", label: "KPI nhân viên", icon: "🎯" },
    ],
  },
  {
    title: "Khách hàng",
    items: [
      { href: "/customers", label: "Khách hàng", icon: "👥" },
      { href: "/sales", label: "Doanh số bán hàng", icon: "💰" },
    ],
  },
  {
    title: "Vận hành",
    items: [
      { href: "/work-rhythm", label: "Nhịp công việc", icon: "🗓️" },
      {
        href: "/settings",
        label: "Danh mục",
        icon: "⚙️",
        show: (p) => p.manageCatalog || p.managePipeline || p.manageScoring,
      },
    ],
  },
  {
    title: "Quản trị",
    items: [
      { href: "/admin/users", label: "Người dùng", icon: "🔐", show: (p) => p.manageUsers },
      { href: "/admin/roles", label: "Vai trò & quyền", icon: "🛡️", show: (p) => p.managePermissions },
    ],
  },
];

export default function Sidebar({ perms }: { perms: SidebarPerms }) {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r border-slate-200 bg-white flex flex-col">
      <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-200">
        <span className="text-xl">🧭</span>
        <div>
          <div className="font-semibold text-slate-900 leading-tight">Sale B2B CRM</div>
          <div className="text-xs text-slate-500 leading-tight">Quản lý bán hàng</div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto thin-scroll">
        {SECTIONS.map((section) => {
          const items = section.items.filter((i) => !i.show || i.show(perms));
          if (items.length === 0) return null;
          return (
            <div key={section.title}>
              <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {section.title}
              </div>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={clsx(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                      )}
                    >
                      <span className="text-base">{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="px-5 py-4 text-xs text-slate-400 border-t border-slate-200">Công ty cổ phần ABC</div>
    </aside>
  );
}
