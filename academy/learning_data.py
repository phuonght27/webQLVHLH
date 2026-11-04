from django.http import JsonResponse
from django.views.decorators.http import require_GET
from .models import Grade, Allocation, Submission, Comment, Enrollment
from .services import scoped
from .views import api, guard

@api
@require_GET
def learning_summary(request):
    blocked = guard(request)
    if blocked is not None:
        return blocked

    grades = scoped(Grade, request.user).filter(deleted_at=None, archived_at=None).select_related(
        "enrollment__classroom__course", "enrollment__student", "exam_type"
    )
    grade_groups = {}
    for g in grades:
        cl = g.enrollment.classroom
        key = (cl.pk, g.exam_type_id)
        item = grade_groups.setdefault(key, {
            "id": f"{cl.pk}-{g.exam_type_id}", "course": cl.course.name,
            "classroom": cl.code, "exam": str(g.exam_type), "exam_id": g.exam_type_id,
            "records": [],
        })
        item["records"].append({
            "student": g.enrollment.student.full_name, "student_code": g.enrollment.student.username,
            "listening": float(g.listening), "reading": float(g.reading),
            "speaking": float(g.speaking), "writing": float(g.writing),
            "overall": float(g.overall),
        })
    grade_items = []
    for item in grade_groups.values():
        values = item["records"]
        item["overall"] = round(sum(x["overall"] for x in values) / len(values), 2)
        grade_items.append(item)

    members = list(scoped(Enrollment, request.user).filter(
        deleted_at=None, left_at=None
    ).select_related("student", "classroom__course"))
    member_by_class = {}
    for e in members:
        member_by_class.setdefault(e.classroom_id, []).append(e)

    allocations = scoped(Allocation, request.user).filter(
        deleted_at=None, archived_at=None
    ).select_related("classroom__course", "session", "assignment")
    submissions = scoped(Submission, request.user).filter(
        deleted_at=None
    ).select_related("enrollment__student", "allocation")
    sub_map = {(s.allocation_id, s.enrollment_id): s for s in submissions}
    comments = scoped(Comment, request.user).filter(
        deleted_at=None
    ).select_related("submission__allocation__classroom__course",
                     "submission__allocation__session", "submission__enrollment__student")
    comment_map = {}
    for c in comments:
        comment_map.setdefault(c.submission_id, []).append(c.content)

    submission_items, comment_items = [], []
    from django.utils import timezone
    for a in allocations:
        cl = a.classroom
        records = []
        remarks = []
        for e in member_by_class.get(cl.pk, []):
            sub = sub_map.get((a.pk, e.pk))
            status = str(sub.status) if sub else (
                "Quá hạn" if timezone.now() > a.deadline else "Chưa nộp"
            )
            record = {
                "student": e.student.full_name, "student_code": e.student.username,
                "status": status, "submitted_at": timezone.localtime(sub.submitted_at).strftime("%d/%m/%Y %H:%M") if sub and sub.submitted_at else "",
            }
            records.append(record)
            if sub:
                for content in comment_map.get(sub.pk, []):
                    remarks.append({"student": e.student.full_name, "student_code": e.student.username, "content": content})
        base = {
            "id": a.pk, "course": cl.course.name, "classroom": cl.code,
            "session": a.session.number, "session_date": a.session.date.strftime("%d/%m/%Y"),
            "assignment": a.assignment.title, "deadline": timezone.localtime(a.deadline).strftime("%d/%m/%Y %H:%M"),
        }
        submission_items.append({**base, "records": records,
            "status": "Đã nộp" if records and all(r["status"] == "Đã nộp" for r in records) else "Chưa hoàn tất"})
        if remarks:
            comment_items.append({**base, "records": remarks,
                "preview": remarks[0]["content"]})
    return JsonResponse({"grades": grade_items, "submissions": submission_items, "comments": comment_items})
