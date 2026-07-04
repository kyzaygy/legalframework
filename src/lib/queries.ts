import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

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
  children: TreeUnit[];
  articles: TreeArticle[];
}

export interface CodeTree {
  rootUnits: TreeUnit[];
  rootArticles: TreeArticle[];
}

export function getCodes() {
  return prisma.code.findMany({ orderBy: { order: "asc" } });
}

export function getCodeBySlug(slug: string) {
  return prisma.code.findUnique({ where: { slug } });
}

export async function getCodeTree(codeId: string): Promise<CodeTree> {
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
  for (const unit of units) {
    nodes.set(unit.id, { ...unit, children: [], articles: [] });
  }

  const rootUnits: TreeUnit[] = [];
  for (const unit of units) {
    const node = nodes.get(unit.id)!;
    if (unit.parentId && nodes.has(unit.parentId)) {
      nodes.get(unit.parentId)!.children.push(node);
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
}

export async function getArticle(codeSlug: string, articleSlug: string) {
  const code = await prisma.code.findUnique({ where: { slug: codeSlug } });
  if (!code) return null;

  const article = await prisma.article.findUnique({
    where: { codeId_slug: { codeId: code.id, slug: articleSlug } },
  });
  if (!article) return null;

  const [units, prev, next] = await Promise.all([
    prisma.structuralUnit.findMany({
      where: { codeId: code.id },
      select: { id: true, parentId: true, number: true, title: true, type: true },
    }),
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

  const unitMap = new Map(units.map((unit) => [unit.id, unit]));
  const breadcrumbs: { type: string; number: string | null; title: string }[] = [];
  let cursor = article.unitId;
  while (cursor) {
    const unit = unitMap.get(cursor);
    if (!unit) break;
    breadcrumbs.unshift({ type: unit.type, number: unit.number, title: unit.title });
    cursor = unit.parentId;
  }

  return { code, article, breadcrumbs, prev, next };
}

export interface SearchHit {
  codeSlug: string;
  codeShort: string;
  number: string;
  title: string | null;
  slug: string;
  status: string;
  snippet: string;
}

// ts_headline не экранирует HTML в тексте статьи, а сниппет рендерится через
// dangerouslySetInnerHTML. Поэтому маркеры подсветки — управляющие символы,
// которых не бывает в тексте; HTML экранируется целиком, затем маркеры
// превращаются в <mark>.
const HEADLINE_START = "\u0001";
const HEADLINE_STOP = "\u0002";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function toSafeSnippet(raw: string): string {
  return escapeHtml(raw.replaceAll(HEADLINE_START + HEADLINE_STOP, ""))
    .replaceAll(HEADLINE_START, "<mark>")
    .replaceAll(HEADLINE_STOP, "</mark>");
}

export async function searchArticles(query: string): Promise<SearchHit[]> {
  const hits = await prisma.$queryRaw<SearchHit[]>`
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
    ORDER BY ts_rank(a."searchVector", q) DESC, a."order" ASC
    LIMIT 40;
  `;
  return hits.map((hit) => ({ ...hit, snippet: toSafeSnippet(hit.snippet) }));
}
