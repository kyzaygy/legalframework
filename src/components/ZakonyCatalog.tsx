"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { LawListItem } from "@/lib/queries";

function normalize(value: string): string {
  return value.toLowerCase().replace(/ё/g, "е").trim();
}

export function ZakonyCatalog({ laws }: { laws: LawListItem[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return laws;
    return laws.filter(
      (law) => normalize(law.title).includes(q) || normalize(law.shortName).includes(q),
    );
  }, [laws, query]);

  return (
    <div>
      <div className="zk-filter">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Фильтр по названию или номеру закона"
          aria-label="Фильтр по названию или номеру закона"
          autoComplete="off"
          maxLength={200}
        />
        <span className="zk-count">
          {filtered.length} из {laws.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="state">
          <p className="big">Ничего не нашлось</p>
          <p>Попробуйте другое слово из названия закона или его номер.</p>
        </div>
      ) : (
        <div className="zk-list">
          {filtered.map((law) => (
            <Link key={law.slug} className="zk-item" href={`/${law.slug}`}>
              <span className="zk-num">{law.shortName}</span>
              <span className="zk-title">{law.title}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
