import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type TransitionEvent } from "react";
import { ChevronLeft, ChevronRight, Download, PenLine } from "lucide-react";
import type { Card } from "@/lib/shelf";
import { INKS, downloadText, notesToMarkdown, type Tool } from "@/lib/notes";
import { useDesk } from "@/lib/desk-store";
import { blockHeight, packLeaves, stableBox, type Block, type Leaf } from "@/lib/text";
import { BlockView, Flow } from "@/components/typeset";
import { InkLayer } from "@/components/ink-layer";
import { rebindMarks } from "@/lib/notes";

import { LANGUAGES, CREDITS } from "@/lib/translate/models";
import { useTranslation } from "@/lib/translate/use-translation";

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
  translated,
  target,
  pageHeight,
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
  translated?: string;
  target?: string;
  pageHeight?: number;
}) {
  const extra = comments.length > 0;
  const notes = extra ? (
    <aside className="page-notes" aria-label="Notes on this page">
      {comments.map((comment) => (
        <p key={comment} className="margin-note">
          {comment}
        </p>
      ))}
    </aside>
  ) : null;
  if (index <= 0) {
    return (
      <div className={`page-scroll${extra ? " has-extra" : ""}`}>
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
              `${words.toLocaleString()} words on ${pageCount.toLocaleString()} pages. The type is set. Turn the leaf from the spine.`}
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
  // Both margin notes and translated prose can overflow the fixed page budget.
  return (
    <div className={`page-scroll${extra || translated !== undefined ? " has-extra" : ""}`}>
      <div className={`page-inner${extra ? " has-notes" : ""}`}>
        <p className="running-head">{opensChapter ? card.title : leaf?.chapter || card.title}</p>
        {translated !== undefined ? (
          <div className="page-prose" lang={target} dir={target === "ar" ? "rtl" : "auto"} data-translation>
            {translated.split(/\n\s*\n/).map((paragraph, i) => <p key={i}>{paragraph}</p>)}
            <small className="text-muted text-sm">{CREDITS}</small>
          </div>
        ) : <Flow blocks={leaf?.blocks ?? []} cursor={cursor} lang={card.lang} />}
        <p className="folio">{index}</p>
        {notes}
        {translated !== undefined ? <div style={{ position: "absolute", inset: 0, height: pageHeight }}>{ink}</div> : ink}
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
  const positionRef = useRef(useDesk.getState().positions[String(card.id)] ?? { anchor: null, leaf: 0, updatedAt: 0 });
  const paginatedRef = useRef(false);
  const resolvedLeafRef = useRef<number | null>(null);
  useEffect(() => {
    const root = cardRef.current;
    if (!root) return;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || !(event.target instanceof Element)) return;
      const scroll = event.target.closest<HTMLElement>(".page-scroll.has-extra");
      if (!scroll || scroll.scrollHeight <= scroll.clientHeight || !event.deltaY) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scroll.clientHeight : 1;
      scroll.scrollTop += event.deltaY * unit;
    };
    root.addEventListener("wheel", wheel, { passive: false });
    return () => root.removeEventListener("wheel", wheel);
  }, []);
  const animRef = useRef<Anim | null>(null);
  const shown = pending ?? leaf;
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const last = leaves.length;
  const leavesRef = useRef(leaves);
  leavesRef.current = leaves;
  const ink = INKS.find((item) => item.id === inkId) ?? INKS[0]!;
  const strokes = notes?.strokes[String(shown)] ?? [];
  const translation = useTranslation(card.id, (card.lang || "en").toLowerCase().split("-")[0]!, leaves, shown);
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
    if (pending != null && leaf === pending) setPending(null);
  }, [leaf, pending]);

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
      setBox((prev) => stableBox(prev, width, budget));
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(root);
    document.fonts?.ready.then(read).catch(() => undefined);
    return () => observer.disconnect();
  }, [card.id, status]);

  useLayoutEffect(() => {
    const root = measureRef.current;
    if (status !== "ready" || !blocks.length || !root || box.width < 80 || box.budget < 80) return;
    const nodes = root.querySelectorAll<HTMLElement>("[data-idx]");
    const heights = blocks.map((block, index) => {
      const measured = nodes[index]?.offsetHeight ?? 0;
      return measured > 0 ? measured : blockHeight(block, box.width);
    });
    const next = packLeaves(blocks, (_block, index) => heights[index] ?? 0, box.budget);
    const old = leavesRef.current;
    const oldPlains = old.map((item) => item.plain);
    const nextPlains = next.map((item) => item.plain);
    const same = oldPlains.length === nextPlains.length && oldPlains.every((plain, index) => plain === nextPlains[index]);
    if (!same) {
      const book = useDesk.getState().notes[String(card.id)];
      if (book && (book.comments.length > 0 || Object.values(book.strokes).some((list) => list.length > 0))) {
        const rebound = rebindMarks(oldPlains, nextPlains, book.strokes, book.comments);
        if (rebound.moved) useDesk.getState().rebindBook(card.id, rebound.strokes, rebound.comments);
      }
      setLeaves(next);
    }
    const position = positionRef.current;
    const found = position.anchor == null ? -1 : next.findIndex((item) => item.blocks.includes(blocks[position.anchor!]!));
    const held = found >= 0 ? found + 1 : Math.min(position.leaf, next.length);
    positionRef.current.leaf = held;
    resolvedLeafRef.current = held;
    paginatedRef.current = status === "ready" && next.length > 0;
    if (held !== shownRef.current) onLeaf(held);
  }, [blocks, box, onLeaf, card.id, status]);

  useLayoutEffect(() => {
    if (!paginatedRef.current || status !== "ready") return;
    if (resolvedLeafRef.current != null && shown !== resolvedLeafRef.current) return;
    resolvedLeafRef.current = null;
    // Keep the original block anchor through repagination; only a turn changes it.
    if (positionRef.current.leaf !== shown || positionRef.current.anchor == null) {
      const first = leaves[shown - 1]?.blocks[0];
      positionRef.current = { anchor: first ? blocks.indexOf(first) : null, leaf: shown, updatedAt: Date.now() };
    }
    positionRef.current.leaf = shown;
    useDesk.getState().savePosition(card.id, positionRef.current.anchor, shown);
  }, [shown, leaves, blocks, card.id, status]);

  useLayoutEffect(() => {
    if (anim?.phase !== "prep") return;
    const id = requestAnimationFrame(() => {
      setAnim((current) => (current && current.phase === "prep" ? { ...current, phase: "run" } : current));
    });
    return () => cancelAnimationFrame(id);
  }, [anim]);

  const commit = useCallback((next: number) => {
    pinPlace(next);
    setAnim(null);
    setPending(next);
    onLeaf(next);
  }, [onLeaf, blocks]);

  function pinPlace(index: number) {
    const first = leavesRef.current[index - 1]?.blocks[0];
    positionRef.current = { anchor: first ? blocks.indexOf(first) : null, leaf: index, updatedAt: Date.now() };
  }

  function turn(dir: 1 | -1) {
    if (anim) return;
    const next = shown + dir;
    if (next < 0 || next > last) return;
    if (!motion) {
      pinPlace(next);
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

  const pageText = shown <= 0 ? `${card.title}. By ${card.author}.` : (leaves[shown - 1]?.plain ?? "");
  const turnRef = useRef<(dir: 1 | -1) => void>(() => undefined);
  turnRef.current = turn;

  useEffect(() => {
    if (!onAir || typeof window === "undefined" || !window.speechSynthesis) {
      window.speechSynthesis?.cancel();
      setCursor(null);
      return;
    }
    const text = pageText;
    if (!text.trim()) return;
    let stopped = false;
    const timer = window.setTimeout(() => {
      if (stopped) return;
      const synth = window.speechSynthesis;
      synth.cancel();
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
        if (shown < leavesRef.current.length) turnRef.current(1);
        else onStopAir();
      };
      synth.speak(utter);
    }, 70);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.speechSynthesis.cancel();
    };
    // The spoken page, not the leaf array. A resize must not cancel a sentence that is still on screen.
  }, [onAir, pageText, rate, card.lang, shown, onStopAir]);

  function finish(event: TransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.propertyName !== "transform") return;
    const current = animRef.current;
    if (!current || current.phase !== "run") return;
    commit(current.incoming);
  }

  function jump(next: number) {
    pinPlace(next);
    setAnim(null);
    setPending(next);
    onLeaf(next);
  }

  function inkFor(index: number, interactive: boolean) {
    const pageStrokes = notes?.strokes[String(index)] ?? [];
    return (
      <InkLayer
        active={interactive}
        onTurn={turn}
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
        translated={index === shown ? translation.translated : undefined}
        target={translation.target}
        pageHeight={cardRef.current?.clientHeight}
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
          <select className="desk-btn" aria-label="Translate" value={translation.target} onChange={(event) => translation.select(event.target.value)}>
            <option value="">Translate</option>
            {LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.name}</option>)}
          </select>
          {translation.target && <button type="button" className={`desk-btn${translation.original ? " is-on" : ""}`} aria-pressed={translation.original} onClick={translation.toggle}>Original</button>}
        </div>
        {translation.message && <p className="text-muted text-sm" role="status">{translation.message}</p>}
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
