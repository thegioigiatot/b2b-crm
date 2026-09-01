"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

type DevUser = { id: string; email: string; name: string | null; role: string; employeeName: string | null };

export default function LoginForm({
  firebaseEnabled,
  devUsers,
  next,
}: {
  firebaseEnabled: boolean;
  devUsers: DevUser[];
  next: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function finishWithIdToken(idToken: string) {
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Đăng nhập thất bại");
    router.replace(data.active ? next : "/cho-duyet");
    router.refresh();
  }

  async function google() {
    setErr("");
    setBusy(true);
    try {
      const { clientAuth, googleProvider } = await import("@/lib/firebase-client");
      const { signInWithPopup } = await import("firebase/auth");
      const cred = await signInWithPopup(clientAuth(), googleProvider);
      await finishWithIdToken(await cred.user.getIdToken());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi đăng nhập Google");
    } finally {
      setBusy(false);
    }
  }

  async function emailPassword(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const { clientAuth } = await import("@/lib/firebase-client");
      const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import("firebase/auth");
      const fn = mode === "signup" ? createUserWithEmailAndPassword : signInWithEmailAndPassword;
      const cred = await fn(clientAuth(), email, password);
      await finishWithIdToken(await cred.user.getIdToken());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sai email hoặc mật khẩu");
    } finally {
      setBusy(false);
    }
  }

  async function devLogin(userId: string) {
    setErr("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ devUserId: userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lỗi");
      router.replace(data.active ? next : "/cho-duyet");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-5">
      <div className="text-center">
        <div className="text-2xl">🧭</div>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Sale B2B CRM</h1>
        <p className="text-sm text-slate-500">Đăng nhập để tiếp tục</p>
      </div>

      {err && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{err}</div>}

      {firebaseEnabled ? (
        <>
          <button onClick={google} disabled={busy} className="btn btn-ghost w-full">
            <span className="font-bold text-[#4285F4]">G</span> Đăng nhập với Google
          </button>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> hoặc <span className="h-px flex-1 bg-slate-200" />
          </div>
          <form onSubmit={emailPassword} className="space-y-3">
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
            <button type="submit" disabled={busy} className="btn btn-primary w-full">
              {mode === "signup" ? "Tạo tài khoản" : "Đăng nhập"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setMode((m) => (m === "signup" ? "signin" : "signup"))}
            className="w-full text-center text-xs text-slate-500 hover:text-slate-800"
          >
            {mode === "signup" ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Tạo mới"}
          </button>
        </>
      ) : (
        <div className="space-y-2">
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Chưa cấu hình Firebase — đang dùng đăng nhập demo. Chọn một tài khoản:
          </p>
          <div className="max-h-72 space-y-1.5 overflow-auto">
            {devUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => devLogin(u.id)}
                disabled={busy}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:border-indigo-300 hover:bg-indigo-50/40"
              >
                <span>
                  <span className="font-medium text-slate-800">{u.name ?? u.email}</span>
                  <span className="block text-[11px] text-slate-400">
                    {u.employeeName ?? "chưa nối nhân viên"} · {u.email}
                  </span>
                </span>
                <span
                  className={clsx(
                    "chip",
                    u.role === "ADMIN" ? "chip-hot" : u.role === "MANAGER" ? "chip-warm" : "chip-slate",
                  )}
                >
                  {u.role}
                </span>
              </button>
            ))}
            {devUsers.length === 0 && (
              <p className="text-xs text-slate-400">Chưa có user nào — chạy <code>npm run db:seed</code>.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
