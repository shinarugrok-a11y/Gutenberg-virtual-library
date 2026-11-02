import type { Block, Run } from "@/lib/text";
import { blockPlain } from "@/lib/text";

function Runs({ runs }: { runs: Run[] }) {
  return runs.map((run, index) => {
    if (run.kind === "em") return <em key={index}>{run.text}</em>;
    if (run.kind === "sup") return <sup key={index}>{run.text}</sup>;
    if (run.kind === "sub") return <sub key={index}>{run.text}</sub>;
    return <span key={index}>{run.text}</span>;
  });
}

function Ornament() {
  return (
    <div className="ornament" aria-hidden>
      <i />
      <i />
      <i />
    </div>
  );
}

export function BlockView({ block, spoken }: { block: Block; spoken: boolean }) {
  if (block.type === "heading") {
    return (
      <h3 className={block.level === 1 ? "chap" : "subhead"}>
        {spoken ? <mark className="spoken"><Runs runs={block.runs} /></mark> : <Runs runs={block.runs} />}
      </h3>
    );
  }
  if (block.type === "para") {
    const drop = block.flush && !block.cont && !block.salute && !block.aside && /^[A-Za-z]/.test(block.plain);
    const className = [
      block.salute ? "salute" : "",
      block.aside ? "aside" : "",
      block.flush || block.cont ? "flush" : "",
      drop ? "drop" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return (
      <p className={className || undefined}>
        {spoken ? <mark className="spoken"><Runs runs={block.runs} /></mark> : <Runs runs={block.runs} />}
      </p>
    );
  }
  if (block.type === "verse") {
    return (
      <div className={`verse${spoken ? " is-spoken" : ""}`}>
        {block.lines.map((line, index) => (
          <p key={index} className="verse-line">
            <Runs runs={line.runs} />
          </p>
        ))}
      </div>
    );
  }
  if (block.type === "center") {
    return (
      <div className="centerpiece">
        {block.lines.map((line, index) => (
          <p key={index}>
            <Runs runs={line.runs} />
          </p>
        ))}
      </div>
    );
  }
  if (block.type === "plate") {
    return (
      <figure className="plate">
        <Ornament />
        {block.plain ? (
          <figcaption>{spoken ? <mark className="spoken"><Runs runs={block.runs} /></mark> : <Runs runs={block.runs} />}</figcaption>
        ) : null}
      </figure>
    );
  }
  if (block.type === "toc") {
    return (
      <p className="toc-line">
        <span>{spoken ? <mark className="spoken"><Runs runs={block.runs} /></mark> : <Runs runs={block.runs} />}</span>
        {block.loc ? <span className="leader" /> : null}
        {block.loc ? <span className="toc-loc">{block.loc}</span> : null}
      </p>
    );
  }
  if (block.type === "rule") return <Ornament />;
  return null;
}

export function Flow({ blocks, cursor, lang }: { blocks: Block[]; cursor: number | null; lang?: string }) {
  let offset = 0;
  return (
    <div className="page-prose" lang={lang || "en"}>
      {blocks.map((block, index) => {
        const text = blockPlain(block);
        const start = offset;
        if (text) offset += text.length + 2;
        const spoken = Boolean(text) && cursor != null && cursor >= start && cursor < start + text.length;
        return (
          <div className={`flow-block${spoken ? " is-spoken" : ""}`} key={index}>
            <BlockView block={block} spoken={spoken} />
          </div>
        );
      })}
    </div>
  );
}
