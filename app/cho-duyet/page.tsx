import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/auth/SignOutButton";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const ctx = await getCurrentUser();
  if (!ctx) redirect("/login");
  if (ctx.user.active) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="card card-pad max-w-sm text-center">
        <div className="text-4xl">⏳</div>
        <h1 className="mt-2 text-lg font-semibold text-slate-900">Đang chờ duyệt</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tài khoản <b>{ctx.user.email}</b> đã tạo thành công. Quản trị viên cần kích hoạt và gán bạn vào một nhân viên
          trước khi bạn dùng được hệ thống.
        </p>
        <div className="mt-4">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
