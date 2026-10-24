"use client";
import { useActionState, useRef, useTransition, type ReactNode } from "react";
export type FormResult = { error?: string; ok?: boolean };
export default function ActionForm({ action, children, className }: { action: (f: FormData) => Promise<FormResult>; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [, startTransition] = useTransition();
  const [state, submit, pending] = useActionState(async (_: FormResult, f: FormData) => {
    const result = await action(f);
    if (result.ok) ref.current?.reset();
    return result;
  }, {});
  return <form ref={ref} action={submit} className={className} onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => submit(data));
  }}>
    <fieldset disabled={pending} className="contents">{children}</fieldset>
    {pending && <p className="text-xs text-slate-500">Đang lưu…</p>}
    {state.error && <p role="alert" className="text-sm text-rose-600 col-span-full">{state.error}</p>}
    {state.ok && <p role="status" className="text-sm text-emerald-700 col-span-full">Đã lưu.</p>}
  </form>;
}
