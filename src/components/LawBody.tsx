import { parseLawBlocks, type LawNode, type PartNode, type SubNode } from "@/lib/lawBlocks";

function RepealedTag() {
  return <span className="repealed-tag">утратил силу</span>;
}

function Sub({ node }: { node: SubNode }) {
  return (
    <div className={`node sub${node.repealed ? " repealed" : ""}`}>
      <span className="mk">{node.marker}</span>
      <div className="tx">
        <p>
          <span dangerouslySetInnerHTML={{ __html: node.html }} />
          {node.repealed && <RepealedTag />}
        </p>
      </div>
    </div>
  );
}

function Part({ node }: { node: PartNode }) {
  return (
    <div className={`node part${node.repealed ? " repealed" : ""}`}>
      <span className="mk">{node.marker}</span>
      <div className="tx">
        {node.intro.map((html, index) => (
          <p key={`intro-${index}`}>
            <span dangerouslySetInnerHTML={{ __html: html }} />
            {node.repealed && index === 0 && <RepealedTag />}
          </p>
        ))}
        {node.children.length > 0 && (
          <div className="children">
            {node.children.map((child, index) => (
              <Sub key={`sub-${index}`} node={child} />
            ))}
          </div>
        )}
        {node.tail.map((html, index) => (
          <p key={`tail-${index}`} className="tail" dangerouslySetInnerHTML={{ __html: html }} />
        ))}
      </div>
    </div>
  );
}

function renderNode(node: LawNode, index: number) {
  switch (node.kind) {
    case "part":
      return <Part key={index} node={node} />;
    case "sub":
      return <Sub key={index} node={node} />;
    case "raw":
      return <div key={index} dangerouslySetInnerHTML={{ __html: node.html }} />;
    case "paragraph":
      return (
        <p key={index} className={node.repealed ? "repealed" : undefined}>
          <span dangerouslySetInnerHTML={{ __html: node.html }} />
          {node.repealed && <RepealedTag />}
        </p>
      );
  }
}

export function LawBody({ bodyHtml }: { bodyHtml: string }) {
  const nodes = parseLawBlocks(bodyHtml);
  return <div className="law">{nodes.map(renderNode)}</div>;
}
