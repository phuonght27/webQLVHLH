#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
VENV_PATH="${VENV_PATH:-/workspace/.venvs/webintern}"
"$VENV_PATH/bin/python" manage.py check
exec "$VENV_PATH/bin/python" manage.py runserver "${BIND_ADDRESS:-127.0.0.1:8000}" --noreload
