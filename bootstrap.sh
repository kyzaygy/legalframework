#!/usr/bin/env bash
set -euo pipefail

REPO="https://github.com/kyzaygy/legalframework.git"
DIR="/opt/legalframework"

echo "==> Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

echo "==> Исходники в ${DIR}"
if [ ! -d "${DIR}/.git" ]; then
  command -v git >/dev/null 2>&1 || { apt-get update && apt-get install -y git; }
  git clone "${REPO}" "${DIR}"
fi
cd "${DIR}"
git pull --ff-only || true

echo "==> .env"
if [ ! -f .env ]; then
  command -v openssl >/dev/null 2>&1 || { apt-get update && apt-get install -y openssl; }
  cat > .env <<EOF
POSTGRES_USER=kodeksy
POSTGRES_PASSWORD=$(openssl rand -hex 24)
POSTGRES_DB=kodeksy
SITE_URL=https://legalframework.ru
EOF
  chmod 600 .env
  echo "    создан .env со сгенерированным паролем БД"
else
  echo "    .env уже существует, оставляю как есть"
fi

echo "==> Firewall (22, 80, 443)"
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp || true
  ufw allow 80/tcp || true
  ufw allow 443/tcp || true
  ufw --force enable || true
fi

echo "==> Деплой"
chmod +x deploy.sh
./deploy.sh
