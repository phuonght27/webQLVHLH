from decimal import Decimal, ROUND_HALF_UP
from django.db import models, transaction
from django.db.models import Q
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator, RegexValidator
from django.utils import timezone


class Counter(models.Model):
    prefix = models.CharField(max_length=30, unique=True)
    value = models.PositiveIntegerField(default=0)


def next_code(prefix):
    with transaction.atomic():
        c, _ = Counter.objects.select_for_update().get_or_create(prefix=prefix)
        c.value += 1
        c.save()
        return f"{prefix}{c.value:03d}"


class Account(AbstractUser):
    ROLE = [
        ("QLCN", "Quản lý chi nhánh"),
        ("QLLH", "Quản lý lớp học"),
        ("GV", "Giáo viên"),
        ("HV", "Học viên"),
    ]
    email = models.EmailField("Email", max_length=100, unique=True)
    full_name = models.CharField("Họ và tên", max_length=255)
    role = models.CharField("Vai trò", max_length=4, choices=ROLE, default="HV")
    gender = models.CharField(
        "Giới tính", max_length=3, choices=[("Nam", "Nam"), ("Nữ", "Nữ")]
    )
    phone = models.CharField(
        "Số điện thoại",
        max_length=10,
        validators=[RegexValidator(r"^0\d{9}$", "SĐT phải gồm 10 số, bắt đầu bằng 0.")],
    )
    address = models.CharField("Địa chỉ", max_length=255)
    must_change_password = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="created_accounts",
    )
    avatar = models.ImageField(
    "Ảnh đại diện",
    upload_to="avatars/",
    blank=True,
    null=True
    )
    def clean(self):
        super().clean()
        self.email = self.email.lower().strip()
        self.full_name = " ".join(self.full_name.split()).title()
        if not self.full_name or any(
            not (c.isalpha() or c.isspace()) for c in self.full_name
        ):
            raise ValidationError({"full_name": "Họ tên chỉ gồm chữ và khoảng trắng."})

    def save(self, *a, **kw):
        if not self.username:
            self.username = next_code(self.role)
        super().save(*a, **kw)

    def __str__(self):
        return f"{self.username} · {self.full_name}"


class Record(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    archived_at = models.DateTimeField(null=True, blank=True, editable=False)
    deleted_at = models.DateTimeField(null=True, blank=True, editable=False)

    class Meta:
        abstract = True

    def clean(self):
        for f in self._meta.fields:
            value = getattr(self, f.name) if isinstance(f, models.CharField) else None
            if (
                isinstance(f, models.CharField)
                and not f.blank
                and isinstance(value, str)
                and not value.strip()
            ):
                raise ValidationError({f.name: "Không được để trống."})


class Course(Record):
    name = models.CharField("Tên khóa học", max_length=255, unique=True)
    symbol = models.CharField(
        "Ký hiệu",
        max_length=20,
        unique=True,
        validators=[RegexValidator(r"^[A-Z0-9]+$")],
    )
    description = models.CharField("Mô tả", max_length=1500)

    def __str__(self):
        return self.name

    def clean(self):
        super().clean()
        if Course.objects.filter(name__iexact=self.name).exclude(pk=self.pk).exists():
            raise ValidationError({"name": "Tên khóa học đã tồn tại."})


class Shift(Record):
    name = models.CharField("Tên ca", max_length=10, unique=True)
    start = models.TimeField("Giờ bắt đầu")
    end = models.TimeField("Giờ kết thúc")

    def __str__(self):
        return f"{self.name} ({self.start:%H:%M}–{self.end:%H:%M})"

    def clean(self):
        super().clean()
        if self.start and self.end:
            if self.start >= self.end:
                raise ValidationError("Giờ kết thúc phải sau giờ bắt đầu.")
            if (
                Shift.objects.filter(
                    deleted_at=None, start__lt=self.end, end__gt=self.start
                )
                .exclude(pk=self.pk)
                .exists()
            ):
                raise ValidationError("Ca học bị chồng lấn.")


class Room(models.Model):
    name = models.CharField("Phòng học", max_length=50, unique=True)

    def __str__(self):
        return self.name


class Classroom(Record):
    code = models.CharField("Mã lớp", max_length=30, unique=True, editable=False)
    course = models.ForeignKey(
        Course, verbose_name="Khóa học", on_delete=models.PROTECT
    )
    manager = models.ForeignKey(
        Account,
        verbose_name="QLLH phụ trách",
        on_delete=models.PROTECT,
        related_name="managed_classes",
        limit_choices_to={"role": "QLLH", "is_active": True},
    )
    teacher = models.ForeignKey(
        Account,
        verbose_name="Giáo viên",
        on_delete=models.PROTECT,
        related_name="taught_classes",
        limit_choices_to={"role": "GV", "is_active": True},
    )
    start_date = models.DateField("Ngày bắt đầu")
    end_date = models.DateField("Ngày kết thúc")

    def clean(self):
        super().clean()
        if self.start_date and self.end_date and self.start_date >= self.end_date:
            raise ValidationError("Ngày kết thúc phải sau ngày bắt đầu.")

    def save(self, *a, **kw):
        if not self.code:
            self.code = next_code(self.course.symbol)
        super().save(*a, **kw)

    @property
    def status(self):
        today = timezone.localdate()
        return (
            "Chưa bắt đầu"
            if today < self.start_date
            else "Đã kết thúc"
            if today > self.end_date
            else "Đang hoạt động"
        )

    def __str__(self):
        return self.code


class Enrollment(Record):
    classroom = models.ForeignKey(
        Classroom, verbose_name="Lớp học", on_delete=models.PROTECT
    )
    student = models.ForeignKey(
        Account,
        verbose_name="Học viên",
        on_delete=models.PROTECT,
        limit_choices_to={"role": "HV", "is_active": True},
    )
    left_at = models.DateTimeField(null=True, editable=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["classroom", "student"], name="unique_membership"
            )
        ]

    def __str__(self):
        return f"{self.student} · {self.classroom}"


class Schedule(Record):
    classroom = models.ForeignKey(
        Classroom, verbose_name="Lớp học", on_delete=models.PROTECT
    )
    shift = models.ForeignKey(Shift, verbose_name="Ca học", on_delete=models.PROTECT)
    room = models.ForeignKey(Room, verbose_name="Phòng học", on_delete=models.PROTECT)

    def __str__(self):
        return f"{self.classroom} · {self.shift} · {self.room}"


class ScheduleDay(models.Model):
    schedule = models.ForeignKey(
        Schedule, on_delete=models.CASCADE, related_name="weekdays"
    )
    weekday = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(2), MaxValueValidator(8)]
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["schedule", "weekday"], name="unique_weekday"
            )
        ]


class Session(models.Model):
    schedule = models.ForeignKey(Schedule, on_delete=models.PROTECT)
    classroom = models.ForeignKey(Classroom, on_delete=models.PROTECT)
    number = models.PositiveIntegerField()
    date = models.DateField()
    shift = models.ForeignKey(Shift, on_delete=models.PROTECT)
    room = models.ForeignKey(Room, on_delete=models.PROTECT)
    cancelled = models.BooleanField(default=False)
    # Calendar visibility is independent from cancellation/learning records.
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["classroom", "date", "shift"], name="unique_class_session"
            ),
            models.UniqueConstraint(
                fields=["classroom", "number"], name="unique_session_number"
            ),
        ]

    def __str__(self):
        return f"{self.classroom} · Buổi {self.number} · {self.date}"


class Assignment(Record):
    title = models.CharField("Tiêu đề", max_length=255)
    description = models.TextField("Nội dung", blank=True)
    teacher = models.ForeignKey(Account, on_delete=models.PROTECT, editable=False)
    edited = models.BooleanField(default=False, editable=False)

    def __str__(self):
        return self.title


class Allocation(Record):
    assignment = models.ForeignKey(
        Assignment, verbose_name="Bài tập", on_delete=models.PROTECT
    )
    classroom = models.ForeignKey(
        Classroom, verbose_name="Lớp học", on_delete=models.PROTECT
    )
    session = models.ForeignKey(
        Session, verbose_name="Buổi học", on_delete=models.PROTECT
    )
    deadline = models.DateTimeField("Hạn nộp")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["assignment", "classroom"], name="unique_allocation"
            )
        ]

    def clean(self):
        super().clean()
        if self.deadline and self.deadline <= timezone.now():
            raise ValidationError({"deadline": "Hạn nộp phải ở tương lai."})
        if (
            self.session_id
            and self.classroom_id
            and self.session.classroom_id != self.classroom_id
        ):
            raise ValidationError("Buổi học không thuộc lớp đã chọn.")

    def __str__(self):
        return f"{self.assignment} · {self.classroom}"


class Submission(Record):
    allocation = models.ForeignKey(
        Allocation, verbose_name="Bài được giao", on_delete=models.PROTECT
    )
    enrollment = models.ForeignKey(
        Enrollment, verbose_name="Học viên / Lớp", on_delete=models.PROTECT
    )
    content = models.TextField("Nội dung bài làm")
    submitted_at = models.DateTimeField(null=True, editable=False)
    invalid = models.BooleanField(default=False, editable=False)
    late_override = models.BooleanField(default=False, editable=False)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["allocation", "enrollment"], name="unique_submission"
            )
        ]

    def clean(self):
        super().clean()
        if (
            self.allocation_id
            and self.enrollment_id
            and self.allocation.classroom_id != self.enrollment.classroom_id
        ):
            raise ValidationError("Học viên không thuộc lớp được giao.")

    @property
    def status(self):
        if self.invalid:
            return "Không hợp lệ"
        if not self.submitted_at:
            return (
                "Quá hạn" if timezone.now() > self.allocation.deadline else "Chưa nộp"
            )
        return "Nộp muộn" if self.late_override or self.submitted_at > self.allocation.deadline else "Đã nộp"

    def __str__(self):
        return f"{self.enrollment.student} · {self.allocation.assignment}"


class Attachment(models.Model):
    assignment = models.ForeignKey(Assignment, null=True, on_delete=models.PROTECT)
    submission = models.ForeignKey(Submission, null=True, on_delete=models.PROTECT)
    file = models.FileField(upload_to="documents/%Y/%m/")
    original_name = models.CharField(max_length=255)
    size = models.PositiveBigIntegerField()

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(assignment__isnull=False, submission__isnull=True)
                    | Q(assignment__isnull=True, submission__isnull=False)
                ),
                name="attachment_one_owner",
            )
        ]


class Comment(Record):
    submission = models.ForeignKey(
        Submission, verbose_name="Bài nộp", on_delete=models.PROTECT
    )
    author = models.ForeignKey(Account, on_delete=models.PROTECT, editable=False)
    content = models.CharField("Nhận xét", max_length=3000)

    def __str__(self):
        return self.content[:70]


class SubmissionException(Record):
    submission = models.ForeignKey(
        Submission, verbose_name="Bài nộp", on_delete=models.PROTECT
    )
    author = models.ForeignKey(Account, on_delete=models.PROTECT, editable=False)
    reason = models.CharField("Lý do ngoại lệ", max_length=500)
    previous = models.CharField(max_length=50, editable=False)
    next_status = models.CharField(
        "Trạng thái điều chỉnh",
        max_length=30,
        choices=[("valid", "Công nhận bài nộp"), ("invalid", "Không hợp lệ")],
    )

    def __str__(self):
        return self.reason


def submission_evidence_storage():
    from django.conf import settings
    from django.core.files.storage import FileSystemStorage

    # Evidence is private and must not be served by the public media URL.
    return FileSystemStorage(location=settings.VAR_DIR / "submission-evidence")


class SubmissionUpdate(models.Model):
    allocation = models.ForeignKey(Allocation, on_delete=models.PROTECT)
    enrollment = models.ForeignKey(Enrollment, on_delete=models.PROTECT)
    author = models.ForeignKey(Account, on_delete=models.PROTECT)
    reason = models.CharField(max_length=500)
    previous_status = models.CharField(max_length=50)
    next_status = models.CharField(max_length=50)
    evidence = models.FileField(storage=submission_evidence_storage, blank=True)
    evidence_name = models.CharField(max_length=255, blank=True)
    evidence_size = models.PositiveBigIntegerField(default=0)
    work_attachment = models.ForeignKey(Attachment, null=True, blank=True, on_delete=models.SET_NULL)
    work_name = models.CharField(max_length=255, blank=True)
    work_size = models.PositiveBigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)


class ExamType(models.Model):
    name = models.CharField("Loại kiểm tra", max_length=50, unique=True)

    def __str__(self):
        return self.name


score_validators = [MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("10"))]


class Grade(Record):
    enrollment = models.ForeignKey(
        Enrollment, verbose_name="Học viên / Lớp", on_delete=models.PROTECT
    )
    exam_type = models.ForeignKey(
        ExamType, verbose_name="Loại kiểm tra", on_delete=models.PROTECT
    )
    listening = models.DecimalField(
        "Listening", max_digits=3, decimal_places=1, validators=score_validators
    )
    reading = models.DecimalField(
        "Reading", max_digits=3, decimal_places=1, validators=score_validators
    )
    speaking = models.DecimalField(
        "Speaking", max_digits=3, decimal_places=1, validators=score_validators
    )
    writing = models.DecimalField(
        "Writing", max_digits=3, decimal_places=1, validators=score_validators
    )
    exam_date = models.DateField("Ngày kiểm tra")
    note = models.CharField("Ghi chú", max_length=500, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["enrollment", "exam_type"],
                condition=Q(deleted_at__isnull=True),
                name="unique_grade",
            ),
            models.CheckConstraint(
                condition=Q(
                    listening__gte=0,
                    listening__lte=10,
                    reading__gte=0,
                    reading__lte=10,
                    speaking__gte=0,
                    speaking__lte=10,
                    writing__gte=0,
                    writing__lte=10,
                ),
                name="score_range",
            ),
        ]

    def clean(self):
        super().clean()
        for name in ["listening", "reading", "speaking", "writing"]:
            value = getattr(self, name)
            if value is not None and value * 2 != (value * 2).to_integral_value():
                raise ValidationError({name: "Điểm phải theo bước 0.5."})

    @property
    def overall(self):
        return (
            (self.listening + self.reading + self.speaking + self.writing) / 4 * 2
        ).quantize(Decimal("1"), rounding=ROUND_HALF_UP) / 2

    def __str__(self):
        return f"{self.enrollment} · {self.exam_type} · {self.overall}"


class GradeHistory(models.Model):
    grade = models.ForeignKey(Grade, on_delete=models.PROTECT)
    author = models.ForeignKey(Account, on_delete=models.PROTECT)
    before = models.JSONField()
    after = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)


class RetakeCriterion(models.Model):
    name = models.CharField("Tiêu chí", max_length=255)
    min_score = models.DecimalField(
        "Điểm tối thiểu", max_digits=3, decimal_places=1, validators=score_validators
    )
    min_submission_rate = models.DecimalField(
        "Tỷ lệ nộp tối thiểu (%)",
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )

    def __str__(self):
        return self.name


class RetakeRequest(Record):
    enrollment = models.ForeignKey(
        Enrollment, verbose_name="Học viên / Lớp", on_delete=models.PROTECT
    )
    reason = models.CharField("Lý do học lại", max_length=500)
    status = models.CharField(
        "Kết quả",
        max_length=20,
        choices=[
            ("pending", "Chờ duyệt"),
            ("approved", "Đồng ý"),
            ("rejected", "Từ chối"),
        ],
        default="pending",
        editable=False,
    )
    reviewer = models.ForeignKey(
        Account, null=True, on_delete=models.PROTECT, editable=False
    )
    review_note = models.CharField(max_length=500, blank=True, editable=False)
    reviewed_at = models.DateTimeField(null=True, editable=False)

    def __str__(self):
        return f"{self.enrollment} · {self.get_status_display()}"


class RetakeEvaluation(models.Model):
    request = models.ForeignKey(RetakeRequest, on_delete=models.PROTECT)
    criterion = models.ForeignKey(RetakeCriterion, on_delete=models.PROTECT)
    score_snapshot = models.DecimalField(max_digits=3, decimal_places=1, null=True)
    submission_rate = models.DecimalField(max_digits=5, decimal_places=2)
    passed = models.BooleanField()


class Audit(models.Model):
    actor = models.ForeignKey(Account, null=True, on_delete=models.PROTECT)
    action = models.CharField(max_length=80)
    entity = models.CharField(max_length=80)
    object_id = models.BigIntegerField(null=True)
    detail = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)


class LoginSession(models.Model):
    user = models.ForeignKey(Account, on_delete=models.PROTECT)
    session_hash = models.CharField(max_length=64)
    logged_in = models.DateTimeField(auto_now_add=True)
    logged_out = models.DateTimeField(null=True)


class OTP(models.Model):
    user = models.ForeignKey(Account, on_delete=models.CASCADE)
    digest = models.CharField(max_length=255)
    expires = models.DateTimeField()
    used = models.BooleanField(default=False)
    attempts = models.PositiveSmallIntegerField(default=0)


class AuthThrottle(models.Model):
    key = models.CharField(max_length=64, unique=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    window_start = models.DateTimeField(default=timezone.now)
