# Развёртывание «Кодексы РФ» на боевом VPS

Инструкция для ручного выполнения в веб-консоли VPS под `root`.
Конечный результат — сайт работает по `https://legalframework.ru`.
SSH со стороны разработчика не используется — все шаги вы выполняете сами.

Предполагается чистый Ubuntu-сервер (KVM), DNS-записи `@` и `www` уже указывают
на этот сервер, открыты порты 22, 80, 443.

---

## 0. Быстрый путь (одна команда)

Если нужно просто поднять всё разом — вставьте в веб-консоль под `root` одну
строку. Она установит Docker, склонирует проект, создаст `.env` со стойким
паролем, откроет порты 22/80/443 и выполнит полный деплой с загрузкой корпуса:

```bash
curl -fsSL https://raw.githubusercontent.com/kyzaygy/legalframework/main/bootstrap.sh | bash
```

Скрипт идемпотентен: повторный запуск делает `git pull`, не перезаписывает
`.env` и не задваивает данные. Ручные шаги ниже (разделы 1–8) — на случай,
если нужно контролировать каждый этап или разобраться с ошибкой.

---

## 1. Перенос проекта на сервер

Цель — положить проект в каталог `/opt/legalframework` на сервере.

**Не переносите** каталоги `node_modules`, `.next`, `.git` и файл `.env` —
они либо собираются в образе, либо создаются на сервере.

**Желательно перенести** каталог `loader/.cache/raw` (локально собранный кэш
исходных данных, ~60 МБ): тогда загрузка корпуса пойдёт из кэша, без повторных
обращений к API pravo.gov.ru. Без него всё тоже работает — данные скачаются
заново. Приложение в контейнере работает от пользователя `node` (uid 1000),
поэтому после переноса выполните `chown -R 1000:1000 loader/.cache`
(`deploy.sh` делает это автоматически).

Любой удобный способ переноса, например:

- **Через архив.** На своей машине упакуйте проект (без `node_modules`, `.next`,
  `.git`, `.env`), загрузите архив на сервер (файловый менеджер панели или
  `scp`/`sftp` с вашей машины), затем на сервере:
  ```bash
  mkdir -p /opt/legalframework
  tar -xzf /root/legalframework.tar.gz -C /opt/legalframework
  ```
- **Через git** (если проект в репозитории):
  ```bash
  apt-get update && apt-get install -y git
  git clone <URL-репозитория> /opt/legalframework
  ```
  (Кэш `loader/.cache/raw` в git не входит — перенесите его отдельно при желании.)

Дальше все команды выполняются из каталога проекта:

```bash
cd /opt/legalframework
```

---

## 2. Установка Docker и Compose-плагина

```bash
curl -fsSL https://get.docker.com | sh
docker --version
docker compose version
```

`get.docker.com` ставит Docker Engine вместе с плагином `compose`.

---

## 3. Файл .env с секретами

`.env` не входит в репозиторий — создайте его на сервере. Сгенерируйте стойкий
пароль БД и сразу запишите его в файл:

```bash
cd /opt/legalframework
cat > .env <<EOF
POSTGRES_USER=kodeksy
POSTGRES_PASSWORD=$(openssl rand -hex 24)
POSTGRES_DB=kodeksy
SITE_URL=https://legalframework.ru
EOF
chmod 600 .env
cat .env
```

Пароль генерируется в hex (только `0-9a-f`), чтобы быть безопасным внутри
строки подключения `DATABASE_URL`. Не используйте `base64` — символы `/ + =`
ломают URL. Если задаёте пароль вручную — только буквы и цифры.

Переменные в `.env`:

| Переменная          | Значение                          | Назначение                         |
|---------------------|-----------------------------------|------------------------------------|
| `POSTGRES_USER`     | `kodeksy`                          | пользователь БД                    |
| `POSTGRES_PASSWORD` | сгенерированный стойкий пароль     | пароль БД (нигде не коммитится)    |
| `POSTGRES_DB`       | `kodeksy`                          | имя базы                           |
| `SITE_URL`          | `https://legalframework.ru`        | базовый URL для canonical/sitemap  |

Адреса источника (`PRAVO_*`) переопределять не нужно — у них рабочие значения
по умолчанию.

---

## 4. Firewall (ufw)

```bash
apt-get install -y ufw
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status
```

Открыты только 22, 80, 443.

---

## 5. Запуск

```bash
cd /opt/legalframework
chmod +x deploy.sh
./deploy.sh
```

`deploy.sh` по шагам: собирает образы, поднимает PostgreSQL, применяет миграции
(включая полнотекстовый индекс), запускает приложение и Caddy, затем загружает
корпус командой `import:all` и печатает количество загруженного.

Ожидаемый итог проверки в конце:

```
 codes | units | articles
-------+-------+----------
    21 |  1515 |     9378
```

Числа могут немного отличаться, если на портале обновились редакции.

Caddy сам получит TLS-сертификат Let's Encrypt для `legalframework.ru` и
`www.legalframework.ru` при первом обращении (нужны открытые 80/443 и
корректный DNS). Первый выпуск занимает до минуты.

---

## 6. Проверка, что сайт поднялся

С любой машины (или прямо на сервере):

```bash
# http редиректит на https
curl -sI http://legalframework.ru | head -1

# apex отдаёт 200
curl -sI https://legalframework.ru | head -1

# www редиректит на apex
curl -sI https://www.legalframework.ru | grep -i location

# текст статьи присутствует в HTML (SSR), а не подгружается скриптом
curl -s https://legalframework.ru/gk-rf/statya-1142 | grep -o "Наследниками первой очереди" | head -1

# поиск по реквизиту ведёт на статью (ожидается 307 и Location на /gk-rf/statya-1142)
curl -sI "https://legalframework.ru/search?q=%D1%81%D1%82%201142%20%D0%93%D0%9A" | grep -iE "HTTP/|location"

# sitemap содержит ~9400 URL
curl -s https://legalframework.ru/sitemap.xml | grep -c "<url>"

# robots: статьи и кодексы открыты, закрыт только /search
curl -s https://legalframework.ru/robots.txt
```

В браузере дополнительно проверьте:

- замок (валидный сертификат) на `https://legalframework.ru`;
- открывается статья, например `https://legalframework.ru/uk-rf/statya-105`,
  с бордовым маркером, номером и вложенной нумерацией пунктов;
- поиск слова `алименты` даёт результаты с подсветкой;
- кнопка «Aa Вид» — размер шрифта и тема сохраняются после перезагрузки.

---

## 7. Обновление текстов в будущем

Тексты на портале меняются — обновляйте корпус (например, раз в неделю по cron):

```bash
cd /opt/legalframework && docker compose run --rm app npm run import:all
```

Страницы отдаются из кэша (сутки), поэтому после импорта сбросьте его, чтобы
обновлённые тексты появились сразу. Задайте `REVALIDATE_SECRET` в `.env`
(`openssl rand -hex 24`, затем `docker compose up -d app`) и дёрните эндпоинт:

```bash
curl -fsS -X POST -H "x-revalidate-secret: $REVALIDATE_SECRET" \
  https://legalframework.ru/api/revalidate
```

Без секрета эндпоинт отключён, а кэш истечёт сам не позднее чем через сутки.

Импорт защищён от сломанной разметки источника: если новый прогон принёс
менее половины статей уже наполненного кодекса, транзакция откатывается,
старый текст остаётся, а расхождение попадает в итоговый отчёт прогона —
проверяйте его в логе cron.

### Импорт всех федеральных законов (`import:fz`)

`import:all` загружает кодексы, Конституцию и курируемый набор законов. Полный
перечень действующих федеральных законов подтягивается отдельной командой —
она автоматически находит их через API ЕБПИ (attrsearch), отсекает
законы-поправки («О внесении изменений…») и недействующие акты:

```bash
# СНАЧАЛА пробный прогон на 5 законах — проверить, что API отвечает и импорт идёт:
docker compose run --rm app npm run import:fz -- 5

# затем полный импорт (это ЧАСЫ: сотни/тысячи законов, портал троттлится):
docker compose run --rm app npm run import:fz
```

Особенности:

- Команда идемпотентна: повторный прогон обновляет записи, не задваивает.
  Slug закона — `fz-<номер>-<год>` (напр. `fz-152-2006`), стабилен между
  прогонами.
- Перечень законов запрашивается **без кэша** (свежий список каждый раз), а
  тексты редакций кэшируются в `loader/.cache/raw`, как и у кодексов.
- Первый полный импорт лучше запускать в `screen`/`tmux` или через `nohup`,
  чтобы не прерваться по обрыву SSH:
  ```bash
  nohup docker compose run --rm app npm run import:fz \
    >> /var/log/kodeksy-fz.log 2>&1 &
  tail -f /var/log/kodeksy-fz.log
  ```
- После импорта список доступен на `/zakony`; на главной — популярные законы
  и ссылка на полный каталог. Отдельный прогон миграций не нужен — схема БД
  не менялась.
- Для еженедельного обновления можно добавить `import:fz` в cron рядом с
  `import:all` (но учтите длительность — лучше раз в месяц и в тихие часы).

Пример еженедельного cron (по понедельникам в 4:00, со сбросом кэша после
импорта; `REVALIDATE_SECRET` подставьте значением, cron не читает `.env`):

```bash
( crontab -l 2>/dev/null; echo "0 4 * * 1 cd /opt/legalframework && docker compose run --rm app npm run import:all >> /var/log/kodeksy-import.log 2>&1 && curl -fsS -X POST -H 'x-revalidate-secret: <секрет>' https://legalframework.ru/api/revalidate >> /var/log/kodeksy-import.log 2>&1" ) | crontab -
```

### Резервные копии базы данных

Полный импорт занимает часы, поэтому базу дешевле бэкапить, чем перезаливать.
Ежедневный дамп с ротацией за 7 дней:

```bash
mkdir -p /opt/legalframework/backups
( crontab -l 2>/dev/null; echo "30 3 * * * cd /opt/legalframework && docker compose exec -T db pg_dump -U kodeksy -d kodeksy -Fc > backups/kodeksy-\$(date +\%F).dump && find backups -name '*.dump' -mtime +7 -delete" ) | crontab -
```

Восстановление в чистую базу:

```bash
docker compose exec -T db pg_restore -U kodeksy -d kodeksy --clean --if-exists < backups/kodeksy-2026-07-06.dump
```

Дампы лежат на том же диске, что и база — критичные копируйте на другой хост
(rclone/scp), иначе смерть VPS уносит и базу, и бэкапы.

Команды управления:

```bash
docker compose ps          # статус контейнеров
docker compose logs -f app # логи приложения
docker compose logs -f caddy
docker compose restart app
docker compose down        # остановить всё (данные БД сохраняются в томе)
```

---

## 8. Обновление зависимостей и патчи безопасности

Зависимости приложения (npm) и базовые образы (Docker) отслеживает Dependabot
(`.github/dependabot.yml`, еженедельно, PR в репозиторий). CI на каждый PR
прогоняет typecheck, сборку и `npm audit --audit-level=high`.

Порядок применения обновлений на сервере:

```bash
cd /opt/legalframework
git pull --ff-only
docker compose build --pull        # --pull подтягивает свежие базовые образы
docker compose run --rm app npx prisma migrate deploy
docker compose up -d
docker compose ps                  # app должен стать healthy
```

Обратите внимание: `statement_timeout=15s` из `DATABASE_URL` действует и на
`prisma migrate deploy`. Текущие миграции короткие, но если будущая миграция
(например, `CREATE INDEX` на большой таблице) упадёт по таймауту — выполните
её разово с URL без параметра `options`:

```bash
docker compose run --rm \
  -e DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@db:5432/$POSTGRES_DB?schema=public" \
  app npx prisma migrate deploy
```

Рекомендации:

- **Критичные патчи Next.js/React** (RCE, как React2Shell в декабре 2025)
  применяйте немедленно, не дожидаясь еженедельного цикла: смержите PR
  Dependabot (или обновите версии в `package.json` вручную), затем выполните
  команды выше.
- Раз в месяц запускайте `npm audit` локально и проверяйте
  https://github.com/vercel/next.js/security/advisories на новые advisory.
- Ветка Next.js, на которой сидит проект, должна получать патчи. Если ветка
  объявлена EOL — планируйте переход на поддерживаемую minor/major версию.
- После обновления проверьте сайт по чек-листу из раздела 6.

Прод-образ намеренно содержит dev-зависимости: импортёр (`loader/`) запускается
внутри контейнера через `tsx`, миграции — через `prisma` CLI (оба —
devDependencies). Это осознанный компромисс в пользу простоты деплоя;
контейнер работает от непривилегированного пользователя `node`.

---

## 9. Автодеплой и приватный репозиторий

### 9.1. Перевод репозитория в приватный

GitHub → Settings → General → Danger Zone → Change visibility → Private.

После этого анонимный `git pull` по HTTPS на сервере перестанет работать.
Переведите сервер на SSH с deploy-ключом (доступ только на чтение и только к
этому репозиторию):

```bash
# на сервере: ключ без пароля специально для деплоя
ssh-keygen -t ed25519 -N "" -f /root/.ssh/github_deploy -C "legalframework-deploy"
cat /root/.ssh/github_deploy.pub
```

Публичный ключ добавьте в GitHub → Settings → **Deploy keys** → Add deploy key
(галку «Allow write access» НЕ ставить). Затем на сервере:

```bash
cat >> /root/.ssh/config <<'EOF'
Host github.com
    IdentityFile /root/.ssh/github_deploy
    IdentitiesOnly yes
EOF
cd /opt/legalframework
git remote set-url origin git@github.com:kyzaygy/legalframework.git
git pull --ff-only        # проверка: должно работать без пароля
```

Однострочник из раздела 0 для приватного репозитория выполняется так (после
установки deploy-ключа):

```bash
curl -fsSL ... # raw-ссылка приватного репо требует токен; проще склонировать по SSH:
git clone git@github.com:kyzaygy/legalframework.git /opt/legalframework
cd /opt/legalframework && ./bootstrap.sh
```

CI, Dependabot и автодеплой (ниже) с приватностью работают без изменений.

### 9.2. Автодеплой из GitHub Actions

После зелёной сборки в `main` джоба `deploy` из `.github/workflows/ci.yml`
сама выкатывает изменения на сервер. Настройка — три секрета в
GitHub → Settings → Secrets and variables → **Actions**:

| Секрет           | Значение                                                       |
|------------------|----------------------------------------------------------------|
| `DEPLOY_HOST`    | IP или хост сервера (например, `legalframework.ru`)            |
| `DEPLOY_USER`    | `root`                                                         |
| `DEPLOY_SSH_KEY` | **приватный** ключ для входа на сервер (см. ниже)              |

Ключ для Actions заведите отдельный (не тот, которым входите сами, и не
deploy-ключ GitHub):

```bash
# на своей машине
ssh-keygen -t ed25519 -N "" -f actions_deploy -C "github-actions-deploy"
# публичную часть — на сервер:
cat actions_deploy.pub | ssh root@legalframework.ru 'cat >> /root/.ssh/authorized_keys'
# приватную часть (файл actions_deploy целиком) — в секрет DEPLOY_SSH_KEY,
# после чего локальные файлы удалите: rm actions_deploy actions_deploy.pub
```

Пока секреты не заданы, джоба деплоя тихо пропускается — ничего не ломается.
Деплой не запускает импорт корпуса и не сбрасывает кэш страниц — это по-прежнему
cron/руки (разделы 7 и 8).

## 10. Мониторинг доступности

Приложение отдаёт `GET /api/health`: `200 {"ok":true}` когда живы и приложение,
и БД; `503` — если БД недоступна.

Подключите любой бесплатный аптайм-мониторинг (UptimeRobot, HetrixTools,
Better Stack):

1. Тип проверки — HTTP(S), URL — `https://legalframework.ru/api/health`,
   интервал 1–5 минут, критерий — код ответа 200.
2. Алерты — на почту и/или в Telegram (у всех сервисов есть интеграция).
3. Также полезна проверка на строку `"ok":true` в теле ответа.

## 11. Если что-то пошло не так

- **Падает на миграциях / подключении к БД.** Убедитесь, что `.env` создан и
  содержит `POSTGRES_PASSWORD`. Посмотрите `docker compose logs db` и
  `docker compose logs app`. Повторный запуск `./deploy.sh` безопасен —
  миграции и импорт идемпотентны.
- **Нет сертификата / TLS-ошибка.** Проверьте, что DNS `legalframework.ru` и
  `www` указывают на этот сервер, а 80 и 443 открыты в ufw и у провайдера.
  Логи: `docker compose logs caddy`. Дайте Caddy до минуты на выпуск.
- **`import:all` долго идёт или часть кодексов с ошибкой.** Импорт устойчив:
  делает паузы между запросами и повторы. Запустите его ещё раз — он
  идемпотентен (обновит записи, не задвоит). Расхождения структуры печатаются
  в конце прогона.
- **Контейнер `app` рестартует.** Смотрите `docker compose logs app`: чаще
  всего это недоступная БД (подождите её готовности) или неверный `.env`.
