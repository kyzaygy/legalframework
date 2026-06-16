import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.SITE_URL ?? "http://localhost:3000";
  const [codes, articles] = await Promise.all([
    prisma.code.findMany({ select: { slug: true } }),
    prisma.article.findMany({ select: { slug: true, code: { select: { slug: true } } } }),
  ]);

  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    ...codes.map((code) => ({
      url: `${base}/${code.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...articles.map((article) => ({
      url: `${base}/${article.code.slug}/${article.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
