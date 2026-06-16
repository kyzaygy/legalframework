export interface CodexPart {
  caption: string;
  hash: string;
}

export interface CodexSpec {
  slug: string;
  shortName: string;
  title: string;
  sourceUrl: string;
  parts: CodexPart[];
}

export interface Redaction {
  redid: number;
  reddate: string;
  redstatus: string;
  actual: boolean;
  redcompleted: boolean;
  hascontent: boolean;
}

export interface RedactionsResponse {
  docid: number;
  redactions: Redaction[];
  error?: string;
}

export interface RawUnit {
  id: string;
  np: string;
  npe: string;
  caption: string;
  unit: string;
  lvl: number;
}

export interface ContentResponse {
  data?: RawUnit[];
  error?: string;
  status?: string;
}

export interface RedTextResponse {
  redtext: string;
  error?: string;
}

export type UnitTypeName = "PART" | "SECTION" | "CHAPTER" | "PARAGRAPH";

export type StatusName = "ACTIVE" | "REPEALED" | "FUTURE";

export interface ParsedUnit {
  key: string;
  parentKey: string | null;
  type: UnitTypeName;
  number: string | null;
  title: string;
  order: number;
}

export interface ParsedArticle {
  unitKey: string | null;
  number: string;
  title: string | null;
  bodyHtml: string;
  bodyText: string;
  status: StatusName;
  order: number;
}

export interface ParsedCode {
  units: ParsedUnit[];
  articles: ParsedArticle[];
  editionDate: Date | null;
}
