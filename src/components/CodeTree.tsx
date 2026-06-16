"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "./icons";
import type { CodeTree as CodeTreeData, TreeArticle, TreeUnit } from "@/lib/queries";

const TYPE_LABEL: Record<string, string> = {
  PART: "Часть",
  SECTION: "Раздел",
  CHAPTER: "Глава",
  PARAGRAPH: "§",
};

function unitLabel(unit: TreeUnit): string {
  const word = TYPE_LABEL[unit.type] ?? "";
  const number = unit.number ? ` ${unit.number}` : "";
  const separator = unit.title ? ". " : "";
  return `${word}${number}${separator}${unit.title}`.trim();
}

function Leaf({ codeSlug, article }: { codeSlug: string; article: TreeArticle }) {
  return (
    <Link className="tleaf" href={`/${codeSlug}/${article.slug}`}>
      <span className="num">ст. {article.number}</span>
      <span>{article.title ?? "Без названия"}</span>
    </Link>
  );
}

function Branch({
  codeSlug,
  unit,
  depth,
}: {
  codeSlug: string;
  unit: TreeUnit;
  depth: number;
}) {
  const [open, setOpen] = useState(depth === 0);
  return (
    <div className={`tnode${open ? "" : " collapsed"}`}>
      <button className={`tbranch lvl${depth}`} type="button" onClick={() => setOpen((value) => !value)}>
        <span className="tw">
          <ChevronDown size={11} />
        </span>
        <span className="lbl">{unitLabel(unit)}</span>
      </button>
      <div className="tkids">
        {unit.children.map((child) => (
          <Branch key={child.id} codeSlug={codeSlug} unit={child} depth={depth + 1} />
        ))}
        {unit.articles.map((article) => (
          <Leaf key={article.slug} codeSlug={codeSlug} article={article} />
        ))}
      </div>
    </div>
  );
}

export function CodeTree({ codeSlug, tree }: { codeSlug: string; tree: CodeTreeData }) {
  return (
    <div className="tree">
      {tree.rootUnits.map((unit) => (
        <Branch key={unit.id} codeSlug={codeSlug} unit={unit} depth={0} />
      ))}
      {tree.rootArticles.map((article) => (
        <Leaf key={article.slug} codeSlug={codeSlug} article={article} />
      ))}
    </div>
  );
}
