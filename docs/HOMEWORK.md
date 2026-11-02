# Luồng giao bài, nộp file và nhận xét

## Giáo viên

Vào **Quản lý bài tập → Tạo bài tập mới**. Nhập tiêu đề, mô tả, chọn tệp đề
bài và tích một hoặc nhiều lớp đang diễn ra mà giáo viên phụ trách. Mỗi lớp
có buổi học đã/đang diễn ra và hạn nộp riêng ở tương lai. Kiểm tra màn hình
xác nhận rồi giao bài. Hủy màn hình xác nhận giữ lại nội dung đã nhập.

Một Assignment dùng chung cho nhiều Allocation; không nhân bản đề bài theo lớp.
Tạo đề, phân phối lớp và lưu thông tin tệp trong một giao dịch. Nếu có lỗi ở
bất kỳ lớp hay tệp nào, không tạo một phần bài tập. File đã lưu trong lần tạo
thất bại được dọn khỏi storage.

Tại bài tập, chọn **Chi tiết / Bài nộp** của lớp để xem danh sách học viên,
trạng thái và thời gian nộp. Chọn **Xem bài / Nhận xét** để tải file bài làm,
thêm, sửa hoặc xóa nhận xét. Không cần chọn mã bài nộp từ bảng nhận xét riêng.
Giáo viên không nhận được file nháp trước khi học viên xác nhận nộp.

## Học viên

Vào **Bài tập được giao → Xem bài tập** để xem nội dung đề, tài liệu,
lớp, buổi và hạn nộp. Trong **Bài nộp của bạn**, thêm một hoặc nhiều file.
Các file tải thành công được giữ dạng nháp và có thể xóa trước khi nộp.
Nút **Nộp bài** chỉ bật khi có file; xác nhận nộp ghi nhận thời gian nộp.
Hủy hộp thoại xác nhận giữ nguyên file nháp.

Sau khi nộp, không thêm/xóa file. Có thể hủy nộp trước hạn, sửa file rồi nộp
lại. Theo chính sách nộp muộn hiện có của hệ thống, bài gửi sau hạn được ghi
**Nộp muộn**; không cho hủy sau hạn. Học viên đã rời lớp được xem lại bài cũ
nhưng không nộp bài. Học viên chỉ đọc được bài và file trong phạm vi của mình.

Nhận xét nằm ngay dưới bài được giao trong danh sách và dưới bài nộp ở trang
chi tiết. Khi chưa có nhận xét, hiển thị **Chưa có nhận xét**. Trang tự tải lại
dữ liệu mỗi 30 giây khi đang hiển thị, hoặc cập nhật khi mở lại bài tập.

## File và kiểm thử

Nhận PDF, DOCX, PNG, JPEG, kiểm tra chữ ký định dạng phía server; tối đa 20 MB
mỗi file và 10 file một bài nộp. Chặn file trùng tên và dung lượng, tên chứa
ký tự không hợp lệ. Mô tả dùng văn bản nhiều dòng; chưa bổ sung trình soạn
thảo rich text. Chưa triển khai toàn bộ các AC khác của module như xem trước
nội dung Word/PDF trực tiếp trong popup.

Không thay đổi lược đồ database; bản ghi bài tập, bài nộp và nhận xét đã có
tiếp tục sử dụng. API mới nằm dưới `/api/homework/`, giữ CSRF/session và kiểm
tra quyền phía server. Các bảng giao bài, bài nộp và nhận xét riêng được thay
bằng luồng trong chi tiết bài tập trên menu.

Kiểm thử: `python manage.py test academy`,
`python manage.py makemigrations --check --dry-run`, `npm run build --prefix frontend`.
Kiểm thử trình duyệt dùng dữ liệu riêng: GV giao một đề cho hai lớp, đính kèm
đề, HV tải file nháp và xác nhận nộp, GV nhận xét, HV xem nhận xét trong danh
sách và chi tiết; kiểm tra độ rộng màn hình 390px và lỗi JavaScript.
