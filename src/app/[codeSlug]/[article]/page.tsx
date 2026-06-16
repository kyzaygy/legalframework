import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LawBody } from "@/components/LawBody";
import { formatDate } from "@/lib/format";
import { getArticle } from "@/lib/queries";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  PART: "Часть",
  SECTION: "Раздел",
  CHAPTER: "Глава",
  PARAGRAPH: "§",
};

const STATUS_LABEL: Record<string, string> = {
  REPEALED: "Утратила силу",
  FUTURE: "Будущая редакция",
};

function crumbLabel(crumb: { type: string; number: string | null; title: string }): string {
  const word = TYPE_LABEL[crumb.type] ?? "";
  if (crumb.number) return `${word} ${crumb.number}`.trim();
  return crumb.title;
}

interface ArticleParams {
  params: Promise<{ codeSlug: string; article: string }>;
}

export async function generateMetadata({ params }: ArticleParams): Promise<Metadata> {
  const { codeSlug, article } = await params;
  const data = await getArticle(codeSlug, article);
  if (!data) return {};
  const heading = data.article.title
    ? `Статья ${data.article.number}. ${data.article.title}`
    : `Статья ${data.article.number}`;
  const title = `${heading} ${data.code.shortName}`;
  return {
    title,
    description: data.article.bodyText.slice(0, 160),
    alternates: { canonical: `/${codeSlug}/${article}` },
  };
}

export default async function ArticlePage({ params }: ArticleParams) {
  const { codeSlug, article } = await params;
  if (!article.startsWith("statya-")) notFound();

  const data = await getArticle(codeSlug, article);
  if (!data) notFound();

  const { code, article: art, breadcrumbs, prev, next } = data;
  const edition = formatDate(art.editionDate ?? code.editionDate);

  return (
    <div className="shell">
      <article className="article">
        <nav className="crumbs">
          <Link href={`/${code.slug}`}>{code.shortName}</Link>
          <span className="sep">›</span>
          {breadcrumbs.map((crumb, index) => (
            <span key={index}>
              <span className="lnk">{crumbLabel(crumb)}</span>
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
          {STATUS_LABEL[art.status] && <span className="art-status">{STATUS_LABEL[art.status]}</span>}
          <span>{edition ? `Действующая редакция · ${edition}` : "Консолидированный текст"}</span>
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
