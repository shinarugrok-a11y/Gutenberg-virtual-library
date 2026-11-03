import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type TransitionEvent } from "react";
import { ChevronLeft, ChevronRight, Download, PenLine } from "lucide-react";
import type { Card } from "@/lib/shelf";
import { INKS, downloadText, notesToMarkdown, type MarginNote, type Tool } from "@/lib/notes";
import { useDesk } from "@/lib/desk-store";
import { blockHeight, packLeaves, stableBox, type Block, type Leaf } from "@/lib/text";
import { BlockView, Flow } from "@/components/typeset";
import { InkLayer } from "@/components/ink-layer";
import { rebindMarks } from "@/lib/notes";

import { LANGUAGES, CREDITS } from "@/lib/translate/models";
import { useTranslation } from "@/lib/translate/use-translation";

type Anim = { dir: 1 | -1; incoming: number; phase: "prep" | "run" };

const SPEECH_LANGS: Record<string, string> = {
  en: "en-US", fr: "fr-FR", de: "de-DE", es: "es-ES", it: "it-IT", pt: "pt-PT", nl: "nl-NL", fi: "fi-FI", sv: "sv-SE",
  da: "da-DK", no: "nb-NO", pl: "pl-PL", ru: "ru-RU", el: "el-GR", hu: "hu-HU", la: "it-IT", zh: "zh-CN", ja: "ja-JP",
  ko: "ko-KR", cs: "cs-CZ", ca: "ca-ES", eo: "eo",
};

function speechLang(lang: string) {
  const code = (lang || "en").toLowerCase().split(/[-_;,\s]/)[0] ?? "en";
  return SPEECH_LANGS[code] ?? code;
}

/** Spoken pieces with their offsets in the page text, small enough for every speech engine. */
function speechPieces(text: string, max = 1200): { start: number; text: string }[] {
  const pieces: { start: number; text: string }[] = [];
  const re = /[^\n]+(?:\n(?!\n)[^\n]*)*/g;
  for (const match of text.matchAll(re)) {
    const para = match[0];
    const base = match.index ?? 0;
    let from = 0;
    while (from < para.length) {
      let end = Math.min(para.length, from + max);
      if (end < para.length) {
        const window = para.slice(from, end);
        const stop = Math.max(window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "), window.lastIndexOf("; "));
        const space = window.lastIndexOf(" ");
        if (stop > max * 0.4) end = from + stop + 1;
        else if (space > max * 0.4) end = from + space;
      }
      const piece = para.slice(from, end);
      if (piece.trim()) pieces.push({ start: base + from, text: piece });
      from = end;
    }
  }
  return pieces;
}

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
  truncated,
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
  comments: Pick<MarginNote, "id" | "text">[];
  translated?: string;
  truncated?: boolean;
  target?: string;
  pageHeight?: number;
}) {
  const extra = comments.length > 0;
  const notes = extra ? (
    <aside className="page-notes" aria-label="Notes on this page">
      {comments.map((comment) => (
        <p key={comment.id} className="margin-note">
          {comment.text}
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
            {status === "ready" && pageCount === 0 && "This edition has no readable text on the shelf. Go back to the catalog and try another book."}
            {status === "ready" &&
              pageCount > 0 &&
              `${words.toLocaleString()} words on ${pageCount.toLocaleString()} pages. The type is set. Turn the leaf from the spine, flick the page sideways, or use the arrow keys.`}
            {status === "idle" && "Waiting on the shelf."}
          </p>
          {status === "ready" && truncated && (
            <p className="page-prose">This edition is very long. Night Desk set the first five million characters, so the ending is not on these pages.</p>
          )}
          <p className="page-kicker">Public-domain text via Project Gutenberg.</p>
          {notes}
          {ink}
        </div>
      </div>
    );
  }
  const opensChapter = leaf?.blocks.some((block) => block.type === "heading" && block.level === 1) ?? false;
  // Margin notes, translated prose and a single oversized block can all overflow the fixed page budget.
  return (
    <div className={`page-scroll${extra || translated !== undefined || leaf?.tall ? " has-extra" : ""}`}>
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
  truncated,
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
  truncated?: boolean;
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
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const rateRef = useRef(rate);
  rateRef.current = rate;
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
  const sourceLang = (card.lang || "en").toLowerCase().split(/[-_;,\s]/)[0] || "en";
  const translation = useTranslation(card.id, sourceLang, leaves, shown);
  const plains = useMemo(() => leaves.map((item) => item.plain), [leaves]);

  useEffect(() => {
    animRef.current = anim;
  }, [anim]);

  useEffect(() => {
    if (window.matchMedia("(min-width: 1180px)").matches) setInkOpen(true);
  }, []);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      const root = cardRef.current;
      if (!root || root.offsetParent === null) return;
      const dir = event.key === "ArrowRight" || event.key === "PageDown" ? 1 : event.key === "ArrowLeft" || event.key === "PageUp" ? -1 : 0;
      if (!dir) return;
      event.preventDefault();
      turnRef.current(dir);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
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

  const pinPlace = useCallback((index: number) => {
    const first = leavesRef.current[index - 1]?.blocks[0];
    positionRef.current = { anchor: first ? blocksRef.current.indexOf(first) : null, leaf: index, updatedAt: Date.now() };
  }, []);

  const commit = useCallback((next: number) => {
    pinPlace(next);
    setAnim(null);
    setPending(next);
    onLeaf(next);
  }, [onLeaf, pinPlace]);

  function turn(dir: 1 | -1) {
    if (anim || status !== "ready") return;
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
    const pieces = speechPieces(pageText);
    if (!pieces.length) {
      // Nothing to say on this leaf (an ornament or plate); move on instead of stalling on air.
      const timer = window.setTimeout(() => {
        if (shown < leavesRef.current.length) turnRef.current(1);
        else onStopAir();
      }, 600);
      return () => window.clearTimeout(timer);
    }
    let stopped = false;
    const synth = window.speechSynthesis;
    const lang = speechLang(card.lang);
    const voice = synth.getVoices().find((item) => item.lang.toLowerCase() === lang.toLowerCase()) ??
      synth.getVoices().find((item) => item.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
    const speak = (at: number) => {
      if (stopped) return;
      const piece = pieces[at];
      if (!piece) {
        setCursor(null);
        if (shown < leavesRef.current.length) turnRef.current(1);
        else onStopAir();
        return;
      }
      const utter = new SpeechSynthesisUtterance(piece.text);
      utter.rate = rateRef.current;
      utter.lang = lang;
      if (voice) utter.voice = voice;
      utter.onboundary = (event) => {
        if (!stopped && typeof event.charIndex === "number") setCursor(piece.start + event.charIndex);
      };
      utter.onend = () => speak(at + 1);
      utter.onerror = (event) => {
        if (stopped || event.error === "interrupted" || event.error === "canceled") return;
        speak(at + 1);
      };
      synth.speak(utter);
    };
    const timer = window.setTimeout(() => {
      synth.cancel();
      speak(0);
    }, 70);
    // Desktop Chrome silently stops long speech after ~15 seconds unless it is nudged.
    const desktop = !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const keepAlive = desktop
      ? window.setInterval(() => {
          if (synth.speaking && !synth.paused) {
            synth.pause();
            synth.resume();
          }
        }, 10_000)
      : 0;
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      if (keepAlive) window.clearInterval(keepAlive);
      synth.cancel();
    };
    // The spoken page, not the leaf array. A resize must not cancel a sentence that is still on screen.
    // Rate is read per sentence so a speed change does not restart the page.
  }, [onAir, pageText, card.lang, shown, onStopAir]);

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

  useEffect(() => {
    setConfirmClear(false);
  }, [shown]);

  useEffect(() => {
    if (!confirmClear) return;
    const timer = window.setTimeout(() => setConfirmClear(false), 4000);
    return () => window.clearTimeout(timer);
  }, [confirmClear]);

  const measureTree = useMemo(
    () =>
      blocks.map((block, index) => (
        <div className="flow-block" data-idx={index} key={index}>
          {block.type === "break" ? null : <BlockView block={block} spoken={false} />}
        </div>
      )),
    [blocks],
  );

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
    const pageComments = (notes?.comments ?? []).filter((comment) => comment.leaf === index);
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
        truncated={truncated}
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
            {measureTree}
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
            {LANGUAGES.map((language) => (
              <option key={language.code} value={language.code} disabled={language.code === sourceLang}>
                {language.name}
                {language.code === sourceLang ? " (book's language)" : ""}
              </option>
            ))}
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
                if (!draft.trim()) return;
                addComment(card.id, shown, draft);
                setDraft("");
              }}
            >
              <input className="desk-field" value={draft} placeholder="A line in the margin, saved with this page" onChange={(event) => setDraft(event.target.value)} maxLength={2000} aria-label="Margin note" />
              <button type="submit" className="desk-btn is-on" disabled={!draft.trim()}>
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
