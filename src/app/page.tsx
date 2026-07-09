import Link from "next/link";
import { ChevronRight } from "@/components/icons";
import { getCodes } from "@/lib/queries";
import { TelegramModal } from "@/components/TelegramModal";

export const dynamic = "force-dynamic";

// Популярные федеральные законы, вынесенные на главную (курируемый набор из
// loader/laws.ts). Полный перечень — на /zakony.
const POPULAR_LAW_SLUGS = new Set([
  "zpp",
  "o-personalnyh-dannyh",
  "o-potrebitelskom-kredite",
  "osago",
  "o-bankrotstve",
  "ob-ispolnitelnom-proizvodstve",
  "o-poryadke-rassmotreniya-obrashcheniy-grazhdan",
]);

function abbrOf(shortName: string): string {
  return shortName.replace(/\s*РФ$/u, "").trim();
}

export default async function HomePage() {
  const codes = await getCodes();
  const constitution = codes.find((code) => code.kind === "CONSTITUTION");
  const codexes = codes.filter((code) => code.kind === "CODE");
  const allLaws = codes.filter((code) => code.kind === "LAW");
  const laws = allLaws.filter((code) => POPULAR_LAW_SLUGS.has(code.slug));

  return (
    <>
      <div className="shell codes">
        <section className="hero">
          <h1>Все кодексы РФ и Конституция</h1>
          <p>
            Бесплатно, в действующей редакции. Найдите статью по номеру или по слову из закона.
          </p>
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

        {allLaws.length > 0 && (
          <>
            <div className="laws-head laws-label">
              <p className="eyebrow codes-label">Федеральные законы</p>
              {allLaws.length > laws.length && (
                <Link className="laws-all" href="/zakony">
                  Все федеральные законы ({allLaws.length}) →
                </Link>
              )}
            </div>
            <div className="code-grid">
              {laws.map((code) => (
                <Link key={code.slug} className="code-item" href={`/${code.slug}`}>
                  <span className="abbr">{code.shortName}</span>
                  <span className="nm">{code.title}</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
      <TelegramModal />
    </>
  );
}
