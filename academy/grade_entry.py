from django.http import JsonResponse
from django.views.decorators.http import require_GET
from .models import Enrollment, ExamType, Grade
from .services import classes_for, can_write, scoped
from .views import api, guard, denied

@api
@require_GET
def grade_entry_options(request):
    blocked = guard(request)
    if blocked is not None:
        return blocked
    if not can_write("grades", request.user):
        return denied()
    classes = classes_for(request.user).filter(
        deleted_at=None, archived_at=None,
        course__deleted_at=None, course__archived_at=None,
    ).select_related("course").order_by("code")
    if request.user.role == "GV" and not request.user.is_superuser:
        classes = classes.filter(teacher=request.user)
    class_id = request.GET.get("classroom", "")
    chosen = classes.filter(pk=class_id).first() if class_id.isdigit() else None
    members = []
    if chosen:
        enrollments = Enrollment.objects.filter(
            classroom=chosen, deleted_at=None, left_at=None,
            student__is_active=True,
        ).select_related("student").order_by("student__full_name")
        members = [{
            "enrollment": e.pk,
            "name": e.student.full_name,
            "student_code": e.student.username,
            "class_code": chosen.code,
            "course": chosen.course.name,
            "used_exam_types": list(Grade.objects.filter(enrollment=e, deleted_at=None).values_list("exam_type_id", flat=True)),
        } for e in enrollments]
    grade_id = request.GET.get("grade", "")
    selected = None
    if grade_id.isdigit():
        grade = scoped(Grade, request.user).filter(pk=int(grade_id), deleted_at=None).select_related(
            "enrollment__student", "enrollment__classroom__course"
        ).first()
        if grade and classes.filter(pk=grade.enrollment.classroom_id).exists():
            e = grade.enrollment
            selected = {
                "enrollment": e.pk, "name": e.student.full_name,
                "student_code": e.student.username,
                "class_code": e.classroom.code,
                "course": e.classroom.course.name,
                "overall": str(grade.overall),
                "used_exam_types": list(Grade.objects.filter(
                    enrollment=e, deleted_at=None
                ).values_list("exam_type_id", flat=True)),
            }
    return JsonResponse({
        "selected": selected,
        "classes": [{"id": c.pk, "code": c.code,
                     "label": f"{c.code} - {c.course.name}"} for c in classes],
        "exam_types": [{"id": t.pk, "name": t.name} for t in ExamType.objects.order_by("name")],
        "members": members,
    })
