import { config } from "./config";
import { fetchJson, fetchText } from "./http";
import { buildEbpiCode, parseCodexList, parseConstitution } from "./parse";
import type {
  CodexSpec,
  ContentResponse,
  ParsedArticle,
  ParsedCode,
  ParsedUnit,
  RedactionsResponse,
  RedTextResponse,
} from "./types";

const CONSTITUTION_SPEC: CodexSpec = {
  slug: "konstituciya",
  shortName: "Конституция РФ",
  title: "Конституция Российской Федерации",
  sourceUrl: "http://pravo.gov.ru/proxy/ips/?doc_itself=&nd=102027595",
  parts: [],
};

function api(path: string): string {
  return config.apiBase + path;
}

function parseReddate(value: string): Date | null {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export async function fetchCodexSpecs(): Promise<CodexSpec[]> {
  const html = await fetchText(config.codexUrl);
  return parseCodexList(html, config.codexUrl);
}

async function resolveActualRedaction(hash: string): Promise<{ redid: number; editionDate: Date | null }> {
  const t = encodeURIComponent(JSON.stringify({ hash, ttl: 1 }));
  const data = await fetchJson<RedactionsResponse>(api(`redactions/?bpa=${config.bpa}&t=${t}`));
  if (data.error) throw new Error(`redactions: ${data.error}`);
  const redactions = data.redactions ?? [];
  const withContent = redactions
    .filter((red) => red.redcompleted && red.hascontent)
    .sort((a, b) => b.reddate.localeCompare(a.reddate));
  const chosen =
    withContent.find((red) => red.actual) ??
    withContent[0] ??
    redactions.find((red) => red.actual) ??
    redactions[0];
  if (!chosen) throw new Error(`Нет доступных редакций для hash ${hash}`);
  return { redid: chosen.redid, editionDate: parseReddate(chosen.reddate) };
}

async function fetchEbpiPart(hash: string): Promise<{
  units: ParsedUnit[];
  articles: ParsedArticle[];
  editionDate: Date | null;
}> {
  const { redid, editionDate } = await resolveActualRedaction(hash);
  const content = await fetchJson<ContentResponse>(api(`getcontent/?bpa=${config.bpa}&rdk=${redid}`));
  if (content.error || !content.data) throw new Error(`getcontent: ${content.error ?? "пустой ответ"}`);
  const redtext = await fetchJson<RedTextResponse>(api(`redtext?bpa=${config.bpa}&t=${redid}&ttl=0`));
  if (redtext.error) throw new Error(`redtext: ${redtext.error}`);
  const built = buildEbpiCode(content.data, redtext.redtext);
  return { ...built, editionDate };
}

function namespaceKeys(prefix: string, units: ParsedUnit[], articles: ParsedArticle[]): void {
  for (const unit of units) {
    unit.key = `${prefix}${unit.key}`;
    unit.parentKey = unit.parentKey === null ? null : `${prefix}${unit.parentKey}`;
  }
  for (const article of articles) {
    article.unitKey = article.unitKey === null ? null : `${prefix}${article.unitKey}`;
  }
}

export async function fetchCodex(spec: CodexSpec): Promise<ParsedCode> {
  const multipart = spec.parts.length > 1;
  const units: ParsedUnit[] = [];
  const articles: ParsedArticle[] = [];
  const editionDates: Date[] = [];
  let order = 0;

  for (let index = 0; index < spec.parts.length; index += 1) {
    const part = spec.parts[index]!;
    const result = await fetchEbpiPart(part.hash);
    if (result.editionDate) editionDates.push(result.editionDate);

    const prefix = `p${index}:`;
    namespaceKeys(prefix, result.units, result.articles);

    let partRootKey: string | null = null;
    if (multipart) {
      partRootKey = `${prefix}root`;
      units.push({
        key: partRootKey,
        parentKey: null,
        type: "PART",
        number: String(index + 1),
        title: part.caption,
        order: order++,
      });
    }

    for (const unit of result.units) {
      if (unit.parentKey === null) unit.parentKey = partRootKey;
      unit.order = order++;
      units.push(unit);
    }
    for (const article of result.articles) {
      if (article.unitKey === null) article.unitKey = partRootKey;
      articles.push(article);
    }
  }

  articles.forEach((article, index) => {
    article.order = index;
  });

  const editionDate = editionDates.length > 0
    ? new Date(Math.max(...editionDates.map((date) => date.getTime())))
    : null;

  return { units, articles, editionDate };
}

export function constitutionSpec(): CodexSpec {
  return CONSTITUTION_SPEC;
}

export async function fetchConstitution(): Promise<ParsedCode> {
  const html = await fetchText(CONSTITUTION_SPEC.sourceUrl);
  return parseConstitution(html);
}
