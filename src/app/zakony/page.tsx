import type { Metadata } from "next";
import Link from "next/link";
import { getLaws, type LawListItem } from "@/lib/queries";
import { normalizeSearchQuery } from "@/lib/validate";

export const dynamic = "force-dynamic";

// Законов тысячи: страница отдаётся кусками, чтобы HTML не разрастался на
// мегабайты. Фильтр — обычная GET-форма, работает без JavaScript.
const PAGE_SIZE = 200;

interface ZakonyParams {
  searchParams: Promise<{ q?: string; page?: string }>;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/ё/g, "е").trim();
}

function parsePage(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

function filterLaws(laws: LawListItem[], query: string): LawListItem[] {
  const q = normalize(query);
  if (!q) return laws;
  return laws.filter(
    (law) => normalize(law.title).includes(q) || normalize(law.shortName).includes(q),
  );
}

export async function generateMetadata({ searchParams }: ZakonyParams): Promise<Metadata> {
  const { q, page } = await searchParams;
  const query = normalizeSearchQuery(q);
  const pageNumber = parsePage(page);
  return {
    title: "Федеральные законы",
    description:
      "Все действующие федеральные законы Российской Федерации в актуальной редакции. Поиск по названию и номеру.",
    alternates: {
      canonical: pageNumber > 1 ? `/zakony?page=${pageNumber}` : "/zakony",
    },
    // Отфильтрованные выдачи — не для индекса, это дубли каталога.
    ...(query ? { robots: { index: false } } : {}),
  };
}

function pageHref(query: string, page: number): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `/zakony?${suffix}` : "/zakony";
}

export default async function ZakonyPage({ searchParams }: ZakonyParams) {
  const { q, page } = await searchParams;
  const query = normalizeSearchQuery(q);

  const laws = await getLaws();
  const filtered = filterLaws(laws, query);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageNumber = Math.min(parsePage(page), totalPages);
  const visible = filtered.slice((pageNumber - 1) * PAGE_SIZE, pageNumber * PAGE_SIZE);

  return (
    <div className="shell">
      <div className="toc-head">
        <p className="eyebrow">Федеральные законы</p>
        <h1>Федеральные законы РФ</h1>
        <div className="meta">Действующие федеральные законы в актуальной редакции.</div>
      </div>

      <form className="zk-filter" method="get" action="/zakony">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Фильтр по названию или номеру закона"
          aria-label="Фильтр по названию или номеру закона"
          autoComplete="off"
          maxLength={200}
        />
        <span className="zk-count">
          {filtered.length} из {laws.length}
        </span>
      </form>

      {visible.length === 0 ? (
        <div className="state">
          <p className="big">Ничего не нашлось</p>
          <p>Попробуйте другое слово из названия закона или его номер.</p>
        </div>
      ) : (
        <div className="zk-list">
          {visible.map((law) => (
            <Link key={law.slug} className="zk-item" href={`/${law.slug}`}>
              <span className="zk-num">{law.shortName}</span>
              <span className="zk-title">{law.title}</span>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="zk-pager" aria-label="Страницы каталога">
          {pageNumber > 1 ? (
            <Link href={pageHref(query, pageNumber - 1)}>← Назад</Link>
          ) : (
            <span />
          )}
          <span className="zk-page">
            Страница {pageNumber} из {totalPages}
          </span>
          {pageNumber < totalPages ? (
            <Link href={pageHref(query, pageNumber + 1)}>Вперёд →</Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
