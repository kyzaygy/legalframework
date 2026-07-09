// Даты из кэшированных запросов (unstable_cache) приходят строками после
// JSON-сериализации, из прямых запросов — объектами Date.
export function formatDate(date: Date | string | null): string | null {
  if (!date) return null;
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return null;
  const day = String(value.getUTCDate()).padStart(2, "0");
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${value.getUTCFullYear()}`;
}

export function articleHref(codeSlug: string, articleSlug: string): string {
  return `/${codeSlug}/${articleSlug}`;
}

// Обрезка meta-description по границе слова, чтобы не рвать слово посередине.
export function truncateAtWord(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  // Если пробел слишком далеко от края (одно гигантское «слово») — режем жёстко.
  const trimmed = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed.replace(/[\s,;:.—-]+$/u, "")}…`;
}
