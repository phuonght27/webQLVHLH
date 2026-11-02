# Giao diện trạng thái nộp bài theo lớp và buổi học

Với vai trò **Quản lý lớp học**, mở **Quản lý Bài tập** để vào thẳng màn
hình theo dõi trạng thái nộp bài và form cập nhật. Không đặt màn hình này trong
menu Quản lý Lớp học của vai trò QLLH. Giáo viên và quản lý chi nhánh vẫn giữ
vị trí truy cập theo dõi hiện có; luồng Quản lý Bài tập của giáo viên/học viên
không thay đổi.

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

Nút **Cập nhật** mở popup **Cập nhật bài nộp của học viên** theo hàng đã chọn.
Thông tin học viên, lớp, buổi, deadline và trạng thái được đọc lại từ server,
không cho sửa trên form. Lý do bắt buộc, tối đa 500 ký tự; mỗi vùng minh chứng
và tệp bài làm cho phép chọn/kéo thả một file DOCX/PDF/PNG/JPEG tối đa 20 MB.
Nếu lưu thất bại, form giữ nguyên lý do và file đã chọn để thử lại.

Form dùng GET/POST `/api/progress/<allocation_id>/<enrollment_id>/update/`.
Quản lý lớp học được ghi nhận lý do, minh chứng và bài làm nhận thủ công
trong đúng lớp mình phụ trách. Giáo viên giữ quyền hiện có trong lớp được
phân công. Đây là quyền riêng của endpoint cập nhật bài nộp, không cấp thêm
quyền kiểm duyệt ngoại lệ, sửa điểm, giao bài hay nhận xét cho QLLH. Không cập nhật khi học viên
đã rời lớp, lớp/khóa lưu trữ hoặc buổi học bị hủy. API ngoại lệ kiểm duyệt cũ
vẫn giữ nguyên, nhưng popup này không có dropdown tự đổi trạng thái.

Chỉ lý do/minh chứng: lưu lịch sử, không tạo Submission giả, không đổi trạng
thái hay thời gian nộp. Khi có tệp bài làm: lưu Attachment vào đúng bài nộp,
chỉ tạo Submission nếu cần, ghi nhận thời gian nhận file thực; sau deadline
là Nộp muộn. Không tự gỡ cờ Không hợp lệ. Không xóa file bài làm đã có.
Nếu nhận file trước hạn, học viên vẫn có thể hủy và xóa file theo luồng cũ;
lịch sử cập nhật giữ tên/dung lượng file ngay cả khi file đã được xóa hợp lệ.

Model `SubmissionUpdate` lưu người thực hiện, lý do, trạng thái trước/sau,
minh chứng và liên kết tệp bài làm. Minh chứng nằm riêng tại
`VAR_DIR/submission-evidence`, ngoài MEDIA_ROOT; chỉ tải qua API kiểm tra quyền
của nhân sự thuộc phạm vi lớp. Cột lý do thay đổi trạng thái lấy bản ghi gần
nhất giữa lịch sử cập nhật và ngoại lệ cũ. Link Minh chứng hiển thị nếu bản
ghi mới nhất có minh chứng. Mọi thao tác có audit; khi lỗi giao dịch, file
vừa lưu được dọn để tránh lưu một phần.

**Cần chạy `python manage.py migrate` sau khi cập nhật code**, trước khi mở
màn hình. Migration 0004 chỉ tạo bảng lịch sử mới, không thay đổi hay xóa
bảng bài nộp, bài tập hoặc nhận xét cũ. Render start script đã chạy migrate;
Codespaces cần chạy migrate thủ công trước khi khởi động lại.

Sửa lỗi form ngoại lệ cũ: trường audit `previous` không nằm trong form nhưng
bị kiểm tra rỗng trước khi server gán giá trị. Server nay gán trạng thái hiện
tại từ bài nộp trong phạm vi quyền trước khi xác thực form; không nhận giá trị
này từ client. Quy tắc chuyển trạng thái và ghi audit giữ nguyên.

Kiểm tra backend gồm phạm vi lớp/buổi,
thông tin học viên, trạng thái cũ, bài tập cùng buổi, lớp rỗng, bài nháp và
cập nhật ngoại lệ qua endpoint thật. Kiểm tra trình duyệt bằng dữ liệu giả
gồm bộ chọn, thống kê, lọc, phân trang, refresh/lỗi tải, form ngoại lệ và mobile.

Kiểm tra popup mới: lý do/minh chứng không làm mất trạng thái thiếu bài,
tệp bài làm được ghi nhận nộp muộn, minh chứng tải đúng quyền, file sai/
quá lớn bị chặn, giao dịch lỗi dọn file, quyền nhân sự và luồng hủy nộp cũ.

Kiểm tra vị trí/phân quyền QLLH: mở Quản lý Bài tập trực tiếp thấy bảng trạng
thái và nút Cập nhật; quản lý lớp khác bị chặn GET/POST phía server. Kiểm tra
trình duyệt xác nhận form, tải file và lưu hoạt động cho QLLH, đồng thời GV
vẫn tạo/giao bài và HV vẫn xem bài tập được giao. Không sửa cấu hình
`can_write` hoặc các thay đổi người dùng đã thực hiện trong services.py.
