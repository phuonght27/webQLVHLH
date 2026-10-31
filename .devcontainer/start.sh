#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ ! -x .venv/bin/python || ! -f frontend/dist/index.html ]]; then
  bash .devcontainer/setup.sh
fi
# Reuse a healthy instance on this Codespace's private forwarded port.
if .venv/bin/python -c 'import urllib.request; urllib.request.urlopen("http://127.0.0.1:8000/api/auth/session/", timeout=2)' >/dev/null 2>&1; then
  echo 'Website is already running on port 8000.'
  exit 0
fi
nohup .venv/bin/python manage.py runserver 0.0.0.0:8000 --noreload > /tmp/webintern-server.log 2>&1 < /dev/null &
.venv/bin/python - <<'PY'
import time, urllib.request
for attempt in range(20):
    try:
        with urllib.request.urlopen('http://127.0.0.1:8000/api/auth/session/', timeout=2) as response:
            if response.status == 200:
                print('Website ready. Open port 8000 in the Ports tab.')
                break
    except OSError:
        time.sleep(1)
else:
    raise SystemExit('Startup failed. Inspect /tmp/webintern-server.log.')
PY
