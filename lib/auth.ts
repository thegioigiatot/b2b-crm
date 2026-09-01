import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Employee, User } from "@prisma/client";
import { prisma } from "./prisma";
import { firebaseAdmin, firebaseConfigured } from "./firebase-admin";
import {
  DEFAULT_ROLE_PERMS,
  resolvePerms,
  type PermKey,
  type Role,
} from "./permissions";

export const SESSION_COOKIE = "session";
export const DEV_COOKIE = "dev_uid";

export type { Role, PermKey } from "./permissions";
export type PermMap = Record<PermKey, boolean>;
export type AuthContext = { user: User; employee: Employee | null; perms: PermMap };

/** Demo login (no Firebase) is only allowed outside production and when Firebase is unset. */
export const devLoginEnabled = !firebaseConfigured && process.env.NODE_ENV !== "production";

function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Match an incoming Firebase identity to a User row, creating/backfilling as needed. */
export async function syncUser(identity: {
  uid: string;
  email: string;
  name?: string | null;
  picture?: string | null;
}): Promise<User> {
  const email = identity.email.toLowerCase();
  const isAdmin = adminEmails().includes(email);

  let user =
    (await prisma.user.findUnique({ where: { firebaseUid: identity.uid } })) ??
    (await prisma.user.findUnique({ where: { email } }));

  if (!user) {
    user = await prisma.user.create({
      data: {
        firebaseUid: identity.uid,
        email,
        name: identity.name ?? null,
        photoUrl: identity.picture ?? null,
        role: isAdmin ? "ADMIN" : "SALES",
        active: isAdmin,
        lastLoginAt: new Date(),
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        firebaseUid: identity.uid,
        name: user.name ?? identity.name ?? null,
        photoUrl: identity.picture ?? user.photoUrl,
        role: isAdmin && user.role !== "ADMIN" ? "ADMIN" : user.role,
        active: isAdmin ? true : user.active,
        lastLoginAt: new Date(),
      },
    });
  }
  return user;
}

async function loadContext(userId: string): Promise<AuthContext | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { employee: true } });
  if (!user) return null;
  const roleConfig = await prisma.roleConfig.findUnique({ where: { role: user.role } });
  const perms = resolvePerms(user.role as Role, roleConfig?.perms, user.extraPerms);
  const { employee, ...rest } = user;
  return { user: rest as User, employee: employee ?? null, perms };
}

/** Current signed-in context or null. Never throws / redirects. Cached per request. */
export const getCurrentUser = cache(async (): Promise<AuthContext | null> => {
  const jar = await cookies();

  if (firebaseConfigured) {
    const token = jar.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const admin = firebaseAdmin();
    if (!admin) return null;
    try {
      const decoded = await admin.auth.verifySessionCookie(token, true);
      if (!decoded.email) return null;
      const user = await syncUser({
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name ?? null,
        picture: decoded.picture ?? null,
      });
      return loadContext(user.id);
    } catch {
      return null;
    }
  }

  if (devLoginEnabled) {
    const id = jar.get(DEV_COOKIE)?.value;
    if (!id) return null;
    return loadContext(id);
  }

  return null;
});

export async function requireUser(): Promise<AuthContext> {
  const ctx = await getCurrentUser();
  if (!ctx) redirect("/login");
  if (!ctx.user.active) redirect("/cho-duyet");
  return ctx;
}

export async function requireRole(...roles: Role[]): Promise<AuthContext> {
  const ctx = await requireUser();
  if (!roles.includes(ctx.user.role as Role)) redirect("/403");
  return ctx;
}

/** Gate a page/action on a specific permission key. */
export async function requirePerm(key: PermKey): Promise<AuthContext> {
  const ctx = await requireUser();
  if (!ctx.perms[key]) redirect("/403");
  return ctx;
}

// ---------- authorization helpers ----------

type OwnedRow = { ownerId?: string | null; employeeId?: string | null; followers?: { employeeId: string }[] };

export function hasPerm(ctx: AuthContext, key: PermKey): boolean {
  return !!ctx.perms[key];
}

function owns(ctx: AuthContext, res?: OwnedRow): boolean {
  const empId = ctx.employee?.id;
  if (!empId || !res) return false;
  if (res.ownerId === empId || res.employeeId === empId) return true;
  return !!res.followers?.some((f) => f.employeeId === empId);
}

type Entity = "deal" | "lead" | "task";
const VIEW_ALL: Record<Entity, PermKey> = {
  deal: "viewAllDeals",
  lead: "viewAllLeads",
  task: "viewAllTasks",
};

export function canRead(ctx: AuthContext, entity: Entity, res?: OwnedRow): boolean {
  return ctx.perms[VIEW_ALL[entity]] || owns(ctx, res);
}

export function canEdit(ctx: AuthContext, res?: OwnedRow): boolean {
  return ctx.perms.editAnyRecord || owns(ctx, res);
}

export function canDelete(ctx: AuthContext, res?: OwnedRow): boolean {
  return ctx.perms.deleteRecords && canEdit(ctx, res);
}

/** Back-compat wrapper used by older call sites. */
export function can(
  ctx: AuthContext,
  action: "record:write" | "record:read" | "record:delete",
  res?: OwnedRow,
): boolean {
  if (action === "record:read") return ctx.perms.editAnyRecord || owns(ctx, res) || anyViewAll(ctx);
  if (action === "record:delete") return canDelete(ctx, res);
  return canEdit(ctx, res);
}
function anyViewAll(ctx: AuthContext) {
  return ctx.perms.viewAllDeals || ctx.perms.viewAllLeads || ctx.perms.viewAllTasks;
}

/** True when the user manages team data — used for UI hints (owner filters, pickers). */
export function isPrivileged(ctx: AuthContext) {
  return ctx.perms.editAnyRecord || ctx.perms.viewAllDeals;
}

/** Prisma `where` fragment restricting Deal rows to what the viewer may see. */
export function dealVisibilityWhere(ctx: AuthContext) {
  if (ctx.perms.viewAllDeals) return {};
  const empId = ctx.employee?.id ?? "__none__";
  return { OR: [{ ownerId: empId }, { followers: { some: { employeeId: empId } } }] };
}

export function leadVisibilityWhere(ctx: AuthContext) {
  if (ctx.perms.viewAllLeads) return {};
  return { employeeId: ctx.employee?.id ?? "__none__" };
}

export function taskVisibilityWhere(ctx: AuthContext) {
  if (ctx.perms.viewAllTasks) return {};
  return { employeeId: ctx.employee?.id ?? "__none__" };
}

/** Ensure the RoleConfig rows exist (lazy, called from the roles admin page). */
export async function ensureRoleConfigs() {
  const existing = await prisma.roleConfig.findMany();
  const have = new Set(existing.map((r) => r.role));
  for (const role of ["ADMIN", "MANAGER", "SALES"] as Role[]) {
    if (!have.has(role)) {
      await prisma.roleConfig.create({
        data: { role, perms: JSON.stringify(DEFAULT_ROLE_PERMS[role]) },
      });
    }
  }
  return prisma.roleConfig.findMany();
}
