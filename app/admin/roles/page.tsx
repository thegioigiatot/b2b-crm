import PageHeader from "@/components/PageHeader";
import RolePermsMatrix from "@/components/admin/RolePermsMatrix";
import { requirePerm, ensureRoleConfigs } from "@/lib/auth";
import {
  DEFAULT_ROLE_PERMS,
  ROLES,
  parsePermMap,
  type PermKey,
  type Role,
} from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AdminRolesPage() {
  await requirePerm("managePermissions");
  const rows = await ensureRoleConfigs();
  const byRole = new Map(rows.map((r) => [r.role, r.perms]));

  const perms = Object.fromEntries(
    ROLES.map((role) => [role, parsePermMap(byRole.get(role), DEFAULT_ROLE_PERMS[role])]),
  ) as Record<Role, Record<PermKey, boolean>>;

  return (
    <div>
      <PageHeader
        title="🛡️ Vai trò & quyền"
        subtitle="Bật/tắt từng quyền cho mỗi vai trò. Áp dụng ngay cho toàn hệ thống."
      />
      <div className="p-6">
        <RolePermsMatrix perms={perms} />
      </div>
    </div>
  );
}
