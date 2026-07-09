import { describe, expect, it } from "vitest";
import { parseRequisite } from "./search";

describe("parseRequisite", () => {
  it("распознаёт «ст 105 УК»", () => {
    expect(parseRequisite("ст 105 УК")).toEqual({
      codeSlug: "uk-rf",
      articleSlug: "statya-105",
    });
  });

  it("распознаёт составной номер и «РФ» с точками", () => {
    expect(parseRequisite("ст. 105.1 УК РФ")).toEqual({
      codeSlug: "uk-rf",
      articleSlug: "statya-105.1",
    });
  });

  it("распознаёт полное слово «статья»", () => {
    expect(parseRequisite("статья 14 СК")).toEqual({
      codeSlug: "sk-rf",
      articleSlug: "statya-14",
    });
  });

  it("работает без слова «статья»", () => {
    expect(parseRequisite("1142 гк")).toEqual({
      codeSlug: "gk-rf",
      articleSlug: "statya-1142",
    });
  });

  it("берёт номер статьи, а не номер части", () => {
    expect(parseRequisite("ч. 2 ст. 105 ук")).toEqual({
      codeSlug: "uk-rf",
      articleSlug: "statya-105",
    });
  });

  it("возвращает null без номера или без кодекса", () => {
    expect(parseRequisite("наследство")).toBeNull();
    expect(parseRequisite("статья 105")).toBeNull();
    expect(parseRequisite("УК РФ")).toBeNull();
  });
});
