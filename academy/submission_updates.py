"""Staff updates for submission status, evidence and manually received work."""
import secrets
from pathlib import Path

from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import FileResponse, Http404, JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from .homework import cleanup_files, files_for, save_files, validate_files
from .models import Allocation, Attachment, Enrollment, Submission, SubmissionUpdate
from .services import can_write, scoped
from .views import api, audit, denied, guard


def has_update_permission(user):
    # Class managers may record received work for their own classes; this does
    # not grant them the separate teacher-only moderation/exception actions.
    return user.role != "QLCN" and (user.role == "QLLH" or can_write("exceptions", user))


def may_update(user, allocation, enrollment):
    classroom = allocation.classroom
    in_scope = (user.is_superuser
        or (user.role == "QLLH" and classroom.manager_id == user.pk)
        or (user.role == "GV" and classroom.teacher_id == user.pk and allocation.assignment.teacher_id == user.pk))
    return bool(has_update_permission(user) and in_scope
        and enrollment.classroom_id == allocation.classroom_id
        and not enrollment.deleted_at and not enrollment.left_at
        and not allocation.deleted_at and not allocation.assignment.deleted_at
        and not allocation.session.cancelled
        and not classroom.archived_at and not classroom.deleted_at
        and not classroom.course.archived_at and not classroom.course.deleted_at)


def current_status(allocation, submission):
    return submission.status if submission else (
        "Quá hạn" if timezone.now() > allocation.deadline else "Chưa nộp")


def get_targets(user, allocation_id, enrollment_id, lock=False):
    allocations = scoped(Allocation, user).filter(deleted_at=None, assignment__deleted_at=None)
    enrollments = scoped(Enrollment, user).filter(deleted_at=None)
    if lock:
        allocations = allocations.select_for_update()
        enrollments = enrollments.select_for_update()
    allocation = allocations.select_related("assignment", "session", "classroom__course").filter(pk=allocation_id).first()
    if not allocation:
        raise Http404
    enrollment = enrollments.select_related("student").filter(pk=enrollment_id, classroom_id=allocation.classroom_id).first()
    if not enrollment:
        raise Http404
    if not may_update(user, allocation, enrollment):
        raise ValidationError("Lớp, học viên hoặc buổi học không còn cho phép cập nhật.")
    return allocation, enrollment


@api
@require_http_methods(["GET", "POST"])
def update_submission(r, allocation_id, enrollment_id):
    blocked = guard(r)
    if blocked is not None:
        return blocked
    if not has_update_permission(r.user):
        return denied()
    if r.method == "GET":
        allocation, enrollment = get_targets(r.user, allocation_id, enrollment_id)
        sub = Submission.objects.filter(allocation=allocation, enrollment=enrollment, deleted_at=None).first()
        return JsonResponse({
            "student_code": enrollment.student.username,
            "student_name": enrollment.student.full_name,
            "classroom": allocation.classroom.code,
            "session": f"Buổi {allocation.session.number}",
            "assignment": allocation.assignment.title,
            "deadline": timezone.localtime(allocation.deadline).strftime("%d/%m/%Y %H:%M"),
            "status": current_status(allocation, sub),
            "can_mark_invalid": r.user.role == "GV",
            "can_mark_late": r.user.role == "QLLH",
            "files": files_for(submission=sub) if sub else [],
        })
    requested_status = r.POST.get("status", "keep")
    if requested_status not in ["keep", "invalid", "late"]:
        raise ValidationError("Trạng thái cập nhật không hợp lệ.")
    if requested_status == "invalid" and r.user.role != "GV":
        return denied()
    if requested_status == "late" and r.user.role != "QLLH":
        return denied()
    reason = r.POST.get("reason", "").strip()
    if not reason or len(reason) > 500:
        raise ValidationError("Lý do cập nhật bắt buộc, tối đa 500 ký tự.")
    if len(r.FILES.getlist("evidence")) > 1 or len(r.FILES.getlist("work_file")) > 1:
        raise ValidationError("Mỗi khu vực chỉ được chọn một tệp.")
    evidence, work_file = r.FILES.get("evidence"), r.FILES.get("work_file")
    if evidence:
        validate_files([evidence], limit=1)
    if work_file:
        validate_files([work_file], limit=1)
    saved_work, saved_evidence = [], []
    try:
        with transaction.atomic():
            allocation, enrollment = get_targets(r.user, allocation_id, enrollment_id, lock=True)
            sub = Submission.objects.select_for_update().filter(allocation=allocation, enrollment=enrollment).first()
            if sub and sub.deleted_at:
                raise ValidationError("Bài nộp đã bị xóa, không thể cập nhật.")
            if requested_status == "invalid" and not (sub and sub.submitted_at) and not work_file:
                raise ValidationError("Chỉ được đánh dấu Không hợp lệ khi học viên đã nộp bài hoặc có tệp bài làm được ghi nhận.")
            if requested_status == "late":
                if not (sub and sub.submitted_at) and not work_file:
                    raise ValidationError("Cần có bài đã nộp hoặc tải tệp bài làm để ghi nhận Nộp muộn.")
                if sub and sub.invalid:
                    raise ValidationError("Bài đã bị giáo viên đánh dấu Không hợp lệ, không được thay đổi quyết định này.")
                if timezone.now() <= allocation.deadline:
                    raise ValidationError("Chưa qua hạn nộp, không thể ghi nhận Nộp muộn.")
            previous = current_status(allocation, sub)
            record = SubmissionUpdate(allocation=allocation, enrollment=enrollment, author=r.user,
                reason=reason, previous_status=previous)
            if work_file:
                existing_files = list(Attachment.objects.filter(submission=sub)) if sub else []
                validate_files([work_file], existing_files)
                if not sub:
                    sub = Submission.objects.create(allocation=allocation, enrollment=enrollment, content="")
                save_files([work_file], saved_work, submission=sub)
                record.work_attachment = saved_work[0]
                record.work_name = saved_work[0].original_name
                record.work_size = saved_work[0].size
                # Record when the newly received work is actually submitted.
                # An invalid moderation decision is never silently lifted here.
                sub.submitted_at = timezone.now()
                sub.save(update_fields=["submitted_at", "updated_at"])
            if requested_status == "late":
                sub.late_override = True
                sub.save(update_fields=["late_override", "updated_at"])
            if requested_status == "invalid":
                sub.invalid = True
                sub.save(update_fields=["invalid", "updated_at"])
            if evidence:
                record.evidence_name, record.evidence_size = evidence.name, evidence.size
                name = secrets.token_hex(16) + Path(evidence.name).suffix.lower()
                record.evidence.save(name, evidence, save=False)
                saved_evidence.append((record.evidence.storage, record.evidence.name))
            record.next_status = current_status(allocation, sub)
            record.save()
            audit(r.user, "update_submission", record, {
                "allocation_id": allocation.pk, "enrollment_id": enrollment.pk,
                "previous_status": previous, "next_status": record.next_status,
                "work_attachment_id": record.work_attachment_id,
            })
    except Exception:
        cleanup_files(saved_work)
        for storage, name in saved_evidence:
            storage.delete(name)
        raise
    return JsonResponse({"ok": True, "id": record.pk, "status": record.next_status})


@api
@require_http_methods(["GET"])
def evidence_download(r, pk):
    blocked = guard(r)
    if blocked is not None:
        return blocked
    if r.user.role not in ["QLCN", "QLLH", "GV"] and not r.user.is_superuser:
        return denied()
    record = SubmissionUpdate.objects.filter(pk=pk, enrollment__in=scoped(Enrollment, r.user)).first()
    if not record or not record.evidence:
        raise Http404
    response = FileResponse(record.evidence.open("rb"), as_attachment=True,
        filename=record.evidence_name, content_type="application/octet-stream")
    response["X-Content-Type-Options"] = "nosniff"
    response["Cache-Control"] = "private, no-store"
    return response
