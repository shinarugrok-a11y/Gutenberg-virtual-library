import { useCallback, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BookOpen, Headphones, Library, Radio, ScrollText } from "lucide-react";
import { fetchBookText, searchShelf, spinDial } from "@/lib/catalog.functions";
import { flushDesk, useDesk } from "@/lib/desk-store";
import { frequency, type Card, type Order } from "@/lib/shelf";
import { composeBook } from "@/lib/text";
import { Shelf } from "@/components/shelf";
import { SpineWall } from "@/components/cloth-spine";
import { BookStage } from "@/components/book-stage";
import { AskPanel } from "@/components/ask-panel";
import { Winamp } from "@/components/winamp";

type Pane = "read" | "tune" | "ask" | "music";

export function Desk() {
  const [booted, setBooted] = useState(false);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [order, setOrder] = useState<Order>("popular");
  const [genre, setGenre] = useState("");
  const [lang, setLang] = useState("");
  const [letter, setLetter] = useState("");
  const [page, setPage] = useState(1);
  const [card, setCard] = useState<Card | null>(null);
  const [leaf, setLeaf] = useState(0);
  const [textPages, setTextPages] = useState<string[]>([]);
  const onPages = useCallback((next: string[]) => {
    setTextPages((prev) => {
      if (prev.length === next.length && prev.every((page, index) => page === next[index])) return prev;
      return next;
    });
  }, []);
  const [onAir, setOnAir] = useState(false);
  const [pane, setPane] = useState<Pane>("tune");
  const [askOpen, setAskOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [spinError, setSpinError] = useState<string | null>(null);
  const motionOn = useDesk((s) => s.motion !== false);
  const setMotion = useDesk((s) => s.setMotion);
  const atmosphere = useDesk((s) => s.atmosphere);
  const setAtmosphere = useDesk((s) => s.setAtmosphere);
  const lastBook = useDesk((s) => s.lastBook);
  const storageWarning = useDesk((s) => s.storageWarning);
  const stopAir = useCallback(() => setOnAir(false), []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    useDesk.getState().hydrate(!reduce);
    const saved = useDesk.getState().lastBook;
    if (saved) open(saved);
    setBooted(true);
    window.addEventListener("pagehide", flushDesk);
    return () => window.removeEventListener("pagehide", flushDesk);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(qInput);
      setPage(1);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [qInput]);

  const shelfQuery = useQuery({
    queryKey: ["shelf", q, order, genre, lang, letter, page],
    enabled: booted,
    placeholderData: keepPreviousData,
    queryFn: () => searchShelf({ data: { q, order, genre, lang, letter, page } }),
  });

  const textQuery = useQuery({
    queryKey: ["book-text", card?.id],
    enabled: booted && card != null,
    staleTime: Infinity,
    queryFn: () => fetchBookText({ data: { id: card!.id } }),
  });

  const edition = useMemo(() => (textQuery.data?.ok ? composeBook(textQuery.data.text) : null), [textQuery.data]);
  const shelf = shelfQuery.data?.ok ? shelfQuery.data : null;
  const shelfError = shelfQuery.data && !shelfQuery.data.ok ? shelfQuery.data.error : shelfQuery.isError ? "The card catalog didn't answer." : null;

  function open(book: Card) {
    setCard(book);
    setLeaf(useDesk.getState().positions[String(book.id)]?.leaf ?? 0);
    useDesk.getState().rememberBook(book);
    setTextPages([]);
    setOnAir(false);
    setPane("read");
    setAskOpen(false);
    useDesk.getState().ensureBook(book.id, book.title, book.author);
  }

  async function spin() {
    setSpinning(true);
    setSpinError(null);
    const result = await spinDial({ data: { q, order, genre, lang, letter, page: 1 } });
    setSpinning(false);
    if (result.ok) open(result.book);
    else setSpinError(result.error);
  }

  const status = !card ? "idle" : textQuery.data?.ok ? "ready" : textQuery.data && !textQuery.data.ok ? "error" : textQuery.isError ? "error" : "loading";
  const bookError = textQuery.data && !textQuery.data.ok ? textQuery.data.error : textQuery.isError ? "The pages didn't come up." : null;
  const freq = card ? frequency(card.id) : "91.1";
  const now = card ? card.title : "The whole Gutenberg shelf";
  const pickingBand = order === "genre" && !genre;

  return (
    <div className="desk" data-motion={motionOn ? "on" : "off"} data-atmosphere={atmosphere} data-on-air={onAir ? "true" : "false"}>
      <header className="fascia">
        <div>
          <p className="eyebrow">Station K-GUT</p>
          <h1 className="wordmark">
            Night Desk <em>Library</em>
          </h1>
        </div>
        <div className="well">
          <div className="needle-wrap" aria-hidden>
            <div className="needle" />
          </div>
          <span className="freq">{freq}</span>
          <div className="now-playing">
            <p className="text-muted text-xs tracking-widest uppercase">{onAir ? "On air" : "Tuned"}</p>
            <div className="ticker">
              <div className="ticker-track">
                <span>{now}</span>
                <span>{now}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="row-scroll">
          <button type="button" className={`desk-btn${onAir ? " is-on" : ""}`} aria-pressed={onAir} disabled={!card} onClick={() => setOnAir((value) => !value)}>
            <Radio className="mr-1 inline size-4" aria-hidden />
            {onAir ? "On air" : "Read aloud"}
          </button>
          <button
            type="button"
            className={`desk-btn${askOpen || pane === "ask" ? " is-on" : ""}`}
            onClick={() => {
              setAskOpen(true);
              setPane("ask");
            }}
            disabled={!card}
          >
            <ScrollText className="mr-1 inline size-4" aria-hidden />
            Ask
          </button>
          <button type="button" className={`desk-btn${motionOn ? " is-on" : ""}`} aria-pressed={motionOn} onClick={() => setMotion(!motionOn)}>
            {motionOn ? "Animation on" : "Animation off"}
          </button>
          <label className="atmosphere">
            Atmosphere
            <select
              className="desk-select compact"
              aria-label="Atmosphere"
              value={atmosphere}
              onChange={(event) => setAtmosphere(event.target.value as "chalkboard" | "forest" | "vintage")}
            >
              <option value="chalkboard">Chalkboard</option>
              <option value="forest">Dark forest</option>
              <option value="vintage">Vintage</option>
            </select>
          </label>
        </div>
      </header>
      <div className="layout">
        <div className={`${pane === "tune" ? "block" : "hidden"} show-wide`}>
          <Shelf
            qInput={qInput}
            onQ={setQInput}
            order={order}
            onOrder={(next) => {
              setOrder(next);
              setPage(1);
              if (next !== "genre") setGenre("");
            }}
            genre={genre}
            onGenre={(next) => {
              setGenre(next);
              setPage(1);
              if (next) setOrder("genre");
            }}
            lang={lang}
            onLang={(next) => {
              setLang(next);
              setPage(1);
            }}
            letter={letter}
            onLetter={(next) => {
              setLetter(next);
              setPage(1);
            }}
            page={page}
            onPage={setPage}
            books={shelf?.books ?? []}
            total={shelf?.total ?? 0}
            pageCount={shelf?.pageCount ?? 1}
            live={Boolean(shelf?.live)}
            genres={shelf?.genres ?? []}
            loading={shelfQuery.isPending}
            error={shelfError}
            onRetry={() => void shelfQuery.refetch()}
            activeId={card?.id ?? null}
            onOpen={open}
            onSpin={() => void spin()}
            spinning={spinning}
            wall={card ? "sidebar" : "narrow"}
          />
          {lastBook && (!card || lastBook.id !== card.id) && <button type="button" className="desk-btn" onClick={() => open(lastBook)}>Continue reading {lastBook.title}</button>}
          {spinError && <p className="warn mt-2">{spinError}</p>}
        </div>
        <div className={`${pane === "read" ? "block" : "hidden"} show-wide`}>
          {card ? (
            <BookStage
              key={card.id}
              card={card}
              blocks={edition?.blocks ?? []}
              words={edition?.words ?? 0}
              leaf={leaf}
              onLeaf={setLeaf}
              onPages={onPages}
              onAir={onAir}
              onStopAir={stopAir}
              motion={motionOn}
              status={status}
              error={bookError}
            />
          ) : (
            <div className="panel wall-stage only-wide">
              <p className="eyebrow">The collection</p>
              <h2 className="wall-title">A quiet place to lose your place.</h2>
              <p className="text-muted wall-lede">
                Cloth spines on the shelf. Open one and the ink stays on the page — pen, pencil, brush, the same five colors.
              </p>
              {pickingBand ? (
                <p className="text-muted mt-4 text-sm">Choose a band in the catalog. The shelf will stand up in that order.</p>
              ) : (
                <SpineWall books={shelf?.books ?? []} activeId={null} onOpen={open} perShelf={18} tall />
              )}
            </div>
          )}
          {storageWarning && <p className="warn mt-2">This desk is full of ink. Download your notes before they stop saving on this browser.</p>}
        </div>
        <div className={`${pane === "ask" || pane === "music" ? "flex" : "hidden"} show-wide-flex flex-col gap-4`}>
          {card && (pane === "ask" || askOpen) && (
            <div className={pane === "ask" ? "block" : "hidden show-wide"}>
              <AskPanel
                bookId={card.id}
                title={card.title}
                pagesReady={status === "ready"}
                pages={textPages}
                onGoto={(next) => {
                  setLeaf(next);
                  setPane("read");
                }}
              />
            </div>
          )}
          <div className={pane === "music" ? "block" : "hidden show-wide"}>
            <Winamp onAir={onAir} motion={motionOn} />
          </div>
        </div>
      </div>
      <nav className="tabbar" aria-label="Desk">
        <button type="button" className={pane === "read" ? "is-on" : ""} onClick={() => setPane("read")}>
          <BookOpen className="size-5" aria-hidden />
          Read
        </button>
        <button type="button" className={pane === "tune" ? "is-on" : ""} onClick={() => setPane("tune")}>
          <Library className="size-5" aria-hidden />
          Tune
        </button>
        <button type="button" className={pane === "ask" ? "is-on" : ""} onClick={() => setPane("ask")} disabled={!card}>
          <ScrollText className="size-5" aria-hidden />
          Ask
        </button>
        <button type="button" className={pane === "music" ? "is-on" : ""} onClick={() => setPane("music")}>
          <Headphones className="size-5" aria-hidden />
          Music
        </button>
      </nav>
    </div>
  );
}
