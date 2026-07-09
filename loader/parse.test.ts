import { describe, expect, it } from "vitest";
import { parseCodexList, parseConstitution } from "./parse";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);

describe("parseCodexList", () => {
  const html = `
    <div class="codex-item">
      <div class="codex-item-text">
        <a href="/content#hash=${HASH_A}">Уголовный кодекс Российской Федерации (УК РФ)</a>
      </div>
    </div>
    <div class="codex-item">
      <div class="codex-item-text">Гражданский кодекс Российской Федерации (ГК РФ)</div>
    </div>
    <div class="codex-item codex-subitem">
      <div class="codex-item-text">
        <a href="/content#hash=${HASH_B}">Часть первая</a>
      </div>
    </div>
    <div class="codex-item codex-subitem">
      <div class="codex-item-text">
        <a href="/content#hash=${HASH_C}">Часть вторая</a>
      </div>
    </div>
  `;

  it("собирает кодексы и их части", () => {
    const specs = parseCodexList(html, "http://pravo.gov.ru/codex/");
    expect(specs.map((spec) => spec.slug)).toEqual(["uk-rf", "gk-rf"]);

    const uk = specs[0]!;
    expect(uk.kind).toBe("CODE");
    expect(uk.title).toBe("Уголовный кодекс Российской Федерации");
    expect(uk.parts).toHaveLength(1);
    expect(uk.parts[0]!.hash).toBe(HASH_A);

    const gk = specs[1]!;
    expect(gk.parts.map((part) => part.hash)).toEqual([HASH_B, HASH_C]);
    expect(gk.parts.map((part) => part.caption)).toEqual(["Часть первая", "Часть вторая"]);
  });

  it("отбрасывает кодексы без единой части", () => {
    const empty = `
      <div class="codex-item">
        <div class="codex-item-text">Семейный кодекс Российской Федерации (СК РФ)</div>
      </div>
    `;
    expect(parseCodexList(empty, "http://pravo.gov.ru/codex/")).toEqual([]);
  });
});

describe("parseConstitution", () => {
  const html = `
    <html><body>
      <p>Конституция Российской Федерации</p>
      <p>(с изменениями на 4 октября 2022 года)</p>
      <p>РАЗДЕЛ ПЕРВЫЙ</p>
      <p>ГЛАВА 1</p>
      <p>ОСНОВЫ КОНСТИТУЦИОННОГО СТРОЯ</p>
      <p>Статья 1</p>
      <p>1. Российская Федерация — Россия есть демократическое федеративное правовое государство.</p>
      <p>2. Наименования Российская Федерация и Россия равнозначны.</p>
      <p>Статья 2</p>
      <p>Человек, его права и свободы являются высшей ценностью.</p>
    </body></html>
  `;

  it("строит дерево раздел → глава и статьи с телом", () => {
    const parsed = parseConstitution(html);

    expect(parsed.units).toHaveLength(2);
    const [section, chapter] = parsed.units;
    expect(section!.type).toBe("SECTION");
    expect(section!.number).toBe("ПЕРВЫЙ");
    expect(chapter!.type).toBe("CHAPTER");
    expect(chapter!.number).toBe("1");
    expect(chapter!.title).toBe("ОСНОВЫ КОНСТИТУЦИОННОГО СТРОЯ");
    expect(chapter!.parentKey).toBe(section!.key);

    expect(parsed.articles).toHaveLength(2);
    const [first, second] = parsed.articles;
    expect(first!.number).toBe("1");
    expect(first!.unitKey).toBe(chapter!.key);
    expect(first!.bodyText).toContain("демократическое федеративное");
    expect(first!.bodyText).toContain("равнозначны");
    expect(second!.number).toBe("2");
    expect(second!.bodyHtml).toContain("<p>");
  });

  it("берёт последнюю дату редакции из текста", () => {
    const parsed = parseConstitution(html);
    expect(parsed.editionDate?.toISOString().slice(0, 10)).toBe("2022-10-04");
  });
});
