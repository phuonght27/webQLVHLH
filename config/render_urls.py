from django.http import JsonResponse
from django.urls import path
from .urls import urlpatterns as app_urls


def health(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [path("healthz/", health), *app_urls]
