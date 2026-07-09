# Кодексы и Конституция РФ

Сайт со всеми действующими кодексами РФ и Конституцией в актуальной редакции.
Серверный рендеринг, навигация по структуре кодекса, поиск по реквизиту и
полнотекстовый поиск. Источник данных — официальный портал `pravo.gov.ru`.

## Стек

- Next.js (App Router) + TypeScript, SSR/SSG страниц.
- PostgreSQL + Prisma, полнотекстовый поиск на встроенной конфигурации `russian`.
- Модуль загрузки данных — скрипты на TypeScript (`loader/`).
- Docker Compose: приложение + PostgreSQL.

## Структура

- `prisma/` — схема и миграции (включая SQL-миграцию полнотекстового индекса).
- `loader/` — загрузка с `pravo.gov.ru`: разбор перечня кодексов, разбор
  консолидированных текстов через API `actual.pravo.gov.ru` и парсинг
  Конституции с консолидированной страницы ИПС.
- `src/app/` — страницы: главная, кодекс (дерево), статья, поиск, `sitemap.xml`,
  `robots.txt`.
- `src/components/`, `src/lib/` — компоненты и доступ к данным.

## Прод-деплой

Полная пошаговая инструкция для боевого VPS (Docker + Caddy с автоматическим
TLS) — в [DEPLOY.md](DEPLOY.md). Кратко:

```bash
cp .env.example .env   # задать стойкий POSTGRES_PASSWORD и SITE_URL
./deploy.sh            # сборка, миграции, старт контейнеров, import:all
```

`docker-compose.yml` поднимает PostgreSQL, приложение Next.js и обратный прокси
Caddy (TLS Let's Encrypt, www → apex). Миграции применяются автоматически.

## Локальная разработка

```bash
npm install
# поднять PostgreSQL и указать DATABASE_URL в .env
npx prisma migrate deploy
npx prisma generate
npm run import:codex        # разведка: один кодекс (Семейный)
npm run import:all          # все кодексы + Конституция
npm run dev
npm test                    # юнит-тесты парсеров и утилит (vitest)
```

## Загрузка данных

- `npm run import:codex [slug]` — импорт одного кодекса (по умолчанию `sk-rf`).
  Этап разведки: проверка модели на одном кодексе.
- `npm run import:all` — массовая загрузка всех кодексов и Конституции.
  Идемпотентно: повторный запуск обновляет записи, не плодя дубли.
- Расхождения структуры выводятся в конце прогона для ручной проверки.

## Адреса

- Кодекс: `/{slug}` (например `/uk-rf`, `/konstituciya`).
- Статья: `/{slug}/statya-{number}` (например `/uk-rf/statya-105`,
  `/uk-rf/statya-105.1`).
- Поиск: `/search?q=...`. Реквизит вида «ст 105 УК» ведёт прямо на статью.

## Переменные окружения

См. `.env.example`: `DATABASE_URL`, `SITE_URL`, адреса источника
(`PRAVO_CODEX_URL`, `PRAVO_API_BASE`, `PRAVO_BPA`).
