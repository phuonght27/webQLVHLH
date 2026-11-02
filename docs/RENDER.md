# Đưa website lên Render và tự cập nhật từ GitHub

Cấu hình này dùng **Web Service Starter và persistent disk 1 GB có phí**.
Xem giá Render hiển thị trước khi xác nhận tạo dịch vụ. Việc thêm các file
vào GitHub không tạo dịch vụ hay phát sinh phí Render.

## Tạo dịch vụ

1. Đăng nhập https://dashboard.render.com/ bằng tài khoản của bạn.
2. Chọn **New → Blueprint**, kết nối GitHub và cấp quyền cho repo
   `phuonght27/webQLVHLH`.
3. Chọn repo, nhánh `main`. Render đọc `render.yaml`.
4. Kiểm tra gói dịch vụ, ổ đĩa và chi phí; sau đó chọn **Deploy Blueprint**.
5. Đợi deployment chuyển sang **Live**, mở URL HTTPS do Render cấp.
   Đây mới là link website để gửi cho mọi người, không phải link repo GitHub.

Không cần nhập khóa bí mật vào GitHub: Blueprint sinh `DJANGO_SECRET_KEY`.
Hostname Render được tự nhận diện; nếu thêm tên miền riêng, đặt
`DJANGO_ALLOWED_HOSTS` thành tên miền đó (không có https://), phân cách bằng dấu phẩy.
Frontend và API dùng cùng tên miền. Gunicorn chạy Django; WhiteNoise phục vụ assets.

## Khởi tạo tài khoản và dữ liệu

Database mới ban đầu trống. Sau khi dịch vụ Live, mở **Shell** của dịch vụ:
```bash
python manage.py seed_demo
cat /var/data/academy/demo-credentials.txt
```
Dùng tài khoản `quanly@example.com` và mật khẩu vừa tạo; đổi mật khẩu lần đầu.
Chỉ chủ dịch vụ đọc file mật khẩu trong Shell; không đưa file hoặc nội dung
vào GitHub, chat, log build hay chia sẻ công khai. Seed chỉ chạy khi bạn chủ động
gọi lệnh; không tự chèn dữ liệu mẫu mỗi lần deploy.

Đây là database mới, không tự sao chép dữ liệu từ Codespaces hay file SQLite cũ.
Nếu cần giữ dữ liệu đang có, backup và chuyển cả database học tập cùng uploads
theo quy trình riêng trước khi sử dụng.

## Tự cập nhật

Cấu hình `autoDeployTrigger: commit` bật triển khai sau mỗi commit vào `main`.
Sửa file trên GitHub rồi **Commit changes** vào `main`, hoặc merge pull request
vào `main`. Render tự build React, thu thập static, chạy migration rồi khởi động
phiên bản mới. Xem tiến trình ở **Events/Logs**; sửa ở nhánh khác chưa cập nhật web.
Nếu dịch vụ được tạo thủ công thay vì Blueprint, vào **Settings → Build & Deploy**
và chọn nhánh `main`, **Auto-Deploy → On Commit**.

Database, uploads và file email nằm ở persistent disk `/var/data/academy`,
được giữ qua redeploy/restart của cùng dịch vụ. Không đổi sang Free rồi bỏ disk:
filesystem tạm có thể mất dữ liệu. Không xóa disk. Sao lưu dữ liệu trước thay đổi
migration; disk không thay thế backup. Cấu hình SQLite này dành cho một instance;
khi cần nhiều instance/nhiều lượt ghi đồng thời, chuyển sang PostgreSQL và
object storage. Dịch vụ có disk có thể gián đoạn ngắn khi deploy.

## Email và kiểm tra sau triển khai

Mặc định OTP chỉ được ghi vào file riêng `/var/data/academy/mail`, chưa gửi email.
Để người dùng nhận OTP, cấu hình SMTP trong **Environment** theo
`docs/DEPLOYMENT.md` và kiểm tra gửi/nhận thực. Không commit mật khẩu SMTP.

Sau khi deploy: kiểm tra trang đăng nhập, đăng nhập/đổi mật khẩu, tải JS/CSS,
tạo dữ liệu và upload/download; redeploy thử và xác nhận dữ liệu vẫn còn.
Chưa có tài khoản/kết nối Render trong phiên chuẩn bị này, nên chưa có public
URL hay kết quả kiểm thử trên Render.
