#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
for tool in python3 node npm; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Thieu $tool. Hay cai Python 3.12 va Node.js LTS, roi chay lai."
    exit 1
  fi
done
python3 -c 'import sys; assert sys.version_info >= (3,10), "Can Python 3.10 tro len; khuyen nghi Python 3.12"'
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm ci --prefix frontend
npm run build --prefix frontend
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_demo
printf '\nMo trinh duyet: http://127.0.0.1:8000\nTai khoan: quanly@example.com\nMat khau: xem file var/demo-credentials.txt trong thu muc du an.\nDung may chu: Control+C\n\n'
exec .venv/bin/python manage.py runserver 127.0.0.1:8000
