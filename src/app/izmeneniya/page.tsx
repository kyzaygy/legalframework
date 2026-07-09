import type { Metadata } from "next";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { getRecentChanges, type ChangeItem } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Изменения в законах",
  description:
    "Что изменилось в кодексах и федеральных законах РФ: новые документы, изменённые и исключённые статьи по данным последних импортов с pravo.gov.ru.",
  alternates: { canonical: "/izmeneniya" },
};

function dayKey(at: ChangeItem["at"]): string {
  return formatDate(at) ?? "";
}

function changeText(change: ChangeItem): { text: string; href: string | null } {
  const codeHref = `/${change.codeSlug}`;
  switch (change.kind) {
    case "CODE_ADDED":
      return { text: "добавлен на сайт", href: codeHref };
    case "CODE_UPDATED":
      return {
        text: change.count
          ? `обновлена редакция (изменений: ${change.count})`
          : "обновлена редакция",
        href: codeHref,
      };
    case "ARTICLE_ADDED":
      return {
        text: `новая статья ${change.articleNumber}${change.articleTitle ? `. ${change.articleTitle}` : ""}`,
        href: change.articleSlug ? `${codeHref}/${change.articleSlug}` : codeHref,
      };
    case "ARTICLE_UPDATED":
      return {
        text: `изменена статья ${change.articleNumber}${change.articleTitle ? `. ${change.articleTitle}` : ""}`,
        href: change.articleSlug ? `${codeHref}/${change.articleSlug}` : codeHref,
      };
    case "ARTICLE_REMOVED":
      return { text: `статья ${change.articleNumber} исключена`, href: null };
    default:
      return { text: change.kind, href: codeHref };
  }
}

export default async function IzmeneniyaPage() {
  const changes = await getRecentChanges();

  const byDay = new Map<string, ChangeItem[]>();
  for (const change of changes) {
    const key = dayKey(change.at);
    const list = byDay.get(key) ?? [];
    list.push(change);
    byDay.set(key, list);
  }

  return (
    <div className="shell">
      <div className="toc-head">
        <p className="eyebrow">Изменения</p>
        <h1>Изменения в законах</h1>
        <div className="meta">
          Новые документы и изменённые статьи по данным импортов с pravo.gov.ru.
        </div>
      </div>

      {byDay.size === 0 ? (
        <div className="state">
          <p className="big">Пока нет записей</p>
          <p>Журнал наполняется при обновлениях корпуса — загляните после ближайшего импорта.</p>
        </div>
      ) : (
        <div className="chg-feed">
          {[...byDay.entries()].map(([day, items]) => (
            <section key={day} className="chg-day">
              <h2 className="chg-date">{day}</h2>
              <ul className="chg-list">
                {items.map((change) => {
                  const { text, href } = changeText(change);
                  return (
                    <li key={change.id} className="chg-item">
                      <span className="chg-code">{change.codeShort}</span>
                      {href ? <Link href={href}>{text}</Link> : <span>{text}</span>}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
