from django.urls import path, re_path
from django.views.generic import TemplateView
from academy import views, homework

urlpatterns = [
    path("api/homework/", homework.index),
    path("api/homework/<int:pk>/", homework.detail),
    path("api/homework/<int:pk>/submit/", homework.submit),
    path("api/homework/<int:pk>/files/", homework.draft_files),
    path("api/homework/<int:pk>/files/<int:file_id>/", homework.draft_files),
    path("api/auth/<str:action>/", views.auth),
    path("api/overview/", views.overview),
    path("api/progress/", views.progress),
    path("api/bulk/<str:kind>/", views.bulk),
    path("api/retakes/<int:pk>/review/", views.review),
    path("api/files/<int:pk>/", views.download),
    path("api/<str:kind>/<int:pk>/upload/", views.upload),
    path("api/<str:kind>/<int:pk>/", views.records),
    path("api/<str:kind>/", views.records),
    path("", TemplateView.as_view(template_name="index.html")),
]
