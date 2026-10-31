import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
VAR_DIR = BASE_DIR / "var"
VAR_DIR.mkdir(exist_ok=True)
# Persist a private development key locally; production must inject its own key.
key_file = VAR_DIR / "secret.key"
if not key_file.exists():
    import secrets

    key_file.write_text(secrets.token_urlsafe(64))
    key_file.chmod(0o600)
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY") or key_file.read_text()
DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = os.environ.get(
    "DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,testserver"
).split(",")
# Trust only this Codespace's exact HTTPS preview host, keeping CSRF enabled.
CSRF_TRUSTED_ORIGINS = []
if os.environ.get("CODESPACES") == "true" and os.environ.get("CODESPACE_NAME"):
    preview_domain = os.environ.get("GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN", "app.github.dev")
    preview_host = f"{os.environ['CODESPACE_NAME']}-8000.{preview_domain}"
    ALLOWED_HOSTS.append(preview_host)
    CSRF_TRUSTED_ORIGINS.append(f"https://{preview_host}")

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.staticfiles",
    "academy",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
ROOT_URLCONF = "config.urls"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "frontend/dist"],
        "APP_DIRS": True,
    }
]
WSGI_APPLICATION = "config.wsgi.application"
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": VAR_DIR / "academy.sqlite3",
        "OPTIONS": {"timeout": 20},
    }
}
if os.environ.get("POSTGRES_DB"):
    DATABASES["default"] = {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ["POSTGRES_DB"],
        "USER": os.environ["POSTGRES_USER"],
        "PASSWORD": os.environ.get("POSTGRES_PASSWORD", ""),
        "HOST": os.environ.get("POSTGRES_HOST", "localhost"),
        "PORT": os.environ.get("POSTGRES_PORT", "5432"),
    }
AUTH_USER_MODEL = "academy.Account"
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 10},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]
LANGUAGE_CODE = "vi"
TIME_ZONE = "Asia/Ho_Chi_Minh"
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
STATIC_URL = "/assets/"
STATICFILES_DIRS = (
    [BASE_DIR / "frontend/dist/assets"]
    if (BASE_DIR / "frontend/dist/assets").exists()
    else []
)
MEDIA_ROOT = VAR_DIR / "uploads"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
EMAIL_BACKEND = os.environ.get(
    "EMAIL_BACKEND", "django.core.mail.backends.filebased.EmailBackend"
)
EMAIL_FILE_PATH = VAR_DIR / "mail"
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "noreply@toeiclab.local")
EMAIL_HOST = os.environ.get("EMAIL_HOST", "localhost")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = True
