import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { matchCodeByName } from "../src/lib/codes";
import { sanitizeFragment } from "./sanitize";
import type {
  CodexSpec,
  ParsedArticle,
  ParsedCode,
  ParsedUnit,
  RawUnit,
  StatusName,
  UnitTypeName,
} from "./types";

export const discrepancies: string[] = [];

function logDiscrepancy(message: string): void {
  discrepancies.push(message);
  console.warn(`  ! ${message}`);
}

function slugFromTitle(title: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
    и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
    с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
    ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };
  return title
    .toLowerCase()
    .split("")
    .map((char) => map[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function firstLine(node: cheerio.Cheerio<Element>): string {
  const link = node.find("a").first();
  const source = link.length > 0 ? link : node;
  const text = source.contents().first().text().trim();
  return text || node.text().trim();
}

function extractHash(node: cheerio.Cheerio<Element>): string | undefined {
  const href = node.find("a[href*='hash=']").first().attr("href") ?? "";
  return /#hash=([0-9a-f]{64})/.exec(href)?.[1];
}

export function parseCodexList(html: string, sourceUrl: string): CodexSpec[] {
  const $ = cheerio.load(html);
  const specs: CodexSpec[] = [];
  let current: CodexSpec | null = null;
  let derivedCount = 0;

  $(".codex-item").each((_, element) => {
    const node = $(element);
    const textBlock = node.find(".codex-item-text").first();
    if (textBlock.length === 0) return;
    const hash = extractHash(node);

    if (node.hasClass("codex-subitem")) {
      if (!current) return;
      if (!hash) {
        logDiscrepancy(`Часть без hash у кодекса ${current.slug}`);
        return;
      }
      current.parts.push({ caption: firstLine(textBlock), hash });
      return;
    }

    const name = firstLine(textBlock);
    if (!name) return;
    const entry = matchCodeByName(name);
    const slug = entry?.slug ?? `code-${slugFromTitle(name).slice(0, 40)}-${++derivedCount}`;
    if (!entry) logDiscrepancy(`Кодекс без явного slug в реестре: "${name}" -> ${slug}`);
    current = {
      slug,
      shortName: entry?.shortName ?? name,
      title: name.replace(/\s*\([^)]*\)\s*$/, "").trim(),
      sourceUrl,
      parts: [],
    };
    specs.push(current);
    if (hash) current.parts.push({ caption: name, hash });
  });

  return specs.filter((spec) => spec.parts.length > 0);
}

const UNIT_TYPE_MAP: Record<string, UnitTypeName> = {
  часть: "PART",
  книга: "PART",
  раздел: "SECTION",
  подраздел: "SECTION",
  глава: "CHAPTER",
  параграф: "PARAGRAPH",
  "§": "PARAGRAPH",
};

function mapUnitType(unit: string): UnitTypeName {
  const key = unit.trim().toLowerCase();
  const mapped = UNIT_TYPE_MAP[key];
  if (mapped) return mapped;
  logDiscrepancy(`Неизвестный тип структурной единицы: "${unit}" -> PARAGRAPH`);
  return "PARAGRAPH";
}

function parseUnitCaption(caption: string): { number: string | null; title: string } {
  const text = caption.replace(/\s+/g, " ").trim();
  const match = /^[А-ЯЁа-яё§]+\s+([IVXLCDM]+|\d+(?:\.\d+)*)\.?\s*(.*)$/u.exec(text);
  if (!match) return { number: null, title: text };
  return { number: match[1] ?? null, title: (match[2] ?? "").trim() };
}

function parseArticleCaption(caption: string): {
  number: string | null;
  title: string | null;
  status: StatusName;
} {
  const text = caption.replace(/\s+/g, " ").trim();
  const match = /^Стать[яи]\s+(\d+(?:\.\d+)*(?:-\d+)?)\.?\s*(.*)$/u.exec(text);
  const number = match?.[1] ?? null;
  const rest = (match?.[2] ?? "").trim();
  const status: StatusName = /утратил[аио]?\s+силу/iu.test(text) ? "REPEALED" : "ACTIVE";
  if (!number) logDiscrepancy(`Не разобран номер статьи из: "${text}"`);
  return { number, title: rest === "" ? null : rest, status };
}

function isArticleUnit(unit: string): boolean {
  return unit.trim().toLowerCase() === "статья";
}

function isInternalCaption(caption: string): boolean {
  return caption.trimStart().startsWith("$");
}

export function buildEbpiCode(rawUnits: RawUnit[], redtextHtml: string): {
  units: ParsedUnit[];
  articles: ParsedArticle[];
} {
  const $ = cheerio.load(redtextHtml);
  const units: ParsedUnit[] = [];
  const articles: ParsedArticle[] = [];
  const stack: { key: string; lvl: number }[] = [];
  let unitOrder = 0;
  let articleOrder = 0;

  for (const raw of rawUnits) {
    if (isInternalCaption(raw.caption)) continue;

    while (stack.length > 0 && stack[stack.length - 1]!.lvl >= raw.lvl) stack.pop();
    const parentKey = stack.length > 0 ? stack[stack.length - 1]!.key : null;

    if (isArticleUnit(raw.unit)) {
      const { number, title, status } = parseArticleCaption(raw.caption);
      if (!number) continue;
      const body = extractArticleBody($, raw.np, raw.npe);
      articles.push({
        unitKey: parentKey,
        number,
        title,
        bodyHtml: body.bodyHtml,
        bodyText: body.bodyText || (status === "REPEALED" ? "Утратила силу." : ""),
        status,
        order: articleOrder++,
      });
      continue;
    }

    const { number, title } = parseUnitCaption(raw.caption);
    units.push({
      key: raw.id,
      parentKey,
      type: mapUnitType(raw.unit),
      number,
      title,
      order: unitOrder++,
    });
    stack.push({ key: raw.id, lvl: raw.lvl });
  }

  return { units, articles };
}

function extractArticleBody(
  $: cheerio.CheerioAPI,
  np: string,
  npe: string,
): { bodyHtml: string; bodyText: string } {
  const start = $(`[id="${np}"]`).first();
  if (start.length === 0) return { bodyHtml: "", bodyText: "" };
  if (np === npe) return { bodyHtml: "", bodyText: "" };

  const end = $(`[id="${npe}"]`).first();
  const between = start.nextUntil(`[id="${npe}"]`);
  const parts: string[] = [];
  between.each((_, element) => {
    parts.push($.html(element));
  });
  if (end.length > 0) parts.push($.html(end));

  return sanitizeFragment(parts.join(""));
}

const RU_MONTHS: Record<string, number> = {
  января: 1, февраля: 2, марта: 3, апреля: 4, мая: 5, июня: 6,
  июля: 7, августа: 8, сентября: 9, октября: 10, ноября: 11, декабря: 12,
};

function latestDate(text: string): Date | null {
  let latest: Date | null = null;
  const regex = /(\d{1,2})\s+([а-яё]+)\s+(\d{4})/giu;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const month = RU_MONTHS[match[2]!.toLowerCase()];
    if (!month) continue;
    const date = new Date(Date.UTC(Number(match[3]), month - 1, Number(match[1])));
    if (!latest || date > latest) latest = date;
  }
  return latest;
}

export function parseConstitution(html: string): ParsedCode {
  const $ = cheerio.load(html);
  const units: ParsedUnit[] = [];
  const articles: ParsedArticle[] = [];
  const editionDate = latestDate($("body").text());

  let sectionKey: string | null = null;
  let chapterKey: string | null = null;
  let expectChapterTitle = false;
  let unitOrder = 0;
  let articleOrder = 0;
  let currentArticle: ParsedArticle | null = null;
  let articleBody: string[] = [];

  const flushArticle = (): void => {
    if (!currentArticle) return;
    const sanitized = sanitizeFragment(articleBody.join(""));
    currentArticle.bodyHtml = sanitized.bodyHtml;
    currentArticle.bodyText = sanitized.bodyText;
    articles.push(currentArticle);
    currentArticle = null;
    articleBody = [];
  };

  $("p").each((_, element) => {
    const node = $(element);
    const text = node.text().replace(/ /g, " ").replace(/\s+/g, " ").trim();
    if (!text) return;

    const sectionMatch = /^РАЗДЕЛ\s+(.+)$/u.exec(text);
    const chapterMatch = /^ГЛАВА\s+(\d+)\s*(.*)$/u.exec(text);
    const articleMatch = /^Статья\s+(\d+(?:\.\d+)*)\s*$/u.exec(text);

    if (sectionMatch) {
      flushArticle();
      sectionKey = `section-${unitOrder}`;
      units.push({
        key: sectionKey,
        parentKey: null,
        type: "SECTION",
        number: sectionMatch[1]!.trim(),
        title: "",
        order: unitOrder++,
      });
      chapterKey = null;
      expectChapterTitle = false;
      return;
    }

    if (chapterMatch) {
      flushArticle();
      chapterKey = `chapter-${unitOrder}`;
      units.push({
        key: chapterKey,
        parentKey: sectionKey,
        type: "CHAPTER",
        number: chapterMatch[1]!.trim(),
        title: (chapterMatch[2] ?? "").trim(),
        order: unitOrder++,
      });
      expectChapterTitle = (chapterMatch[2] ?? "").trim() === "";
      return;
    }

    if (articleMatch) {
      flushArticle();
      expectChapterTitle = false;
      currentArticle = {
        unitKey: chapterKey ?? sectionKey,
        number: articleMatch[1]!,
        title: null,
        bodyHtml: "",
        bodyText: "",
        status: "ACTIVE",
        order: articleOrder++,
      };
      return;
    }

    if (expectChapterTitle && chapterKey && text === text.toUpperCase()) {
      const chapter = units.find((unit) => unit.key === chapterKey);
      if (chapter) chapter.title = text;
      expectChapterTitle = false;
      return;
    }

    if (currentArticle) articleBody.push($.html(element));
  });

  flushArticle();
  return { units, articles, editionDate };
}
