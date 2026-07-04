FROM node:24-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
# Образ намеренно содержит dev-зависимости: loader (импорт корпуса) запускается
# внутри этого же контейнера через tsx, а миграции — через prisma CLI (оба —
# devDependencies). Отдельный прод-образ без dev-зависимостей потребовал бы
# второй образ/стадию для импорта и усложнил бы деплой (см. DEPLOY.md).
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=node:node package.json package-lock.json* next.config.ts tsconfig.json ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node loader ./loader
COPY --chown=node:node src ./src
COPY --chown=node:node public ./public
COPY --chown=node:node docker-entrypoint.sh ./
# Каталог кэша loader'а создаётся заранее с владельцем node: на него монтируется
# volume, и хостовый каталог должен принадлежать uid 1000 (см. deploy.sh).
RUN chmod +x docker-entrypoint.sh \
  && mkdir -p loader/.cache/raw \
  && chown -R node:node loader/.cache
USER node
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
