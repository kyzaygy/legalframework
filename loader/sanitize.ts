import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";

const ALLOWED_TAGS = new Set([
  "p",
  "ol",
  "ul",
  "li",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "b",
  "i",
  "sup",
]);

const DROP_TAGS = "script, style, input, label, img, br";

function depth(node: AnyNode): number {
  let count = 0;
  let current = node.parent;
  while (current) {
    count += 1;
    current = current.parent;
  }
  return count;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/ /g, " ").replace(/[ \t]+/g, " ").replace(/\s+\n/g, "\n").trim();
}

export interface SanitizedBody {
  bodyHtml: string;
  bodyText: string;
}

export function sanitizeFragment(rawHtml: string): SanitizedBody {
  const $ = cheerio.load(rawHtml, null, false);

  $(DROP_TAGS).remove();

  const elements = $("*").toArray() as Element[];
  elements.sort((a, b) => depth(b) - depth(a));
  for (const element of elements) {
    const tag = element.tagName?.toLowerCase();
    if (!tag) continue;
    if (ALLOWED_TAGS.has(tag)) {
      element.attribs = {};
    } else {
      $(element).replaceWith($(element).contents());
    }
  }

  $("p, li, td, th").each((_, element) => {
    const node = $(element);
    if (normalizeWhitespace(node.text()) === "") node.remove();
  });

  const bodyHtml = normalizeWhitespace($.html())
    .replace(/>\s+</g, "><")
    .trim();

  const paragraphs: string[] = [];
  $("p, li, td, th").each((_, element) => {
    const text = normalizeWhitespace($(element).text());
    if (text) paragraphs.push(text);
  });
  const bodyText = paragraphs.length > 0 ? paragraphs.join("\n") : normalizeWhitespace($.root().text());

  return { bodyHtml, bodyText };
}
