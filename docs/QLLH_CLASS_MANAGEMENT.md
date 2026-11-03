# Quản lý lớp học cho QLLH

Giao diện tham chiếu: các ảnh trong tài liệu người dùng cung cấp
`Kiểm tra 1 QLATTT.docx`. Phạm vi chính là vai trò QLLH. Theo xác nhận của
người dùng, QLLH chỉ xem/chọn khóa và ca; QLCN được bổ sung màn quản lý danh
mục khóa/ca. Các vai trò GV/HV và các màn khác của QLCN giữ lối truy cập cũ.

## Màn hình

- QLLH → Quản lý Lớp học: danh mục khóa, ca chỉ đọc; danh sách lớp, tạo/sửa
  lớp, chi tiết và thêm/xóa thành viên; danh sách lịch theo **từng buổi có ngày**.
- Màn lớp hiển thị đúng khóa, mã/tên GV, mã/tên QLLH, số học viên đang học,
  trạng thái tính từ ngày bắt đầu/kết thúc. Có tìm kiếm, lọc, phân trang, lưu trữ.
- Tạo lớp: chọn khóa, mã lớp tự sinh, QLLH tự gán theo người đăng nhập, chọn
  GV Active, ngày bắt đầu/kết thúc và học viên trong phạm vi quản lý.
- Sửa lớp: khóa/mã lớp/QLLH không được đổi. Lớp đã kết thúc chỉ được xem.
- Chi tiết lớp: hiển thị danh sách học viên thực; loại khỏi lớp là đánh dấu
  rời lớp, có xem lịch sử và có thể thêm lại mà không nhân bản membership.
- Tạo lịch: chọn lớp/ca/phòng/thứ trong tuần; ngày lớp tự lấy, buổi tự sinh.
  Khi sửa chỉ đổi phòng/thứ; mã lớp/ca không thay đổi. Buổi đã diễn ra chỉ đọc.
- QLLH đổi mật khẩu: mật khẩu hiện tại, mật khẩu mới, xác nhận, hiện/ẩn và
  quên mật khẩu qua OTP hiện có. Giữ chính sách tối thiểu 10 ký tự của hệ thống.
- QLCN: tạo khóa (tự sinh ký hiệu), sửa mô tả, tìm kiếm, xóa nếu chưa dùng hoặc
  ẩn/khôi phục; tạo ca với kiểm tra khoảng giờ và chồng lấn, lưu trữ ca đã dùng.

## Dữ liệu và phân quyền

API riêng `/api/class-management/` phục vụ màn mới. QLLH bị chặn ghi danh mục
khóa/ca kể cả gọi endpoint cũ. Quy tắc tạo/sửa lớp/lịch/thành viên QLLH cũng
được áp dụng cho endpoint cũ để không thể vượt kiểm tra bằng cách bỏ qua UI.
Endpoint riêng không mở quyền quản lý lớp cho GV/HV hoặc cấp quyền mới trên
màn hình lớp/lịch của QLCN. Danh mục khóa/ca vẫn là dữ liệu dùng chung.

Lớp chỉ thuộc QLLH đăng nhập. Học viên được chọn là HV Active do người đó tạo
hoặc đã thuộc các lớp của người đó; không đưa danh sách học viên của quản lý
khác vào bộ chọn. Giáo viên chỉ lấy GV Active; mã/tên hiển thị riêng đúng cột.

Tạo lớp và các membership trong một giao dịch, tự sinh mã bằng counter trong
giao dịch. Nếu lỗi học viên/ngày/GV, không lưu lớp hoặc tăng counter một phần.
Số thứ tự lấy theo từng khóa và các mã lớp thực đã có để không dùng lại mã
khi counter cũ bị lệch; không đánh lại mã của lớp hiện có.
Đổi ngày/GV của lớp đồng bộ lại lịch trong cùng giao dịch; trùng lịch sẽ rollback
cả thay đổi lớp. Không loại buổi đã diễn ra khỏi khoảng ngày lớp.

Kiểm tra trùng phòng/GV/lớp ở cùng ngày và khoảng giờ trên toàn hệ thống.
Sửa lịch chỉ cập nhật buổi chưa diễn ra, giữ ID buổi cũ, không xóa buổi liên kết
bài tập. Buổi tương lai chưa gắn dữ liệu học tập được đánh lại số theo ngày;
không đánh lại số buổi đã diễn ra hoặc khi có tham chiếu học tập tương lai.
Buổi loại khỏi lịch được đánh dấu hủy. Ẩn/khôi phục lớp/lịch không xóa học viên,
bài nộp hay điểm. Không seed/reset/ghi đè database của người dùng khi cập nhật.

Không đổi model và không có migration mới. Kiểm tra gồm test backend toàn bộ
vai trò, nghiệp vụ âm/dương, giao dịch/rollback, lịch trùng, lịch sử/ID buổi,
phân quyền endpoint cũ/mới và xác nhận mật khẩu QLLH. Kiểm tra trình duyệt trực
tiếp trên database thử riêng cho QLCN/QLLH: danh mục, tạo lớp và thành viên,
hủy xác nhận giữ form, xóa/thêm lại học viên, tạo/sửa lịch, form mật khẩu và mobile.
