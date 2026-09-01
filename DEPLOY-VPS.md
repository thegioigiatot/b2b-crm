# Triển khai lên VPS — CRM cho 2D Digital (`crm.nawasoft.vn`)

Kịch bản: 1 VPS Ubuntu, ~7 tài khoản (5 sales + 1 quản lý + 1 admin), PostgreSQL chạy
ngay trên VPS, Node + PM2 + Nginx + HTTPS (Let's Encrypt), đăng nhập bằng Firebase
(Gmail Google + Email/Password).

Ước lượng VPS tối thiểu: **2 vCPU / 2–4 GB RAM / 20 GB SSD**, Ubuntu 22.04 LTS.

---

## 0. Trỏ tên miền

Ở trang quản lý DNS của `nawasoft.vn`, thêm bản ghi:

| Loại | Tên | Giá trị |
|---|---|---|
| A | `crm` | `<IP_VPS>` |

Chờ vài phút cho DNS lan, kiểm tra: `ping crm.nawasoft.vn` ra đúng IP.

---

## 1. Chuẩn bị VPS (chạy với user `root` hoặc `sudo`)

```bash
apt update && apt upgrade -y
apt install -y curl git nginx ufw

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v            # v20.x

# PM2 (chạy app nền + tự khởi động lại)
npm i -g pm2

# PostgreSQL 16
apt install -y postgresql postgresql-contrib
systemctl enable --now postgresql

# Firewall
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```

---

## 2. Tạo database

```bash
sudo -u postgres psql <<'SQL'
CREATE USER crm WITH PASSWORD 'DAT_MAT_KHAU_MANH_O_DAY';
CREATE DATABASE saleb2bcrm OWNER crm;
GRANT ALL PRIVILEGES ON DATABASE saleb2bcrm TO crm;
SQL
```

Chuỗi kết nối sẽ là:
`postgresql://crm:DAT_MAT_KHAU_MANH_O_DAY@localhost:5432/saleb2bcrm?schema=public`

---

## 3. Tạo Firebase project

1. https://console.firebase.google.com → **Add project** (vd tên `2d-digital-crm`).
2. **Build → Authentication → Get started**, tab **Sign-in method** bật:
   - **Google**
   - **Email/Password**
3. **Authentication → Settings → Authorized domains** → **Add domain** → `crm.nawasoft.vn`.
4. **⚙ Project settings → General → Your apps → </> (Web)** → đăng ký app → copy 4 giá trị:
   `apiKey`, `authDomain`, `projectId`, `appId`.
5. **⚙ Project settings → Service accounts → Generate new private key** → tải file JSON.
   Trong file lấy: `project_id`, `client_email`, `private_key`.

---

## 4. Lấy mã nguồn & cấu hình

```bash
# tạo user riêng cho app (không chạy bằng root)
adduser --system --group --shell /bin/bash crmapp
su - crmapp

git clone <URL_REPO> app     # hoặc scp/rsync mã nguồn lên ~/app
cd app
npm ci
```

Tạo file `.env` (trong `~/app`):

```bash
cat > .env <<'ENV'
NODE_ENV=production

DATABASE_URL="postgresql://crm:DAT_MAT_KHAU_MANH_O_DAY@localhost:5432/saleb2bcrm?schema=public"
DIRECT_URL="postgresql://crm:DAT_MAT_KHAU_MANH_O_DAY@localhost:5432/saleb2bcrm?schema=public"

# Email của bạn (admin) — tự thành ADMIN khi đăng nhập lần đầu
ADMIN_EMAILS="admin-2ddigital@gmail.com"

NEXT_PUBLIC_FIREBASE_API_KEY="..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="2d-digital-crm.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="2d-digital-crm"
NEXT_PUBLIC_FIREBASE_APP_ID="1:....:web:...."

FIREBASE_PROJECT_ID="2d-digital-crm"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@2d-digital-crm.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n...\n-----END PRIVATE KEY-----\n"
ENV
```

> `FIREBASE_PRIVATE_KEY`: dán **nguyên chuỗi có `\n`** như trong file JSON, đặt trong dấu
> nháy kép. Code tự chuyển `\n` thành xuống dòng lúc chạy.

---

## 5. Migrate + build + khởi động

```bash
cd ~/app
npx prisma migrate deploy      # tạo toàn bộ bảng
npm run build                  # build production

# — Tuỳ chọn A: bắt đầu SẠCH (khuyến nghị cho công ty thật) —
# Không seed. Bảng rỗng; ScoringConfig + PipelineStage + RoleConfig sẽ được tạo mặc định
# lần đầu vào Settings / mở deal / vào trang phân quyền.
#
# — Tuỳ chọn B: nạp dữ liệu mẫu để xem thử —
# npm run db:seed

pm2 start npm --name crm -- run start      # chạy Next trên cổng 3000
pm2 save
pm2 startup systemd -u crmapp --hp /home/crmapp   # chạy dòng lệnh nó in ra (bằng sudo)
```

Kiểm tra nội bộ: `curl -I http://localhost:3000` → `200` hoặc `307 → /login`.

---

## 6. Nginx reverse proxy + HTTPS

Thoát về `root`/`sudo`:

```bash
cat > /etc/nginx/sites-available/crm.nawasoft.vn <<'NGINX'
server {
    listen 80;
    server_name crm.nawasoft.vn;

    client_max_body_size 10M;   # cho phép upload ảnh đại diện

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

ln -s /etc/nginx/sites-available/crm.nawasoft.vn /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Chứng chỉ Let's Encrypt
apt install -y certbot python3-certbot-nginx
certbot --nginx -d crm.nawasoft.vn --redirect -m admin-2ddigital@gmail.com --agree-tos -n
```

Certbot tự sửa file Nginx sang HTTPS + bật gia hạn tự động (`systemctl status certbot.timer`).

Mở `https://crm.nawasoft.vn` → phải thấy trang **/login** với nút "Đăng nhập với Google".

---

## 7. Tạo 7 tài khoản

**Bước 1 — Admin (bạn):**
1. Vào `https://crm.nawasoft.vn` → **Đăng nhập với Google** bằng đúng email đã đặt trong
   `ADMIN_EMAILS`.
2. Vào ngay → bạn là **ADMIN**.

**Bước 2 — 1 quản lý + 5 sales:**
- Cách nhanh: menu **Quản trị → Người dùng → “+ Thêm người dùng”**. Với mỗi người nhập
  **Gmail của họ**, họ tên, SĐT, chức danh, chọn vai trò **MANAGER** (cho quản lý) hoặc
  **SALES**, tick “Kích hoạt ngay”, và **Nối với nhân viên** tương ứng (tạo nhân viên
  trong **Danh mục** trước nếu chưa có).
- Sau đó bảo mỗi người vào `https://crm.nawasoft.vn` và **Đăng nhập với Google** bằng
  đúng Gmail đó — hệ thống tự khớp và cho vào với đúng vai trò.

> Nếu ai đó lỡ đăng nhập trước khi bạn tạo: tài khoản của họ sẽ ở trạng thái **chờ duyệt**.
> Bạn vào **Quản trị → Người dùng**, mở hồ sơ họ, chọn vai trò + nối nhân viên + bật hoạt động.

**Phân quyền chi tiết** (nếu cần khác mặc định): **Quản trị → Vai trò & quyền**
(`/admin/roles`) chỉnh cho từng vai trò; hoặc “Quyền riêng” cho từng user.

---

## 8. Cập nhật khi có phiên bản mới

```bash
su - crmapp
cd ~/app
git pull
npm ci
npx prisma migrate deploy
npm run build
pm2 restart crm
```

## 9. Sao lưu database (nên đặt cron hằng ngày)

```bash
# /etc/cron.daily/crm-backup  (chmod +x)
#!/bin/bash
DEST=/var/backups/crm
mkdir -p "$DEST"
sudo -u postgres pg_dump saleb2bcrm | gzip > "$DEST/saleb2bcrm-$(date +\%F).sql.gz"
find "$DEST" -name '*.sql.gz' -mtime +14 -delete
```

## 10. Vận hành & sự cố

| Việc | Lệnh |
|---|---|
| Xem log app | `pm2 logs crm` |
| Trạng thái | `pm2 status` · `systemctl status nginx postgresql` |
| Đổi biến môi trường | sửa `~/app/.env` rồi `pm2 restart crm` |
| Lỗi 502 Bad Gateway | app chưa chạy → `pm2 restart crm`, xem `pm2 logs crm` |
| Lỗi đăng nhập Google | thiếu `crm.nawasoft.vn` trong Firebase → Authorized domains |
| Lỗi "auth not configured" | thiếu/nhầm biến `FIREBASE_*` trong `.env` |

## Ghi chú kỹ thuật

- Ảnh đại diện lưu trực tiếp trong DB (data URI, thu nhỏ 160px) — không cần S3/Storage.
  `client_max_body_size 10M` ở Nginx là để form không bị chặn.
- Route dùng `firebase-admin` (`/api/auth/session`) chạy Node runtime (đã cấu hình sẵn).
- `proxy.ts` (middleware ở Next 16) chỉ kiểm tra cookie phiên ở Edge; xác thực chữ ký
  nằm trong `lib/auth.ts` chạy ở Node.
- Muốn tách DB sang máy khác sau này: chỉ đổi `DATABASE_URL`/`DIRECT_URL` rồi
  `prisma migrate deploy` + `pm2 restart crm`.
