export const SEARCH_QUERY_MAX_LENGTH = 200;

// Слаги кодексов генерируются loader'ом: латиница, цифры, дефисы (gk-rf, code-...-1).
const CODE_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

// Слаги статей: statya-<номер>, номер может содержать точки и дефисные суффиксы
// (statya-105, statya-105.1, statya-105-2).
const ARTICLE_SLUG = /^statya-\d[\d.-]{0,30}$/;

export function normalizeSearchQuery(raw: string | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim().slice(0, SEARCH_QUERY_MAX_LENGTH);
}

export function isValidCodeSlug(slug: string): boolean {
  return CODE_SLUG.test(slug);
}

export function isValidArticleSlug(slug: string): boolean {
  return ARTICLE_SLUG.test(slug);
}
