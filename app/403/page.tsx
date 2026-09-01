import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="card card-pad max-w-sm text-center">
        <div className="text-4xl">🚫</div>
        <h1 className="mt-2 text-lg font-semibold text-slate-900">Không đủ quyền</h1>
        <p className="mt-1 text-sm text-slate-500">Tài khoản của bạn không được phép xem trang này.</p>
        <Link href="/" className="btn btn-primary btn-sm mt-4">
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
