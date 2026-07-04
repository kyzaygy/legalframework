#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "Файл .env не найден. Создайте его по образцу .env.example (см. DEPLOY.md)." >&2
  exit 1
fi

set -a
. ./.env
set +a

POSTGRES_USER="${POSTGRES_USER:-kodeksy}"
POSTGRES_DB="${POSTGRES_DB:-kodeksy}"

echo "==> 1/5 Сборка образов"
# Приложение работает от пользователя node (uid 1000); хостовый каталог кэша
# loader'а монтируется в контейнер и должен принадлежать этому uid.
mkdir -p loader/.cache/raw
chown -R 1000:1000 loader/.cache 2>/dev/null || true
docker compose build

echo "==> 2/5 Запуск базы данных"
docker compose up -d db
echo "    ожидание готовности PostgreSQL..."
until docker compose exec -T db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
  sleep 2
done

echo "==> 3/5 Применение миграций и полнотекстового индекса"
docker compose run --rm app npx prisma migrate deploy

echo "==> 4/5 Запуск приложения и Caddy (TLS выпустится автоматически)"
docker compose up -d

echo "==> 5/5 Загрузка корпуса с pravo.gov.ru (это может занять несколько минут)"
docker compose run --rm app npm run import:all

echo "==> Проверка количества загруженных данных"
docker compose exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  'SELECT (SELECT count(*) FROM "Code") AS codes, (SELECT count(*) FROM "StructuralUnit") AS units, (SELECT count(*) FROM "Article") AS articles;'

echo ""
echo "Готово. Откройте https://legalframework.ru"
echo "Если сертификат ещё не выпустился — подождите до минуты и обновите страницу."
