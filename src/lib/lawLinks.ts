import { CODE_REGISTRY } from "./codes";

// Автолинковка перекрёстных ссылок в текстах законов: «статьей 26.11
// настоящего Кодекса», «статьи 15 ГК РФ», «статьями 309 и 310 Гражданского
// кодекса Российской Федерации» превращаются в ссылки на статьи.
//
// Работает по санитизированному HTML (только белый список тегов, без
// атрибутов): текст обрабатывается ТОЛЬКО вне тегов, href собирается из
// валидированного слага и номера — инъекция исключена. Ссылка ставится
// только если целевая статья существует (резолвер проверяет по БД).

export interface LawRef {
  codeSlug: string;
  number: string;
}

// «статья/статье/статьёй/статьями …» + один или несколько номеров.
// \b не работает с кириллицей (word-класс в JS — только ASCII), поэтому
// границу слова изображает lookbehind.
const REF_START =
  /(?<![а-яё])стать(?:ями|ям|ях|ёй|ей|и|е|ю|я)\s+(\d+(?:\.\d+)*(?:\s*(?:,|и|или)\s*\d+(?:\.\d+)*)*)/giu;

// Контекст после списка номеров, определяющий целевой документ.
const SELF_CONTEXT =
  /^\s*настоящ[а-яё]*\s+(?:Кодекс[а-яё]*|Федеральн[а-яё]*\s+закон[а-яё]*|закон[а-яё]*)/iu;

const ABBR_ALTERNATION = CODE_REGISTRY.flatMap((entry) => entry.abbreviations)
  .sort((a, b) => b.length - a.length)
  .join("|");
// «… ГК РФ», «… КоАП РФ» — аббревиатура кодекса сразу после номеров.
const ABBR_CONTEXT = new RegExp(`^\\s*(${ABBR_ALTERNATION})\\s+РФ`, "iu");

// «… Гражданского кодекса Российской Федерации» — полное имя по ключевым словам.
interface KeywordEntry {
  keyword: string;
  slug: string;
}
const KEYWORD_ENTRIES: KeywordEntry[] = CODE_REGISTRY.flatMap((entry) =>
  entry.keywords.map((keyword) => ({ keyword, slug: entry.slug })),
);

const ABBR_TO_SLUG = new Map<string, string>();
for (const entry of CODE_REGISTRY) {
  for (const abbr of entry.abbreviations) ABBR_TO_SLUG.set(abbr.toUpperCase(), entry.slug);
}

function matchFullName(context: string): string | null {
  // Смотрим не дальше 60 символов после номеров: «... Гражданского кодекса
  // Российской Федерации» укладывается, а случайные совпадения дальше — нет.
  const head = context.slice(0, 60).toLowerCase().replace(/ё/g, "е");
  if (!/^\s*[а-я]/iu.test(head)) return null;
  for (const { keyword, slug } of KEYWORD_ENTRIES) {
    const at = head.indexOf(keyword.replace(/ё/g, "е"));
    if (at >= 0 && at <= 3) return slug;
  }
  // «кодекс …» после ключевого слова тоже покрыт keywords; отдельно ловим
  // порядок «<прилагательное> кодекса»: жилищного кодекса, семейного кодекса…
  const adjective = /^\s*([а-я-]+)\s+кодекс/iu.exec(head);
  if (adjective) {
    for (const { keyword, slug } of KEYWORD_ENTRIES) {
      if (keyword.startsWith(adjective[1]!.slice(0, 6))) return slug;
    }
  }
  return null;
}

function splitNumbers(list: string): string[] {
  return list
    .split(/\s*(?:,|и|или)\s*/u)
    .map((value) => value.trim())
    .filter((value) => /^\d+(?:\.\d+)*$/.test(value));
}

function resolveTarget(context: string, currentCodeSlug: string): string | null {
  if (SELF_CONTEXT.test(context)) return currentCodeSlug;
  const abbr = ABBR_CONTEXT.exec(context);
  if (abbr) return ABBR_TO_SLUG.get(abbr[1]!.toUpperCase()) ?? null;
  return matchFullName(context);
}

interface RefOccurrence {
  start: number; // границы списка номеров внутри текстового сегмента
  end: number;
  numbers: string[];
  codeSlug: string;
}

function findInText(text: string, currentCodeSlug: string): RefOccurrence[] {
  const found: RefOccurrence[] = [];
  REF_START.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = REF_START.exec(text)) !== null) {
    const numbersList = match[1]!;
    const numbersStart = match.index + match[0].length - numbersList.length;
    const context = text.slice(match.index + match[0].length);
    const codeSlug = resolveTarget(context, currentCodeSlug);
    if (!codeSlug) continue;
    found.push({
      start: numbersStart,
      end: numbersStart + numbersList.length,
      numbers: splitNumbers(numbersList),
      codeSlug,
    });
  }
  return found;
}

const TAG_SPLIT = /(<[^>]*>)/g;

// Первый проход: собрать все упоминания из HTML-фрагментов.
export function collectLawRefs(htmlFragments: string[], currentCodeSlug: string): LawRef[] {
  const refs: LawRef[] = [];
  const seen = new Set<string>();
  for (const html of htmlFragments) {
    for (const segment of html.split(TAG_SPLIT)) {
      if (segment.startsWith("<")) continue;
      for (const occurrence of findInText(segment, currentCodeSlug)) {
        for (const number of occurrence.numbers) {
          const key = `${occurrence.codeSlug}/${number}`;
          if (seen.has(key)) continue;
          seen.add(key);
          refs.push({ codeSlug: occurrence.codeSlug, number });
        }
      }
    }
  }
  return refs;
}

export type RefResolver = (codeSlug: string, number: string) => string | null;

function linkifyText(text: string, currentCodeSlug: string, resolve: RefResolver): string {
  const occurrences = findInText(text, currentCodeSlug);
  if (occurrences.length === 0) return text;

  let result = "";
  let cursor = 0;
  for (const occurrence of occurrences) {
    result += text.slice(cursor, occurrence.start);
    let list = text.slice(occurrence.start, occurrence.end);
    // Внутри списка оборачиваем каждый номер отдельной ссылкой.
    for (const number of occurrence.numbers) {
      const articleSlug = resolve(occurrence.codeSlug, number);
      if (!articleSlug) continue;
      // Номер как отдельное «слово» в списке; экранирование не нужно —
      // номер и slug состоят из [0-9a-z.-].
      list = list.replace(
        new RegExp(`(^|[^\\d.])(${number.replace(/\./g, "\\.")})(?![\\d.])`, "u"),
        `$1<a class="law-ref" href="/${occurrence.codeSlug}/${articleSlug}">$2</a>`,
      );
    }
    result += list;
    cursor = occurrence.end;
  }
  result += text.slice(cursor);
  return result;
}

// Второй проход: расставить ссылки в HTML-фрагменте.
export function linkifyLawHtml(html: string, currentCodeSlug: string, resolve: RefResolver): string {
  return html
    .split(TAG_SPLIT)
    .map((segment) => (segment.startsWith("<") ? segment : linkifyText(segment, currentCodeSlug, resolve)))
    .join("");
}
