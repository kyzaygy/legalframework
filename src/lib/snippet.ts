// ts_headline не экранирует HTML в тексте статьи, а сниппет рендерится через
// dangerouslySetInnerHTML. Поэтому маркеры подсветки — управляющие символы,
// которых не бывает в тексте; HTML экранируется целиком, затем маркеры
// превращаются в <mark>.
export const HEADLINE_START = "\u0001";
export const HEADLINE_STOP = "\u0002";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function toSafeSnippet(raw: string): string {
  return escapeHtml(raw.replaceAll(HEADLINE_START + HEADLINE_STOP, ""))
    .replaceAll(HEADLINE_START, "<mark>")
    .replaceAll(HEADLINE_STOP, "</mark>");
}
