"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      const { firebaseClientConfigured } = await import("@/lib/firebase-client");
      if (firebaseClientConfigured) {
        const { clientAuth } = await import("@/lib/firebase-client");
        const { signOut: fbSignOut } = await import("firebase/auth");
        await fbSignOut(clientAuth()).catch(() => {});
      }
    } catch {
      /* ignore */
    }
    await fetch("/api/auth/session", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <button onClick={signOut} disabled={busy} className="btn btn-ghost btn-sm">
      Đăng xuất
    </button>
  );
}
