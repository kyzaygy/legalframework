import { describe, expect, it } from "vitest";
import { parseLawBlocks, type PartNode, type RawNode, type SubNode } from "./lawBlocks";

describe("parseLawBlocks", () => {
  it("собирает часть с пунктами, вступлением и хвостом", () => {
    const nodes = parseLawBlocks(
      "<p>1. Первая часть:</p>" +
        "<p>1) первый пункт;</p>" +
        "<p>а) буквенный пункт;</p>" +
        "<p>Абзац после пунктов.</p>",
    );
    expect(nodes).toHaveLength(1);
    const part = nodes[0] as PartNode;
    expect(part.kind).toBe("part");
    expect(part.marker).toBe("1.");
    expect(part.intro).toEqual(["Первая часть:"]);
    expect(part.children.map((child) => child.marker)).toEqual(["1)", "а)"]);
    expect(part.tail).toEqual(["Абзац после пунктов."]);
  });

  it("помечает утратившие силу части", () => {
    const nodes = parseLawBlocks("<p>2. Утратила силу.</p>");
    const part = nodes[0] as PartNode;
    expect(part.repealed).toBe(true);
  });

  it("распознаёт составные номера частей", () => {
    const nodes = parseLawBlocks("<p>5.1. Дополнительная часть.</p>");
    const part = nodes[0] as PartNode;
    expect(part.marker).toBe("5.1.");
  });

  it("пункт без части остаётся самостоятельным узлом", () => {
    const nodes = parseLawBlocks("<p>б) отдельный пункт.</p>");
    const sub = nodes[0] as SubNode;
    expect(sub.kind).toBe("sub");
    expect(sub.marker).toBe("б)");
  });

  it("таблица проходит как raw и прерывает текущую часть", () => {
    const nodes = parseLawBlocks(
      "<p>1. Часть с таблицей:</p><table><tr><td>x</td></tr></table><p>Обычный абзац.</p>",
    );
    expect(nodes.map((node) => node.kind)).toEqual(["part", "raw", "paragraph"]);
    expect((nodes[1] as RawNode).html).toContain("<table>");
  });

  it("абзац без маркера — paragraph", () => {
    const nodes = parseLawBlocks("<p>Просто текст статьи.</p>");
    expect(nodes[0]!.kind).toBe("paragraph");
  });
});
