import { lookupRequisiteSlug } from "./codes";

export interface Requisite {
  codeSlug: string;
  articleSlug: string;
}

const SKIP_TOKENS = new Set(["ст", "статья", "статьи", "рф"]);

export function parseRequisite(raw: string): Requisite | null {
  const tokens = raw
    .toLowerCase()
    .replace(/,/g, " ")
    // Точка внутри составного номера (105.1) — часть номера; остальные
    // точки («ст.», «ук.») — разделители.
    .replace(/(?<!\d)\.|\.(?!\d)/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  let number: string | null = null;
  let codeSlug: string | null = null;

  for (const token of tokens) {
    if (/^\d+(?:\.\d+)*$/.test(token)) {
      number = token;
      continue;
    }
    if (SKIP_TOKENS.has(token)) continue;
    const slug = lookupRequisiteSlug(token);
    if (slug) codeSlug = slug;
  }

  if (number && codeSlug) {
    return { codeSlug, articleSlug: `statya-${number}` };
  }
  return null;
}
