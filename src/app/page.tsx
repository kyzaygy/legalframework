import Link from "next/link";
import { ChevronRight } from "@/components/icons";
import { getCodes } from "@/lib/queries";
import { TelegramModal } from "@/components/TelegramModal";

export const dynamic = "force-dynamic";

function abbrOf(shortName: string): string {
  return shortName.replace(/\s*РФ$/u, "").trim();
}

export default async function HomePage() {
  const codes = await getCodes();
  const constitution = codes.find((code) => code.kind === "CONSTITUTION");
  const codexes = codes.filter((code) => code.kind === "CODE");
  const laws = codes.filter((code) => code.kind === "LAW");

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

        {laws.length > 0 && (
          <>
            <p className="eyebrow codes-label laws-label">Федеральные законы</p>
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
