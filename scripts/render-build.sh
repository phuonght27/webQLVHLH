#!/usr/bin/env bash
set -euo pipefail
python -m pip install -r requirements-render.txt
npm ci --prefix frontend
npm run build --prefix frontend
python manage.py collectstatic --noinput
python manage.py check --deploy --fail-level ERROR
