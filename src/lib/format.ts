export function formatDate(date: Date | null): string | null {
  if (!date) return null;
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getUTCFullYear()}`;
}

export function articleHref(codeSlug: string, articleSlug: string): string {
  return `/${codeSlug}/${articleSlug}`;
}
