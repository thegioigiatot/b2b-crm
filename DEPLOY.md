# Triển khai (Vercel + Neon + Firebase)

Xem `SETUP.md` để biết cách lấy từng giá trị cấu hình.

## 1. Chuẩn bị

- **Neon**: 1 project Postgres → có `DATABASE_URL` (pooled) và `DIRECT_URL` (direct).
- **Firebase**: đã bật Google + Email/Password, đã có web config + service account JSON.
- Repo đã đẩy lên GitHub.

## 2. Import vào Vercel

1. https://vercel.com/new → chọn repo.
2. **Framework Preset**: Next.js (mặc định).
3. **Build Command** (Settings → General → Build & Development Settings, ghi đè):
   ```
   prisma generate && prisma migrate deploy && next build
   ```
4. **Environment Variables** — thêm tất cả (Production + Preview):

   | Biến | Ghi chú |
   |---|---|
   | `DATABASE_URL` | Neon **pooled** (`-pooler`, `?sslmode=require`) |
   | `DIRECT_URL` | Neon **direct** |
   | `ADMIN_EMAILS` | email quản trị, phân tách bằng dấu phẩy |
   | `NEXT_PUBLIC_FIREBASE_API_KEY` / `_AUTH_DOMAIN` / `_PROJECT_ID` / `_APP_ID` | web config |
   | `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` | từ service account |
   | `FIREBASE_PRIVATE_KEY` | dán nguyên chuỗi có `\n` (Vercel giữ đúng khi bạn dán cả dấu nháy kép ở hai đầu — hoặc dán không nháy và để `\n` literal; code tự `replace(/\\n/g,"\n")`) |

5. **Deploy**.

## 3. Nạp dữ liệu ban đầu (một lần)

`migrate deploy` chỉ tạo bảng, không seed. Từ máy bạn, trỏ vào DB production rồi seed:

```bash
# .env.production.local chứa DATABASE_URL/DIRECT_URL của Neon
DATABASE_URL="<neon-pooled>" DIRECT_URL="<neon-direct>" npm run db:seed
```

> Muốn khởi đầu **sạch** (không có 90 khách hàng demo): bỏ qua bước này. Bảng rỗng,
> `ScoringConfig` và `PipelineStage` sẽ được tạo mặc định lần đầu bạn vào Settings /
> mở deal; hoặc chạy một script seed rút gọn của riêng bạn.

## 4. Cấu hình Firebase cho domain production

Firebase Console → **Authentication → Settings → Authorized domains** → thêm:
- `your-app.vercel.app`
- domain tuỳ chỉnh (nếu có)

## 5. Đăng nhập lần đầu

1. Vào `https://your-app.vercel.app` → `/login`.
2. Đăng nhập bằng email nằm trong `ADMIN_EMAILS` → bạn là **ADMIN**, được kích hoạt ngay.
3. Vào **Quản trị → Người dùng**: khi đồng nghiệp đăng nhập lần đầu họ ở trạng thái
   *chờ duyệt* — bạn kích hoạt, chọn vai trò (MANAGER/SALES) và nối với một nhân viên
   trong Danh mục.

## Ghi chú kỹ thuật

- Các route dùng `firebase-admin` (`app/api/auth/session`) đã đặt `runtime = "nodejs"`.
- `proxy.ts` (tên mới của middleware ở Next 16) chỉ kiểm tra sự tồn tại của cookie phiên
  ở Edge; xác thực chữ ký nằm trong `lib/auth.ts` (`getCurrentUser`) chạy ở Node.
- Prisma dùng `directUrl` cho migrate và `url` (pooled) cho runtime — bắt buộc với Neon.
- Đổi provider DB về sau: chỉ cần đổi `DATABASE_URL`/`DIRECT_URL` và chạy lại
  `prisma migrate deploy` (Prisma Client không đổi).
