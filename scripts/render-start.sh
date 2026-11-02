#!/usr/bin/env bash
set -euo pipefail
: "${DJANGO_DATA_DIR:?Set DJANGO_DATA_DIR to a persistent disk directory}"
umask 077
mkdir -p "$DJANGO_DATA_DIR"
python manage.py migrate --noinput
exec gunicorn config.wsgi:application --bind "0.0.0.0:${PORT:-10000}" --workers 1 --threads 4 --timeout 120 --access-logfile - --error-logfile -
