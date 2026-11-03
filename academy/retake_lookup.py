from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.db.models import Q
from django.utils import timezone
from .models import Enrollment, Allocation, Submission, Grade
from .views import api, guard, denied

@api
@require_GET
def retake_student_lookup(request):
    blocked = guard(request)
    if blocked is not None:
        return blocked
    if request.user.role != "QLLH" and not request.user.is_superuser:
        return denied()
    code = request.GET.get("student_code", "").strip()
    class_code = request.GET.get("class_code", "").strip()
    if not code:
        return JsonResponse({"error": "Vui lòng nhập mã học viên."}, status=400)
    enrollments = Enrollment.objects.filter(
        student__username__iexact=code, student__role="HV",
        student__is_active=True, deleted_at__isnull=True, left_at__isnull=True,
        classroom__deleted_at__isnull=True,
    ).select_related("student", "classroom__course")
    if not request.user.is_superuser:
        enrollments = enrollments.filter(classroom__manager=request.user)
    if class_code:
        enrollments = enrollments.filter(classroom__code__iexact=class_code)
    enrollments = list(enrollments.order_by("classroom__code"))
    if not enrollments:
        return JsonResponse({"error": "Không tìm thấy học viên trong lớp do bạn quản lý."}, status=404)
    classes = [{"code": e.classroom.code, "course": e.classroom.course.name} for e in enrollments]
    if len(enrollments) > 1:
        return JsonResponse({"multiple": True, "classes": classes})
    e = enrollments[0]
    allocations = Allocation.objects.filter(
        classroom=e.classroom, deleted_at__isnull=True, archived_at__isnull=True
    )
    total = allocations.count()
    submitted = Submission.objects.filter(
        allocation__in=allocations, enrollment=e, deleted_at__isnull=True,
        submitted_at__isnull=False, invalid=False,
    ).values("allocation_id").distinct().count()
    grades = Grade.objects.filter(
        enrollment=e, deleted_at__isnull=True, archived_at__isnull=True
    ).select_related("exam_type").order_by("exam_date")
    grade_items = [{"exam_type": g.exam_type.name, "date": g.exam_date.isoformat(), "overall": float(g.overall)} for g in grades]
    input_grades = [g for g in grades if "đầu vào" in g.exam_type.name.casefold() or "dau vao" in g.exam_type.name.casefold() or "placement" in g.exam_type.name.casefold()]
    input_score = float(input_grades[-1].overall) if input_grades else None
    return JsonResponse({
        "multiple": False, "classes": classes,
        "student": {"code": e.student.username, "name": e.student.full_name},
        "classroom": {"code": e.classroom.code, "course": e.classroom.course.name,
                      "end_date": e.classroom.end_date.isoformat()},
        "learning": {"missing_assignments": max(0, total - submitted),
                     "input_score": input_score,
                     "grades": grade_items},
    })
