import type { Metadata } from "next";
import "./globals.css";
import AppChrome from "@/components/AppChrome";
import { getCurrentUser } from "@/lib/auth";
import { getAlertCount } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Sale B2B CRM",
  description: "Phần mềm CRM quản lý khách hàng, doanh số và KPI nhân viên",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const ctx = await getCurrentUser();
  const alertCount = ctx ? await getAlertCount(ctx) : 0;

  const topBarUser = ctx
    ? {
        name: ctx.user.name,
        email: ctx.user.email,
        role: ctx.user.role,
        photoUrl: ctx.user.photoUrl,
        employeeName: ctx.employee?.name ?? null,
        canManageUsers: !!ctx.perms.manageUsers,
      }
    : null;

  const sidebarPerms = {
    manageCatalog: !!ctx?.perms.manageCatalog,
    managePipeline: !!ctx?.perms.managePipeline,
    manageScoring: !!ctx?.perms.manageScoring,
    manageUsers: !!ctx?.perms.manageUsers,
    managePermissions: !!ctx?.perms.managePermissions,
  };

  return (
    <html lang="vi" className="h-full">
      <body className="min-h-full antialiased">
        <AppChrome user={topBarUser} perms={sidebarPerms} alertCount={alertCount}>
          {children}
        </AppChrome>
      </body>
    </html>
  );
}
