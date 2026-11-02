"""Role-specific assignment, submission and feedback workflow."""
import json
import re
import secrets
import zipfile
from pathlib import Path

from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import Http404, JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from .models import Assignment, Allocation, Attachment, Comment, Enrollment, Submission, Classroom, Session
from .services import scoped, classes_for, validate_active_parents
from .views import api, guard, denied, audit, data, form_for


def files_for(**owner):
    return [{"id": f.pk, "name": f.original_name, "size": f.size}
            for f in Attachment.objects.filter(**owner).order_by("pk")]


def comments_for(submission):
    return [{"id": c.pk, "author": c.author.full_name, "content": c.content,
             "created_at": c.created_at.isoformat()}
            for c in Comment.objects.filter(submission=submission, deleted_at=None)
            .select_related("author").order_by("created_at", "pk")]


def submission_data(sub):
    return {"id": sub.pk, "student": sub.enrollment.student.full_name,
            "student_code": sub.enrollment.student.username,
            "enrollment": sub.enrollment_id, "status": sub.status,
            "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
            "content": sub.content, "files": files_for(submission=sub),
            "comments": comments_for(sub)}


def allocation_data(a):
    return {"id": a.pk, "classroom_id": a.classroom_id,
            "classroom": str(a.classroom), "session_id": a.session_id,
            "session": f"Buổi {a.session.number}", "date": a.session.date.isoformat(),
            "deadline": a.deadline.isoformat(), "title": a.assignment.title,
            "assignment_id": a.assignment_id, "description": a.assignment.description,
            "teacher": a.assignment.teacher.full_name}


def visible_allocations(user):
    qs = scoped(Allocation, user).filter(deleted_at=None, assignment__deleted_at=None)
    if user.role == "GV":
        qs = qs.filter(assignment__teacher=user)
    return qs.select_related("assignment__teacher", "classroom__course", "session")


def get_allocation(user, pk):
    a = visible_allocations(user).filter(pk=pk).first()
    if not a:
        raise Http404
    return a


def writable_enrollment(user, allocation):
    if user.role != "HV":
        raise ValidationError("Chỉ học viên được nộp bài.")
    e = Enrollment.objects.filter(student=user, classroom=allocation.classroom,
                                  deleted_at=None, left_at=None).first()
    if not e or allocation.session.cancelled:
        raise ValidationError("Bạn không thể nộp bài cho lớp hoặc buổi học này.")
    validate_active_parents(allocation)
    return e


def validate_files(files, existing=(), limit=10):
    if limit is not None and len(files) + len(existing) > limit:
        raise ValidationError(f"Chỉ được tải tối đa {limit} file.")
    seen = {(f.original_name, f.size) for f in existing}
    for f in files:
        if f.size > 20 * 1024 * 1024:
            raise ValidationError("Dung lượng file vượt quá giới hạn cho phép (20MB).")
        if len(f.name) > 255 or re.search(r'[\\/:*?"<>|]', f.name):
            raise ValidationError("Tên file chứa ký tự không hợp lệ hoặc dài quá 255 ký tự.")
        if (f.name, f.size) in seen:
            raise ValidationError("File đã tồn tại trong danh sách tải lên.")
        seen.add((f.name, f.size))
        head = f.read(16)
        f.seek(0)
        ext = Path(f.name).suffix.lower()
        valid = ((ext == ".pdf" and head.startswith(b"%PDF-"))
                 or (ext == ".png" and head.startswith(b"\x89PNG\r\n\x1a\n"))
                 or (ext in (".jpg", ".jpeg") and head.startswith(b"\xff\xd8\xff")))
        if ext == ".docx" and head.startswith(b"PK"):
            try:
                with zipfile.ZipFile(f) as z:
                    valid = {"word/document.xml", "[Content_Types].xml"} <= set(z.namelist())
            except zipfile.BadZipFile:
                valid = False
            f.seek(0)
        if not valid:
            raise ValidationError("Chỉ nhận PDF, DOCX, PNG hoặc JPEG đúng định dạng.")


def save_files(files, saved, **owner):
    for f in files:
        name = f.name
        f.name = secrets.token_hex(16) + Path(name).suffix.lower()
        attachment = Attachment(file=f, original_name=name, size=f.size, **owner)
        # Track the storage object even if the database insert fails.
        saved.append(attachment)
        attachment.save()


def cleanup_files(saved):
    for attachment in saved:
        if attachment.file and attachment.file._committed:
            attachment.file.delete(save=False)


@api
@require_http_methods(["GET", "POST"])
def index(r):
    blocked = guard(r)
    if blocked is not None:
        return blocked
    if r.method == "GET":
        if r.GET.get("options"):
            if r.user.role != "GV":
                return denied()
            today = timezone.localdate()
            classes = classes_for(r.user).filter(
                archived_at=None, start_date__lte=today, end_date__gte=today,
                course__archived_at=None, course__deleted_at=None)
            return JsonResponse({"classes": [
                {"id": c.pk, "label": str(c), "sessions": [
                    {"id": s.pk, "label": f"Buổi {s.number} · {s.date:%d/%m/%Y}"}
                    for s in Session.objects.filter(classroom=c, cancelled=False,
                                                     date__lte=today).order_by("-date")
                ]} for c in classes.order_by("code")]})
        allocations = visible_allocations(r.user)
        if r.user.role == "HV":
            rows = []
            for a in allocations.order_by("-session__date", "-pk"):
                sub = Submission.objects.filter(allocation=a, enrollment__student=r.user,
                                                deleted_at=None).first()
                item = allocation_data(a)
                item.update(status=sub.status if sub else (
                    "Quá hạn" if timezone.now() > a.deadline else "Chưa nộp"),
                    comments=comments_for(sub) if sub else [])
                rows.append(item)
        else:
            rows = []
            for assignment in scoped(Assignment, r.user).filter(deleted_at=None).order_by("-pk"):
                rows.append({"id": assignment.pk, "title": assignment.title,
                             "description": assignment.description,
                             "allocations": [allocation_data(a) for a in allocations.filter(assignment=assignment)],
                             "files": files_for(assignment=assignment)})
        return JsonResponse({"rows": rows})
    if r.user.role != "GV":
        return denied()
    payload = json.loads(r.POST.get("payload", "{}"))
    if not isinstance(payload, dict):
        raise ValidationError("Thông tin bài tập không hợp lệ.")
    title = str(payload.get("title", "")).strip()
    errors = {}
    if not title or len(title) > 255:
        errors["title"] = "Tiêu đề bài tập bắt buộc, tối đa 255 ký tự."
    rows = payload.get("classes", [])
    if not isinstance(rows, list) or not rows:
        errors["classes"] = "Vui lòng chọn ít nhất một lớp."
    if errors:
        raise ValidationError(errors)
    files = r.FILES.getlist("files")
    validate_files(files, limit=None)
    saved = []
    try:
        with transaction.atomic():
            assignment = Assignment.objects.create(title=title, description=payload.get("description", ""), teacher=r.user)
            seen = set()
            for row in rows:
                if not isinstance(row, dict):
                    raise ValidationError("Thông tin lớp không hợp lệ.")
                c = classes_for(r.user).filter(pk=row.get("classroom"), archived_at=None,
                    start_date__lte=timezone.localdate(), end_date__gte=timezone.localdate()).first()
                if not c or c.pk in seen:
                    raise ValidationError("Lớp đã kết thúc, chưa bắt đầu, bị trùng hoặc không thuộc phân công.")
                seen.add(c.pk)
                form = form_for("allocations", r.user, {**row, "assignment": assignment.pk})
                if not form.is_valid():
                    raise ValidationError(f"{c}: " + "; ".join(str(e) for es in form.errors.values() for e in es))
                allocation = form.save(commit=False)
                validate_active_parents(allocation)
                allocation.save()
            save_files(files, saved, assignment=assignment)
            audit(r.user, "assign_homework", assignment, {"classes": list(seen)})
    except Exception:
        cleanup_files(saved)
        raise
    return JsonResponse({"ok": True, "id": assignment.pk}, status=201)


@api
@require_http_methods(["GET"])
def detail(r, pk):
    blocked = guard(r)
    if blocked is not None:
        return blocked
    a = get_allocation(r.user, pk)
    result = allocation_data(a)
    result["files"] = files_for(assignment=a.assignment)
    if r.user.role == "HV":
        sub = Submission.objects.filter(allocation=a, enrollment__student=r.user, deleted_at=None).first()
        result["submission"] = submission_data(sub) if sub else None
        result["can_submit"] = bool(Enrollment.objects.filter(classroom=a.classroom, student=r.user,
            deleted_at=None, left_at=None).exists() and not a.session.cancelled
            and not a.classroom.archived_at and not a.classroom.deleted_at
            and not a.classroom.course.archived_at and not a.classroom.course.deleted_at
            and not (sub and sub.submitted_at))
        result["can_cancel"] = bool(sub and sub.submitted_at and timezone.now() <= a.deadline)
    else:
        roster = []
        for e in Enrollment.objects.filter(classroom=a.classroom, deleted_at=None).select_related("student"):
            sub = Submission.objects.filter(allocation=a, enrollment=e, deleted_at=None).first()
            # Draft uploads are private until the student confirms submission.
            if sub and sub.submitted_at:
                roster.append(submission_data(sub))
            elif not e.left_at:
                roster.append({"id": None, "student": e.student.full_name,
                    "student_code": e.student.username, "enrollment": e.pk,
                    "status": "Quá hạn" if timezone.now() > a.deadline else "Chưa nộp",
                    "submitted_at": None, "files": [], "comments": []})
        result["students"] = roster
    return JsonResponse(result)


@api
@require_http_methods(["POST", "DELETE"])
def submit(r, pk):
    blocked = guard(r)
    if blocked is not None:
        return blocked
    a = get_allocation(r.user, pk)
    e = writable_enrollment(r.user, a)
    with transaction.atomic():
        sub = Submission.objects.select_for_update().filter(allocation=a, enrollment=e, deleted_at=None).first()
        if not sub:
            raise ValidationError("Vui lòng tải ít nhất một file bài làm trước khi nộp.")
        if r.method == "DELETE":
            if timezone.now() > a.deadline:
                raise ValidationError("Không thể hủy bài sau hạn nộp.")
            sub.submitted_at = None
            sub.save(update_fields=["submitted_at"])
            audit(r.user, "cancel_submission", sub)
        else:
            if sub.submitted_at:
                raise ValidationError("Bài đã nộp. Hãy hủy nộp trước khi thay đổi.")
            if not Attachment.objects.filter(submission=sub).exists():
                raise ValidationError("Vui lòng tải ít nhất một file bài làm trước khi nộp.")
            sub.submitted_at = timezone.now()
            sub.save(update_fields=["submitted_at"])
            audit(r.user, "submit_homework", sub)
    return JsonResponse({"ok": True})


@api
@require_http_methods(["POST", "DELETE"])
def draft_files(r, pk, file_id=None):
    blocked = guard(r)
    if blocked is not None:
        return blocked
    a = get_allocation(r.user, pk)
    e = writable_enrollment(r.user, a)
    saved = []
    try:
        with transaction.atomic():
            sub, _ = Submission.objects.select_for_update().get_or_create(
                allocation=a, enrollment=e, defaults={"content": ""})
            if sub.deleted_at or sub.submitted_at:
                raise ValidationError("Bài đã nộp. Hãy hủy nộp trước khi thay đổi file.")
            if r.method == "DELETE":
                f = Attachment.objects.filter(pk=file_id, submission=sub).first()
                if not f:
                    raise Http404
                storage, name = f.file.storage, f.file.name
                f.delete()
                transaction.on_commit(lambda: storage.delete(name))
            else:
                files = r.FILES.getlist("files")
                if not files:
                    raise ValidationError("Chọn ít nhất một file bài làm.")
                validate_files(files, list(Attachment.objects.filter(submission=sub)))
                save_files(files, saved, submission=sub)
            audit(r.user, "update_draft_files", sub)
    except Exception:
        cleanup_files(saved)
        raise
    return JsonResponse({"ok": True, "files": files_for(submission=sub)})
