import { unstable_cache } from "next/cache";
import { unitAnchor } from "./anchors";
import { prisma } from "./prisma";
import { toSafeSnippet } from "./snippet";

// Контент меняется только при импорте (еженедельный cron), поэтому результаты
// запросов кэшируются на сутки. После импорта кэш сбрасывается целиком через
// POST /api/revalidate (тег ниже).
export const CONTENT_CACHE_TAG = "content";
const CONTENT_REVALIDATE_SECONDS = 60 * 60 * 24;

const contentCache = { revalidate: CONTENT_REVALIDATE_SECONDS, tags: [CONTENT_CACHE_TAG] };

// Значения из unstable_cache проходят JSON-сериализацию: Date на попадании в
// кэш возвращается строкой. formatDate и sitemap принимают оба варианта.
export type CachedDate = Date | string | null;

export interface CodeListItem {
  slug: string;
  title: string;
  shortName: string;
  kind: string;
  editionDate: CachedDate;
}

export const getCodes = unstable_cache(
  (): Promise<CodeListItem[]> =>
    prisma.code.findMany({
      orderBy: { order: "asc" },
      select: { slug: true, title: true, shortName: true, kind: true, editionDate: true },
    }),
  ["codes"],
  contentCache,
);

export interface LawListItem {
  slug: string;
  shortName: string;
  title: string;
}

export const getLaws = unstable_cache(
  (): Promise<LawListItem[]> =>
    prisma.code.findMany({
      where: { kind: "LAW" },
      orderBy: { title: "asc" },
      select: { slug: true, shortName: true, title: true },
    }),
  ["laws"],
  contentCache,
);

export interface CodeInfo {
  id: string;
  slug: string;
  title: string;
  shortName: string;
  kind: string;
  editionDate: CachedDate;
  sourceUrl: string | null;
}

export const getCodeBySlug = unstable_cache(
  (slug: string): Promise<CodeInfo | null> =>
    prisma.code.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        shortName: true,
        kind: true,
        editionDate: true,
        sourceUrl: true,
      },
    }),
  ["code-by-slug"],
  contentCache,
);

export interface TreeArticle {
  number: string;
  title: string | null;
  slug: string;
  status: string;
  order: number;
}

export interface TreeUnit {
  id: string;
  type: string;
  number: string | null;
  title: string;
  order: number;
  anchor: string;
  children: TreeUnit[];
  articles: TreeArticle[];
}

export interface CodeTree {
  rootUnits: TreeUnit[];
  rootArticles: TreeArticle[];
}

export const getCodeTree = unstable_cache(
  async (codeId: string): Promise<CodeTree> => {
    const [units, articles] = await Promise.all([
      prisma.structuralUnit.findMany({
        where: { codeId },
        orderBy: { order: "asc" },
        select: { id: true, parentId: true, type: true, number: true, title: true, order: true },
      }),
      prisma.article.findMany({
        where: { codeId },
        orderBy: { order: "asc" },
        select: { number: true, title: true, slug: true, status: true, order: true, unitId: true },
      }),
    ]);

    const nodes = new Map<string, TreeUnit>();
    const usedAnchors = new Set<string>();
    const rootUnits: TreeUnit[] = [];
    // units отсортированы по order, родители идут раньше детей — якорь родителя
    // к моменту обработки ребёнка уже вычислен.
    for (const unit of units) {
      const parent = unit.parentId ? nodes.get(unit.parentId) : undefined;
      let anchor = unitAnchor(parent?.anchor ?? null, unit.type, unit.number, unit.order);
      if (usedAnchors.has(anchor)) anchor = `${anchor}-${unit.order}`;
      usedAnchors.add(anchor);

      const node: TreeUnit = { ...unit, anchor, children: [], articles: [] };
      nodes.set(unit.id, node);
      if (parent) {
        parent.children.push(node);
      } else {
        rootUnits.push(node);
      }
    }

    const rootArticles: TreeArticle[] = [];
    for (const article of articles) {
      const entry: TreeArticle = {
        number: article.number,
        title: article.title,
        slug: article.slug,
        status: article.status,
        order: article.order,
      };
      if (article.unitId && nodes.has(article.unitId)) {
        nodes.get(article.unitId)!.articles.push(entry);
      } else {
        rootArticles.push(entry);
      }
    }

    return { rootUnits, rootArticles };
  },
  ["code-tree"],
  contentCache,
);

export interface Breadcrumb {
  type: string;
  number: string | null;
  title: string;
  anchor: string;
}

export interface ArticleNeighbor {
  number: string;
  title: string | null;
  slug: string;
}

async function fetchBreadcrumbs(startUnitId: string | null): Promise<Breadcrumb[]> {
  // Подъём по цепочке предков: максимум 4–5 запросов по первичному ключу
  // вместо загрузки всех структурных единиц кодекса.
  const chain: { type: string; number: string | null; title: string; order: number }[] = [];
  let cursor = startUnitId;
  while (cursor) {
    const unit: {
      parentId: string | null;
      type: string;
      number: string | null;
      title: string;
      order: number;
    } | null = await prisma.structuralUnit.findUnique({
      where: { id: cursor },
      select: { parentId: true, type: true, number: true, title: true, order: true },
    });
    if (!unit) break;
    chain.unshift(unit);
    cursor = unit.parentId;
  }

  const crumbs: Breadcrumb[] = [];
  let parentAnchor: string | null = null;
  for (const unit of chain) {
    const anchor = unitAnchor(parentAnchor, unit.type, unit.number, unit.order);
    crumbs.push({ type: unit.type, number: unit.number, title: unit.title, anchor });
    parentAnchor = anchor;
  }
  return crumbs;
}

export const getArticle = unstable_cache(
  async (codeSlug: string, articleSlug: string) => {
    const code = await prisma.code.findUnique({
      where: { slug: codeSlug },
      select: {
        id: true,
        slug: true,
        title: true,
        shortName: true,
        kind: true,
        editionDate: true,
        sourceUrl: true,
      },
    });
    if (!code) return null;

    const article = await prisma.article.findUnique({
      where: { codeId_slug: { codeId: code.id, slug: articleSlug } },
    });
    if (!article) return null;

    const [breadcrumbs, prev, next] = await Promise.all([
      fetchBreadcrumbs(article.unitId),
      prisma.article.findFirst({
        where: { codeId: code.id, order: { lt: article.order } },
        orderBy: { order: "desc" },
        select: { number: true, title: true, slug: true },
      }),
      prisma.article.findFirst({
        where: { codeId: code.id, order: { gt: article.order } },
        orderBy: { order: "asc" },
        select: { number: true, title: true, slug: true },
      }),
    ]);

    return { code, article, breadcrumbs, prev, next };
  },
  ["article"],
  contentCache,
);

export interface SearchHit {
  codeSlug: string;
  codeShort: string;
  number: string;
  title: string | null;
  slug: string;
  status: string;
  snippet: string;
}

export interface SearchResult {
  hits: SearchHit[];
  hasMore: boolean;
}

const SEARCH_LIMIT = 40;

export async function searchArticles(query: string): Promise<SearchResult> {
  // Понижающий множитель для федеральных законов: их тысячи, и по частотным
  // словам они забивали бы статьи кодексов и Конституции с тем же рангом.
  const rows = await prisma.$queryRaw<SearchHit[]>`
    SELECT
      c.slug AS "codeSlug",
      c."shortName" AS "codeShort",
      a.number,
      a.title,
      a.slug,
      a.status::text AS status,
      ts_headline('russian', a."bodyText", q,
        'StartSel="' || chr(1) || '",StopSel="' || chr(2) || '",MaxFragments=1,MaxWords=34,MinWords=16,ShortWord=2') AS snippet
    FROM "Article" a
    JOIN "Code" c ON c.id = a."codeId",
      websearch_to_tsquery('russian', ${query}) q
    WHERE a."searchVector" @@ q
    ORDER BY
      ts_rank(a."searchVector", q) * (CASE WHEN c.kind = 'LAW' THEN 0.5 ELSE 1.0 END) DESC,
      a."order" ASC
    LIMIT ${SEARCH_LIMIT + 1};
  `;
  const hasMore = rows.length > SEARCH_LIMIT;
  const hits = rows
    .slice(0, SEARCH_LIMIT)
    .map((hit) => ({ ...hit, snippet: toSafeSnippet(hit.snippet) }));
  return { hits, hasMore };
}

// ——— Перекрёстные ссылки в текстах статей ———

import type { LawRef } from "./lawLinks";

// Проверка существования целевых статей для автолинковки: по каждому
// упомянутому кодексу один индексный запрос. Возвращает "codeSlug/number" →
// слаг статьи. Не кэшируется: запросы дешёвые и специфичны для статьи.
export async function resolveArticleRefs(refs: LawRef[]): Promise<Record<string, string>> {
  const byCode = new Map<string, Set<string>>();
  for (const ref of refs) {
    const numbers = byCode.get(ref.codeSlug) ?? new Set<string>();
    numbers.add(ref.number);
    byCode.set(ref.codeSlug, numbers);
  }

  const resolved: Record<string, string> = {};
  for (const [codeSlug, numbers] of byCode) {
    const rows = await prisma.article.findMany({
      where: { code: { slug: codeSlug }, number: { in: [...numbers] } },
      select: { number: true, slug: true },
    });
    for (const row of rows) {
      const key = `${codeSlug}/${row.number}`;
      // При дублях номера (slug с суффиксом -2) оставляем первый.
      if (!(key in resolved)) resolved[key] = row.slug;
    }
  }
  return resolved;
}

// ——— Лента изменений корпуса ———

export interface ChangeItem {
  id: string;
  at: CachedDate;
  codeSlug: string;
  codeShort: string;
  kind: string;
  articleNumber: string | null;
  articleSlug: string | null;
  articleTitle: string | null;
  count: number | null;
}

export const getRecentChanges = unstable_cache(
  (): Promise<ChangeItem[]> =>
    prisma.importChange.findMany({
      orderBy: { at: "desc" },
      take: 400,
    }),
  ["changes"],
  contentCache,
);
