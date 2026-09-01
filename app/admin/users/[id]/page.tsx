import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import UserForm from "@/components/admin/UserForm";
import { DeleteUserButton, UserPermsButton } from "@/components/admin/UserControls";
import { prisma } from "@/lib/prisma";
import { requirePerm } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { user: me, perms } = await requirePerm("manageUsers");
  const { id } = await params;
  const [user, employees] = await Promise.all([
    prisma.user.findUnique({ where: { id } }),
    prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!user) notFound();

  return (
    <div>
      <PageHeader
        title={`👤 ${user.name ?? user.email}`}
        subtitle={<Link href="/admin/users" className="hover:underline">← Danh sách người dùng</Link>}
        actions={
          <div className="flex items-center gap-3">
            {perms.managePermissions && (
              <UserPermsButton userId={user.id} role={user.role} extraPerms={user.extraPerms} />
            )}
            {user.id !== me.id && <DeleteUserButton userId={user.id} />}
          </div>
        }
      />
      <div className="p-6">
        <UserForm user={user} employees={employees.map((e) => ({ id: e.id, name: e.name }))} currentUserId={me.id} />
      </div>
    </div>
  );
}
