import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { parseRequisite } from "@/lib/search";
import { prisma } from "@/lib/prisma";
import { searchArticles, type SearchHit } from "@/lib/queries";
import { normalizeSearchQuery } from "@/lib/validate";

export const metadata: Metadata = {
  title: "Поиск",
  robots: { index: false },
};

function pluralizeArticles(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "статья";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "статьи";
  return "статей";
}

function Prompt() {
  return (
    <div className="search-wrap">
      <div className="state">
        <p className="big">Введите статью или слово из закона</p>
        <p>
          Например: «статья 105 УК», «1142 ГК» или просто «наследство». По номеру статьи сразу
          откроем нужный текст.
        </p>
      </div>
    </div>
  );
}

function NoResults({ query }: { query: string }) {
  return (
    <div className="search-wrap">
      <div className="search-head">
        <h1>
          По запросу «<span className="q">{query}</span>»
        </h1>
      </div>
      <div className="state">
        <p className="big">Ничего не нашлось</p>
        <p>Проверьте номер статьи или попробуйте другое слово. Например: «наследство», «кража».</p>
      </div>
    </div>
  );
}

function Results({ query, hits }: { query: string; hits: SearchHit[] }) {
  return (
    <div className="search-wrap">
      <div className="search-head">
        <h1>
          Найдено по запросу «<span className="q">{query}</span>»
        </h1>
        <div className="count">
          {hits.length} {pluralizeArticles(hits.length)}
        </div>
      </div>
      <div className="results">
        {hits.map((hit) => (
          <Link key={`${hit.codeSlug}-${hit.slug}`} className="result" href={`/${hit.codeSlug}/${hit.slug}`}>
            <div className="r-title">
              <span className="r-num">Статья {hit.number}</span>{" "}
              <span className="r-code">{hit.codeShort}</span>
              {hit.title ? ` — ${hit.title}` : ""}
            </div>
            <div className="r-snip" dangerouslySetInnerHTML={{ __html: hit.snippet }} />
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = normalizeSearchQuery(typeof q === "string" ? q : undefined);

  if (!query) {
    return (
      <div className="shell">
        <Prompt />
      </div>
    );
  }

  const requisite = parseRequisite(query);
  if (requisite) {
    const article = await prisma.article.findFirst({
      where: { slug: requisite.articleSlug, code: { slug: requisite.codeSlug } },
      select: { slug: true },
    });
    if (article) redirect(`/${requisite.codeSlug}/${requisite.articleSlug}`);
  }

  const hits = await searchArticles(query);

  return (
    <div className="shell">{hits.length === 0 ? <NoResults query={query} /> : <Results query={query} hits={hits} />}</div>
  );
}
