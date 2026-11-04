
from django.urls import path, re_path
from django.views.generic import TemplateView
from django.conf import settings
from django.conf.urls.static import static
from academy import views, homework, submission_updates
from academy import class_management, grade_entry, learning_data, retake_lookup

urlpatterns = [
    path("api/retake/student-lookup/", retake_lookup.retake_student_lookup),
    path("api/learning-data/", learning_data.learning_summary),
    path("api/grade-entry/options/", grade_entry.grade_entry_options),
    path("api/class-management/sessions/<int:pk>/visibility/", class_management.session_visibility),
    path("api/class-management/options/", class_management.options),
    path("api/class-management/<str:kind>/", class_management.manage),
    path("api/class-management/<str:kind>/<int:pk>/", class_management.manage),
    path("api/homework/", homework.index),
    path("api/homework/assignments/<int:pk>/", homework.assignment_editor),
    path("api/files/<int:pk>/preview/", views.download, {"preview": True}),
    path("api/homework/<int:pk>/", homework.detail),
    path("api/homework/<int:pk>/submit/", homework.submit),
    path("api/homework/<int:pk>/files/", homework.draft_files),
    path("api/homework/<int:pk>/files/<int:file_id>/", homework.draft_files),

    path("api/grade-entry/options/", grade_entry.grade_entry_options),
    path("api/auth/<str:action>/", views.auth),
    path("api/overview/", views.overview),
    path("api/progress/", views.progress),
    path("api/progress/<int:allocation_id>/<int:enrollment_id>/update/", submission_updates.update_submission),
    path("api/progress/updates/<int:pk>/evidence/", submission_updates.evidence_download),
    path("api/bulk/<str:kind>/", views.bulk),
    path("api/retakes/<int:pk>/review/", views.review),
    path("api/files/<int:pk>/", views.download),
    path("api/grades/<int:grade_id>/detail/", views.grade_detail),

    path("api/<str:kind>/<int:pk>/upload/", views.upload),
    path("api/<str:kind>/<int:pk>/", views.records),
    path("api/<str:kind>/", views.records),

    path("api/profile/update/", views.update_profile),

    path("", TemplateView.as_view(template_name="index.html")),
]

if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT
    )
