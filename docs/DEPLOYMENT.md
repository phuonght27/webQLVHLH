# Triển khai và cấu hình

## Phát triển đã kiểm thử

Python 3.12, Django 5.2.18, Node 24, React 19.1.1 và Vite 6.4.5. `requirements.txt` ghim các gói Python và dependency đã cài; `frontend/package-lock.json` khóa cây npm. `scripts/setup.sh` cài dependency, build React, migrate CSDL mới và chạy Django check. Dữ liệu/khóa/email/upload đặt trong `var/` đã gitignore. Không thay đổi file SQLite cũ.

## PostgreSQL (chưa chạy kiểm thử tích hợp trong phiên này)

Cấp một PostgreSQL database riêng và user chỉ có quyền cần thiết; export `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT` qua cấu hình bí mật của môi trường. Settings tự chọn PostgreSQL khi có `POSTGRES_DB`. Sau đó chạy `manage.py migrate` và `manage.py test academy`. Test cần quyền tạo test database hoặc database test được chuẩn bị sẵn. Không chuyển SQLite bằng cách đổi đuôi file; dùng quy trình export/import được kiểm tra riêng nếu cần giữ dữ liệu.

## Email

Mặc định Django filebased backend ghi thư OTP vào `var/mail/` — chỉ đọc cục bộ cho phát triển. Để gửi thực: đặt `EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL`; TLS đang bật. Không nhập mật khẩu SMTP vào Git hoặc chat. Cần kiểm thử gửi/nhận OTP thực với nhà cung cấp trước nghiệm thu. Phiên này không yêu cầu/cấp bí mật SMTP và không gửi thư ra ngoài.

## Production

1. Build React bằng `npm ci --prefix frontend && npm run build --prefix frontend`.
2. Cấu hình `DJANGO_DEBUG=0`, `DJANGO_SECRET_KEY` ngẫu nhiên và `DJANGO_ALLOWED_HOSTS` đúng domain. `.env.example` là tài liệu mẫu; ứng dụng không tự đọc `.env`.
3. Chạy Django bằng WSGI server hỗ trợ production (cần bổ sung và ghim server trong quy trình triển khai thực). Cấu hình Nginx phục vụ `frontend/dist` và proxy `/api/` tới WSGI. Cho frontend/API cùng origin. TLS kết thúc tại reverse proxy; cấu hình chuyển HTTP sang HTTPS ở proxy. Cookie session/CSRF secure khi DEBUG=0.
4. Không phục vụ `var/` hay uploads qua alias public. Download chỉ qua API kiểm tra quyền. Chỉ cho phép Django đọc/ghi thư mục upload riêng; thêm quét malware khi dùng thực tế.
5. Backup database và upload cùng bộ dữ liệu; kiểm thử restore, concurrent transactions/sinh mã, tải lớn, mail, log retention và chốt AC còn mâu thuẫn.

Chưa cung cấp public URL, chưa publish hay triển khai website lên Internet. Các lệnh hiện tại chỉ khởi động development server. Cấu hình cloud draft đã publish trước đó không bị ghi đè bởi tác vụ phát triển website này; dùng script trong repository cho source mới.
