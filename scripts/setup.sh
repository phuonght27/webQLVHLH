#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
VENV_PATH="${VENV_PATH:-/workspace/.venvs/webintern}"
python3 -m venv "$VENV_PATH"
"$VENV_PATH/bin/python" -m pip install --cache-dir /workspace/.cache/pip -r requirements.txt
npm ci --prefix frontend --cache /workspace/.cache/npm
npm run build --prefix frontend
"$VENV_PATH/bin/python" manage.py migrate
"$VENV_PATH/bin/python" manage.py check
