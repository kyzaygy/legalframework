import type { PrismaClient } from "@prisma/client";
import { discrepancies } from "./parse";
import type { CodexSpec, ParsedCode } from "./types";

export interface ImportSummary {
  slug: string;
  units: number;
  articles: number;
  repealed: number;
}

export async function importCode(
  prisma: PrismaClient,
  spec: CodexSpec,
  parsed: ParsedCode,
  order: number,
): Promise<ImportSummary> {
  const code = await prisma.code.upsert({
    where: { slug: spec.slug },
    create: {
      slug: spec.slug,
      title: spec.title,
      shortName: spec.shortName,
      editionDate: parsed.editionDate,
      sourceUrl: spec.sourceUrl,
      order,
    },
    update: {
      title: spec.title,
      shortName: spec.shortName,
      editionDate: parsed.editionDate,
      sourceUrl: spec.sourceUrl,
      order,
    },
  });

  await prisma.article.deleteMany({ where: { codeId: code.id } });
  await prisma.structuralUnit.deleteMany({ where: { codeId: code.id } });

  const keyToId = new Map<string, string>();
  let remaining = [...parsed.units];
  while (remaining.length > 0) {
    const ready = remaining.filter(
      (unit) => unit.parentKey === null || keyToId.has(unit.parentKey),
    );
    if (ready.length === 0) {
      discrepancies.push(`Висячие ссылки на родителя в ${spec.slug}, прикреплены к корню`);
      remaining.forEach((unit) => {
        unit.parentKey = null;
      });
      continue;
    }
    for (const unit of ready) {
      const created = await prisma.structuralUnit.create({
        data: {
          codeId: code.id,
          parentId: unit.parentKey ? keyToId.get(unit.parentKey)! : null,
          type: unit.type,
          number: unit.number,
          title: unit.title,
          order: unit.order,
        },
      });
      keyToId.set(unit.key, created.id);
    }
    remaining = remaining.filter((unit) => !keyToId.has(unit.key));
  }

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

  if (articleData.length > 0) {
    await prisma.article.createMany({ data: articleData });
  }

  return {
    slug: spec.slug,
    units: parsed.units.length,
    articles: parsed.articles.length,
    repealed: parsed.articles.filter((article) => article.status === "REPEALED").length,
  };
}
