"""Role-specific class management; other roles keep their existing workflows."""
import unicodedata
import re
from datetime import date, datetime, timedelta

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.http import Http404, JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from .models import Account, Allocation, Classroom, Counter, Course, Enrollment, Room, Schedule, ScheduleDay, Session, Shift
from .services import classes_for, validate_active_parents
from .views import api, audit, data, denied, guard


KINDS = {"courses": Course, "shifts": Shift, "classes": Classroom, "schedules": Schedule, "enrollments": Enrollment}


def class_code(course, reserve=False):
    # Account for historical/imported class codes even if the counter is stale.
    if reserve:
        counter, _ = Counter.objects.select_for_update().get_or_create(prefix=course.symbol)
    else:
        counter = Counter.objects.filter(prefix=course.symbol).first()
    number = counter.value if counter else 0
    for code in Classroom.objects.filter(course=course, code__startswith=course.symbol).values_list("code", flat=True):
        suffix = code[len(course.symbol):]
        if suffix.isdigit():
            number = max(number, int(suffix))
    if reserve:
        counter.value = number + 1
        counter.save(update_fields=["value"])
    return f"{course.symbol}{number + 1:03d}"


def students_for(user):
    return Account.objects.filter(role="HV", is_active=True).filter(
        Q(created_by=user) | Q(enrollment__classroom__manager=user, enrollment__deleted_at=None)
    ).distinct()


def active_classes(user):
    return classes_for(user).filter(archived_at=None, course__deleted_at=None, course__archived_at=None)


def editable_class(c):
    if c.end_date < timezone.localdate():
        raise ValidationError("Không thể chỉnh sửa lớp học đã kết thúc.")
    validate_active_parents(Schedule(classroom=c))


def taught(s):
    now = timezone.localtime()
    return s.date < now.date() or (s.date == now.date() and s.shift.end <= now.time())


def sync_manager_schedule(schedule, days):
    if not isinstance(days, list) or not days or any(str(d) not in [str(i) for i in range(2, 9)] for d in days):
        raise ValidationError({"days": "Chọn ít nhất một thứ từ Thứ 2 đến Chủ nhật."})
    days = sorted({int(d) for d in days})
    if schedule.shift.deleted_at or schedule.shift.archived_at:
        raise ValidationError({"shift": "Ca học đã ẩn hoặc bị xóa."})
    validate_active_parents(schedule)
    existing = list(Session.objects.filter(schedule=schedule).select_related("shift"))
    old_by_date = {s.date: s for s in existing}
    wanted = []
    day = schedule.classroom.start_date
    while day <= schedule.classroom.end_date:
        if day.weekday() + 2 in days:
            wanted.append(day)
        day += timedelta(days=1)
    if not wanted:
        raise ValidationError({"days": "Không có ngày học phù hợp trong thời gian của lớp."})
    for old in existing:
        if old.date not in wanted and not taught(old):
            if Allocation.objects.filter(session=old, deleted_at=None).exists():
                raise ValidationError("Buổi học đã gắn bài tập, không thể loại bỏ khỏi lịch.")
            old.cancelled = True
            old.save(update_fields=["cancelled"])
    now = timezone.localtime()
    for day in wanted:
        old = old_by_date.get(day)
        if old and taught(old):
            continue
        # Editing a recurring schedule only changes future sessions.
        if existing and (day < now.date() or (day == now.date() and schedule.shift.end <= now.time())):
            continue
        conflicts = Session.objects.filter(date=day, cancelled=False,
            schedule__deleted_at=None, classroom__deleted_at=None,
            shift__start__lt=schedule.shift.end, shift__end__gt=schedule.shift.start).exclude(schedule=schedule)
        if conflicts.filter(Q(room=schedule.room) | Q(classroom=schedule.classroom)
                | Q(classroom__teacher=schedule.classroom.teacher)).exists():
            raise ValidationError(f"Trùng phòng, giáo viên hoặc lịch lớp vào ngày {day:%d/%m/%Y}.")
        if old:
            old.room = schedule.room
            old.cancelled = False
            old.save(update_fields=["room", "cancelled"])
        else:
            # Never re-create a referenced session or re-use its identity.
            number = (Session.objects.filter(classroom=schedule.classroom).order_by("-number").values_list("number", flat=True).first() or 0) + 1
            Session.objects.create(schedule=schedule, classroom=schedule.classroom, shift=schedule.shift,
                room=schedule.room, date=day, number=number)
    schedule.weekdays.all().delete()
    ScheduleDay.objects.bulk_create([ScheduleDay(schedule=schedule, weekday=d) for d in days])
    renumber_future_sessions(schedule.classroom)


def renumber_future_sessions(classroom):
    sessions = list(Session.objects.filter(classroom=classroom).select_related("shift").order_by("date", "shift__start", "pk"))
    history = [s for s in sessions if taught(s)]
    future = [s for s in sessions if not taught(s)]
    # Preserve labels as well as identity whenever a future session is already
    # referenced by learning data. Taught sessions are never re-numbered.
    if not future or Allocation.objects.filter(session__in=future).exists():
        return
    temporary = max((s.number for s in sessions), default=0) + len(future) + 1
    for index, session in enumerate(future):
        session.number = temporary + index
        session.save(update_fields=["number"])
    number = max((s.number for s in history), default=0)
    for session in [s for s in future if not s.cancelled] + [s for s in future if s.cancelled]:
        number += 1
        session.number = number
        session.save(update_fields=["number"])


def class_json(c):
    return {"id": c.pk, "code": c.code, "course": c.course_id, "course_name": c.course.name,
        "teacher": c.teacher_id, "teacher_code": c.teacher.username, "teacher_name": c.teacher.full_name,
        "manager": c.manager_id, "manager_code": c.manager.username, "manager_name": c.manager.full_name,
        "start_date": str(c.start_date), "end_date": str(c.end_date), "status": c.status,
        "archived": bool(c.archived_at), "student_count": Enrollment.objects.filter(classroom=c, deleted_at=None, left_at=None).count()}


@api
@require_http_methods(["GET"])
def options(r):
    blocked = guard(r)
    if blocked is not None:
        return blocked
    if r.user.role not in ["QLLH", "QLCN"]:
        return denied()
    courses = Course.objects.filter(deleted_at=None, archived_at=None).order_by("pk")
    shifts = Shift.objects.filter(deleted_at=None, archived_at=None).order_by("start")
    catalogue = {
        "courses": [{"id": c.pk, "name": c.name, "symbol": c.symbol,
            "next_code": class_code(c)} for c in courses],
        "shifts": [{"id": s.pk, "name": s.name, "start": s.start.strftime("%H:%M"), "end": s.end.strftime("%H:%M")} for s in shifts],
    }
    if r.user.role == "QLCN":
        return JsonResponse(catalogue)
    catalogue.update({
        "manager": {"id": r.user.pk, "code": r.user.username, "name": r.user.full_name},
        "teachers": [{"id": u.pk, "code": u.username, "name": u.full_name} for u in Account.objects.filter(role="GV", is_active=True).order_by("username")],
        "students": [{"id": u.pk, "code": u.username, "name": u.full_name} for u in students_for(r.user).order_by("username")],
        "classes": [class_json(c) for c in active_classes(r.user).select_related("course", "teacher", "manager").filter(end_date__gte=timezone.localdate()).order_by("code")],
        "rooms": [{"id": room.pk, "name": room.name} for room in Room.objects.order_by("name")],
    })
    return JsonResponse(catalogue)


@api
@require_http_methods(["GET", "POST", "PATCH", "DELETE"])
def manage(r, kind, pk=None):
    blocked = guard(r)
    if blocked is not None:
        return blocked
    if kind not in KINDS:
        raise Http404
    catalogue = kind in ["courses", "shifts"]
    if r.user.role != "QLLH" and not (r.user.role == "QLCN" and catalogue):
        return denied()
    if r.method != "GET":
        return mutate(r, kind, pk)
    archived = r.GET.get("archived") == "1"
    if catalogue:
        model = KINDS[kind]
        qs = model.objects.filter(deleted_at=None, archived_at__isnull=not archived).order_by("pk")
        if pk:
            qs = qs.filter(pk=pk)
            if not qs.exists():
                raise Http404
        if kind == "courses":
            rows = [{"id": c.pk, "name": c.name, "symbol": c.symbol, "description": c.description,
                "used": Classroom.objects.filter(course=c).exists(), "archived": bool(c.archived_at)} for c in qs]
        else:
            rows = [{"id": s.pk, "name": s.name, "start": s.start.strftime("%H:%M"), "end": s.end.strftime("%H:%M"),
                "used": Schedule.objects.filter(shift=s).exists(), "archived": bool(s.archived_at)} for s in qs]
        return JsonResponse({"rows": rows, "can_write": r.user.role == "QLCN"})
    if kind == "classes":
        qs = classes_for(r.user).select_related("course", "teacher", "manager")
        if pk:
            c = qs.filter(pk=pk).first()
            if not c:
                raise Http404
            result = class_json(c)
            result["members"] = [{"id": e.pk, "student_id": e.student_id, "code": e.student.username,
                "name": e.student.full_name, "left": bool(e.left_at)} for e in Enrollment.objects.filter(classroom=c, deleted_at=None).select_related("student").order_by("student__username")]
            return JsonResponse(result)
        return JsonResponse({"rows": [class_json(c) for c in qs.filter(archived_at__isnull=not archived).order_by("code")]})
    if kind == "schedules":
        qs = Session.objects.filter(classroom__in=classes_for(r.user), schedule__deleted_at=None).select_related(
            "classroom__course", "classroom__teacher", "classroom__manager", "shift", "room", "schedule")
        qs = qs.filter(Q(schedule__archived_at__isnull=False) | Q(classroom__archived_at__isnull=False)) if archived else qs.filter(schedule__archived_at=None, classroom__archived_at=None)
        if pk:
            schedule = Schedule.objects.filter(pk=pk, classroom__in=classes_for(r.user), deleted_at=None).select_related("classroom", "shift").first()
            if not schedule:
                raise Http404
            return JsonResponse({"id": schedule.pk, "classroom": schedule.classroom_id,
                "shift": schedule.shift_id, "room": schedule.room_id,
                "days": list(schedule.weekdays.values_list("weekday", flat=True)), "archived": bool(schedule.archived_at)})
        rows = [{"id": s.pk, "schedule_id": s.schedule_id, "number": s.number,
            "classroom": s.classroom.code, "classroom_id": s.classroom_id,
            "course": s.classroom.course.name, "course_id": s.classroom.course_id,
            "date": str(s.date), "shift": s.shift.name, "shift_id": s.shift_id,
            "start": s.shift.start.strftime("%H:%M"), "end": s.shift.end.strftime("%H:%M"),
            "room": s.room.name, "room_id": s.room_id, "teacher": s.classroom.teacher.full_name,
            "manager": s.classroom.manager.full_name, "cancelled": s.cancelled,
            "past": taught(s), "archived": bool(s.schedule.archived_at or s.classroom.archived_at)} for s in qs.order_by("date", "shift__start", "pk")]
        return JsonResponse({"rows": rows})
    raise Http404


def lookup(model, value, field, **filters):
    try:
        obj = model.objects.filter(pk=value, **filters).first()
    except (ValueError, TypeError):
        obj = None
    if not obj:
        raise ValidationError({field: "Vui lòng chọn dữ liệu hợp lệ đang hoạt động."})
    return obj


def parse_date(value, field):
    try:
        return date.fromisoformat(value)
    except (ValueError, TypeError):
        raise ValidationError({field: "Vui lòng chọn ngày hợp lệ."})


@transaction.atomic
def mutate(r, kind, pk=None):
    # Also used by legacy endpoints to prevent bypassing QLLH business rules.
    if r.user.role not in ["QLLH", "QLCN"]:
        return denied()
    catalogue = kind in ["courses", "shifts"]
    if catalogue and r.user.role != "QLCN":
        return denied()
    if not catalogue and r.user.role != "QLLH":
        return denied()
    model = KINDS[kind]
    qs = model.objects.filter(deleted_at=None)
    if kind == "classes":
        qs = qs.filter(manager=r.user)
    elif kind in ["schedules", "enrollments"]:
        qs = qs.filter(classroom__in=classes_for(r.user))
    obj = qs.select_for_update().filter(pk=pk).first() if pk else None
    if pk and not obj:
        raise Http404
    if r.method in ["PATCH", "DELETE"] and not obj:
        raise Http404
    payload = data(r) if r.method != "DELETE" else {}
    action = payload.get("_action")
    if r.method == "DELETE" or action in ["archive", "restore"]:
        if not obj:
            raise Http404
        if kind == "enrollments":
            editable_class(obj.classroom)
            obj.left_at = timezone.now()
            obj.save(update_fields=["left_at"])
        elif r.method == "DELETE":
            if kind == "schedules":
                if Allocation.objects.filter(session__schedule=obj).exists():
                    raise ValidationError("Lịch đã gắn bài tập, hãy chọn Ẩn thay vì Xóa.")
                for session in Session.objects.filter(schedule=obj).select_related("shift"):
                    if not taught(session):
                        session.cancelled = True
                        session.save(update_fields=["cancelled"])
            elif any(getattr(obj, rel.get_accessor_name()).exists() for rel in obj._meta.related_objects):
                raise ValidationError("Dữ liệu đang được sử dụng; hãy chọn Ẩn thay vì Xóa.")
            obj.deleted_at = timezone.now()
            obj.save(update_fields=["deleted_at"])
        else:
            if action == "restore":
                validate_active_parents(obj)
            obj.archived_at = timezone.now() if action == "archive" else None
            obj.save(update_fields=["archived_at"])
            schedules = [obj] if kind == "schedules" else list(Schedule.objects.filter(classroom=obj, deleted_at=None, archived_at=None)) if kind == "classes" else []
            for schedule in schedules:
                if action == "archive":
                    for session in Session.objects.filter(schedule=schedule).select_related("shift"):
                        if not taught(session):
                            session.cancelled = True
                            session.save(update_fields=["cancelled"])
                else:
                    sync_manager_schedule(schedule, list(schedule.weekdays.values_list("weekday", flat=True)))
        audit(r.user, action or "delete", obj)
        return JsonResponse({"ok": True})
    if kind in ["courses", "shifts"]:
        if obj and obj.archived_at:
            raise ValidationError("Khôi phục dữ liệu trước khi chỉnh sửa.")
        if kind == "courses":
            if obj:
                if payload.get("name", obj.name) != obj.name or payload.get("symbol", obj.symbol) != obj.symbol:
                    raise ValidationError("Tên và mã khóa học không được thay đổi.")
                obj.description = payload.get("description", obj.description).strip()
            else:
                name = payload.get("name", "").strip()
                symbol = re.sub(r"[^A-Z0-9]", "", unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().upper())[:20]
                obj = Course(name=name, symbol=symbol, description=payload.get("description", "").strip())
        else:
            if obj:
                return denied()
            try:
                start = datetime.strptime(payload.get("start", ""), "%H:%M").time()
                end = datetime.strptime(payload.get("end", ""), "%H:%M").time()
            except (ValueError, TypeError):
                raise ValidationError({"start": "Giờ học phải theo định dạng HH:mm."})
            obj = Shift(name=payload.get("name", "").strip(), start=start, end=end)
        obj.full_clean()
        obj.save()
    elif kind == "classes":
        if payload.get("manager") is not None and str(payload["manager"]) != str(r.user.pk):
            raise ValidationError({"manager": "QLLH phụ trách được tự động gán theo tài khoản đăng nhập."})
        if obj:
            editable_class(obj)
            if payload.get("course") is not None and str(payload["course"]) != str(obj.course_id):
                raise ValidationError({"course": "Không được thay đổi khóa học của lớp."})
            if payload.get("code", obj.code) != obj.code:
                raise ValidationError({"code": "Mã lớp không được thay đổi."})
        else:
            course = lookup(Course, payload.get("course"), "course", deleted_at=None, archived_at=None)
            obj = Classroom(course=course, manager=r.user, code=class_code(course, reserve=True))
        obj.teacher = lookup(Account, payload.get("teacher", obj.teacher_id), "teacher", role="GV", is_active=True)
        obj.start_date = parse_date(payload.get("start_date", str(obj.start_date) if obj.start_date else ""), "start_date")
        obj.end_date = parse_date(payload.get("end_date", str(obj.end_date) if obj.end_date else ""), "end_date")
        past = Session.objects.filter(classroom=obj, cancelled=False).select_related("shift") if obj.pk else []
        if any(taught(s) and not obj.start_date <= s.date <= obj.end_date for s in past):
            raise ValidationError("Khoảng ngày mới không được loại bỏ buổi học đã diễn ra.")
        obj.full_clean()
        obj.save()
        if "students" in payload:
            add_students(r.user, obj, payload["students"])
        for schedule in Schedule.objects.filter(classroom=obj, deleted_at=None, archived_at=None):
            sync_manager_schedule(schedule, list(schedule.weekdays.values_list("weekday", flat=True)))
    elif kind == "enrollments":
        if obj:
            if payload.get("_action") == "leave":
                editable_class(obj.classroom)
                obj.left_at = timezone.now()
                obj.save(update_fields=["left_at"])
            elif payload.get("_action") == "rejoin":
                add_students(r.user, obj.classroom, [obj.student_id])
            else:
                raise ValidationError("Không được đổi lớp/học viên của bản ghi tham gia lớp.")
        else:
            classroom = active_classes(r.user).filter(pk=payload.get("classroom")).first()
            if not classroom:
                raise Http404
            editable_class(classroom)
            ids = payload.get("students", [payload.get("student")])
            add_students(r.user, classroom, ids)
            return JsonResponse({"ok": True})
    elif kind == "schedules":
        if obj:
            editable_class(obj.classroom)
            if obj.archived_at:
                raise ValidationError("Khôi phục lịch trước khi chỉnh sửa.")
            for field in ["classroom", "shift"]:
                if field in payload and str(payload[field]) != str(getattr(obj, field + "_id")):
                    raise ValidationError({field: "Không được thay đổi lớp hoặc ca của lịch đã tạo."})
        else:
            classroom = active_classes(r.user).filter(pk=payload.get("classroom")).first()
            if not classroom:
                raise Http404
            editable_class(classroom)
            obj = Schedule(classroom=classroom, shift=lookup(Shift, payload.get("shift"), "shift", deleted_at=None, archived_at=None))
        obj.room = lookup(Room, payload.get("room", obj.room_id), "room")
        obj.full_clean()
        obj.save()
        sync_manager_schedule(obj, payload.get("days", []))
    else:
        raise Http404
    audit(r.user, "update" if pk else "create", obj)
    return JsonResponse({"ok": True, "id": obj.pk})


def add_students(user, classroom, ids):
    editable_class(classroom)
    if not isinstance(ids, list) or any(not str(i).isdigit() for i in ids):
        raise ValidationError({"students": "Danh sách học viên không hợp lệ."})
    ids = [int(i) for i in ids]
    if len(ids) != len(set(ids)):
        raise ValidationError({"students": "Không được chọn học viên trùng lặp."})
    choices = {u.pk: u for u in students_for(user).filter(pk__in=ids)}
    if len(choices) != len(ids):
        raise ValidationError({"students": "Học viên không hoạt động hoặc ngoài phạm vi quản lý."})
    for student in choices.values():
        membership, created = Enrollment.objects.get_or_create(classroom=classroom, student=student)
        if not created:
            membership.left_at = None
            membership.deleted_at = None
            membership.save(update_fields=["left_at", "deleted_at"])
        audit(user, "enroll", membership)
