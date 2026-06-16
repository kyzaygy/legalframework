export interface SubNode {
  kind: "sub";
  marker: string;
  html: string;
  repealed: boolean;
}

export interface PartNode {
  kind: "part";
  marker: string;
  intro: string[];
  children: SubNode[];
  tail: string[];
  repealed: boolean;
}

export interface ParagraphNode {
  kind: "paragraph";
  html: string;
  repealed: boolean;
}

export interface RawNode {
  kind: "raw";
  html: string;
}

export type LawNode = PartNode | SubNode | ParagraphNode | RawNode;

const SPACE = "(?:\\s|&nbsp;|\\u00a0)";
const PART_MARKER = new RegExp(`^${SPACE}*(\\d+(?:\\.\\d+)*)\\.${SPACE}+`);
const SUB_MARKER = new RegExp(
  `^${SPACE}*([А-Яа-яёЁA-Za-z]\\d*(?:\\.\\d+)?|\\d+(?:\\.\\d+)*)\\)${SPACE}+`,
);
const REPEALED = /утратил[аио]?\s+силу/i;

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/ /g, " ");
}

function splitBlocks(html: string): string[] {
  const blocks: string[] = [];
  const regex = /<p>([\s\S]*?)<\/p>|<(table|ul|ol)>[\s\S]*?<\/\2>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    blocks.push(match[0]);
  }
  return blocks;
}

export function parseLawBlocks(bodyHtml: string): LawNode[] {
  const nodes: LawNode[] = [];
  let currentPart: PartNode | null = null;
  let afterSubs = false;

  for (const block of splitBlocks(bodyHtml)) {
    if (!block.startsWith("<p>")) {
      nodes.push({ kind: "raw", html: block });
      currentPart = null;
      afterSubs = false;
      continue;
    }

    const inner = block.replace(/^<p>/, "").replace(/<\/p>$/, "");
    const text = stripTags(inner).trim();
    const repealed = REPEALED.test(text);

    const partMatch = PART_MARKER.exec(inner);
    if (partMatch) {
      const node: PartNode = {
        kind: "part",
        marker: `${partMatch[1]}.`,
        intro: [inner.slice(partMatch[0].length)],
        children: [],
        tail: [],
        repealed,
      };
      nodes.push(node);
      currentPart = node;
      afterSubs = false;
      continue;
    }

    const subMatch = SUB_MARKER.exec(inner);
    if (subMatch) {
      const node: SubNode = {
        kind: "sub",
        marker: `${subMatch[1]})`,
        html: inner.slice(subMatch[0].length),
        repealed,
      };
      if (currentPart) {
        currentPart.children.push(node);
        afterSubs = true;
      } else {
        nodes.push(node);
      }
      continue;
    }

    if (currentPart && afterSubs) {
      currentPart.tail.push(inner);
    } else if (currentPart) {
      currentPart.intro.push(inner);
    } else {
      nodes.push({ kind: "paragraph", html: inner, repealed });
    }
  }

  return nodes;
}
