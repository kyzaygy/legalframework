import { describe, expect, it } from "vitest";
import { slugifyAnchor, unitAnchor } from "./anchors";

describe("slugifyAnchor", () => {
  it("транслитерирует кириллицу и римские номера", () => {
    expect(slugifyAnchor("ПЕРВЫЙ")).toBe("pervyy");
    expect(slugifyAnchor("II")).toBe("ii");
    expect(slugifyAnchor("105.1")).toBe("105-1");
  });

  it("вычищает спецсимволы", () => {
    expect(slugifyAnchor("§")).toBe("");
  });
});

describe("unitAnchor", () => {
  it("строит сегмент по типу и номеру", () => {
    expect(unitAnchor(null, "CHAPTER", "5", 3)).toBe("glava-5");
    expect(unitAnchor(null, "SECTION", "II", 1)).toBe("razdel-ii");
  });

  it("наследует якорь родителя", () => {
    expect(unitAnchor("razdel-ii", "PARAGRAPH", "1", 7)).toBe("razdel-ii-par-1");
  });

  it("подставляет order, когда номера нет или он пуст после чистки", () => {
    expect(unitAnchor(null, "SECTION", null, 4)).toBe("razdel-4");
    expect(unitAnchor(null, "PARAGRAPH", "§", 9)).toBe("par-9");
  });
});
