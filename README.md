# The Toeic Lab — Hệ thống quản lý học tập 3 tầng

Ứng dụng React + Django JSON API + CSDL quan hệ, triển khai từ ba tài liệu người dùng cung cấp. Giao diện tiếng Việt tham khảo thiết kế PDF trang 93–113: sidebar xanh đậm, header người dùng, bảng, tìm kiếm, trạng thái, popup và biểu mẫu.

## Chạy ngay trên GitHub Codespaces

1. Mở repository trên GitHub → **Code → Codespaces → Create codespace on main**.
2. Chờ cài đặt tự động hoàn tất (Python, Node, dependency, CSDL và dữ liệu demo).
3. Mở tab **Ports**, chọn **Open in Browser** ở cổng **8000**. Giữ chế độ **Private**.
4. Đăng nhập `quanly@example.com`. Mở file `var/demo-credentials.txt` trong Codespaces để lấy mật khẩu của Codespace này. Không commit file đó.

Nếu website chưa chạy, mở terminal Codespaces và chạy `bash .devcontainer/start.sh`. Nhật ký máy chủ ở `/tmp/webintern-server.log`. Sau khi sửa React, chạy `npm run build --prefix frontend` rồi tải lại trang. Sau khi sửa Python, dừng tiến trình `manage.py runserver` của dự án trong terminal/Processes, rồi chạy lại lệnh start. Mỗi Codespace có CSDL và mật khẩu riêng; không dùng mật khẩu từ môi trường cloud trước.

GitHub Codespaces chạy môi trường phát triển trên trình duyệt, không phải GitHub Pages và không phải bản triển khai production. Codespaces phụ thuộc quyền và hạn mức tài khoản GitHub. Cấu hình đã được thêm; việc tạo và chạy Codespace thực cần thực hiện trên tài khoản của bạn.

## Chạy tại môi trường này

```bash
cd /workspace/webintern
./scripts/setup.sh
/workspace/.venvs/webintern/bin/python manage.py seed_demo
./scripts/start.sh
```

Mở ứng dụng trên cổng 8000 bằng cơ chế truy cập của môi trường. `start.sh` mặc định chỉ bind loopback; đặt `BIND_ADDRESS=0.0.0.0:8000` khi cần truy cập từ bên ngoài qua proxy phù hợp. Không dùng Django runserver cho production.

Tài khoản mẫu: `quanly@example.com` (QLCN), `lop@example.com` (QLLH), `giaovien@example.com` (GV), `hocvien1@example.com` đến `hocvien5@example.com` (HV). Mật khẩu ngẫu nhiên được lưu tại **`var/demo-credentials.txt`**, quyền 0600, bị loại khỏi Git. Mỗi tài khoản phải đổi mật khẩu lần đầu. Một số tài khoản đã thực hiện đổi mật khẩu trong kiểm thử trình duyệt; file cục bộ được cập nhật tương ứng. Chạy lại seed không ghi đè dữ liệu/mật khẩu.

Dữ liệu mới: `var/academy.sqlite3`. File `db.sqlite3` cũ giữ nguyên vì chứa hệ thống bán hàng khác, không phải dữ liệu học tập. Khóa bí mật phát triển tạo cục bộ ở `var/secret.key`. Không đưa thư mục `var/` vào Git hoặc công khai qua web.

## Phát triển React riêng

```bash
# Terminal 1
/workspace/.venvs/webintern/bin/python manage.py runserver 127.0.0.1:8000
# Terminal 2
cd frontend
npm run dev
```

Vite proxy `/api` tới Django, giữ cùng origin trên trình duyệt; session cookie + CSRF bảo vệ mọi thao tác ghi. Production build ở `frontend/dist`, Django phục vụ build trong chế độ phát triển. Dùng checkout hiện tại; không cần tạo Git worktree.

## Kiểm thử

```bash
/workspace/.venvs/webintern/bin/python manage.py test academy
/workspace/.venvs/webintern/bin/python manage.py makemigrations --check --dry-run
npm run build --prefix frontend
```

Kiểm thử dùng CSDL riêng, không thay đổi dữ liệu demo. Xem [thiết kế và phạm vi](docs/IMPLEMENTATION.md), [API](docs/API.md), [từ điển dữ liệu](docs/DATA_DICTIONARY.md) và [triển khai](docs/DEPLOYMENT.md).

Đây là bản phát triển chạy được. Chưa kiểm thử PostgreSQL/SMTP thực, chưa triển khai Internet và chưa nghiệm thu toàn bộ AC trong tài liệu. Các khác biệt và phần cần hoàn thiện được ghi rõ trong tài liệu phạm vi.
