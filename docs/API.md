# Django JSON API

Mọi endpoint có dấu `/` cuối. React/Vite dùng proxy `/api`. Session cookie HttpOnly, CSRF token lấy từ `GET /api/auth/session/`, gửi header `X-CSRFToken` cho POST/PATCH/DELETE. Không sử dụng JWT trong localStorage. API kiểm tra quyền độc lập với nút hiển thị frontend.

## Xác thực

| Phương thức | URL | Dữ liệu |
|---|---|---|
| GET | `/api/auth/session/` | `{user, csrf}`, user null nếu chưa đăng nhập |
| POST | `/api/auth/login/` | `email, password, remember` |
| POST | `/api/auth/logout/` | `{}` |
| POST | `/api/auth/password/` | `old_password, password`; đổi xong đăng xuất |
| POST | `/api/auth/forgot/` | `email`; phản hồi không tiết lộ tài khoản có tồn tại |
| POST | `/api/auth/reset/` | `email, code, password`; OTP một lần |

## Tài nguyên

`kind`: `accounts`, `courses`, `shifts`, `classes`, `enrollments`, `schedules`, `assignments`, `allocations`, `submissions`, `comments`, `exceptions`, `grades`, `retakes`.

- `GET /api/{kind}/`: `{title, columns, rows, total, page, can_write, filters, status_options}`. Mỗi row có `{id, values, extra, archived}`.
- Tham số: `q` tìm trên cột hiển thị; `page` (10 dòng/trang); `archived=1`; `status`; `filter_{field}=id` cho các FK nằm trong danh sách cột.
- `GET /api/{kind}/{id}/`: thông tin chi tiết; bài tập/bài nộp thêm danh sách file, bài nộp thêm nhận xét.
- `GET /api/{kind}/?form=1` hoặc `/{id}/?form=1`: schema trường `{name,label,type,required,value,choices,maxLength}`. Choice value là ID dùng khi gửi API/CSV; danh sách đã giới hạn theo quyền.
- `POST /api/{kind}/`: tạo bằng JSON, tên trường theo schema. Mật khẩu tạm chỉ trả trong lần tạo tài khoản.
- `PATCH /api/{kind}/{id}/`: gửi đầy đủ các trường editable của biểu mẫu, không phải JSON Patch theo trường đơn lẻ.
- `PATCH /api/{kind}/{id}/` với `{_action:"archive"|"restore"}`: khóa/ca/lớp/lịch; tài khoản dùng `toggle`; enrollment dùng `leave`/`rejoin`.
- `DELETE /api/{kind}/{id}/`: xóa theo quy tắc nghiệp vụ; với bài nộp là hủy nộp trước hạn. Tài khoản không xóa, dùng Inactive.

`days` trong lịch học là mảng chuỗi thứ từ `"2"` đến `"8"` (8 = Chủ nhật). Khi tạo bài tập, tác giả tự lấy từ phiên đăng nhập. Khi tạo bài nộp, `enrollment` bắt buộc thuộc người đăng nhập và cùng lớp với `allocation`.

## Hàng loạt, tệp, thống kê

- `POST /api/bulk/accounts/`, `/api/bulk/grades/`, `/api/bulk/allocations/`: `{rows:[{...}, ...]}` tối đa 200 dòng, một giao dịch; dòng lỗi rollback toàn bộ.
- CSV tài khoản: `full_name,gender,phone,email,address,role`.
- CSV điểm: `enrollment,exam_type,listening,reading,speaking,writing,exam_date,note`.
- CSV giao bài: `assignment,classroom,session,deadline`. Một assignment có thể xuất hiện nhiều dòng với các lớp khác nhau; mỗi lớp chỉ giao một lần.
- Ngày nhập API/CSV: `YYYY-MM-DD`; datetime `YYYY-MM-DDTHH:mm:ss+07:00`. Nếu không có offset, Django hiểu theo Asia/Ho_Chi_Minh. Ngày hiển thị dùng DD/MM/YYYY.
- `POST /api/{assignments|submissions}/{id}/upload/`: multipart `file`, ≤20 MB.
- `GET /api/files/{id}/`: tải tệp dạng attachment sau khi kiểm tra quyền. Không public thư mục upload.
- `GET /api/overview/`: thống kê, điểm/nhận xét gần nhất, lịch sắp tới theo phạm vi quyền.
- `GET /api/progress/`: trạng thái từng HV/từng bài giao, bao gồm người chưa có bài nộp.
- `POST /api/retakes/{id}/review/`: `{status:"approved"|"rejected",note:"..."}`; quản lý thuộc phạm vi, chỉ duyệt một lần. Snapshot điểm/tỷ lệ nộp được lưu trong cùng giao dịch.

Lỗi 400 (dữ liệu/quy tắc), 401 (chưa đăng nhập), 403 (quyền/đổi mật khẩu lần đầu/CSRF), 404 (không tồn tại hoặc ngoài phạm vi), 409 (trùng/ràng buộc), 429 (giới hạn yêu cầu). Các trường bị bảo vệ như tác giả, role khi sửa, mã người dùng và mật khẩu hash không lấy từ payload.
