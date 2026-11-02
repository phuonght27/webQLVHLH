"""Production settings for a single Render instance with a persistent disk."""
from .settings import *  # noqa: F403
from django.core.exceptions import ImproperlyConfigured

DEBUG = False
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "")
if len(SECRET_KEY) < 50:
    raise ImproperlyConfigured("Set a random DJANGO_SECRET_KEY of at least 50 characters.")

render_host = os.environ.get("RENDER_EXTERNAL_HOSTNAME", "")
ALLOWED_HOSTS = [
    host.strip() for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "").split(",")
    if host.strip()
]
if render_host:
    ALLOWED_HOSTS.append(render_host)
if not ALLOWED_HOSTS:
    raise ImproperlyConfigured("Set RENDER_EXTERNAL_HOSTNAME or DJANGO_ALLOWED_HOSTS.")
CSRF_TRUSTED_ORIGINS = [f"https://{host}" for host in ALLOWED_HOSTS]
VAR_DIR = Path(os.environ.get("DJANGO_DATA_DIR", "/var/data/academy"))
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": VAR_DIR / "academy.sqlite3",
        "OPTIONS": {"timeout": 20},
    }
}
MEDIA_ROOT = VAR_DIR / "uploads"
EMAIL_FILE_PATH = VAR_DIR / "mail"
STATIC_ROOT = BASE_DIR / "staticfiles"
MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True
SECURE_REDIRECT_EXEMPT = [r"^healthz/$"]
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 3600
ROOT_URLCONF = "config.render_urls"
