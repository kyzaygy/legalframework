import { createHash } from "node:crypto";
import type { ChangeKind, Prisma, PrismaClient } from "@prisma/client";
import { discrepancies } from "./parse";
import type { CodexSpec, ParsedCode, ParsedUnit } from "./types";

export interface ImportSummary {
  slug: string;
  units: number;
  articles: number;
  repealed: number;
}

// Защита от «молчаливой» деградации парсера: если у уже наполненного кодекса
// новый прогон принёс менее половины статей, это почти наверняка сломанная
// разметка источника, а не реальная правка закона. Откатываем транзакцию —
// старый корпус остаётся на месте, расхождение уходит в лог.
const MIN_ARTICLES_FOR_GUARD = 20;
const CREATE_CHUNK = 400;
// Если у документа изменилось больше статей — пишем в журнал одну сводную
// запись CODE_UPDATED вместо потока построчных (обновилась вся редакция).
const GRANULAR_CHANGES_LIMIT = 50;

function bodyHash(text: string): string {
  return createHash("md5").update(text).digest("hex");
}

interface ChangeRow {
  codeSlug: string;
  codeShort: string;
  kind: ChangeKind;
  articleNumber?: string;
  articleSlug?: string;
  articleTitle?: string;
  count?: number;
}

interface PreviousArticle {
  number: string;
  title: string | null;
  hash: string;
}

function diffChanges(
  spec: CodexSpec,
  previous: Map<string, PreviousArticle>,
  next: { slug: string; number: string; title: string | null; bodyText: string }[],
): ChangeRow[] {
  const base = { codeSlug: spec.slug, codeShort: spec.shortName };
  if (previous.size === 0) {
    return [{ ...base, kind: "CODE_ADDED" }];
  }

  const changes: ChangeRow[] = [];
  const nextSlugs = new Set(next.map((article) => article.slug));
  for (const article of next) {
    const before = previous.get(article.slug);
    if (!before) {
      changes.push({
        ...base,
        kind: "ARTICLE_ADDED",
        articleNumber: article.number,
        articleSlug: article.slug,
        articleTitle: article.title ?? undefined,
      });
    } else if (before.hash !== bodyHash(article.bodyText) || before.title !== article.title) {
      changes.push({
        ...base,
        kind: "ARTICLE_UPDATED",
        articleNumber: article.number,
        articleSlug: article.slug,
        articleTitle: article.title ?? undefined,
      });
    }
  }
  for (const [slug, before] of previous) {
    if (!nextSlugs.has(slug)) {
      changes.push({
        ...base,
        kind: "ARTICLE_REMOVED",
        articleNumber: before.number,
        articleTitle: before.title ?? undefined,
      });
    }
  }

  if (changes.length > GRANULAR_CHANGES_LIMIT) {
    return [{ ...base, kind: "CODE_UPDATED", count: changes.length }];
  }
  return changes;
}

function chunked<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function createUnits(
  tx: Prisma.TransactionClient,
  codeId: string,
  slug: string,
  units: ParsedUnit[],
): Promise<Map<string, string>> {
  const keyToId = new Map<string, string>();
  const orderToKey = new Map<number, string>();
  for (const unit of units) orderToKey.set(unit.order, unit.key);

  let remaining = [...units];
  while (remaining.length > 0) {
    const ready = remaining.filter(
      (unit) => unit.parentKey === null || keyToId.has(unit.parentKey),
    );
    if (ready.length === 0) {
      discrepancies.push(`Висячие ссылки на родителя в ${slug}, прикреплены к корню`);
      remaining.forEach((unit) => {
        unit.parentKey = null;
      });
      continue;
    }
    for (const batch of chunked(ready, CREATE_CHUNK)) {
      const created = await tx.structuralUnit.createManyAndReturn({
        data: batch.map((unit) => ({
          codeId,
          parentId: unit.parentKey ? keyToId.get(unit.parentKey)! : null,
          type: unit.type,
          number: unit.number,
          title: unit.title,
          order: unit.order,
        })),
        select: { id: true, order: true },
      });
      // order уникален внутри кодекса в рамках одного прогона — по нему
      // восстанавливаем соответствие созданных строк исходным ключам.
      for (const row of created) {
        const key = orderToKey.get(row.order);
        if (key) keyToId.set(key, row.id);
      }
    }
    remaining = remaining.filter((unit) => !keyToId.has(unit.key));
  }
  return keyToId;
}

export async function importCode(
  prisma: PrismaClient,
  spec: CodexSpec,
  parsed: ParsedCode,
  order: number,
): Promise<ImportSummary> {
  await prisma.$transaction(
    async (tx) => {
      const code = await tx.code.upsert({
        where: { slug: spec.slug },
        create: {
          slug: spec.slug,
          title: spec.title,
          shortName: spec.shortName,
          kind: spec.kind,
          editionDate: parsed.editionDate,
          sourceUrl: spec.sourceUrl,
          order,
        },
        update: {
          title: spec.title,
          shortName: spec.shortName,
          kind: spec.kind,
          editionDate: parsed.editionDate,
          sourceUrl: spec.sourceUrl,
          order,
        },
      });

      // Снимок прежнего состояния для журнала изменений и защитной проверки.
      const previousRows = await tx.article.findMany({
        where: { codeId: code.id },
        select: { slug: true, number: true, title: true, bodyText: true },
      });
      const existing = previousRows.length;
      if (existing >= MIN_ARTICLES_FOR_GUARD && parsed.articles.length < existing / 2) {
        throw new Error(
          `подозрительное сокращение статей в ${spec.slug}: было ${existing}, ` +
            `стало ${parsed.articles.length} — импорт отменён, старый текст сохранён`,
        );
      }
      const previous = new Map<string, PreviousArticle>(
        previousRows.map((row) => [
          row.slug,
          { number: row.number, title: row.title, hash: bodyHash(row.bodyText) },
        ]),
      );

      await tx.article.deleteMany({ where: { codeId: code.id } });
      await tx.structuralUnit.deleteMany({ where: { codeId: code.id } });

      const keyToId = await createUnits(tx, code.id, spec.slug, parsed.units);

      const usedSlugs = new Set<string>();
      const articleData = parsed.articles.map((article) => {
        let slug = `statya-${article.number}`;
        let suffix = 2;
        while (usedSlugs.has(slug)) slug = `statya-${article.number}-${suffix++}`;
        usedSlugs.add(slug);
        return {
          codeId: code.id,
          unitId: article.unitKey ? keyToId.get(article.unitKey) ?? null : null,
          number: article.number,
          slug,
          title: article.title,
          bodyHtml: article.bodyHtml,
          bodyText: article.bodyText,
          status: article.status,
          editionDate: parsed.editionDate,
          order: article.order,
        };
      });

      for (const batch of chunked(articleData, CREATE_CHUNK)) {
        await tx.article.createMany({ data: batch });
      }

      const changes = diffChanges(spec, previous, articleData);
      if (changes.length > 0) {
        await tx.importChange.createMany({ data: changes });
      }
    },
    // Крупные кодексы (НК, КоАП) — тысячи статей; дефолтных 5 секунд
    // интерактивной транзакции не хватит.
    { timeout: 300_000, maxWait: 15_000 },
  );

  return {
    slug: spec.slug,
    units: parsed.units.length,
    articles: parsed.articles.length,
    repealed: parsed.articles.filter((article) => article.status === "REPEALED").length,
  };
}
