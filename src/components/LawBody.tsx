import { slugifyAnchor } from "@/lib/anchors";
import { parseLawBlocks, type LawNode, type PartNode, type SubNode } from "@/lib/lawBlocks";
import { collectLawRefs, linkifyLawHtml, type RefResolver } from "@/lib/lawLinks";
import { resolveArticleRefs } from "@/lib/queries";
import { AnchorMark } from "./AnchorMark";

type Linkify = (html: string) => string;

function RepealedTag() {
  return <span className="repealed-tag">утратил силу</span>;
}

// Якорь пункта из маркера: «1.» → p-1, «а)» → p-a, «26.1.» → p-26-1.
// Вложенные подпункты наследуют префикс родителя: p-2-a.
class AnchorIds {
  private used = new Set<string>();

  make(marker: string, parent?: string): string {
    const base = `${parent ?? "p"}-${slugifyAnchor(marker) || "x"}`;
    let id = base;
    let n = 2;
    while (this.used.has(id)) id = `${base}-${n++}`;
    this.used.add(id);
    return id;
  }
}

function Sub({ node, id, linkify }: { node: SubNode; id: string; linkify: Linkify }) {
  return (
    <div id={id} className={`node sub${node.repealed ? " repealed" : ""}`}>
      <AnchorMark id={id} marker={node.marker} />
      <div className="tx">
        <p>
          <span dangerouslySetInnerHTML={{ __html: linkify(node.html) }} />
          {node.repealed && <RepealedTag />}
        </p>
      </div>
    </div>
  );
}

function Part({
  node,
  id,
  ids,
  linkify,
}: {
  node: PartNode;
  id: string;
  ids: AnchorIds;
  linkify: Linkify;
}) {
  return (
    <div id={id} className={`node part${node.repealed ? " repealed" : ""}`}>
      <AnchorMark id={id} marker={node.marker} />
      <div className="tx">
        {node.intro.map((html, index) => (
          <p key={`intro-${index}`}>
            <span dangerouslySetInnerHTML={{ __html: linkify(html) }} />
            {node.repealed && index === 0 && <RepealedTag />}
          </p>
        ))}
        {node.children.length > 0 && (
          <div className="children">
            {node.children.map((child, index) => (
              <Sub key={`sub-${index}`} node={child} id={ids.make(child.marker, id)} linkify={linkify} />
            ))}
          </div>
        )}
        {node.tail.map((html, index) => (
          <p
            key={`tail-${index}`}
            className="tail"
            dangerouslySetInnerHTML={{ __html: linkify(html) }}
          />
        ))}
      </div>
    </div>
  );
}

function nodeHtmls(nodes: LawNode[]): string[] {
  const htmls: string[] = [];
  for (const node of nodes) {
    if (node.kind === "part") {
      htmls.push(...node.intro, ...node.tail);
      for (const child of node.children) htmls.push(child.html);
    } else {
      htmls.push(node.html);
    }
  }
  return htmls;
}

export async function LawBody({ bodyHtml, codeSlug }: { bodyHtml: string; codeSlug: string }) {
  const nodes = parseLawBlocks(bodyHtml);

  // Перекрёстные ссылки: сначала собрать упоминания, потом одним заходом
  // проверить существование целевых статей, ссылки ставить только на живые.
  const refs = collectLawRefs(nodeHtmls(nodes), codeSlug);
  const resolved = refs.length > 0 ? await resolveArticleRefs(refs) : {};
  const resolve: RefResolver = (code, number) => resolved[`${code}/${number}`] ?? null;
  const linkify: Linkify = (html) => linkifyLawHtml(html, codeSlug, resolve);

  const ids = new AnchorIds();
  return (
    <div className="law">
      {nodes.map((node, index) => {
        switch (node.kind) {
          case "part":
            return <Part key={index} node={node} id={ids.make(node.marker)} ids={ids} linkify={linkify} />;
          case "sub":
            return <Sub key={index} node={node} id={ids.make(node.marker)} linkify={linkify} />;
          case "raw":
            return <div key={index} dangerouslySetInnerHTML={{ __html: node.html }} />;
          case "paragraph":
            return (
              <p key={index} className={node.repealed ? "repealed" : undefined}>
                <span dangerouslySetInnerHTML={{ __html: linkify(node.html) }} />
                {node.repealed && <RepealedTag />}
              </p>
            );
        }
      })}
    </div>
  );
}
