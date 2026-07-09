import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LawBody } from "@/components/LawBody";
import { formatDate, truncateAtWord } from "@/lib/format";
import { getArticle } from "@/lib/queries";
import { isValidArticleSlug, isValidCodeSlug } from "@/lib/validate";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  PART: "Часть",
  SECTION: "Раздел",
  CHAPTER: "Глава",
  PARAGRAPH: "§",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Действующая редакция",
  REPEALED: "Утратила силу",
  FUTURE: "Будущая редакция",
};

function crumbLabel(crumb: { type: string; number: string | null; title: string }): string {
  const word = TYPE_LABEL[crumb.type] ?? "";
  if (crumb.number) return `${word} ${crumb.number}`.trim();
  return crumb.title;
}

function articleHeading(article: { number: string; title: string | null }): string {
  return article.title
    ? `Статья ${article.number}. ${article.title}`
    : `Статья ${article.number}`;
}

function toIsoDate(value: Date | string | null): string | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

interface ArticleParams {
  params: Promise<{ codeSlug: string; article: string }>;
}

export async function generateMetadata({ params }: ArticleParams): Promise<Metadata> {
  const { codeSlug, article } = await params;
  if (!isValidCodeSlug(codeSlug) || !isValidArticleSlug(article)) return {};
  const data = await getArticle(codeSlug, article);
  if (!data) return {};
  const title = `${articleHeading(data.article)} ${data.code.shortName}`;
  const description = truncateAtWord(data.article.bodyText, 160);
  const canonical = `/${codeSlug}/${article}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title,
      description,
      url: canonical,
    },
  };
}

export default async function ArticlePage({ params }: ArticleParams) {
  const { codeSlug, article } = await params;
  if (!isValidCodeSlug(codeSlug) || !isValidArticleSlug(article)) notFound();

  const data = await getArticle(codeSlug, article);
  if (!data) notFound();

  const { code, article: art, breadcrumbs, prev, next } = data;
  const edition = formatDate(art.editionDate ?? code.editionDate);

  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
  const pageUrl = `${siteUrl}/${code.slug}/${art.slug}`;
  const isoModified = toIsoDate(art.editionDate ?? code.editionDate);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Legislation",
        name: articleHeading(art),
        isPartOf: { "@type": "Legislation", name: code.title },
        inLanguage: "ru",
        url: pageUrl,
        legislationLegalForce:
          art.status === "ACTIVE"
            ? "https://schema.org/InForce"
            : "https://schema.org/NotInForce",
        ...(isoModified ? { dateModified: isoModified } : {}),
        ...(code.sourceUrl ? { sameAs: code.sourceUrl } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: code.shortName,
            item: `${siteUrl}/${code.slug}`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: `Статья ${art.number}`,
            item: pageUrl,
          },
        ],
      },
    ],
  };

  return (
    <div className="shell">
      <script
        type="application/ld+json"
        // «<» экранируется, чтобы содержимое из БД не могло закрыть тег script.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replaceAll("<", "\\u003c") }}
      />
      <article className="article">
        <nav className="crumbs">
          <Link href={`/${code.slug}`}>{code.shortName}</Link>
          <span className="sep">›</span>
          {breadcrumbs.map((crumb) => (
            <span key={crumb.anchor}>
              <Link className="lnk" href={`/${code.slug}#${crumb.anchor}`}>
                {crumbLabel(crumb)}
              </Link>
              <span className="sep">›</span>
            </span>
          ))}
          <span className="cur">Статья {art.number}</span>
        </nav>

        <header className="art-head">
          <span className="bar" />
          {art.title ? (
            <div>
              <div className="num">Статья {art.number}</div>
              <h1 className="ttl">{art.title}</h1>
            </div>
          ) : (
            <div className="num alone">Статья {art.number}</div>
          )}
        </header>

        <div className="art-meta">
          <span className={`badge badge--${art.status.toLowerCase()}`}>
            {STATUS_LABEL[art.status] ?? art.status}
          </span>
          <span>
            {code.shortName}
            {edition ? ` · обновлено ${edition}` : " · консолидированный текст"}
          </span>
        </div>

        <LawBody bodyHtml={art.bodyHtml} />

        <nav className="art-nav">
          {prev ? (
            <Link className="prev" href={`/${code.slug}/${prev.slug}`}>
              <span className="dir">Предыдущая</span>
              <span className="lbl">← Статья {prev.number}</span>
              {prev.title && <div className="sub">{prev.title}</div>}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link className="next" href={`/${code.slug}/${next.slug}`}>
              <span className="dir">Следующая</span>
              <span className="lbl">Статья {next.number} →</span>
              {next.title && <div className="sub">{next.title}</div>}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </article>
    </div>
  );
}
