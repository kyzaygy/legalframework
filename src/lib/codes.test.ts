import { describe, expect, it } from "vitest";
import { lookupRequisiteSlug, matchCodeByName } from "./codes";

describe("matchCodeByName", () => {
  it("находит кодекс по аббревиатуре в скобках", () => {
    expect(matchCodeByName("Уголовный кодекс Российской Федерации (УК РФ)")?.slug).toBe("uk-rf");
    expect(
      matchCodeByName("Кодекс Российской Федерации об административных правонарушениях (КоАП РФ)")
        ?.slug,
    ).toBe("koap-rf");
  });

  it("находит кодекс по ключевым словам без скобок", () => {
    expect(matchCodeByName("Кодекс административного судопроизводства Российской Федерации")?.slug).toBe(
      "kas-rf",
    );
    expect(matchCodeByName("Семейный кодекс Российской Федерации")?.slug).toBe("sk-rf");
  });

  it("возвращает null для неизвестного названия", () => {
    expect(matchCodeByName("Модельный кодекс интеллектуальной собственности")).toBeNull();
  });
});

describe("lookupRequisiteSlug", () => {
  it("нормализует регистр, точки и суффикс РФ", () => {
    expect(lookupRequisiteSlug("ук")).toBe("uk-rf");
    expect(lookupRequisiteSlug("У.К. РФ")).toBe("uk-rf");
    expect(lookupRequisiteSlug("КоАП")).toBe("koap-rf");
  });

  it("возвращает null для неизвестной аббревиатуры", () => {
    expect(lookupRequisiteSlug("ааа")).toBeNull();
  });
});
