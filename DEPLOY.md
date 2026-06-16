# Развёртывание «Кодексы РФ» на боевом VPS

Инструкция для ручного выполнения в веб-консоли VPS под `root`.
Конечный результат — сайт работает по `https://legalframework.ru`.
SSH со стороны разработчика не используется — все шаги вы выполняете сами.

Предполагается чистый Ubuntu-сервер (KVM), DNS-записи `@` и `www` уже указывают
на этот сервер, открыты порты 22, 80, 443.

---

## 1. Перенос проекта на сервер

Цель — положить проект в каталог `/opt/legalframework` на сервере.

**Не переносите** каталоги `node_modules`, `.next`, `.git` и файл `.env` —
они либо собираются в образе, либо создаются на сервере.

**Желательно перенести** каталог `loader/.cache/raw` (локально собранный кэш
исходных данных, ~60 МБ): тогда загрузка корпуса пойдёт из кэша, без повторных
обращений к API pravo.gov.ru. Без него всё тоже работает — данные скачаются
заново.

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
POSTGRES_PASSWORD=$(openssl rand -base64 24)
POSTGRES_DB=kodeksy
SITE_URL=https://legalframework.ru
EOF
chmod 600 .env
cat .env
```

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

Пример еженедельного cron (по понедельникам в 4:00):

```bash
( crontab -l 2>/dev/null; echo "0 4 * * 1 cd /opt/legalframework && docker compose run --rm app npm run import:all >> /var/log/kodeksy-import.log 2>&1" ) | crontab -
```

Команды управления:

```bash
docker compose ps          # статус контейнеров
docker compose logs -f app # логи приложения
docker compose logs -f caddy
docker compose restart app
docker compose down        # остановить всё (данные БД сохраняются в томе)
```

---

## 8. Если что-то пошло не так

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
