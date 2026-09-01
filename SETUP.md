# Cài đặt & chạy cục bộ

CRM này cần **PostgreSQL** và (tuỳ chọn) **Firebase Authentication**.
Nếu chưa cấu hình Firebase, ứng dụng bật màn hình **"đăng nhập demo"** để bạn chọn một
tài khoản đã seed — đủ để chạy thử toàn bộ tính năng và phân quyền.

---

## 1. Cài dependencies

```bash
npm install
```

## 2. Tạo database PostgreSQL

Chọn một trong hai:

### a) Neon (miễn phí, khuyến nghị cho team / deploy)
1. Vào https://neon.tech → **New Project**.
2. Ở màn **Connection Details**, lấy 2 chuỗi:
   - **Pooled connection** (có `-pooler` trong host) → `DATABASE_URL`
   - **Direct connection** (không có `-pooler`) → `DIRECT_URL`
   Cả hai nên có `?sslmode=require`.

### b) Postgres cục bộ (Homebrew)
```bash
brew install postgresql@16 && brew services start postgresql@16
createdb saleb2bcrm_dev
```
→ `DATABASE_URL` = `DIRECT_URL` = `postgresql://<user>@localhost:5432/saleb2bcrm_dev?schema=public`

## 3. Tạo file `.env`

Copy từ mẫu rồi điền:

```bash
cp .env.example .env
```

| Biến | Lấy ở đâu |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | Bước 2 |
| `ADMIN_EMAILS` | Email của bạn (sẽ tự thành ADMIN khi đăng nhập lần đầu). Ngăn cách bằng dấu phẩy. |
| `NEXT_PUBLIC_FIREBASE_*` / `FIREBASE_*` | Bước 5 — **để trống nếu chưa dùng Firebase** |

## 4. Tạo schema + dữ liệu mẫu

```bash
npx prisma migrate dev --name init
npm run db:seed
```

Seed in ra danh sách tài khoản demo: `admin@demo.local` (ADMIN) và `nv001..nv010@demo.local`
(xen kẽ MANAGER / SALES, đã nối sẵn với nhân viên).

## 5. (Tuỳ chọn) Bật Firebase Authentication

1. https://console.firebase.google.com → **Add project**.
2. **Build → Authentication → Get started**. Ở tab **Sign-in method** bật:
   - **Google**
   - **Email/Password**
3. **Project settings (⚙) → General → Your apps → Web (</>)** → đăng ký app → copy các giá trị vào `.env`:
   - `apiKey` → `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `authDomain` → `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `projectId` → `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `appId` → `NEXT_PUBLIC_FIREBASE_APP_ID`
4. **Project settings → Service accounts → Generate new private key** → tải file JSON → lấy:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (giữ nguyên các `\n`, đặt trong dấu nháy kép)
5. **Authentication → Settings → Authorized domains**: thêm `localhost` (và domain Vercel khi deploy).

Khi `FIREBASE_PROJECT_ID` có giá trị, màn đăng nhập demo tắt và dùng Firebase thật.

## 6. Chạy

```bash
npm run dev
```

Mở http://localhost:3000 → bị đẩy tới `/login`.

- **Chưa có Firebase**: chọn tài khoản demo bất kỳ.
- **Có Firebase**: đăng nhập Google hoặc Email/Password. Email trong `ADMIN_EMAILS` thành ADMIN
  và được kích hoạt ngay; email khác tạo tài khoản ở trạng thái **chờ duyệt** — một ADMIN
  vào **Quản trị → Người dùng** để kích hoạt, gán vai trò và nối với một nhân viên.

---

## Vai trò & phân quyền

3 vai trò mặc định:

| | ADMIN | MANAGER | SALES |
|---|---|---|---|
| Xem/sửa mọi Lead · Deal · Việc | ✓ | ✓ | chỉ của mình hoặc đang theo dõi |
| Giai đoạn Pipeline · Chấm điểm · Danh mục | ✓ | ✓ | ✗ |
| Quản lý người dùng · Sửa bảng phân quyền | ✓ | ✗ | ✗ |
| Nhịp công việc | mọi người | mọi người | chỉ của mình |

Muốn chi tiết hơn: **admin@… → Quản trị → Vai trò & quyền** (`/admin/roles`) — bật/tắt
từng quyền cho mỗi vai trò (áp dụng ngay). Ghi đè cho **từng user** ở
**Quản trị → Người dùng → "Quyền riêng"**.

## Lệnh hữu ích

```bash
npm run db:studio      # xem/sửa dữ liệu bằng Prisma Studio
npm run db:seed        # nạp lại dữ liệu mẫu (xoá sạch trước)
npx prisma migrate dev # tạo migration khi đổi schema
npm run lint && npx tsc --noEmit
```
