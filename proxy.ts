import { NextResponse, type NextRequest } from "next/server";

// Cổng rẻ tiền ở Edge (Proxy): chỉ kiểm tra có cookie phiên hay không.
// Việc xác thực thật (firebase-admin) nằm ở getCurrentUser() trong Server Components.
const PUBLIC = ["/login", "/cho-duyet", "/403", "/api/auth"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  const hasSession = req.cookies.has("session") || req.cookies.has("dev_uid");
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Bỏ qua static assets, favicon, hình ảnh trong /public
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
