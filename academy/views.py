import csv, io, json, secrets, hashlib, zipfile
from datetime import timedelta, datetime, date, time
from decimal import Decimal
from functools import wraps
from django import forms
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.hashers import make_password, check_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.db import transaction, IntegrityError, models
from django.db.models import ProtectedError
from django.forms.models import model_to_dict
from django.http import JsonResponse, FileResponse, Http404
from django.middleware.csrf import get_token
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from .models import *
from .services import *


def api(fn):
    @wraps(fn)
    def wrapped(request, *args, **kwargs):
        try:
            return fn(request, *args, **kwargs)
        except (ValidationError, ValueError, KeyError, TypeError) as e:
            return JsonResponse(
                {
                    "error": getattr(e, "message_dict", None)
                    or getattr(e, "messages", None)
                    or str(e)
                },
                status=400,
            )
        except (IntegrityError, ProtectedError):
            return JsonResponse(
                {"error": "Dữ liệu trùng hoặc đang được sử dụng. Không thể thực hiện."},
                status=409,
            )

    return wrapped


def data(r):
    value = json.loads(r.body or "{}")
    if not isinstance(value, dict):
        raise ValidationError("Nội dung yêu cầu phải là JSON object.")
    return value


def denied():
    return JsonResponse(
        {"error": "Bạn không có quyền thực hiện thao tác này."}, status=403
    )


def guard(r):
    if not r.user.is_authenticated or not r.user.is_active:
        return JsonResponse({"error": "Vui lòng đăng nhập."}, status=401)
    if r.user.must_change_password:
        return JsonResponse(
            {"error": "Vui lòng đổi mật khẩu lần đầu.", "must_change_password": True},
            status=403,
        )


def user_data(u):
    return {
        "id": u.pk,
        "name": u.full_name,
        "code": u.username,
        "role": u.role,
        "role_label": u.get_role_display(),
        "email": u.email,
        "gender": u.gender,
        "phone": u.phone,
        "address": u.address,
        "avatar": u.avatar.url if u.avatar else None,
        "must_change_password": u.must_change_password,
    }


def audit(u, action, obj, detail=None):
    Audit.objects.create(
        actor=u,
        action=action,
        entity=obj._meta.label,
        object_id=obj.pk,
        detail=detail or {},
    )


def throttle(key, limit=8):
    key = hashlib.sha256(key.encode()).hexdigest()
    obj, _ = AuthThrottle.objects.get_or_create(key=key)
    if obj.window_start < timezone.now() - timedelta(minutes=15):
        obj.attempts = 0
        obj.window_start = timezone.now()
    obj.attempts = min(obj.attempts + 1, limit + 1)
    obj.save()
    return obj.attempts > limit


@api
@require_http_methods(["GET", "POST"])
def auth(r, action):
    if action == "session" and r.method == "GET":
        return JsonResponse(
            {
                "csrf": get_token(r),
                "user": user_data(r.user)
                if r.user.is_authenticated and r.user.is_active
                else None,
            }
        )
    if r.method != "POST":
        return denied()
    d = data(r)
    if action == "login":
        email = d.get("email", "").strip().lower()
        if throttle("login:" + email):
            return JsonResponse(
                {"error": "Thử quá nhiều lần. Vui lòng chờ 15 phút."}, status=429
            )
        u = Account.objects.filter(email=email).first()
        u = authenticate(
            r, username=u.username if u else email, password=d.get("password", "")
        )
        if not u:
            return JsonResponse(
                {"error": "Email hoặc mật khẩu không đúng."}, status=400
            )
        login(r, u)
        r.session.set_expiry(60 * 60 * 24 * 14 if d.get("remember") else 0)
        LoginSession.objects.create(
            user=u,
            session_hash=hashlib.sha256(r.session.session_key.encode()).hexdigest(),
        )
        return JsonResponse({"user": user_data(u), "csrf": get_token(r)})
    if action == "logout":
        if r.user.is_authenticated:
            LoginSession.objects.filter(
                user=r.user,
                session_hash=hashlib.sha256(r.session.session_key.encode()).hexdigest(),
                logged_out=None,
            ).update(logged_out=timezone.now())
        logout(r)
        return JsonResponse({"ok": True})
    if action == "password":
        if not r.user.is_authenticated:
            return denied()
        if not r.user.check_password(d.get("old_password", "")):
            raise ValidationError("Mật khẩu hiện tại không đúng.")
        validate_password(d.get("password", ""), r.user)
        r.user.set_password(d["password"])
        r.user.must_change_password = False
        r.user.save()
        # Revoke all sessions after password changes; require a fresh login.
        return _invalidate_password_sessions(r, r.user)
    if action == "forgot":
        email = d.get("email", "").strip().lower()
        if throttle("forgot:" + email, 4):
            return JsonResponse(
                {"error": "Vui lòng chờ trước khi yêu cầu lại."}, status=429
            )
        u = Account.objects.filter(email=email, is_active=True).first()
        if u:
            code = f"{secrets.randbelow(1000000):06d}"
            with transaction.atomic():
                OTP.objects.filter(user=u, used=False).update(used=True)
                OTP.objects.create(
                    user=u,
                    digest=make_password(code),
                    expires=timezone.now() + timedelta(minutes=5),
                )
            send_mail(
                "The Toeic Lab – Mã khôi phục mật khẩu",
                f"Mã OTP của bạn: {code}. Có hiệu lực 5 phút.",
                None,
                [u.email],
            )
        return JsonResponse(
            {"ok": True, "message": "Nếu email hợp lệ, mã xác thực đã được gửi."}
        )
    if action == "reset":
        email = d.get("email", "").lower().strip()
        if throttle("reset:" + email, 8):
            return JsonResponse({"error": "Thử quá nhiều lần."}, status=429)
        with transaction.atomic():
            otp = (
                OTP.objects.select_for_update()
                .filter(user__email=email, used=False, expires__gt=timezone.now())
                .order_by("-pk")
                .first()
            )
            if not otp or otp.attempts >= 5:
                raise ValidationError("Mã xác thực không hợp lệ hoặc hết hạn.")
            otp.attempts += 1
            otp.save()
            if not check_password(d.get("code", ""), otp.digest):
                return JsonResponse({"error": "Mã xác thực không đúng."}, status=400)
            validate_password(d.get("password", ""), otp.user)
            otp.user.set_password(d["password"])
            otp.user.must_change_password = False
            otp.user.save()
            OTP.objects.filter(user=otp.user).update(used=True)
        return _invalidate_password_sessions(r, otp.user)
    return denied()


def _invalidate_password_sessions(r, user):
    from django.contrib.sessions.models import Session as AuthSession

    for s in AuthSession.objects.filter(expire_date__gt=timezone.now()):
        if s.get_decoded().get("_auth_user_id") == str(user.pk):
            s.delete()
    LoginSession.objects.filter(user=user, logged_out=None).update(
        logged_out=timezone.now()
    )
    logout(r)
    return JsonResponse({"ok": True})


def form_for(kind, user, payload=None, instance=None):
    model = MODELS[kind]
    fields = [
        x for x in FIELDS[kind] if model._meta.get_field(x).editable and x != "username"
    ]
    if kind == "accounts":
        fields.remove("is_active")
        if instance:
            fields = [x for x in fields if x not in ["role", "email"]]
    if kind == "classes" and instance:
        fields.remove("course")
    if kind == "courses" and instance:
        fields = [x for x in fields if x not in ["name", "symbol"]]
    if kind == "schedules" and instance:
        fields = [x for x in fields if x not in ["classroom", "shift"]]
    cls = forms.modelform_factory(model, fields=fields)
    f = cls(payload, instance=instance)
    for name, field in f.fields.items():
        if isinstance(field, forms.ModelChoiceField):
            field.queryset = scoped(field.queryset.model, user)
            if hasattr(field.queryset.model, "deleted_at"):
                field.queryset = field.queryset.filter(
                    deleted_at=None, archived_at=None
                )
            if name in ["teacher", "manager", "student"]:
                field.queryset = Account.objects.filter(
                    role={"teacher": "GV", "manager": "QLLH", "student": "HV"}[name],
                    is_active=True,
                )
                if name == "student" and user.role == "QLLH":
                    field.queryset = field.queryset.filter(
                        Q(created_by=user) | Q(enrollment__classroom__manager=user)
                    ).distinct()
            if name == "manager" and user.role == "QLLH":
                field.queryset = Account.objects.filter(pk=user.pk)
            if name == "session":
                field.queryset = field.queryset.filter(
                    cancelled=False, date__lte=timezone.localdate()
                )
        if name == "role":
            field.choices = [
                x
                for x in Account.ROLE
                if user.is_superuser
                or x[0] in (["QLLH", "GV"] if user.role == "QLCN" else ["HV"])
            ]
    if kind == "schedules":
        f.fields["days"] = forms.MultipleChoiceField(
            label="Thứ trong tuần",
            choices=[
                (str(i), "Chủ nhật" if i == 8 else f"Thứ {i}") for i in range(2, 9)
            ],
            initial=[str(x.weekday) for x in instance.weekdays.all()]
            if instance
            else [],
        )
    if kind == "exceptions" and payload:
        # This required audit value is server-owned and absent from the form.
        submission = f.fields["submission"].queryset.filter(
            pk=payload.get("submission")
        ).first()
        if submission:
            f.instance.previous = submission.status
    return f


def schema(f):
    result = []
    for name, field in f.fields.items():
        item = {
            "name": name,
            "label": str(field.label),
            "required": field.required,
            "value": f[name].value(),
        }
        if item["value"] is not None and not isinstance(
            item["value"], (str, int, float, bool, list)
        ):
            item["value"] = str(item["value"])
        if hasattr(field, "choices"):
            item.update(
                type="multi"
                if isinstance(field, forms.MultipleChoiceField)
                else "select",
                choices=[{"value": str(k), "label": str(v)} for k, v in field.choices],
            )
        else:
            typ = "text"
            for cls, t in [
                (forms.DateTimeField, "datetime-local"),
                (forms.DateField, "date"),
                (forms.TimeField, "time"),
                (forms.DecimalField, "number"),
                (forms.EmailField, "email"),
            ]:
                if isinstance(field, cls):
                    typ = t
                    break
            if isinstance(field.widget, forms.Textarea):
                typ = "textarea"
            item["type"] = typ
            if getattr(field, "max_length", None):
                item["maxLength"] = field.max_length
        if (
            isinstance(field, forms.ModelChoiceField)
            and field.queryset.model == Session
        ):
            mapping = {str(s.pk): s.classroom_id for s in field.queryset}
            for choice in item.get("choices", []):
                choice["classroom_id"] = mapping.get(choice["value"])
        result.append(item)
    return result


def row(kind, o):
    vals = []
    for name in FIELDS[kind]:
        v = getattr(o, name)
        if hasattr(o, "get_" + name + "_display"):
            v = getattr(o, "get_" + name + "_display")()
        if name == "is_active":
            v = "Active" if v else "Inactive"
        if isinstance(v, datetime):
            v = timezone.localtime(v).strftime("%d/%m/%Y %H:%M")
        elif isinstance(v, date):
            v = v.strftime("%d/%m/%Y")
        elif isinstance(v, time):
            v = v.strftime("%H:%M")
        vals.append(str(v) if v is not None else "—")
    extra = {}
    if kind == "classes":
        extra = {
            "Trạng thái": o.status,
            "Học viên": Enrollment.objects.filter(
                classroom=o, left_at=None, deleted_at=None
            ).count(),
        }
    if kind == "enrollments":
        extra = {"Trạng thái": "Đã rời lớp" if o.left_at else "Đang học"}


    if kind == "grades":
        enrollment = o.enrollment
        classroom = enrollment.classroom
        course = classroom.course
        student = enrollment.student

        return {
            "id": o.pk,
            "values": [
                str(course.name),
                str(student.full_name),
                str(student.username),
                str(classroom.code),
                str(o.exam_type),
            ],
            "extra": {
                "Điểm overall": str(o.overall),
            },
            "archived": bool(getattr(o, "archived_at", None)),
        }


    if kind == "submissions":
        extra = {"Trạng thái": o.status}
    if kind == "retakes":
        extra = {"Kết quả": o.get_status_display(), "Lý do duyệt": o.review_note}
    if kind == "schedules":
        extra = {
            "Thứ": ", ".join(str(x.weekday) for x in o.weekdays.all()),
            "Số buổi": Session.objects.filter(schedule=o, cancelled=False).count(),
        }
    return {
        "id": o.pk,
        "values": vals,
        "extra": extra,
        "archived": bool(getattr(o, "archived_at", None)),
    }


@api
@require_http_methods(["GET", "POST", "PATCH", "DELETE"])
def records(r, kind, pk=None):
    blocked = guard(r)
    if blocked is not None:
        return blocked
    if kind not in MODELS:
        raise Http404
    model = MODELS[kind]
    qs = scoped(model, r.user)
    if hasattr(model, "deleted_at"):
        qs = qs.filter(deleted_at=None)
    obj = qs.filter(pk=pk).first() if pk else None
    if pk and not obj:
        raise Http404
    if r.method == "GET":
        if r.GET.get("form"):
            if not can_write(kind, r.user):
                return denied()
            return JsonResponse(
                {"fields": schema(form_for(kind, r.user, instance=obj))}
            )
        if obj:
            result = row(kind, obj)
            if kind in ["assignments", "submissions"]:
                filt = (
                    {"assignment": obj}
                    if kind == "assignments"
                    else {"submission": obj}
                )
                result["files"] = [
                    {"id": a.pk, "name": a.original_name}
                    for a in Attachment.objects.filter(**filt)
                ]
            if kind == "classes":
                result["members"] = [
                    {
                        "id": e.pk,
                        "student": str(e.student),
                        "status": "Đã rời lớp" if e.left_at else "Đang học",
                    }
                    for e in scoped(Enrollment, r.user).filter(
                        classroom=obj, deleted_at=None
                    )
                ]
                result["sessions"] = [
                    {
                        "id": s.pk,
                        "number": s.number,
                        "date": s.date.strftime("%d/%m/%Y"),
                        "shift": str(s.shift),
                        "room": str(s.room),
                        "cancelled": s.cancelled,
                    }
                    for s in scoped(Session, r.user)
                    .filter(classroom=obj)
                    .order_by("date")
                ]
            if kind == "submissions":
                result["comments"] = [
                    {"id": c.pk, "author": str(c.author), "content": c.content}
                    for c in scoped(Comment, r.user).filter(
                        submission=obj, deleted_at=None
                    )
                ]
            return JsonResponse(result)
        if hasattr(model, "archived_at"):
            qs = qs.filter(archived_at__isnull=r.GET.get("archived") != "1")
        filter_options = []
        for name in FIELDS[kind]:
            field = model._meta.get_field(name)
            if isinstance(field, models.ForeignKey):
                ids = list(qs.values_list(name, flat=True).distinct())
                options = [
                    {"value": str(x.pk), "label": str(x)}
                    for x in field.remote_field.model.objects.filter(pk__in=ids)
                ]
                filter_options.append(
                    {"name": name, "label": str(field.verbose_name), "choices": options}
                )
                selected = r.GET.get("filter_" + name)
                if selected:
                    qs = qs.filter(**{name: selected})
        if kind == "accounts":
            filter_options.append({
                "name": "role",
                "label": "Vai trò",
                "choices": [
                    {"value": code, "label": label}
                    for code, label in Account.ROLE
                ],
            })
            selected_role = r.GET.get("filter_role", "")
            if selected_role in dict(Account.ROLE):
                qs = qs.filter(role=selected_role)
        search = r.GET.get("q", "").strip()[:200]
        # Search visible display columns including foreign key labels.
        objects = [
            o
            for o in qs.order_by("-pk")
            if not search
            or search.casefold() in " ".join(row(kind, o)["values"]).casefold()
        ]
        selected_status = r.GET.get("status", "")
        status_options = {
            "accounts": ["Active", "Inactive"],
            "classes": ["Chưa bắt đầu", "Đang hoạt động", "Đã kết thúc"],
            "enrollments": ["Đang học", "Đã rời lớp"],
            "submissions": [
                "Chưa nộp",
                "Quá hạn",
                "Đã nộp",
                "Nộp muộn",
                "Không hợp lệ",
            ],
            "retakes": ["Chờ duyệt", "Đồng ý", "Từ chối"],
        }.get(kind, [])
        if selected_status:
            objects = [
                o
                for o in objects
                if selected_status
                in row(kind, o)["values"] + list(row(kind, o)["extra"].values())
            ]
        page = max(1, int(r.GET.get("page", 1)))
        total = len(objects)

        if kind == "grades":
            columns = [
                "Tên khóa học",
                "Họ và tên",
                "Mã học viên",
                "Mã lớp",
                "Loại bài kiểm tra",
            ]
        else:
            columns = [
                str(model._meta.get_field(x).verbose_name)
                for x in FIELDS[kind]
            ]

        return JsonResponse(
            {
                "title": TITLES[kind],
                "columns": columns,
                "rows": [row(kind, o) for o in objects[(page - 1) * 10 : page * 10]],
                "total": total,
                "page": page,
                "filters": filter_options,
                "status_options": status_options,
                "can_write": can_write(kind, r.user),
                "role": r.user.role,
            }
        )
    if not can_write(kind, r.user):
        return denied()
    if r.method == "DELETE" and kind == "accounts":
        return denied()
    if kind == "retakes" and obj and obj.status != "pending":
        raise ValidationError("Yêu cầu đã được xử lý.")
    if kind == "submissions" and obj and timezone.now() > obj.allocation.deadline:
        raise ValidationError("Không thể sửa hoặc hủy bài sau hạn nộp.")
    if kind == "submissions" and obj and obj.submitted_at and r.method == "PATCH":
        raise ValidationError("Bài đã nộp. Hãy hủy nộp trước khi thay đổi bài làm.")
    with transaction.atomic():
        if r.method == "DELETE":
            if not obj:
                raise Http404
            if kind == "submissions":
                obj.submitted_at = None
                obj.save()
            elif kind == "comments":
                audit(r.user, "delete", obj)
                obj.delete()
                return JsonResponse({"ok": True})
            else:
                if kind == "schedules":
                    if Allocation.objects.filter(session__schedule=obj).exists():
                        raise ValidationError(
                            "Lịch có buổi được gắn với bài tập; hãy lưu trữ."
                        )
                    Session.objects.filter(
                        schedule=obj, date__gte=timezone.localdate()
                    ).update(cancelled=True)
                if kind in ["courses", "shifts", "classes"]:
                    for rel in obj._meta.related_objects:
                        if getattr(obj, rel.get_accessor_name()).exists():
                            raise ValidationError(
                                "Dữ liệu đang được sử dụng; hãy lưu trữ thay vì xóa."
                            )
                obj.deleted_at = timezone.now()
                obj.save()
            audit(r.user, "delete", obj)
            return JsonResponse({"ok": True})
        payload = data(r)
        if obj and payload.get("_action"):
            action = payload["_action"]
            if action in ["archive", "restore"] and kind in [
                "courses",
                "shifts",
                "classes",
                "schedules",
            ]:
                if action == "restore":
                    validate_active_parents(obj)
                obj.archived_at = timezone.now() if action == "archive" else None
                obj.save()
                if kind == "schedules":
                    if action == "archive":
                        Session.objects.filter(
                            schedule=obj, date__gte=timezone.localdate()
                        ).update(cancelled=True)
                    else:
                        sync_schedule(obj, [x.weekday for x in obj.weekdays.all()])
            elif action == "toggle" and kind == "accounts":
                if obj.pk == r.user.pk:
                    raise ValidationError("Không thể khóa tài khoản đang dùng.")
                obj.is_active = not obj.is_active
                obj.save()
            elif action in ["leave", "rejoin"] and kind == "enrollments":
                obj.left_at = timezone.now() if action == "leave" else None
                obj.save()
            else:
                return denied()
            audit(r.user, action, obj)
            return JsonResponse({"ok": True})
        before = row(kind, obj) if obj else None
        f = form_for(kind, r.user, payload, obj)
        if not f.is_valid():
            return JsonResponse({"error": f.errors.get_json_data()}, status=400)
        target = f.save(commit=False)
        temporary = None
        if kind == "accounts" and not obj:
            temporary = secrets.token_urlsafe(12)
            target.set_password(temporary)
            target.created_by = r.user
        if kind == "assignments":
            if not obj:
                target.teacher = r.user
            else:
                target.edited = True
        if kind in ["comments", "exceptions"]:
            target.author = r.user
            if not target.submission.submitted_at:
                raise ValidationError("Học viên chưa xác nhận nộp bài.")
        if kind == "submissions":
            if target.enrollment.left_at or target.enrollment.deleted_at:
                raise ValidationError("Học viên đã rời lớp.")
            if (
                target.allocation.deleted_at
                or target.allocation.assignment.deleted_at
                or target.allocation.session.cancelled
            ):
                raise ValidationError("Bài tập hoặc buổi học không còn hoạt động.")
            target.submitted_at = timezone.now()
        if kind == "allocations":
            if target.assignment.teacher_id != r.user.pk and not r.user.is_superuser:
                return denied()
            if (
                target.classroom.end_date < timezone.localdate()
                or target.session.cancelled
            ):
                raise ValidationError("Lớp đã kết thúc hoặc buổi học bị hủy.")
        validate_active_parents(target)
        target.save()
        if kind == "schedules":
            sync_schedule(target, [int(x) for x in f.cleaned_data["days"]])
        if kind == "exceptions":
            target.previous = target.submission.status
            target.save()
            sub = target.submission
            sub.invalid = target.next_status == "invalid"
            sub.save()
        if kind == "grades":
            GradeHistory.objects.create(
                grade=target,
                author=r.user,
                before=before or {},
                after=row(kind, target),
            )
        audit(r.user, "update" if obj else "create", target)
        return JsonResponse(
            {"ok": True, "id": target.pk, "temporary_password": temporary}
        )


@api
@require_http_methods(["GET"])
def overview(r):
    blocked = guard(r)
    if blocked is not None:
        return blocked
    classes = classes_for(r.user)
    grades = scoped(Grade, r.user).filter(deleted_at=None)
    submissions = scoped(Submission, r.user).filter(deleted_at=None)
    return JsonResponse(
        {
            "classes": classes.count(),
            "students": scoped(Enrollment, r.user)
            .filter(left_at=None, deleted_at=None)
            .count(),
            "assignments": scoped(Allocation, r.user).filter(deleted_at=None).count(),
            "submitted": submissions.filter(submitted_at__isnull=False).count(),
            "grades": [row("grades", g) for g in grades.order_by("-pk")[:100]],
            "comments": [
                {
                    "student": str(c.submission.enrollment.student),
                    "assignment": str(c.submission.allocation.assignment),
                    "content": c.content,
                }
                for c in scoped(Comment, r.user)
                .filter(deleted_at=None)
                .order_by("-pk")[:100]
            ],
            "upcoming": [
                {
                    "date": str(s.date),
                    "classroom": str(s.classroom),
                    "shift": str(s.shift),
                    "room": str(s.room),
                }
                for s in scoped(Session, r.user)
                .filter(date__gte=timezone.localdate(), cancelled=False)
                .order_by("date")[:12]
            ],
        }
    )


@api
@require_http_methods(["POST"])
def bulk(r, kind):
    blocked = guard(r)
    if blocked is not None:
        return blocked
    if kind not in ["accounts", "grades", "allocations"] or not can_write(kind, r.user):
        return denied()
    d = data(r)
    rows = d.get("rows", [])
    if not 1 <= len(rows) <= 200:
        raise ValidationError("Mỗi lần nhập từ 1 đến 200 dòng.")
    output = []
    with transaction.atomic():
        for index, payload in enumerate(rows, 1):
            f = form_for(kind, r.user, payload)
            if not f.is_valid():
                raise ValidationError(f"Dòng {index}: {f.errors.as_text()}")
            obj = f.save(commit=False)
            password = None
            if kind == "accounts":
                password = secrets.token_urlsafe(12)
                obj.set_password(password)
                obj.created_by = r.user
            if kind == "allocations":
                if obj.assignment.teacher_id != r.user.pk and not r.user.is_superuser:
                    raise ValidationError("Bài tập không thuộc giáo viên hiện tại.")
                if (
                    obj.classroom.end_date < timezone.localdate()
                    or obj.session.cancelled
                ):
                    raise ValidationError("Lớp hoặc buổi học không hoạt động.")
            validate_active_parents(obj)
            obj.save()
            if kind == "grades":
                GradeHistory.objects.create(
                    grade=obj, author=r.user, before={}, after=row(kind, obj)
                )
            audit(r.user, "bulk_create", obj)
            output.append(
                {
                    "code": getattr(obj, "username", obj.pk),
                    "temporary_password": password,
                }
            )
    return JsonResponse({"ok": True, "created": output})


@api
@require_http_methods(["POST"])
def review(r, pk):
    blocked = guard(r)
    if blocked is not None:
        return blocked
    if r.user.role not in ["QLCN", "QLLH"]:
        return denied()
    with transaction.atomic():
        obj = (
            scoped(RetakeRequest, r.user)
            .select_for_update()
            .filter(pk=pk, deleted_at=None)
            .first()
        )
        if not obj:
            raise Http404
        if obj.status != "pending":
            raise ValidationError("Yêu cầu đã được xử lý.")
        d = data(r)
        if (
            d.get("status") not in ["approved", "rejected"]
            or not d.get("note", "").strip()
        ):
            raise ValidationError("Chọn kết quả và nhập lý do xét duyệt.")
        grades = Grade.objects.filter(enrollment=obj.enrollment, deleted_at=None)
        last = grades.order_by("-exam_date").first()
        allocated = Allocation.objects.filter(
            classroom=obj.enrollment.classroom,
            deleted_at=None,
            assignment__deleted_at=None,
        )
        submitted = Submission.objects.filter(
            enrollment=obj.enrollment,
            allocation__in=allocated,
            submitted_at__isnull=False,
            invalid=False,
        ).count()
        rate = (
            Decimal(submitted * 100) / allocated.count()
            if allocated.exists()
            else Decimal(0)
        )
        for criterion in RetakeCriterion.objects.all():
            RetakeEvaluation.objects.create(
                request=obj,
                criterion=criterion,
                score_snapshot=last.overall if last else None,
                submission_rate=rate,
                passed=bool(
                    last
                    and last.overall >= criterion.min_score
                    and rate >= criterion.min_submission_rate
                ),
            )
        obj.status = d["status"]
        obj.review_note = d["note"]
        obj.reviewer = r.user
        obj.reviewed_at = timezone.now()
        obj.save()
        audit(
            r.user,
            "review",
            obj,
            {
                "score": str(last.overall) if last else None,
                "submission_rate": str(rate),
                "note": obj.review_note,
            },
        )
    return JsonResponse(
        {
            "ok": True,
            "submission_rate": str(rate),
            "score": str(last.overall) if last else None,
        }
    )


@api
@require_http_methods(["POST"])
def upload(r, kind, pk):
    blocked = guard(r)
    if blocked is not None:
        return blocked
    if kind not in ["assignments", "submissions"] or not can_write(kind, r.user):
        return denied()
    obj = scoped(MODELS[kind], r.user).filter(pk=pk, deleted_at=None).first()
    if not obj:
        raise Http404
    if kind == "submissions":
        raise ValidationError("Hãy thêm file nháp từ chi tiết bài tập trước khi xác nhận nộp.")
    file = r.FILES.get("file")
    if not file or file.size > 20 * 1024 * 1024:
        raise ValidationError("Tệp phải nhỏ hơn hoặc bằng 20 MB.")
    head = file.read(16)
    file.seek(0)
    ext = file.name.rsplit(".", 1)[-1].lower()
    valid = (
        (ext == "pdf" and head.startswith(b"%PDF-"))
        or (ext == "png" and head.startswith(b"\x89PNG\r\n\x1a\n"))
        or (ext in ["jpg", "jpeg"] and head.startswith(b"\xff\xd8\xff"))
    )
    if ext == "docx" and head.startswith(b"PK"):
        try:
            with zipfile.ZipFile(file) as z:
                valid = (
                    "word/document.xml" in z.namelist()
                    and "[Content_Types].xml" in z.namelist()
                )
        except zipfile.BadZipFile:
            valid = False
        file.seek(0)
    if not valid:
        raise ValidationError("Chỉ nhận PDF, DOCX, PNG hoặc JPEG đúng định dạng.")
    name = file.name[:255]
    file.name = secrets.token_hex(16) + "." + ext
    kwargs = {"assignment": obj} if kind == "assignments" else {"submission": obj}
    attachment = Attachment.objects.create(
        file=file, original_name=name, size=file.size, **kwargs
    )
    audit(r.user, "upload", obj, {"attachment_id": attachment.pk})
    return JsonResponse({"ok": True, "id": attachment.pk})


@require_http_methods(["GET"])
def download(r, pk):
    blocked = guard(r)
    if blocked is not None:
        return blocked
    a = Attachment.objects.filter(pk=pk).first()
    if not a:
        raise Http404
    model = Assignment if a.assignment_id else Submission
    if not scoped(model, r.user).filter(pk=a.assignment_id or a.submission_id).exists():
        return denied()
    response = FileResponse(
        a.file.open("rb"),
        as_attachment=True,
        filename=a.original_name,
        content_type="application/octet-stream",
    )
    response["X-Content-Type-Options"] = "nosniff"
    return response


@api
@require_http_methods(["GET"])
def progress(r):
    blocked = guard(r)
    if blocked is not None:
        return blocked
    from .submission_updates import may_update

    output = []
    members = list(scoped(Enrollment, r.user).filter(
        deleted_at=None, left_at=None).select_related("student", "classroom"))
    classes = scoped(Classroom, r.user).filter(deleted_at=None).order_by("code")
    allocations = list(Allocation.objects.filter(
        classroom__in=classes, deleted_at=None, assignment__deleted_at=None
    ).select_related("assignment", "session", "classroom__course"))
    by_class = {}
    for allocation in allocations:
        by_class.setdefault(allocation.classroom_id, []).append(allocation)
    submissions = list(Submission.objects.filter(
        enrollment__in=members, deleted_at=None).select_related("allocation"))
    by_member_allocation = {(sub.enrollment_id, sub.allocation_id): sub for sub in submissions}
    latest_change = {}
    for exception in SubmissionException.objects.filter(
        submission__in=submissions, deleted_at=None).select_related("submission").order_by("pk"):
        key = (exception.submission.enrollment_id, exception.submission.allocation_id)
        latest_change[key] = (exception.created_at, exception.reason, "")
    for update in SubmissionUpdate.objects.filter(
        enrollment__in=members, allocation__in=allocations).order_by("pk"):
        key = (update.enrollment_id, update.allocation_id)
        previous = latest_change.get(key)
        if not previous or update.created_at > previous[0]:
            latest_change[key] = (update.created_at, update.reason,
                f"/api/progress/updates/{update.pk}/evidence/" if update.evidence else "")
    for member in members:
        for allocation in by_class.get(member.classroom_id, []):
            sub = by_member_allocation.get((member.pk, allocation.pk))
            status = sub.status if sub else (
                "Quá hạn" if timezone.now() > allocation.deadline else "Chưa nộp")
            change = latest_change.get((member.pk, allocation.pk))
            output.append({
                "student": str(member.student),
                "student_name": member.student.full_name,
                "student_code": member.student.username,
                "student_id": member.student_id,
                "enrollment_id": member.pk,
                "classroom": str(member.classroom),
                "classroom_id": member.classroom_id,
                "assignment": allocation.assignment.title,
                "allocation_id": allocation.pk,
                "session_id": allocation.session_id,
                "session": f"Buổi {allocation.session.number}",
                "deadline": timezone.localtime(allocation.deadline).strftime("%d/%m/%Y %H:%M"),
                "status": status,
                "submission_id": sub.pk if sub else None,
                "late_reason": "",
                "change_reason": change[1] if change else "",
                "evidence_url": change[2] if change else "",
                "can_update_submission": may_update(r.user, allocation, member),
                "can_update_exception": bool(can_write("exceptions", r.user) and sub and sub.submitted_at),
            })
    return JsonResponse({
        "rows": output,
        "classes": [{"id": c.pk, "label": str(c), "code": c.code} for c in classes],
        "sessions": [
            {"id": s.pk, "classroom_id": s.classroom_id,
             "label": f"Buổi {s.number}" + (" (đã hủy)" if s.cancelled else ""),
             "date": s.date.isoformat()}
            for s in scoped(Session, r.user).order_by("-date", "-number", "-pk")
        ],
        "allocations": [
            {"id": a.pk, "classroom_id": a.classroom_id, "session_id": a.session_id,
             "label": a.assignment.title} for a in allocations
        ],
        "updated_at": timezone.now().isoformat(),
    })

@api
@require_http_methods(["POST"])
def update_profile(r):
    blocked = guard(r)
    if blocked is not None:
        return blocked

    u = r.user

    # Chỉ nhận các trường được phép sửa.
    u.full_name = r.POST.get("name", "").strip()
    u.gender = r.POST.get("gender", "").strip()
    u.phone = r.POST.get("phone", "").strip()
    u.address = r.POST.get("address", "").strip()

    avatar = r.FILES.get("avatar")

    if avatar:
        import os
        from django.core.files.images import get_image_dimensions

        ext = os.path.splitext(avatar.name)[1].lower()

        if ext not in (".jpg", ".jpeg", ".png"):
            raise ValidationError({
                "avatar": "Chỉ chấp nhận ảnh JPG hoặc PNG."
            })

        if avatar.size > 5 * 1024 * 1024:
            raise ValidationError({
                "avatar": "Ảnh không được vượt quá 5 MB."
            })

        try:
            width, height = get_image_dimensions(avatar)
            if not width or not height:
                raise ValueError()
        except Exception:
            raise ValidationError({
                "avatar": "Tệp ảnh không hợp lệ."
            })

        u.avatar = avatar

    # Kiểm tra tất cả quy tắc trong model.
    u.full_clean()
    u.save()

    return JsonResponse({
        "ok": True,
        "message": "Cập nhật thông tin thành công.",
        "user": user_data(u)
    })

@api
@require_http_methods(["GET"])
def grade_detail(r, grade_id):
    blocked = guard(r)
    if blocked is not None:
        return blocked

    # Chỉ tìm trong các bản ghi mà người dùng có quyền xem.
    selected = (
        scoped(Grade, r.user)
        .filter(pk=grade_id, deleted_at=None)
        .select_related("enrollment__student", "exam_type")
        .first()
    )

    if selected is None:
        raise Http404

    enrollment = selected.enrollment

    # Chỉ lấy điểm của học viên trong đúng lớp được chọn.
    grades = (
        scoped(Grade, r.user)
        .filter(
            enrollment=enrollment,
            deleted_at=None,
            archived_at=None,
        )
        .select_related("exam_type")
        .order_by("exam_date", "pk")
    )

    items = [
        {
            "id": g.pk,
            "exam_type": str(g.exam_type),
            "listening": str(g.listening),
            "speaking": str(g.speaking),
            "reading": str(g.reading),
            "writing": str(g.writing),
            "overall": str(g.overall),
        }
        for g in grades
    ]

    return JsonResponse({
        "student_name": enrollment.student.full_name,
        "student_code": enrollment.student.username,
        "classroom": str(enrollment.classroom),
        "total": len(items),
        "grades": items,
    })
