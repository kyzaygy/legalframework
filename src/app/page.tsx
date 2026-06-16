import Link from "next/link";
import { SearchBox } from "@/components/SearchBox";
import { ChevronRight } from "@/components/icons";
import { getCodes } from "@/lib/queries";

export const revalidate = 3600;

function abbrOf(shortName: string): string {
  return shortName.replace(/\s*РФ$/u, "").trim();
}

export default async function HomePage() {
  const codes = await getCodes();
  const constitution = codes.find((code) => code.slug === "konstituciya");
  const codexes = codes.filter((code) => code.slug !== "konstituciya");

  return (
    <div className="shell codes">
      <section className="hero">
        <h1>Все кодексы РФ и Конституция</h1>
        <p>
          Бесплатно, в действующей редакции. Найдите статью по номеру или по слову из закона.
        </p>
        <SearchBox variant="hero" placeholder="Например: статья 105 УК или «наследство»" />
      </section>

      {constitution && (
        <Link className="const-row" href={`/${constitution.slug}`}>
          <div>
            <div className="ttl">{constitution.title}</div>
            <div className="meta">Основной закон · действующая редакция</div>
          </div>
          <ChevronRight size={22} className="chev" />
        </Link>
      )}

      <p className="eyebrow codes-label">Кодексы</p>
      <div className="code-grid">
        {codexes.map((code) => (
          <Link key={code.slug} className="code-item" href={`/${code.slug}`}>
            <span className="abbr">{abbrOf(code.shortName)}</span>
            <span className="nm">{code.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
