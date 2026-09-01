import PageHeader from "@/components/PageHeader";
import UserForm from "@/components/admin/UserForm";
import { prisma } from "@/lib/prisma";
import { requirePerm } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewUserPage() {
  await requirePerm("manageUsers");
  const employees = await prisma.employee.findMany({ where: { active: true }, orderBy: { name: "asc" } });

  return (
    <div>
      <PageHeader
        title="+ Thêm người dùng"
        subtitle="Tạo trước tài khoản bằng Gmail; người đó đăng nhập Firebase bằng chính Gmail đó là vào được"
      />
      <div className="p-6">
        <UserForm employees={employees.map((e) => ({ id: e.id, name: e.name }))} />
      </div>
    </div>
  );
}
