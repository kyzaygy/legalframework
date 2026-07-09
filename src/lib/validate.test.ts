import { describe, expect, it } from "vitest";
import { isValidArticleSlug, isValidCodeSlug, normalizeSearchQuery } from "./validate";

describe("isValidCodeSlug", () => {
  it("принимает слаги loader'а", () => {
    expect(isValidCodeSlug("uk-rf")).toBe(true);
    expect(isValidCodeSlug("fz-152-2006")).toBe(true);
    expect(isValidCodeSlug("konstituciya")).toBe(true);
  });

  it("отклоняет мусор", () => {
    expect(isValidCodeSlug("UK-RF")).toBe(false);
    expect(isValidCodeSlug("-uk")).toBe(false);
    expect(isValidCodeSlug("uk rf")).toBe(false);
    expect(isValidCodeSlug("")).toBe(false);
  });
});

describe("isValidArticleSlug", () => {
  it("принимает номера с точками и суффиксами", () => {
    expect(isValidArticleSlug("statya-105")).toBe(true);
    expect(isValidArticleSlug("statya-105.1")).toBe(true);
    expect(isValidArticleSlug("statya-105-2")).toBe(true);
  });

  it("отклоняет прочие пути", () => {
    expect(isValidArticleSlug("statya-")).toBe(false);
    expect(isValidArticleSlug("glava-1")).toBe(false);
    expect(isValidArticleSlug("statya-<script>")).toBe(false);
  });
});

describe("normalizeSearchQuery", () => {
  it("схлопывает пробелы и обрезает по лимиту", () => {
    expect(normalizeSearchQuery("  ст   105\n УК ")).toBe("ст 105 УК");
    expect(normalizeSearchQuery("а".repeat(300))).toHaveLength(200);
    expect(normalizeSearchQuery(undefined)).toBe("");
  });
});
