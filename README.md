# Sale B2B CRM

CRM quản lý **Lead → Khách hàng → Deal**, doanh số, KPI nhân viên, chấm điểm lead/deal và
nhịp công việc hằng ngày — có **đăng nhập Firebase** và **phân quyền 3 vai trò**
(Admin / Quản lý / Sales).

## Tính năng chính

- **Đăng nhập & phân quyền** — Firebase Authentication (Google + Email/Password); vai trò
  ADMIN / MANAGER / SALES; SALES chỉ thấy lead/deal/việc của mình hoặc đang theo dõi;
  trang **Quản trị → Người dùng** để kích hoạt tài khoản và nối với nhân viên.
  Chưa cấu hình Firebase thì có màn **đăng nhập demo** để thử nhanh.
- **Leads** — khách tiềm năng thô, tự chấm điểm theo *độ phù hợp* (trọng số) và
  *mức tương tác* (điểm × nửa đời × trần đếm) → nhãn Nóng / Ấm / Nguội; nút chuyển đổi
  thành Khách hàng + Deal + Người liên hệ.
- **Deals** — danh sách (tab Tất cả / Đang mở / Cam kết / Rủi ro / Gia hạn / Thắng / Thua)
  và **bảng kéo thả** theo giai đoạn pipeline; modal "Tạo deal" ngay trên màn hình;
  hồ sơ deal: thanh giai đoạn, sức khỏe deal (% khả năng chốt), dự báo chốt, mốc về,
  người liên hệ, người theo dõi, timeline hoạt động (ghi chú / gọi / email / tài liệu /
  check-in) + đánh dấu Thắng/Thua.
- **Công việc** — bảng kéo thả Cần làm / Đang làm / Hoàn thành, tiến độ theo nhân viên.
- **Nhịp công việc** — định nghĩa việc lặp lại (báo cáo, đăng bài, gọi lead…), màn
  *Việc hôm nay* / *Bảng theo dõi* 14 ngày / *Thiết lập*.
- **Khách hàng** — hồ sơ, **người liên hệ (Contact)**, lịch sử chăm sóc, deal & đơn hàng
  liên quan.
- **KPI & Dashboard** — chỉ tiêu theo nhân viên/nhóm hàng/tháng, phễu pipeline, dự báo có
  trọng số, thẻ "cần chú ý" (deal/việc quá hạn).
- **Danh mục** (ADMIN/MANAGER) — nhân viên, tỉnh/thành, nhóm sản phẩm, nguồn, trạng thái;
  **giai đoạn pipeline** và **bộ chấm điểm** (có chế độ "nắn theo phân bố thật").

## Công nghệ

Next.js 16 (App Router) · TypeScript · Prisma + **PostgreSQL** · Firebase Auth · Tailwind v4
· Recharts. Đọc dữ liệu chạy trong Server Components; thao tác ghi dùng Server Actions
(kèm kiểm tra quyền ở từng action).

## Bắt đầu

Xem **[SETUP.md](SETUP.md)** — hướng dẫn tạo Postgres (Neon hoặc cục bộ), Firebase và `.env`.

```bash
npm install
cp .env.example .env          # điền DATABASE_URL / DIRECT_URL (+ Firebase nếu có)
npx prisma migrate dev --name init
npm run db:seed               # tạo dữ liệu mẫu + tài khoản demo
npm run dev
```

Mở http://localhost:3000 → `/login`. Chưa có Firebase: chọn `admin@demo.local` (ADMIN)
hoặc `nv0XX@demo.local`.

Triển khai lên Vercel: xem **[DEPLOY.md](DEPLOY.md)**.

### Lệnh khác

- `npm run build` / `npm run start`
- `npm run db:studio` — Prisma Studio
- `npm run lint` · `npx tsc --noEmit`

## Cấu trúc dữ liệu (`prisma/schema.prisma`)

| Nhóm | Model |
|---|---|
| Danh mục | `Employee`, `Province`, `ProductGroup`, `Source`, `CareStatus`, `PipelineStage` |
| Đăng nhập | `User` (nối 1-1 với `Employee`) |
| Lead → Account → Deal | `Lead`, `Customer`, `Contact`, `Deal`, `DealFollower` |
| Hoạt động | `Activity` (timeline chung cho Lead & Deal) |
| Bán hàng | `Order`, `KpiTarget`, `CareLog`, `CustomerDocument`, `Task` |
| Chấm điểm | `ScoringConfig` (một dòng, JSON) — logic ở `lib/scoring.ts` |
| Nhịp công việc | `WorkRhythmTask`, `WorkRhythmLog` |

Server actions tách theo miền: `lib/{actions,lead-actions,deal-actions,rhythm-actions,
stage-actions,scoring-actions,user-actions}.ts`. Auth/RBAC: `lib/auth.ts` +
`lib/firebase-{client,admin}.ts` + `proxy.ts`.
