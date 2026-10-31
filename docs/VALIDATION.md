# Kết quả kiểm tra trong môi trường phát triển

Ngày kiểm tra: 31/10/2026, múi giờ Asia/Ho_Chi_Minh.

- Django `check`: không có lỗi.
- `manage.py test academy`: 40 test đã chạy, 40 đạt, không skip.
- `makemigrations --check --dry-run`: không còn thay đổi model thiếu migration.
- `pip check`: không có dependency hỏng.
- `npm ci` + `npm run build`: thành công với React 19.1.1, Vite 6.4.5.
- `npm audit`: không phát hiện lỗ hổng tại thời điểm kiểm tra. Đã cập nhật Vite 6.3.6 lên 6.4.5 theo advisory trước khi hoàn tất.
- `scripts/setup.sh`: chạy thực từ thư mục repo, cài dependency, build, migrate và check thành công. Seed chạy lại giữ nguyên mật khẩu/dữ liệu.
- `scripts/start.sh`: khởi động development server thành công. Dịch vụ đã kiểm tra bằng trình duyệt thực và request API, không chỉ kiểm tra PID/cổng.
- Chromium/Playwright: đăng nhập, đổi mật khẩu lần đầu và điều hướng API cho QLCN/QLLH/GV/HV; CRUD khóa học từ React; popup giao nhiều lớp; xem trạng thái nộp bài; đăng xuất; viewport desktop 1440×1000 và mobile 390×844. Không có JavaScript pageerror trong các lượt kiểm tra thành công.
- `git diff --check`: đạt. File SQLite cũ không thay đổi.

## Nội dung kiểm thử backend

Xác thực và session; tài khoản Inactive; buộc đổi mật khẩu; CSRF; OTP reset/replay; quyền và phạm vi theo GV/HV; ngăn giả mạo enrollment; metadata/list API; tạo/sửa/lưu trữ/khôi phục khóa; chặn xóa dữ liệu đang dùng; kiểm tra điểm 0–10/bước 0.5/Overall/lịch sử; rollback nhập điểm/tài khoản hàng loạt; cấp tài khoản/mật khẩu hash; nộp/hủy/khóa hủy sau hạn; lịch trùng/rollback/giữ khóa buổi tham chiếu; xét học lại và snapshot; học viên chưa nộp vẫn hiện trạng thái; bộ lọc server; lớp lưu trữ chặn nộp; nhập lại điểm đã xóa mềm; kiểm tra chữ ký tệp và quyền tải; dữ liệu lớp chi tiết; giao cùng bài nhiều lớp bằng giao dịch; lịch không có bài tập có thể xóa và hủy buổi tương lai.

## Chưa kiểm tra

PostgreSQL thực, SMTP thực, tải đồng thời/lớn, đầy đủ mọi tổ hợp nghiệp vụ của tài liệu AC, khả năng truy cập với công cụ hỗ trợ, browser Safari/Firefox, backup/restore và triển khai production. Không suy diễn các mục này từ kết quả SQLite/Chromium.
