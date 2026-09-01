"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { requirePerm, ensureRoleConfigs } from "./auth";
import {
  DEFAULT_ROLE_PERMS,
  PERM_KEYS,
  ROLES,
  type PermKey,
  type Role,
} from "./permissions";

// ---------- Users ----------

function str(v: FormDataEntryValue | null) {
  const s = (v ?? "").toString().trim();
  return s.length ? s : undefined;
}

function profileFields(formData: FormData) {
  return {
    name: str(formData.get("name")) ?? null,
    phone: str(formData.get("phone")) ?? null,
    title: str(formData.get("title")) ?? null,
    photoUrl: str(formData.get("photoUrl")) ?? null,
  };
}

export async function createUser(formData: FormData) {
  await requirePerm("manageUsers");
  const email = str(formData.get("email"))?.toLowerCase();
  if (!email) throw new Error("Cần nhập email.");
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw new Error("Email này đã có tài khoản.");
  const role = ROLES.includes(str(formData.get("role")) as Role) ? String(formData.get("role")) : "SALES";
  const employeeId = str(formData.get("employeeId")) ?? null;
  if (employeeId) {
    await prisma.user.updateMany({ where: { employeeId }, data: { employeeId: null } });
  }
  const u = await prisma.user.create({
    data: {
      email,
      role,
      active: formData.getAll("active").includes("on"),
      employeeId,
      ...profileFields(formData),
    },
  });
  revalidatePath("/admin/users");
  redirect(`/admin/users/${u.id}`);
}

/** CRUD đầy đủ: hồ sơ + vai trò + trạng thái + nối nhân viên trong 1 form. */
export async function updateUser(userId: string, formData: FormData) {
  await requirePerm("manageUsers");
  const data: Record<string, unknown> = { ...profileFields(formData) };

  const email = str(formData.get("email"))?.toLowerCase();
  if (email) {
    const other = await prisma.user.findUnique({ where: { email } });
    if (other && other.id !== userId) throw new Error("Email đã được dùng bởi tài khoản khác.");
    data.email = email;
  }

  const role = str(formData.get("role"));
  if (role && ROLES.includes(role as Role)) data.role = role;

  if (formData.has("active")) data.active = formData.getAll("active").includes("on");

  if (formData.has("employeeId")) {
    const employeeId = str(formData.get("employeeId")) ?? null;
    if (employeeId) {
      await prisma.user.updateMany({
        where: { employeeId, NOT: { id: userId } },
        data: { employeeId: null },
      });
    }
    data.employeeId = employeeId;
  }

  await prisma.user.update({ where: { id: userId }, data });
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/", "layout");
}

export async function setUserRole(userId: string, role: string) {
  await requirePerm("manageUsers");
  if (!ROLES.includes(role as Role)) return;
  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin/users");
}

export async function setUserActive(userId: string, active: boolean) {
  await requirePerm("manageUsers");
  await prisma.user.update({ where: { id: userId }, data: { active } });
  revalidatePath("/admin/users");
}

export async function linkUserEmployee(userId: string, employeeId: string) {
  await requirePerm("manageUsers");
  const target = employeeId || null;
  if (target) {
    await prisma.user.updateMany({
      where: { employeeId: target, NOT: { id: userId } },
      data: { employeeId: null },
    });
  }
  await prisma.user.update({ where: { id: userId }, data: { employeeId: target } });
  revalidatePath("/admin/users");
}

export async function deleteUser(userId: string) {
  const { user } = await requirePerm("manageUsers");
  if (user.id === userId) throw new Error("Không thể xoá chính mình.");
  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

/** Ghi đè quyền riêng cho 1 user. state: "role" (theo vai trò), "on" (bật), "off" (tắt). */
export async function setUserPermOverride(userId: string, key: string, state: "role" | "on" | "off") {
  await requirePerm("managePermissions");
  if (!PERM_KEYS.includes(key as PermKey)) return;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { extraPerms: true } });
  let map: Record<string, boolean> = {};
  try {
    map = u?.extraPerms ? JSON.parse(u.extraPerms) : {};
  } catch {
    map = {};
  }
  if (state === "role") delete map[key];
  else map[key] = state === "on";
  await prisma.user.update({
    where: { id: userId },
    data: { extraPerms: Object.keys(map).length ? JSON.stringify(map) : null },
  });
  revalidatePath("/admin/users");
}

// ---------- Role permission matrix ----------

export async function saveRolePerms(formData: FormData) {
  await requirePerm("managePermissions");
  await ensureRoleConfigs();
  for (const role of ROLES) {
    const map = Object.fromEntries(
      PERM_KEYS.map((k) => [k, formData.get(`${role}.${k}`) === "on"]),
    ) as Record<PermKey, boolean>;
    await prisma.roleConfig.upsert({
      where: { role },
      create: { role, perms: JSON.stringify(map) },
      update: { perms: JSON.stringify(map) },
    });
  }
  revalidatePath("/admin/roles");
  revalidatePath("/", "layout");
}

export async function resetRolePerms() {
  await requirePerm("managePermissions");
  for (const role of ROLES) {
    await prisma.roleConfig.upsert({
      where: { role },
      create: { role, perms: JSON.stringify(DEFAULT_ROLE_PERMS[role]) },
      update: { perms: JSON.stringify(DEFAULT_ROLE_PERMS[role]) },
    });
  }
  revalidatePath("/admin/roles");
  revalidatePath("/", "layout");
}
