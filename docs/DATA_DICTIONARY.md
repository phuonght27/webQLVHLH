# Từ điển dữ liệu thực tế

Sinh từ Django models; nguồn chuẩn chi tiết: academy/models.py và migrations. CharField lưu Unicode; điểm dùng Decimal, không dùng float. Thời gian dùng timezone Asia/Ho_Chi_Minh khi hiển thị, UTC trong lưu trữ Django.

## Counter — BO_DEM_MA

Bảng SQL: `academy_counter`

| Trường | Kiểu Django / giới hạn | NULL | Khóa |
|---|---|---|---|
| id | BigAutoField | False | PK |
| prefix | CharField (30) | False | UNIQUE |
| value | PositiveIntegerField | False |  |

## Account — TAI_KHOAN

Bảng SQL: `academy_account`

| Trường | Kiểu Django / giới hạn | NULL | Khóa |
|---|---|---|---|
| id | BigAutoField | False | PK |
| password | CharField (128) | False |  |
| last_login | DateTimeField | True |  |
| is_superuser | BooleanField | False |  |
| username | CharField (150) | False | UNIQUE |
| first_name | CharField (150) | False |  |
| last_name | CharField (150) | False |  |
| is_staff | BooleanField | False |  |
| is_active | BooleanField | False |  |
| date_joined | DateTimeField | False |  |
| email | CharField (100) | False | UNIQUE |
| full_name | CharField (255) | False |  |
| role | CharField (4) | False |  |
| gender | CharField (3) | False |  |
| phone | CharField (10) | False |  |
| address | CharField (255) | False |  |
| must_change_password | BooleanField | False |  |
| created_by | ForeignKey | True | FK → Account |

## Course — KHOA_HOC

Bảng SQL: `academy_course`

| Trường | Kiểu Django / giới hạn | NULL | Khóa |
|---|---|---|---|
| id | BigAutoField | False | PK |
| created_at | DateTimeField | False |  |
| updated_at | DateTimeField | False |  |
| archived_at | DateTimeField | True |  |
| deleted_at | DateTimeField | True |  |
| name | CharField (255) | False | UNIQUE |
| symbol | CharField (20) | False | UNIQUE |
| description | CharField (1500) | False |  |

## Shift — CA_HOC

Bảng SQL: `academy_shift`

| Trường | Kiểu Django / giới hạn | NULL | Khóa |
|---|---|---|---|
| id | BigAutoField | False | PK |
| created_at | DateTimeField | False |  |
| updated_at | DateTimeField | False |  |
| archived_at | DateTimeField | True |  |
| deleted_at | DateTimeField | True |  |
| name | CharField (10) | False | UNIQUE |
| start | TimeField | False |  |
| end | TimeField | False |  |

## Room — PHONG_HOC

Bảng SQL: `academy_room`

| Trường | Kiểu Django / giới hạn | NULL | Khóa |
|---|---|---|---|
| id | BigAutoField | False | PK |
| name | CharField (50) | False | UNIQUE |

## Classroom — LOP_HOC

Bảng SQL: `academy_classroom`

| Trường | Kiểu Django / giới hạn | NULL | Khóa |
|---|---|---|---|
| id | BigAutoField | False | PK |
| created_at | DateTimeField | False |  |
| updated_at | DateTimeField | False |  |
| archived_at | DateTimeField | True |  |
| deleted_at | DateTimeField | True |  |
| code | CharField (30) | False | UNIQUE |
| course | ForeignKey | False | FK → Course |
| manager | ForeignKey | False | FK → Account |
| teacher | ForeignKey | False | FK → Account |
| start_date | DateField | False |  |
| end_date | DateField | False |  |

## Enrollment — THAM_GIA_LOP

Bảng SQL: `academy_enrollment`

| Trường | Kiểu Django / giới hạn | NULL | Khóa |
|---|---|---|---|
| id | BigAutoField | False | PK |
| created_at | DateTimeField | False |  |
| updated_at | DateTimeField | False |  |
| archived_at | DateTimeField | True |  |
| deleted_at | DateTimeField | True |  |
| classroom | ForeignKey | False | FK → Classroom |
| student | ForeignKey | False | FK → Account |
| left_at | DateTimeField | True |  |

## Schedule — LICH_HOC

Bảng SQL: `academy_schedule`

| Trường | Kiểu Django / giới hạn | NULL | Khóa |
|---|---|---|---|
| id | BigAutoField | False | PK |
| created_at | DateTimeField | False |  |
| updated_at | DateTimeField | False |  |
| archived_at | DateTimeField | True |  |
| deleted_at | DateTimeField | True |  |
| classroom | ForeignKey | False | FK → Classroom |
| shift | ForeignKey | False | FK → Shift |
| room | ForeignKey | False | FK → Room |

## ScheduleDay — LICH_HOC_THU

Bảng SQL: `academy_scheduleday`

| Trường | Kiểu Django / giới hạn | NULL | Khóa |
|---|---|---|---|
| id | BigAutoField | False | PK |
| schedule | ForeignKey | False | FK → Schedule |
| weekday | PositiveSmallIntegerField | False |  |

## Session — BUOI_HOC

Bảng SQL: `academy_session`

| Trường | Kiểu Django / giới hạn | NULL | Khóa |
|---|---|---|---|
| id | BigAutoField | False | PK |
| schedule | ForeignKey | False | FK → Schedule |
| classroom | ForeignKey | False | FK → Classroom |
| number | PositiveIntegerField | False |  |
| date | DateField | False |  |
| shift | ForeignKey | False | FK → Shift |
| room | ForeignKey | False | FK → Room |
| cancelled | BooleanField | False |  |

## Assignment — BAI_TAP

Bảng SQL: `academy_assignment`

| Trường | Kiểu Django / giới hạn | NULL | Khóa |
|---|---|---|---|
| id | BigAutoField | False | PK |
| created_at | DateTimeField | False |  |
| updated_at | DateTimeField | False |  |
| archived_at | DateTimeField | True |  |
| deleted_at | DateTimeField | True |  |
| title | CharField (255) | False |  |
| description | TextField | False |  |
| teacher | ForeignKey | False | FK → Account |
| edited | BooleanField | False |  |

## Allocation — GIAO_BAI_TAP

Bảng SQL: `academy_allocation`

| Trường | Kiểu Django / giới hạn | NULL | Khóa |
|---|---|---|---|
| id | BigAutoField | False | PK |
| created_at | DateTimeField | False |  |
| updated_at | DateTimeField | False |  |
| archived_at | DateTimeField | True |  |
| deleted_at | DateTimeField | True |  |
| assignment | ForeignKey | False | FK → Assignment |
| classroom | ForeignKey | False | FK → Classroom |
| session | ForeignKey | False | FK → Session |
| deadline | DateTimeField | False |  |

## Submission — BAI_NOP

Bảng SQL: `academy_submission`

| Trường | Kiểu Django / giới hạn | NULL | Khóa |
|---|---|---|---|
| id | BigAutoField | False | PK |
| created_at | DateTimeField | False |  |
| updated_at | DateTimeField | False |  |
| archived_at | DateTimeField | True |  |
| deleted_at | DateTimeField | True |  |
| allocation | ForeignKey | False | FK → Allocation |
| enrollment | ForeignKey | False | FK → Enrollment |
| content | TextField | False |  |
| submitted_at | DateTimeField | True |  |
| invalid | BooleanField | False |  |

## Attachment — TAI_LIEU_BAI_TAP / FILE_BAI_NOP

Bảng SQL: `academy_attachment`

| Trường | Kiểu Django / giới hạn | NULL | Khóa |
|---|---|---|---|
| id | BigAutoField | False | PK |
| assignment | ForeignKey | True | FK → Assignment |
| submission | ForeignKey | True | FK → Submission |
| file | FileField (100) | False |  |
| original_name | CharField (255) | False |  |
| size | PositiveBigIntegerField | False |  |

## Comment — NHAN_XET_BAI_NOP

Bảng SQL: `academy_comment`

| Trường | Kiểu Django / giới hạn | NULL | Khóa |
|---|---|---|---|
| id | BigAutoField | False | PK |
| created_at | DateTimeField | False |  |
| updated_at | DateTimeField | False |  |
| archived_at | DateTimeField | True |  |
| deleted_at | DateTimeField | True |  |
| submission | ForeignKey | False | FK → Submission |
| author | ForeignKey | False | FK → Account |
| content | CharField (3000) | False |  |

## SubmissionException — CAP_NHAT_BAI_NOP

Bảng SQL: `academy_submissionexception`

| Trường | Kiểu Django / giới hạn | NULL | Khóa |
|---|---|---|---|
| id | BigAutoField | False | PK |
| created_at | DateTimeField | False |  |
| updated_at | DateTimeField | False |  |
| archived_at | DateTimeField | True |  |
| deleted_at | DateTimeField | True |  |
| submission | ForeignKey | False | FK → Submission |
| author | ForeignKey | False | FK → Account |
| reason | CharField (500) | False |  |
| previous | CharField (50) | False |  |
| next_status | CharField (30) | False |  |

## ExamType — LOAI_BAI_KIEM_TRA

Bảng SQL: `academy_examtype`

| Trường | Kiểu Django / giới hạn | NULL | Khóa |
|---|---|---|---|
| id | BigAutoField | False | PK |
| name | CharField (50) | False | UNIQUE |

## Grade — DIEM

Bảng SQL: `academy_grade`

| Trường | Kiểu Django / giới hạn | NULL | Khóa |
|---|---|---|---|
| id | BigAutoField | False | PK |
| created_at | DateTimeField | False |  |
| updated_at | DateTimeField | False |  |
| archived_at | DateTimeField | True |  |
| deleted_at | DateTimeField | True |  |
| enrollment | ForeignKey | False | FK → Enrollment |
| exam_type | ForeignKey | False | FK → ExamType |
| listening | DecimalField (3,1) | False |  |
| reading | DecimalField (3,1) | False |  |
| speaking | DecimalField (3,1) | False |  |
| writing | DecimalField (3,1) | False |  |
| exam_date | DateField | False |  |
| note | CharField (500) | False |  |

## GradeHistory — LICH_SU_DIEM

Bảng SQL: `academy_gradehistory`

| Trường | Kiểu Django / giới hạn | NULL | Khóa |
|---|---|---|---|
| id | BigAutoField | False | PK |
| grade | ForeignKey | False | FK → Grade |
| author | ForeignKey | False | FK → Account |
| before | JSONField | False |  |
| after | JSONField | False |  |
| created_at | DateTimeField | False |  |

## RetakeCriterion — TIEU_CHI_HOC_LAI

Bảng SQL: `academy_retakecriterion`

| Trường | Kiểu Django / giới hạn | NULL | Khóa |
|---|---|---|---|
| id | BigAutoField | False | PK |
| name | CharField (255) | False |  |
| min_score | DecimalField (3,1) | False |  |
| min_submission_rate | DecimalField (5,2) | False |  |

## RetakeRequest — YEU_CAU_HOC_LAI

Bảng SQL: `academy_retakerequest`

| Trường | Kiểu Django / giới hạn | NULL | Khóa |
|---|---|---|---|
| id | BigAutoField | False | PK |
| created_at | DateTimeField | False |  |
| updated_at | DateTimeField | False |  |
| archived_at | DateTimeField | True |  |
| deleted_at | DateTimeField | True |  |
| enrollment | ForeignKey | False | FK → Enrollment |
| reason | CharField (500) | False |  |
| status | CharField (20) | False |  |
| reviewer | ForeignKey | True | FK → Account |
| review_note | CharField (500) | False |  |
| reviewed_at | DateTimeField | True |  |

## RetakeEvaluation — CHI_TIET_XET_HOC_LAI

Bảng SQL: `academy_retakeevaluation`

| Trường | Kiểu Django / giới hạn | NULL | Khóa |
|---|---|---|---|
| id | BigAutoField | False | PK |
| request | ForeignKey | False | FK → RetakeRequest |
| criterion | ForeignKey | False | FK → RetakeCriterion |
| score_snapshot | DecimalField (3,1) | True |  |
| submission_rate | DecimalField (5,2) | False |  |
| passed | BooleanField | False |  |

## Audit — NHAT_KY_HOAT_DONG

Bảng SQL: `academy_audit`

| Trường | Kiểu Django / giới hạn | NULL | Khóa |
|---|---|---|---|
| id | BigAutoField | False | PK |
| actor | ForeignKey | True | FK → Account |
| action | CharField (80) | False |  |
| entity | CharField (80) | False |  |
| object_id | BigIntegerField | True |  |
| detail | JSONField | False |  |
| created_at | DateTimeField | False |  |

## LoginSession — PHIEN_DANG_NHAP

Bảng SQL: `academy_loginsession`

| Trường | Kiểu Django / giới hạn | NULL | Khóa |
|---|---|---|---|
| id | BigAutoField | False | PK |
| user | ForeignKey | False | FK → Account |
| session_hash | CharField (64) | False |  |
| logged_in | DateTimeField | False |  |
| logged_out | DateTimeField | True |  |

## OTP — OTP_XAC_THUC

Bảng SQL: `academy_otp`

| Trường | Kiểu Django / giới hạn | NULL | Khóa |
|---|---|---|---|
| id | BigAutoField | False | PK |
| user | ForeignKey | False | FK → Account |
| digest | CharField (255) | False |  |
| expires | DateTimeField | False |  |
| used | BooleanField | False |  |
| attempts | PositiveSmallIntegerField | False |  |

## AuthThrottle — AuthThrottle

Bảng SQL: `academy_auththrottle`

| Trường | Kiểu Django / giới hạn | NULL | Khóa |
|---|---|---|---|
| id | BigAutoField | False | PK |
| key | CharField (64) | False | UNIQUE |
| attempts | PositiveSmallIntegerField | False |  |
| window_start | DateTimeField | False |  |
