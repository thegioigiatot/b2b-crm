"use client";

import { usePathname } from "next/navigation";
import Sidebar, { type SidebarPerms } from "@/components/Sidebar";
import TopBar, { type TopBarUser } from "@/components/TopBar";

const BARE = ["/login", "/403", "/cho-duyet"];

export default function AppChrome({
  user,
  perms,
  alertCount,
  children,
}: {
  user: TopBarUser | null;
  perms: SidebarPerms;
  alertCount: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (BARE.includes(pathname) || !user) {
    return <>{children}</>;
  }
  return (
    <div className="flex min-h-screen">
      <Sidebar perms={perms} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar user={user} alertCount={alertCount} />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
