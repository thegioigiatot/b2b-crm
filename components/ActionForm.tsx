"use client";
import { useActionState, type ReactNode } from "react";
export type FormResult = { error?: string; ok?: boolean };
export default function ActionForm({ action, children, className }: { action: (f: FormData) => Promise<FormResult>; children: ReactNode; className?: string }) {
  const [state, submit, pending] = useActionState(async (_: FormResult, f: FormData) => action(f), {});
  return <form action={submit} className={className}>
    <fieldset disabled={pending} className="contents">{children}</fieldset>
    {pending && <p className="text-xs text-slate-500">Đang lưu…</p>}
    {state.error && <p role="alert" className="text-sm text-rose-600 col-span-full">{state.error}</p>}
    {state.ok && <p role="status" className="text-sm text-emerald-700 col-span-full">Đã lưu.</p>}
  </form>;
}
