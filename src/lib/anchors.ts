// Якоря структурных единиц на странице оглавления кодекса: /gk-rf#razdel-ii-glava-9.
// Строятся по цепочке «тип-номер» от корня, чтобы § 1 разных глав не совпадали.

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function slugifyAnchor(value: string): string {
  return value
    .toLowerCase()
    .split("")
    .map((char) => TRANSLIT[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const TYPE_ANCHOR: Record<string, string> = {
  PART: "chast",
  SECTION: "razdel",
  CHAPTER: "glava",
  PARAGRAPH: "par",
};

export function unitAnchor(
  parentAnchor: string | null,
  type: string,
  number: string | null,
  order: number,
): string {
  const base = TYPE_ANCHOR[type] ?? "unit";
  // Без номера (или если номер не дал ни одного символа) — глобально
  // уникальный внутри кодекса order, чтобы якорь не схлопнулся с соседним.
  const suffix = (number ? slugifyAnchor(number) : "") || String(order);
  const segment = `${base}-${suffix}`;
  return parentAnchor ? `${parentAnchor}-${segment}` : segment;
}
