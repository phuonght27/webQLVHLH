# Giao diện trạng thái nộp bài theo lớp và buổi học

Mở **Quản lý Lớp học → Trạng thái nộp bài** bằng tài khoản quản lý chi nhánh,
quản lý lớp học hoặc giáo viên. Màn hình lấy các lớp, buổi học và học viên trong
phạm vi quyền hiện có của API. Không mở rộng quyền xem dữ liệu hay ghi ngoại lệ.

Chọn lớp và buổi học để xem bốn ô thống kê, tìm theo mã/họ tên học viên,
lọc trạng thái, phân trang và đổi số dòng mỗi trang. Nếu một buổi có nhiều bài
tập, xuất hiện thêm ô chọn bài tập để mỗi danh sách chỉ tính một lần/học viên.
Tìm kiếm và lọc không làm thay đổi số thống kê của bài tập đang chọn.

API `/api/progress/` giữ trường `rows` và các giá trị trạng thái cũ, bổ sung
ID, mã/tên học viên, danh sách lớp/buổi/bài tập và thời điểm tải dữ liệu.
Trên giao diện, `Đã nộp` hiển thị là **Đúng hạn**, `Quá hạn` là **Thiếu bài**.
`Chưa nộp`, `Nộp muộn`, `Không hợp lệ` giữ nguyên. Không thêm trạng thái
`Chưa chấm` hoặc điều kiện nộp muộn một tháng vì hệ thống hiện chưa có logic đó.

Hệ thống chưa có trường lưu riêng lý do nộp muộn, nên cột này hiển thị `—`.
Cột lý do thay đổi trạng thái lấy lý do của ngoại lệ gần nhất còn hiệu lực.
Không dùng lý do thay đổi trạng thái làm lý do nộp muộn.

Nút cập nhật ngoại lệ xuất hiện với bài nộp muộn/không hợp lệ khi tài khoản
có quyền cập nhật ngoại lệ hiện có. Form cố định đúng bài nộp, lấy lựa chọn
trạng thái từ schema server, bắt buộc lý do và yêu cầu xác nhận trước khi lưu.
Sử dụng endpoint `/api/exceptions/` cũ. Không tạo bài nộp giả cho học viên chưa nộp.
Tài khoản chỉ có quyền xem không được cấp thêm quyền cập nhật từ giao diện.

Sửa lỗi form ngoại lệ cũ: trường audit `previous` không nằm trong form nhưng
bị kiểm tra rỗng trước khi server gán giá trị. Server nay gán trạng thái hiện
tại từ bài nộp trong phạm vi quyền trước khi xác thực form; không nhận giá trị
này từ client. Quy tắc chuyển trạng thái và ghi audit giữ nguyên.

Không đổi model hay tạo migration. Kiểm tra backend gồm phạm vi lớp/buổi,
thông tin học viên, trạng thái cũ, bài tập cùng buổi, lớp rỗng, bài nháp và
cập nhật ngoại lệ qua endpoint thật. Kiểm tra trình duyệt bằng dữ liệu giả
gồm bộ chọn, thống kê, lọc, phân trang, refresh/lỗi tải, form ngoại lệ và mobile.
