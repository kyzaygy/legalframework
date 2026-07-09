import { describe, expect, it } from "vitest";
import { collectLawRefs, linkifyLawHtml, type RefResolver } from "./lawLinks";

const resolveAll: RefResolver = (_code, number) => `statya-${number}`;
const resolveNone: RefResolver = () => null;

describe("collectLawRefs", () => {
  it("находит ссылку на статью настоящего кодекса", () => {
    const refs = collectLawRefs(["в соответствии со статьей 26.11 настоящего Кодекса"], "koap-rf");
    expect(refs).toEqual([{ codeSlug: "koap-rf", number: "26.11" }]);
  });

  it("находит ссылку по аббревиатуре другого кодекса", () => {
    const refs = collectLawRefs(["с учетом статьи 15 ГК РФ"], "koap-rf");
    expect(refs).toEqual([{ codeSlug: "gk-rf", number: "15" }]);
  });

  it("находит перечисление номеров", () => {
    const refs = collectLawRefs(["предусмотренных статьями 309 и 310 настоящего Кодекса"], "gk-rf");
    expect(refs).toEqual([
      { codeSlug: "gk-rf", number: "309" },
      { codeSlug: "gk-rf", number: "310" },
    ]);
  });

  it("находит полное название кодекса", () => {
    const refs = collectLawRefs(
      ["согласно статье 15 Гражданского кодекса Российской Федерации"],
      "koap-rf",
    );
    expect(refs).toEqual([{ codeSlug: "gk-rf", number: "15" }]);
  });

  it("для «настоящего Федерального закона» использует текущий документ", () => {
    const refs = collectLawRefs(["в статье 5 настоящего Федерального закона"], "zpp");
    expect(refs).toEqual([{ codeSlug: "zpp", number: "5" }]);
  });

  it("пропускает упоминания без определимой цели", () => {
    expect(collectLawRefs(["как сказано в статье 10 неизвестного акта"], "gk-rf")).toEqual([]);
    expect(collectLawRefs(["статья без номера"], "gk-rf")).toEqual([]);
  });

  it("не смотрит внутрь тегов", () => {
    expect(collectLawRefs(['<p title="статьи 5 настоящего Кодекса">текст</p>'], "gk-rf")).toEqual(
      [],
    );
  });
});

describe("linkifyLawHtml", () => {
  it("оборачивает номер ссылкой", () => {
    const html = linkifyLawHtml(
      "<p>в соответствии со статьей 26.11 настоящего Кодекса</p>",
      "koap-rf",
      resolveAll,
    );
    expect(html).toBe(
      '<p>в соответствии со статьей <a class="law-ref" href="/koap-rf/statya-26.11">26.11</a> настоящего Кодекса</p>',
    );
  });

  it("оборачивает каждый номер перечисления", () => {
    const html = linkifyLawHtml(
      "<p>статьями 309 и 310 настоящего Кодекса</p>",
      "gk-rf",
      resolveAll,
    );
    expect(html).toContain('href="/gk-rf/statya-309">309</a>');
    expect(html).toContain('href="/gk-rf/statya-310">310</a>');
  });

  it("не трогает текст, если статья не существует", () => {
    const source = "<p>статьей 9999 настоящего Кодекса</p>";
    expect(linkifyLawHtml(source, "gk-rf", resolveNone)).toBe(source);
  });

  it("не путает 26.11 с 26.1", () => {
    const html = linkifyLawHtml(
      "<p>статьями 26.1 и 26.11 настоящего Кодекса</p>",
      "koap-rf",
      resolveAll,
    );
    expect(html).toContain('href="/koap-rf/statya-26.1">26.1</a>');
    expect(html).toContain('href="/koap-rf/statya-26.11">26.11</a>');
  });

  it("сохраняет разметку вокруг", () => {
    const html = linkifyLawHtml(
      "<p><b>Важно:</b> статья 5 настоящего Кодекса</p>",
      "gk-rf",
      resolveAll,
    );
    expect(html).toBe(
      '<p><b>Важно:</b> статья <a class="law-ref" href="/gk-rf/statya-5">5</a> настоящего Кодекса</p>',
    );
  });
});
