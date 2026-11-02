import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type TransitionEvent } from "react";
import { ChevronLeft, ChevronRight, Download, PenLine } from "lucide-react";
import type { Card } from "@/lib/shelf";
import { INKS, downloadText, notesToMarkdown, type Tool } from "@/lib/notes";
import { useDesk } from "@/lib/desk-store";
import { blockHeight, packLeaves, type Block, type Leaf } from "@/lib/text";
import { BlockView, Flow } from "@/components/typeset";
import { InkLayer } from "@/components/ink-layer";

type Anim = { dir: 1 | -1; incoming: number; phase: "prep" | "run" };

function LeafBody({
  card,
  index,
  leaf,
  cursor,
  words,
  pageCount,
  status,
  error,
  ink,
  comments,
}: {
  card: Card;
  index: number;
  leaf: Leaf | null;
  cursor: number | null;
  words: number;
  pageCount: number;
  status: string;
  error: string | null;
  ink: ReactNode;
  comments: string[];
}) {
  const extra = true;
  const notes = (
    <aside className="page-notes" aria-label="Notes on this page">
      {comments.length === 0 ? (
        <p className="margin-hint">margin</p>
      ) : (
        comments.map((comment) => (
          <p key={comment} className="margin-note">
            {comment}
          </p>
        ))
      )}
    </aside>
  );
  if (index <= 0) {
    return (
      <div className="page-scroll">
        <div className={`page-inner title-leaf${extra ? " has-notes" : ""}`}>
          <p className="page-kicker">Project Gutenberg #{card.id}</p>
          <h2>{card.title}</h2>
          <p className="page-prose">{card.author}</p>
          <p className="page-kicker">
            {card.shelf}
            {card.year ? ` · ${card.year}` : ""} · {card.lang || "unknown language"}
          </p>
          <p className="page-prose">
            {status === "loading" && "The pages are coming up from the stacks."}
            {status === "error" && (error || "This text didn't arrive.")}
            {status === "ready" &&
              `${words.toLocaleString()} words on ${pageCount.toLocaleString()} pages. Draw on this leaf. The stroke stays. A note sits in the margin.`}
            {status === "idle" && "Waiting on the shelf."}
          </p>
          <p className="page-kicker">Public-domain text via Project Gutenberg.</p>
          {notes}
          {ink}
        </div>
      </div>
    );
  }
  const opensChapter = leaf?.blocks.some((block) => block.type === "heading" && block.level === 1) ?? false;
  return (
    <div className="page-scroll">
      <div className={`page-inner${extra ? " has-notes" : ""}`}>
        <p className="running-head">{opensChapter ? card.title : leaf?.chapter || card.title}</p>
        <Flow blocks={leaf?.blocks ?? []} cursor={cursor} lang={card.lang} />
        <p className="folio">{index}</p>
        {notes}
        {ink}
      </div>
    </div>
  );
}

export function BookStage({
  card,
  blocks,
  words,
  leaf,
  onLeaf,
  onPages,
  onAir,
  onStopAir,
  motion,
  status,
  error,
}: {
  card: Card;
  blocks: Block[];
  words: number;
  leaf: number;
  onLeaf: (leaf: number) => void;
  onPages: (pages: string[]) => void;
  onAir: boolean;
  onStopAir: () => void;
  motion: boolean;
  status: "loading" | "ready" | "error" | "idle";
  error: string | null;
}) {
  const tool = useDesk((s) => s.tool);
  const inkId = useDesk((s) => s.inkId);
  const brush = useDesk((s) => s.brush);
  const notes = useDesk((s) => s.notes[String(card.id)]);
  const setTool = useDesk((s) => s.setTool);
  const setInkId = useDesk((s) => s.setInkId);
  const setBrush = useDesk((s) => s.setBrush);
  const setStrokes = useDesk((s) => s.setStrokes);
  const addComment = useDesk((s) => s.addComment);
  const [inkOpen, setInkOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [anim, setAnim] = useState<Anim | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [rate, setRate] = useState(1);
  const [box, setBox] = useState({ width: 0, budget: 0 });
  const estimated = useMemo(() => packLeaves(blocks, (block) => blockHeight(block, 340), 360), [blocks]);
  const [leaves, setLeaves] = useState<Leaf[]>(estimated);
  const cardRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const placeRef = useRef("");
  const animRef = useRef<Anim | null>(null);
  const shown = pending ?? leaf;
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const last = leaves.length;
  const ink = INKS.find((item) => item.id === inkId) ?? INKS[0]!;
  const strokes = notes?.strokes[String(shown)] ?? [];
  const plains = useMemo(() => leaves.map((item) => item.plain), [leaves]);

  useEffect(() => {
    animRef.current = anim;
  }, [anim]);

  useEffect(() => {
    if (window.matchMedia("(min-width: 1180px)").matches) setInkOpen(true);
  }, []);

  useEffect(() => {
    onPages(plains);
  }, [plains, onPages]);

  useEffect(() => {
    if (shown > 0) placeRef.current = leaves[shown - 1]?.plain.slice(0, 70) ?? "";
  }, [shown]);

  useEffect(() => {
    if (pending != null && leaf === pending) setPending(null);
  }, [leaf, pending]);

  useEffect(() => {
    if (shown > last) onLeaf(last);
  }, [shown, last, onLeaf]);

  useLayoutEffect(() => {
    const root = cardRef.current;
    if (!root) return;
    const read = () => {
      const scroll = root.querySelector(".page-scroll");
      const inner = root.querySelector(".page-inner");
      if (!scroll || !inner) return;
      const style = getComputedStyle(inner);
      const budget =
        scroll.clientHeight - Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom) - 36;
      const width = scroll.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight);
      setBox((prev) => (prev.width === Math.round(width) && prev.budget === Math.round(budget) ? prev : { width: Math.round(width), budget: Math.round(budget) }));
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(root);
    document.fonts?.ready.then(read).catch(() => undefined);
    return () => observer.disconnect();
  }, [card.id, status]);

  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!root || box.width < 80 || box.budget < 80) return;
    const nodes = root.querySelectorAll<HTMLElement>("[data-idx]");
    const heights = blocks.map((block, index) => {
      const measured = nodes[index]?.offsetHeight ?? 0;
      return measured > 0 ? measured : blockHeight(block, box.width);
    });
    const next = packLeaves(blocks, (_block, index) => heights[index] ?? 0, box.budget);
    const place = placeRef.current;
    const page = shownRef.current;
    if (place && page > 0) {
      const here = next[page - 1]?.plain ?? "";
      if (!here.includes(place.slice(0, 40))) {
        const found = next.findIndex((item) => item.plain.includes(place.slice(0, 40)));
        if (found >= 0) onLeaf(found + 1);
      }
    }
    setLeaves(next);
  }, [blocks, box, onLeaf]);

  useLayoutEffect(() => {
    if (anim?.phase !== "prep") return;
    const id = requestAnimationFrame(() => {
      setAnim((current) => (current && current.phase === "prep" ? { ...current, phase: "run" } : current));
    });
    return () => cancelAnimationFrame(id);
  }, [anim]);

  const commit = useCallback((next: number) => {
    setAnim(null);
    setPending(next);
    onLeaf(next);
  }, [onLeaf]);

  function turn(dir: 1 | -1) {
    if (anim) return;
    const next = shown + dir;
    if (next < 0 || next > last) return;
    if (!motion) {
      setPending(next);
      onLeaf(next);
      return;
    }
    setAnim({ dir, incoming: next, phase: "prep" });
  }

  useEffect(() => {
    if (anim?.phase !== "run") return;
    const timer = window.setTimeout(() => {
      const current = animRef.current;
      if (!current || current.phase !== "run") return;
      commit(current.incoming);
    }, 980);
    return () => window.clearTimeout(timer);
  }, [anim, commit]);

  useEffect(() => {
    if (!onAir || typeof window === "undefined" || !window.speechSynthesis) {
      window.speechSynthesis?.cancel();
      setCursor(null);
      return;
    }
    let stopped = false;
    const timer = window.setTimeout(() => {
      if (stopped) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const text = shown <= 0 ? `${card.title}. By ${card.author}.` : (leaves[shown - 1]?.plain ?? "");
      if (!text.trim()) return;
      const utter = new SpeechSynthesisUtterance(text.slice(0, 8000));
      utter.rate = rate;
      const lang =
        card.lang === "fr" ? "fr-FR" : card.lang === "de" ? "de-DE" : card.lang === "es" ? "es-ES" : card.lang === "it" ? "it-IT" : "en-US";
      utter.lang = lang;
      utter.onboundary = (event) => {
        if (typeof event.charIndex === "number") setCursor(event.charIndex);
      };
      utter.onend = () => {
        if (stopped) return;
        setCursor(null);
        if (shown < last) turn(1);
        else onStopAir();
      };
      synth.speak(utter);
    }, 70);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.speechSynthesis.cancel();
    };
  }, [onAir, shown, card.id, card.title, card.author, card.lang, rate, leaves, last, motion, onStopAir]);

  function finish(event: TransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.propertyName !== "transform") return;
    const current = animRef.current;
    if (!current || current.phase !== "run") return;
    commit(current.incoming);
  }

  function jump(next: number) {
    setAnim(null);
    setPending(next);
    onLeaf(next);
  }

  function inkFor(index: number, interactive: boolean) {
    const pageStrokes = notes?.strokes[String(index)] ?? [];
    return (
      <InkLayer
        active={interactive && inkOpen}
        tool={tool}
        color={ink.color}
        size={brush}
        strokes={pageStrokes}
        onChange={(next) => setStrokes(card.id, index, next)}
      />
    );
  }

  function face(index: number, interactive: boolean) {
    const pageComments = (notes?.comments ?? []).filter((comment) => comment.leaf === index).map((comment) => comment.text);
    return (
      <LeafBody
        card={card}
        index={index}
        leaf={index > 0 ? (leaves[index - 1] ?? null) : null}
        cursor={onAir && index === shown ? cursor : null}
        words={words}
        pageCount={leaves.length}
        status={status}
        error={error}
        comments={pageComments}
        ink={inkFor(index, interactive)}
      />
    );
  }

  const underIndex = anim ? (anim.dir === 1 ? anim.incoming : shown) : shown;
  const frontIndex = anim ? (anim.dir === 1 ? shown : anim.incoming) : shown;
  let transform = "perspective(1700px) rotateY(0deg)";
  if (anim?.phase === "prep" && anim.dir === -1) transform = "perspective(1700px) rotateY(-86deg)";
  if (anim?.phase === "run" && anim.dir === 1) transform = "perspective(1700px) rotateY(-86deg)";
  if (anim?.phase === "run" && anim.dir === -1) transform = "perspective(1700px) rotateY(0deg)";

  function exportNotes(kind: "md" | "json") {
    const bookNotes = notes ?? { id: card.id, title: card.title, author: card.author, strokes: {}, comments: [], qa: [] };
    const slug =
      card.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 48) || `book-${card.id}`;
    if (kind === "json") {
      downloadText(`nightdesk-${slug}.json`, JSON.stringify({ ...bookNotes, pages: plains }, null, 2), "application/json");
      return;
    }
    const markdown = notesToMarkdown({ ...bookNotes, title: card.title, author: card.author }, (index) =>
      index <= 0 ? `${card.title}\n\n${card.author}` : (plains[index - 1] ?? ""),
    );
    downloadText(`nightdesk-${slug}.md`, markdown, "text/markdown");
  }

  const tools: { id: Tool; label: string }[] = [
    { id: "pen", label: "Pen" },
    { id: "pencil", label: "Pencil" },
    { id: "brush", label: "Brush" },
    { id: "marker", label: "Marker" },
    { id: "eraser", label: "Eraser" },
  ];

  return (
    <div className="book-stage">
      <div className={`book-card${anim ? " is-turning" : ""}`} ref={cardRef}>
        <div className="book-stack" aria-hidden />
        <div className="spine" aria-hidden />
        {anim && <div className="page-static under">{face(underIndex, false)}</div>}
        {!anim && <div className="page-static top">{face(shown, true)}</div>}
        {anim && (
          <div className={`leaf${anim.phase === "run" ? " is-run" : ""}`} style={{ transform, transformOrigin: "left center" }} onTransitionEnd={finish}>
            <div className="leaf-face">{face(frontIndex, false)}</div>
          </div>
        )}
        <div className="measure-clip" style={{ width: box.width > 80 ? box.width : 320 }} aria-hidden>
          <div className="page-prose" ref={measureRef} lang={card.lang || "en"}>
            {blocks.map((block, index) => (
              <div className="flow-block" data-idx={index} key={index}>
                {block.type === "break" ? null : <BlockView block={block} spoken={false} />}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="book-tools">
        <div className="row-scroll">
          <button type="button" className="desk-btn" onClick={() => turn(-1)} disabled={shown <= 0 || Boolean(anim)} aria-label="Previous page">
            <ChevronLeft className="inline size-5" aria-hidden />
          </button>
          <span className="text-muted text-sm tabular-nums">
            {shown === 0 ? "Title" : `Page ${shown}`} of {Math.max(last, 0)}
          </span>
          <button
            type="button"
            className="desk-btn"
            onClick={() => turn(1)}
            disabled={shown >= last || Boolean(anim) || status !== "ready"}
            aria-label="Next page"
          >
            <ChevronRight className="inline size-5" aria-hidden />
          </button>
          <button type="button" className={`desk-btn${inkOpen ? " is-on" : ""}`} aria-pressed={inkOpen} onClick={() => setInkOpen((value) => !value)}>
            <PenLine className="mr-1 inline size-4" aria-hidden />
            Ink
          </button>
          <button type="button" className="desk-btn" onClick={() => exportNotes("md")}>
            <Download className="mr-1 inline size-4" aria-hidden />
            Notes
          </button>
          <button type="button" className="desk-btn" onClick={() => exportNotes("json")}>
            JSON
          </button>
        </div>
        <input
          className="range"
          type="range"
          min={0}
          max={Math.max(last, 0)}
          value={Math.min(shown, Math.max(last, 0))}
          aria-label="Page"
          onChange={(event) => jump(Number(event.target.value))}
        />
        {onAir && (
          <label className="text-muted row-scroll text-sm">
            Reading speed
            <input className="range range-short" type="range" min={0.8} max={1.35} step={0.05} value={rate} onChange={(event) => setRate(Number(event.target.value))} />
          </label>
        )}
        {inkOpen && (
          <div className="ink-tray panel">
            <h2 className="desk-heading">The writing desk</h2>
            <div className="row-scroll" role="group" aria-label="Ink tools">
              {tools.map((item) => (
                <button key={item.id} type="button" className={`desk-btn${tool === item.id ? " is-on" : ""}`} aria-pressed={tool === item.id} onClick={() => setTool(item.id)}>
                  {item.label}
                </button>
              ))}
            </div>
            <div className="row-scroll" role="group" aria-label="Inks">
              {INKS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`ink-chip${inkId === item.id ? " is-on" : ""}`}
                  aria-pressed={inkId === item.id}
                  onClick={() => setInkId(item.id)}
                >
                  <i style={{ background: item.color }} aria-hidden />
                  {item.label}
                </button>
              ))}
            </div>
            <label className="text-muted text-sm">
              Weight
              <input className="range" type="range" min={1.2} max={7} step={0.2} value={brush} onChange={(event) => setBrush(Number(event.target.value))} />
            </label>
            <div className="row-scroll">
              <button type="button" className="desk-btn" onClick={() => setStrokes(card.id, shown, strokes.slice(0, -1))} disabled={!strokes.length}>
                Undo
              </button>
              <button
                type="button"
                className="desk-btn"
                onClick={() => {
                  if (!confirmClear) {
                    setConfirmClear(true);
                    return;
                  }
                  setStrokes(card.id, shown, []);
                  setConfirmClear(false);
                }}
              >
                {confirmClear ? "Clear this page" : "Clear"}
              </button>
            </div>
            <form
              className="row-scroll"
              onSubmit={(event) => {
                event.preventDefault();
                addComment(card.id, shown, draft);
                setDraft("");
              }}
            >
              <input className="desk-field" value={draft} placeholder="A line in the margin, saved with this page" onChange={(event) => setDraft(event.target.value)} maxLength={2000} aria-label="Margin note" />
              <button type="submit" className="desk-btn is-on">
                Save note
              </button>
            </form>
            <p className="text-muted text-sm">Draw on the page. The stroke stays with that leaf. The note sits in the margin beside it.</p>
          </div>
        )}
      </div>
    </div>
  );
}
