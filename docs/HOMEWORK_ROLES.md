# Bài tập và bài nộp theo vai trò

Đối chiếu các màn mẫu trong “Kiểm tra 1 QLATTT-2.docx”; các nút mẫu được tách theo quyền, không dùng chung bộ thao tác cho mọi tài khoản.

| Vai trò | Danh sách/chi tiết | Tạo, sửa, xóa, giao bài | Bài nộp và nhận xét | Trạng thái bài nộp |
| --- | --- | --- | --- | --- |
| QLCN | Giám sát bài tập trong phạm vi dữ liệu chi nhánh hiện có | Không | Xem bài đã nộp và nhận xét | Chỉ xem, lọc, tải lại |
| Giáo viên | Bài do mình tạo, giao cho lớp mình phụ trách | Có; lớp/buổi đã giao được giữ nguyên khi chỉnh sửa | Xem file đã nộp, viết nhận xét; chỉ sửa/xóa nhận xét của chính mình | Theo dõi bài mình giao; cập nhật lý do/minh chứng/bài nhận ngoài hệ thống trong lớp phụ trách |
| Học viên | Bài được giao cho lớp mình đang/đã học | Không | Tải file nháp, xác nhận nộp; xem bài và nhận xét của bản thân | Trạng thái cá nhân ngay trong danh sách |
| QLLH | Giữ màn theo dõi bài nộp tại mục Quản lý Bài tập | Không | Giữ nghiệp vụ ghi nhận bài nhận ngoài hệ thống của lớp phụ trách | Giữ phạm vi lớp phụ trách |

## Giao diện

QLCN và giáo viên có hai mục con trong **Quản lý Bài tập**: **Danh sách bài tập** và **Trạng thái bài nộp**. Mục trạng thái được chuyển khỏi Quản lý Lớp học. Học viên không có mục giám sát toàn lớp.

Danh sách dạng bảng, tìm kiếm, lọc lớp/trạng thái, phân trang. Nhãn “Đã chỉnh sửa” được lưu bền và hiển thị cho học viên. Màn chỉnh sửa giữ lớp/buổi, cập nhật tất cả hạn nộp và tệp trong một giao dịch; hạn nộp phải ở tương lai. Xóa bài là xóa mềm, giữ bản ghi bài nộp.

Mô tả hỗ trợ định dạng đơn giản: đậm, nghiêng, gạch chân, danh sách và xem trước. Nội dung được render bằng React, không chèn HTML tùy ý. PDF/ảnh được xem trong khung nội bộ sau khi kiểm tra quyền; DOCX tải xuống để mở xem. File nháp của học viên không xuất hiện cho nhân viên.

Lớp đã kết thúc: học viên xem lại, không nộp thêm. Giữ quy tắc nộp muộn và hủy nộp hiện có; không tự đổi trạng thái chỉ vì nhập lý do. Tệp minh chứng không trở thành bài làm. Việc ẩn từng buổi học và quyền danh mục khóa/ca không thay đổi.

## Máy chủ và kiểm tra

- `GET/POST/DELETE /api/homework/assignments/<id>/`: sửa/xóa bài của chính giáo viên; lưu multipart `payload`, tệp mới và danh sách tệp bỏ.
- `GET /api/files/<id>/preview/`: PDF/PNG/JPEG theo quyền truy cập file; DOCX trả 415, giao diện dùng tải xuống.
- API cũ cũng kiểm tra quyền QLCN chỉ xem, quyền sở hữu bài/nhận xét của giáo viên và giới hạn học viên.
- Không thêm migration. Chạy toàn bộ 105 kiểm thử Django và build Vite thành công. Kiểm tra Chromium: tạo/sửa, nhãn chỉnh sửa, menu bốn vai trò, form cập nhật, học viên nộp PDF, giáo viên mở xem và lưu nhận xét.

## Cập nhật Codespaces

Chạy từng dòng trong thư mục gốc repository:

```bash
git pull --ff-only origin main
pkill -f '[m]anage.py runserver.*8000'
.venv/bin/python manage.py migrate
npm run build --prefix frontend
bash .devcontainer/start.sh
```

Sau đó tải lại trang. Cần khởi động lại server sau build để HTML và tên file assets cùng phiên bản. Không đưa cơ sở dữ liệu, tài khoản thử hoặc file tải lên vào commit.
