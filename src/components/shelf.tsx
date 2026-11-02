import { LoaderCircle, Search } from "lucide-react";
import { LANGUAGES, frequency, type Card, type GenreStat, type Order } from "@/lib/shelf";

const ORDERS: { id: Order; label: string }[] = [
  { id: "popular", label: "Borrowed" },
  { id: "title", label: "Title" },
  { id: "author", label: "Author" },
  { id: "genre", label: "Genre" },
  { id: "newest", label: "Newest" },
];

export function Shelf({
  qInput,
  onQ,
  order,
  onOrder,
  genre,
  onGenre,
  lang,
  onLang,
  letter,
  onLetter,
  page,
  onPage,
  books,
  total,
  pageCount,
  live,
  genres,
  loading,
  error,
  onRetry,
  activeId,
  onOpen,
  onSpin,
  spinning,
}: {
  qInput: string;
  onQ: (value: string) => void;
  order: Order;
  onOrder: (order: Order) => void;
  genre: string;
  onGenre: (genre: string) => void;
  lang: string;
  onLang: (lang: string) => void;
  letter: string;
  onLetter: (letter: string) => void;
  page: number;
  onPage: (page: number) => void;
  books: Card[];
  total: number;
  pageCount: number;
  live: boolean;
  genres: GenreStat[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  activeId: number | null;
  onOpen: (book: Card) => void;
  onSpin: () => void;
  spinning: boolean;
}) {
  const showGenres = order === "genre" && !genre;
  const letters = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];
  const showLetters = order === "title" || order === "author" || (order === "genre" && Boolean(genre));

  return (
    <div className="panel">
      <p className="eyebrow">Card catalog</p>
      <h2 className="mt-1 mb-3 text-2xl">Every text on the shelf</h2>
      <label className="relative block">
        <Search className="text-muted pointer-events-none absolute top-3 left-3 size-5" aria-hidden />
        <input
          className="desk-field with-icon"
          value={qInput}
          placeholder="Title, author, or #1342"
          onChange={(event) => onQ(event.target.value)}
          aria-label="Search the catalog"
        />
      </label>
      <div className="row-scroll mt-3">
        {ORDERS.map((item) => (
          <button key={item.id} type="button" className={`desk-btn${order === item.id ? " is-on" : ""}`} aria-pressed={order === item.id} onClick={() => onOrder(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <label className="mt-3 block text-sm">
        <span className="text-muted">Language</span>
        <select className="desk-select mt-1" value={lang} onChange={(event) => onLang(event.target.value)} aria-label="Language">
          {LANGUAGES.map((item) => (
            <option key={item.id || "all"} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      {showLetters && (
        <div className="letters mt-3" aria-label={order === "author" ? "Author letter" : "Title letter"}>
          <button type="button" className={`desk-btn${letter === "" ? " is-on" : ""}`} onClick={() => onLetter("")}>
            All
          </button>
          {letters.map((item) => (
            <button key={item} type="button" className={`desk-btn${letter === item ? " is-on" : ""}`} onClick={() => onLetter(item)}>
              {item}
            </button>
          ))}
        </div>
      )}
      <div className="row-scroll mt-3">
        <button type="button" className="desk-btn is-on" onClick={onSpin} disabled={spinning}>
          {spinning ? "Spinning" : "Spin the dial"}
        </button>
        {genre && (
          <button type="button" className="desk-btn" onClick={() => onGenre("")}>
            Clear band
          </button>
        )}
      </div>
      {loading && (
        <p className="text-muted mt-4 flex items-center gap-2 text-sm">
          <LoaderCircle className="spin size-4" aria-hidden />
          Opening the card catalog
        </p>
      )}
      {error && (
        <div className="mt-4">
          <p className="warn">{error}</p>
          <button type="button" className="desk-btn mt-2" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}
      {!loading && !error && showGenres && (
        <div className="genre-list">
          {(genres.length ? genres : []).map((item) => (
            <button key={item.id} type="button" className="shelf-item" onClick={() => onGenre(item.id)}>
              <span className="freq">{item.label.slice(0, 1)}</span>
              <span>
                <strong>{item.label}</strong>
                <span className="meta">{item.count.toLocaleString()} books</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {!loading && !error && !showGenres && (
        <>
          <p className="text-muted mt-3 text-sm">
            {live ? "Most borrowed, live from Project Gutenberg" : `${total.toLocaleString()} books`}
            {genre ? ` · ${genres.find((item) => item.id === genre)?.label ?? "band"}` : ""}
          </p>
          <div className="shelf-list">
            {books.map((book) => (
              <button key={book.id} type="button" className={`shelf-item${activeId === book.id ? " is-on" : ""}`} onClick={() => onOpen(book)}>
                <span className="freq">{frequency(book.id)}</span>
                <span>
                  <strong>{book.title}</strong>
                  <span className="meta">
                    {book.author}
                    {book.year ? ` · ${book.year}` : ""} · {book.lang || "—"}
                  </span>
                  <span className="meta">{book.shelf}</span>
                </span>
              </button>
            ))}
            {!books.length && <p className="text-muted text-sm">Nothing on this frequency.</p>}
          </div>
          <div className="row-scroll mt-3">
            <button type="button" className="desk-btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>
              Previous stack
            </button>
            <span className="text-muted text-sm tabular-nums">
              {page} / {Math.max(pageCount, 1)}
            </span>
            <button type="button" className="desk-btn" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
              Next stack
            </button>
          </div>
        </>
      )}
    </div>
  );
}
