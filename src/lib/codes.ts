export interface CodeEntry {
  slug: string;
  shortName: string;
  abbreviations: string[];
  keywords: string[];
}

export const CODE_REGISTRY: CodeEntry[] = [
  { slug: "konstituciya", shortName: "Конституция РФ", abbreviations: ["КОНСТИТУЦИЯ"], keywords: ["конституц"] },
  { slug: "gk-rf", shortName: "ГК РФ", abbreviations: ["ГК"], keywords: ["гражданский кодекс"] },
  { slug: "uk-rf", shortName: "УК РФ", abbreviations: ["УК"], keywords: ["уголовный кодекс"] },
  { slug: "sk-rf", shortName: "СК РФ", abbreviations: ["СК"], keywords: ["семейный"] },
  { slug: "tk-rf", shortName: "ТК РФ", abbreviations: ["ТК"], keywords: ["трудовой"] },
  { slug: "zhk-rf", shortName: "ЖК РФ", abbreviations: ["ЖК"], keywords: ["жилищный"] },
  { slug: "zk-rf", shortName: "ЗК РФ", abbreviations: ["ЗК"], keywords: ["земельный"] },
  { slug: "nk-rf", shortName: "НК РФ", abbreviations: ["НК"], keywords: ["налоговый"] },
  { slug: "koap-rf", shortName: "КоАП РФ", abbreviations: ["КОАП"], keywords: ["об административных правонарушениях"] },
  { slug: "gpk-rf", shortName: "ГПК РФ", abbreviations: ["ГПК"], keywords: ["гражданский процессуальный"] },
  { slug: "upk-rf", shortName: "УПК РФ", abbreviations: ["УПК"], keywords: ["уголовно-процессуальный"] },
  { slug: "apk-rf", shortName: "АПК РФ", abbreviations: ["АПК"], keywords: ["арбитражный процессуальный"] },
  { slug: "uik-rf", shortName: "УИК РФ", abbreviations: ["УИК"], keywords: ["уголовно-исполнительный"] },
  { slug: "kas-rf", shortName: "КАС РФ", abbreviations: ["КАС"], keywords: ["административного судопроизводства"] },
  { slug: "bk-rf", shortName: "БК РФ", abbreviations: ["БК"], keywords: ["бюджетный"] },
  { slug: "grk-rf", shortName: "ГрК РФ", abbreviations: ["ГРК"], keywords: ["градостроительный"] },
  { slug: "lk-rf", shortName: "ЛК РФ", abbreviations: ["ЛК"], keywords: ["лесной"] },
  { slug: "vk-rf", shortName: "ВК РФ", abbreviations: ["ВК"], keywords: ["водный кодекс"] },
  { slug: "vzk-rf", shortName: "ВзК РФ", abbreviations: ["ВЗК"], keywords: ["воздушный"] },
  { slug: "ktm-rf", shortName: "КТМ РФ", abbreviations: ["КТМ"], keywords: ["торгового мореплавания"] },
  { slug: "kvvt-rf", shortName: "КВВТ РФ", abbreviations: ["КВВТ"], keywords: ["внутреннего водного транспорта"] },
  { slug: "tk-eaes", shortName: "ТК ЕАЭС", abbreviations: ["ТКЕАЭС"], keywords: ["таможенный"] },
];

const REGISTRY_BY_ABBR = new Map<string, CodeEntry>();
for (const entry of CODE_REGISTRY) {
  for (const abbr of entry.abbreviations) {
    REGISTRY_BY_ABBR.set(abbr, entry);
  }
}

function normalizeAbbr(raw: string): string {
  const letters = raw
    .toUpperCase()
    .replace(/РОССИЙСКОЙ ФЕДЕРАЦИИ/g, "")
    .replace(/[^А-ЯЁA-Z]/g, "");
  return letters.endsWith("РФ") ? letters.slice(0, -2) : letters;
}

export function matchCodeByName(name: string): CodeEntry | null {
  const paren = /\(([^)]+)\)/.exec(name);
  if (paren && paren[1]) {
    const entry = REGISTRY_BY_ABBR.get(normalizeAbbr(paren[1]));
    if (entry) return entry;
  }
  const lower = name.toLowerCase();
  return CODE_REGISTRY.find((entry) => entry.keywords.some((keyword) => lower.includes(keyword))) ?? null;
}

export function lookupRequisiteSlug(abbr: string): string | null {
  return REGISTRY_BY_ABBR.get(normalizeAbbr(abbr))?.slug ?? null;
}
