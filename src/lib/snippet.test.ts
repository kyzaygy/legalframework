import { describe, expect, it } from "vitest";
import { HEADLINE_START, HEADLINE_STOP, escapeHtml, toSafeSnippet } from "./snippet";

describe("toSafeSnippet", () => {
  it("экранирует HTML и превращает маркеры в <mark>", () => {
    const raw = `Право ${HEADLINE_START}собственности${HEADLINE_STOP} <b>и</b> "владения"`;
    expect(toSafeSnippet(raw)).toBe(
      "Право <mark>собственности</mark> &lt;b&gt;и&lt;/b&gt; &quot;владения&quot;",
    );
  });

  it("вычищает пустые пары маркеров", () => {
    expect(toSafeSnippet(`x${HEADLINE_START}${HEADLINE_STOP}y`)).toBe("xy");
  });

  it("не позволяет тексту статьи внедрить разметку", () => {
    expect(toSafeSnippet('<script>alert("x")</script>')).not.toContain("<script>");
  });
});

describe("escapeHtml", () => {
  it("экранирует амперсанд первым", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });
});
