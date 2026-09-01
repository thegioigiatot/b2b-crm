import { redirect } from "next/navigation";
import LoginForm from "@/components/auth/LoginForm";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, devLoginEnabled } from "@/lib/auth";
import { firebaseConfigured } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = sp.next && sp.next.startsWith("/") ? sp.next : "/";

  const ctx = await getCurrentUser();
  if (ctx?.user.active) redirect(next);

  const devUsers = devLoginEnabled
    ? (
        await prisma.user.findMany({
          include: { employee: true },
          orderBy: [{ role: "asc" }, { email: "asc" }],
        })
      ).map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        employeeName: u.employee?.name ?? null,
      }))
    : [];

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="card card-pad w-full max-w-sm">
        <LoginForm firebaseEnabled={firebaseConfigured} devUsers={devUsers} next={next} />
      </div>
    </div>
  );
}
