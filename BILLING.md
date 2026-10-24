# Phân quyền và thu tiền dịch vụ

## Quy tắc

- SALES chỉ thấy khách hàng/Contact và doanh số thuộc Employee của mình. Deal cho phép người sở hữu hoặc follower; quyền xem toàn bộ từng module được cấu hình riêng. Quyền xem không tự cấp quyền sửa.
- SALES chưa nối Employee bị chặn tạo khách hàng/doanh số/deal. Gán nhân viên khác cần quyền `editAnyRecord`. Xóa cần `deleteRecords` và quyền sửa hồ sơ.
- Đánh dấu Thắng không tự tạo tiền đã thu. Chi tiết deal hiển thị biểu mẫu hợp đồng, kỳ thu và cảnh báo chưa có doanh số. Mục Doanh số cũng liệt kê deal thắng chưa thu.
- Một lần: chọn deal thắng ở `/sales/new`, khách hàng và nhân viên phải khớp. Chỉ ghi một doanh số một lần/deal, khóa duy nhất ngăn gửi lại.
- Định kỳ/thu nhiều đợt: vào chi tiết deal → tạo hợp đồng → lập kỳ → ghi từng phiếu thu. Mỗi phiếu tách phí agency, media thu hộ và VAT. Chỉ phí agency vào Order/KPI/Dashboard theo ngày thu; đây là chỉ tiêu tiền phí dịch vụ đã thu, không phải sổ kế toán doanh thu dồn tích.
- Hợp đồng có chu kỳ 1/3/6/12 tháng hoặc một lần. Kỳ neo vào ngày bắt đầu: 31/01 → 28/02 → 31/03. Ngày hết hạn là cận không bao gồm; không chia tỷ lệ kỳ lẻ. Muốn kỳ kế tiếp vượt hạn phải gia hạn trước. Tạm dừng/kết thúc chặn lập kỳ mới, vẫn có thể thu nợ kỳ cũ.
- VAT cấu hình bởi người vận hành, chỉ áp vào phí agency; làm tròn VND. Không tự suy ra mức thuế pháp lý. Media là tiền thu hộ; chưa tích hợp chi tiêu thực tế từ Meta/Google hay xuất hóa đơn điện tử.
- Công nợ = phí + media + VAT phải thu trừ tiền đã thu riêng từng phần. Chặn thu quá số còn nợ. Ngân sách quảng cáo trong hợp đồng chưa phải tiền đã chi nền tảng.
- Phiếu thu không được xóa gián tiếp bằng xóa Order. Chưa hỗ trợ hoàn tiền/điều chỉnh phiếu thu đã ghi; cần đối soát trước khi ghi. Không tự thay đổi khách hàng/nhân viên của deal đã có giao dịch/hợp đồng.

## Dữ liệu cũ

Migration chỉ thêm bảng/cột, không xóa hay tạo doanh số từ deal thắng. Trong Doanh số, chọn deal khớp khách hàng + nhân viên rồi bấm Liên kết để gắn giao dịch cũ mà không tăng doanh thu. Hãy đối chiếu hết giao dịch cũ trước khi mở hợp đồng; kỳ mới phải bắt đầu sau giao dịch cũ đã liên kết. Giao dịch cũ chưa liên kết vẫn giữ giá trị cũ; không tự suy đoán phần VAT/media của lịch sử.

## Triển khai

1. Sao lưu PostgreSQL và giữ image đang chạy để rollback.
2. Build: `docker build -t b2b-crm:release` với bốn build args `NEXT_PUBLIC_FIREBASE_*` như bản cũ.
3. Chạy `npx prisma migrate deploy` bằng env/database production, sau đó chạy image mới. Không chạy seed trên production.
4. Giữ nguyên `.env`, Firebase Admin key và volume PostgreSQL. Không đưa các tệp này vào Git/source archive.
5. Migration bổ sung tương thích image cũ: có thể rollback image mà không xóa bảng mới; giữ phiếu thu để đối soát trước khi ghi thêm giao dịch bằng bản cũ.

## Kiểm thử

`npm run lint` và `npx tsc --noEmit`.

Tạo PostgreSQL riêng có tên chứa `_test`, áp migrations rồi chạy:

```sh
DATABASE_URL=postgresql://USER@localhost:5432/crm_test DIRECT_URL=postgresql://USER@localhost:5432/crm_test node --import tsx tests/crm-integration.cjs
```

Test dùng PostgreSQL thật, action và DAL thật. Chỉ mô phỏng cookie request, revalidate và redirect của Next khi chạy ngoài web server; không giả mạo Google/Firebase đăng nhập. Tạo hai User SALES/Employee tạm, kiểm đọc/ghi/xóa chéo và kiểm idempotency đồng thời; dọn dữ liệu do test tạo trong finally. Không chạy trên production. Đăng nhập OAuth thật của hai nhân viên vẫn cần chủ tài khoản Google tương ứng thực hiện.

## KPI cho dịch vụ chưa đặt chỉ tiêu

Trang KPI lấy hợp của nhóm có chỉ tiêu và nhóm có doanh số thực thu. Nhóm chưa có KpiTarget vẫn được tính đủ trong doanh số tổng/biểu đồ, có cảnh báo và không hiển thị tỷ lệ phần trăm riêng cho nhóm đó. Không tự thêm chỉ tiêu 0 vào DB; chỉ tiêu 0 đặt chủ động được phân biệt với chưa đặt. Dữ liệu lịch sử chưa gán nhân viên/dịch vụ vẫn hiển thị để đối soát. Thêm hoặc xóa chỉ tiêu không thay đổi doanh thu đã thu. Mục tiêu tổng bằng 0 được hiển thị “Chưa có chỉ tiêu”, không chia cho 0. Phạm vi SALES áp dụng trước khi tổng hợp.

Kiểm thử hồi quy: `node --import tsx --test tests/kpi.test.cjs` cùng bộ tích hợp PostgreSQL. Thay đổi này không cần migration và không sửa mục tiêu/dữ liệu thu tiền hiện có.

## Sửa/xóa khách hàng an toàn

- Biểu mẫu khách hàng gửi `updatedAt` để kiểm tra phiên bản. Biểu mẫu cũ hoặc hai lần lưu cùng phiên bản không được ghi đè lẫn nhau; tải lại hồ sơ trước khi sửa tiếp.
- Mã/tên rỗng, ngày sinh không hợp lệ và mã trùng được báo lỗi ngay trong biểu mẫu. Nội dung nhập được giữ khi bị từ chối; trường tùy chọn để trống sẽ được xóa đúng (null).
- Không chuyển người phụ trách của khách hàng có dữ liệu liên quan vì chưa có nghiệp vụ chuyển đồng bộ toàn bộ hồ sơ.
- Xóa cần `deleteRecords`, quyền sửa hồ sơ và xác nhận đúng mã khách hàng. Chỉ xóa hồ sơ hoàn toàn trống; Contact, deal, doanh số, công việc, lịch sử, tài liệu hoặc lead chuyển đổi đều chặn xóa. Không xóa dây chuyền lịch sử hoặc làm rơi liên kết doanh thu. Contact đang được deal dùng cũng bị chặn xóa.
- SALES thiếu quyền xóa không thấy nút xóa. Các điều kiện tiếp tục được kiểm tra tại backend, trong transaction có khóa hồ sơ.
- Test bổ sung: `node --import tsx tests/customer-edge.cjs` với `DATABASE_URL` và `DIRECT_URL` trỏ tới database `_test`. Bộ test tạo/dọn dữ liệu riêng; không chạy trên production.
