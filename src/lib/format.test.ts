import { describe, expect, it } from "vitest";
import { formatDate, truncateAtWord } from "./format";

describe("formatDate", () => {
  it("форматирует Date по UTC", () => {
    expect(formatDate(new Date(Date.UTC(2026, 5, 17)))).toBe("17.06.2026");
  });

  it("принимает строку из кэша", () => {
    expect(formatDate("2026-06-17T00:00:00.000Z")).toBe("17.06.2026");
  });

  it("возвращает null для пустых и битых значений", () => {
    expect(formatDate(null)).toBeNull();
    expect(formatDate("не дата")).toBeNull();
  });
});

describe("truncateAtWord", () => {
  it("не трогает короткий текст", () => {
    expect(truncateAtWord("Короткое описание.", 160)).toBe("Короткое описание.");
  });

  it("режет по границе слова и ставит многоточие", () => {
    const result = truncateAtWord(
      "Убийство, то есть умышленное причинение смерти другому человеку, наказывается лишением свободы",
      40,
    );
    expect(result.length).toBeLessThanOrEqual(41);
    expect(result.endsWith("…")).toBe(true);
    expect(result).toBe("Убийство, то есть умышленное причинение…");
  });

  it("схлопывает переводы строк", () => {
    expect(truncateAtWord("а\nб  в", 160)).toBe("а б в");
  });
});
