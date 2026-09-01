import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { firebaseAdmin, firebaseConfigured } from "@/lib/firebase-admin";
import { DEV_COOKIE, SESSION_COOKIE, devLoginEnabled, syncUser } from "@/lib/auth";

export const runtime = "nodejs";

const FOURTEEN_DAYS = 60 * 60 * 24 * 14;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const jar = await cookies();

  // --- Real Firebase session ---
  if (firebaseConfigured) {
    const idToken = body?.idToken as string | undefined;
    if (!idToken) return NextResponse.json({ error: "missing idToken" }, { status: 400 });
    const admin = firebaseAdmin()!;
    try {
      const decoded = await admin.auth.verifyIdToken(idToken, true);
      if (!decoded.email) return NextResponse.json({ error: "no email on token" }, { status: 400 });
      const user = await syncUser({
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name ?? null,
        picture: decoded.picture ?? null,
      });
      const sessionCookie = await admin.auth.createSessionCookie(idToken, { expiresIn: FOURTEEN_DAYS * 1000 });
      jar.set(SESSION_COOKIE, sessionCookie, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: FOURTEEN_DAYS,
      });
      return NextResponse.json({ ok: true, active: user.active, role: user.role });
    } catch {
      return NextResponse.json({ error: "invalid token" }, { status: 401 });
    }
  }

  // --- Dev fallback: pick a seeded user by id ---
  if (devLoginEnabled) {
    const devUserId = body?.devUserId as string | undefined;
    if (!devUserId) return NextResponse.json({ error: "missing devUserId" }, { status: 400 });
    const user = await prisma.user.findUnique({ where: { id: devUserId } });
    if (!user) return NextResponse.json({ error: "unknown user" }, { status: 404 });
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    jar.set(DEV_COOKIE, user.id, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: FOURTEEN_DAYS,
    });
    return NextResponse.json({ ok: true, active: user.active, role: user.role });
  }

  return NextResponse.json({ error: "auth not configured" }, { status: 500 });
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(DEV_COOKIE);
  return NextResponse.json({ ok: true });
}
