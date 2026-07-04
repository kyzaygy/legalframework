import { config } from "./config";
import { fetchJson, fetchText } from "./http";
import { FEDERAL_LAWS } from "./laws";
import { buildEbpiCode, parseCodexList, parseConstitution } from "./parse";
import type {
  CardResponse,
  CodexPart,
  CodexSpec,
  ContentResponse,
  ParsedArticle,
  ParsedCode,
  ParsedUnit,
  RedactionsResponse,
  RedTextResponse,
} from "./types";

type EbpiLocator = { hash: string } | { docid: number };

const CONSTITUTION_SPEC: CodexSpec = {
  slug: "konstituciya",
  shortName: "Конституция РФ",
  title: "Конституция Российской Федерации",
  sourceUrl: "http://pravo.gov.ru/proxy/ips/?doc_itself=&nd=102027595",
  kind: "CONSTITUTION",
  parts: [],
};

function api(path: string): string {
  return config.apiBase + path;
}

function partLocator(part: CodexPart): EbpiLocator {
  if (part.hash) return { hash: part.hash };
  if (part.docid !== undefined) return { docid: part.docid };
  throw new Error("Часть документа без hash и docid");
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

async function resolveActualRedaction(locator: EbpiLocator): Promise<{ redid: number; editionDate: Date | null }> {
  const t = encodeURIComponent(JSON.stringify({ ...locator, ttl: 1 }));
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
  if (!chosen) throw new Error(`Нет доступных редакций для ${JSON.stringify(locator)}`);
  // redid приходит из внешнего API и подставляется в URL следующих запросов —
  // принимаем только целое число, чтобы исключить инъекцию в query string.
  if (!Number.isInteger(chosen.redid) || chosen.redid <= 0) {
    throw new Error(`Некорректный redid из API: ${JSON.stringify(chosen.redid)}`);
  }
  return { redid: chosen.redid, editionDate: parseReddate(chosen.reddate) };
}

async function fetchEbpiPart(locator: EbpiLocator): Promise<{
  units: ParsedUnit[];
  articles: ParsedArticle[];
  editionDate: Date | null;
}> {
  const { redid, editionDate } = await resolveActualRedaction(locator);
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
    const result = await fetchEbpiPart(partLocator(part));
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

async function fetchCard(docid: number): Promise<CardResponse> {
  const t = encodeURIComponent(JSON.stringify({ docid, ttl: 1 }));
  const data = await fetchJson<CardResponse>(api(`card/?bpa=${config.bpa}&t=${t}`));
  if (data.error) throw new Error(`card: ${data.error}`);
  return data;
}

function lawNumber(card: CardResponse): string {
  const adopted = card.adoptions?.[0]?.onumber?.trim();
  if (adopted) return adopted;
  const fromPassing = /№\s*(\S+)\s*$/u.exec(card.docpassing)?.[1];
  return fromPassing ?? card.docname;
}

function lawTitle(card: CardResponse): string {
  const actType = card.docpassing.split(/\s+от\s+/u)[0]?.trim();
  if (!actType) return card.docname;
  return `${actType} «${card.docname}»`;
}

export async function fetchLawSpecs(): Promise<CodexSpec[]> {
  const specs: CodexSpec[] = [];
  for (const law of FEDERAL_LAWS) {
    const card = await fetchCard(law.docid);
    // dochash приходит из внешнего API и попадает в sourceUrl — принимаем
    // только hex-хэш ожидаемого формата.
    if (!/^[0-9a-f]{64}$/i.test(card.dochash)) {
      throw new Error(`Некорректный dochash из API для docid=${law.docid}`);
    }
    specs.push({
      slug: law.slug,
      shortName: lawNumber(card),
      title: lawTitle(card),
      sourceUrl: `http://actual.pravo.gov.ru/content/content.html#hash=${card.dochash}&ttl=1`,
      kind: "LAW",
      parts: [{ caption: card.docname, docid: law.docid }],
    });
  }
  return specs;
}
