import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Лимит одного sitemap — 50 000 URL. Статьи бьём на чанки по 20 000, каждый
// становится отдельным /sitemap/<id>.xml (Next строит индекс автоматически).
const CHUNK_SIZE = 20000;
// Число чанков фиксировано и не зависит от БД: generateSitemaps выполняется на
// этапе сборки образа, где базы нет. 8 × 20 000 = 160 000 URL — с большим
// запасом на все федеральные законы; лишние чанки отдают пустой sitemap.
const MAX_CHUNKS = 8;

function base(): string {
  return process.env.SITE_URL ?? "http://localhost:3000";
}

export function generateSitemaps(): { id: number }[] {
  return Array.from({ length: MAX_CHUNKS }, (_, id) => ({ id }));
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const site = base();

  const articles = await prisma.article.findMany({
    orderBy: { id: "asc" },
    skip: id * CHUNK_SIZE,
    take: CHUNK_SIZE,
    select: { slug: true, editionDate: true, code: { select: { slug: true } } },
  });

  const articleEntries: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `${site}/${article.code.slug}/${article.slug}`,
    ...(article.editionDate ? { lastModified: article.editionDate } : {}),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  // Статические и списочные URL кладём только в первый чанк.
  if (id !== 0) return articleEntries;

  const codes = await prisma.code.findMany({ select: { slug: true, editionDate: true } });
  return [
    { url: site, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/zakony`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${site}/izmeneniya`, changeFrequency: "daily", priority: 0.5 },
    ...codes.map((code) => ({
      url: `${site}/${code.slug}`,
      ...(code.editionDate ? { lastModified: code.editionDate } : {}),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...articleEntries,
  ];
}
