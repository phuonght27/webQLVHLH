from datetime import timedelta
from django.db.models import Max, Q
from django.core.exceptions import ValidationError
from django.utils import timezone
from .models import *

MODELS = {
    "accounts": Account,
    "courses": Course,
    "shifts": Shift,
    "classes": Classroom,
    "enrollments": Enrollment,
    "schedules": Schedule,
    "assignments": Assignment,
    "allocations": Allocation,
    "submissions": Submission,
    "comments": Comment,
    "exceptions": SubmissionException,
    "grades": Grade,
    "retakes": RetakeRequest,
}
FIELDS = {
    "accounts": [
        "username",
        "full_name",
        "gender",
        "phone",
        "email",
        "address",
        "role",
        "is_active",
    ],
    "courses": ["name", "symbol", "description"],
    "shifts": ["name", "start", "end"],
    "classes": ["code", "course", "teacher", "manager", "start_date", "end_date"],
    "enrollments": ["classroom", "student"],
    "schedules": ["classroom", "shift", "room"],
    "assignments": ["title", "description"],
    "allocations": ["assignment", "classroom", "session", "deadline"],
    "submissions": ["allocation", "enrollment", "content"],
    "comments": ["submission", "content"],
    "exceptions": ["submission", "reason", "next_status"],
    "grades": [
        "enrollment",
        "exam_type",
        "listening",
        "reading",
        "speaking",
        "writing",
        "exam_date",
        "note",
    ],
    "retakes": ["enrollment", "reason"],
}
TITLES = {
    "accounts": "Quản lý tài khoản",
    "courses": "Quản lý khóa học",
    "shifts": "Quản lý ca học",
    "classes": "Quản lý danh sách lớp học",
    "enrollments": "Thành viên lớp học",
    "schedules": "Quản lý lịch học",
    "assignments": "Quản lý bài tập",
    "allocations": "Giao bài tập cho lớp",
    "submissions": "Theo dõi bài nộp",
    "comments": "Nhận xét bài tập",
    "exceptions": "Cập nhật ngoại lệ",
    "grades": "Quản lý điểm",
    "retakes": "Yêu cầu học lại",
}


def classes_for(user):
    qs = Classroom.objects.filter(deleted_at=None)
    if user.is_superuser or user.role == "QLCN":
        return qs
    if user.role == "QLLH":
        return qs.filter(manager=user)
    if user.role == "GV":
        return qs.filter(teacher=user)
    return qs.filter(enrollment__student=user, enrollment__deleted_at=None).distinct()


def scoped(model, user):
    q = model.objects.all()
    if model == Account:
        if user.is_superuser:
            return q

        # Quản lý chi nhánh: xem QLLH, GV, HV
        if user.role == "QLCN":
            return q.filter(
                role__in=["QLLH", "GV", "HV"]
            )

        # QLLH sees students they created and students enrolled in their classes.
        if user.role == "QLLH":
            return q.filter(role="HV").filter(
                Q(created_by=user)
                | Q(
                    enrollment__classroom__manager=user,
                    enrollment__deleted_at__isnull=True,
                    enrollment__classroom__deleted_at__isnull=True,
                    enrollment__left_at__isnull=True,
                )
            ).distinct()

        # Giáo viên và học viên: chỉ truy xuất tài khoản cá nhân
        return q.filter(pk=user.pk)
    if model in (Course, Shift, Room, ExamType, RetakeCriterion):
        return q
    if model == Classroom:
        return classes_for(user)
    if model in (Enrollment, Schedule, Session, Allocation):
        q = q.filter(classroom__in=classes_for(user))
    if model == Assignment:
        if user.role == "HV":
            q = q.filter(allocation__classroom__in=classes_for(user)).distinct()
        elif user.role == "GV":
            q = q.filter(teacher=user)
        elif user.role == "QLLH":
            q = q.filter(allocation__classroom__in=classes_for(user)).distinct()
    if model in (Submission, Grade, RetakeRequest):
        q = q.filter(enrollment__classroom__in=classes_for(user))
        if user.role == "HV":
            q = q.filter(enrollment__student=user)
        elif model == Submission:
            q = q.filter(submitted_at__isnull=False)
    if model in (Comment, SubmissionException):
        q = q.filter(submission__enrollment__classroom__in=classes_for(user))
        if user.role == "HV":
            q = q.filter(submission__enrollment__student=user)
    if model == Enrollment and user.role == "HV":
        q = q.filter(student=user)
    return q


def can_write(kind, user):
    if kind in ["assignments", "allocations", "comments", "exceptions"]:
        return user.role == "GV"
    if user.is_superuser:
        return True
    if kind == "accounts":
        return user.role in ["QLCN", "QLLH"]
    if kind in ["courses", "shifts"] and user.role == "QLLH":
        return False
    if kind in ["courses", "shifts", "classes", "schedules", "enrollments"]:
        return user.role in ["QLCN", "QLLH"]
    if kind in ["assignments", "allocations", "comments", "exceptions", "grades"]:
        return user.role == "GV"
    return kind in ["submissions", "retakes"] and user.role == "HV"


@transaction.atomic
def sync_schedule(schedule, days):
    if not days or any(d not in range(2, 9) for d in days):
        raise ValidationError("Chọn ít nhất một thứ từ 2 đến 8.")
    if schedule.shift.archived_at or schedule.shift.deleted_at:
        raise ValidationError("Ca học không còn hoạt động.")
    wanted = []
    date = schedule.classroom.start_date
    while date <= schedule.classroom.end_date:
        if date.weekday() + 2 in days:
            wanted.append(date)
        date += timedelta(days=1)
    for date in wanted:
        conflicts = Session.objects.filter(
            date=date,
            cancelled=False,
            shift__start__lt=schedule.shift.end,
            shift__end__gt=schedule.shift.start,
        ).exclude(schedule=schedule)
        if conflicts.filter(
            Q(room=schedule.room)
            | Q(classroom__teacher=schedule.classroom.teacher)
            | Q(classroom=schedule.classroom)
        ).exists():
            raise ValidationError(f"Trùng phòng, giáo viên hoặc lớp vào ngày {date}.")
    # Keep referenced and past session IDs; never regenerate by deleting rows.
    for old in Session.objects.filter(schedule=schedule):
        if old.date not in wanted and old.date >= timezone.localdate():
            old.cancelled = True
            old.save()
    n = (
        Session.objects.filter(classroom=schedule.classroom).aggregate(n=Max("number"))[
            "n"
        ]
        or 0
    )
    for date in wanted:
        session = Session.objects.filter(
            classroom=schedule.classroom, date=date, shift=schedule.shift
        ).first()
        if session and session.schedule_id != schedule.pk:
            raise ValidationError("Lớp đã có lịch học vào ngày này.")
        if not session:
            n += 1
            Session.objects.create(
                schedule=schedule,
                classroom=schedule.classroom,
                date=date,
                shift=schedule.shift,
                room=schedule.room,
                number=n,
            )
        elif date >= timezone.localdate():
            session.room = schedule.room
            session.cancelled = False
            session.save()
    schedule.weekdays.all().delete()
    ScheduleDay.objects.bulk_create(
        [ScheduleDay(schedule=schedule, weekday=d) for d in sorted(set(days))]
    )


def validate_active_parents(obj):
    classroom = None
    if isinstance(obj, (Enrollment, Schedule, Allocation)):
        classroom = obj.classroom
    elif isinstance(obj, (Submission, Grade, RetakeRequest)):
        classroom = obj.enrollment.classroom
    elif isinstance(obj, (Comment, SubmissionException)):
        classroom = obj.submission.enrollment.classroom
    if classroom and (
        classroom.archived_at
        or classroom.deleted_at
        or classroom.course.archived_at
        or classroom.course.deleted_at
    ):
        raise ValidationError(
            "Lớp hoặc khóa học đã lưu trữ/xóa. Khôi phục trước khi cập nhật dữ liệu."
        )
    if isinstance(obj, Classroom) and (obj.course.archived_at or obj.course.deleted_at):
        raise ValidationError("Khóa học đã lưu trữ hoặc xóa.")
