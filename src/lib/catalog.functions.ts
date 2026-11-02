import { createServerFn } from "@tanstack/react-start";
import {
  GENRES,
  PAGE_SIZE,
  authorLabel,
  matchGenre,
  primaryShelf,
  type BookTextErr,
  type BookTextOk,
  type Card,
  type GenreStat,
  type Order,
  type ShelfErr,
  type ShelfOk,
  type ShelfQuery,
} from "@/lib/shelf";

const UA = "NightDesk/1.0 (public-domain reading radio; +https://www.gutenberg.org)";
const CSV_URL = "https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv";

type Rec = {
  id: number;
  title: string;
  author: string;
  lang: string;
  year: number;
  shelves: string;
};

type Index = {
  books: Rec[];
  byId: Map<number, number>;
  titleOrder: number[];
  authorOrder: number[];
  newestOrder: number[];
  genres: GenreStat[];
};

let indexPromise: Promise<Index> | null = null;
const textCache = new Map<number, string>();
const TEXT_CACHE_MAX = 5;

const ORDERS: Order[] = ["title", "author", "newest", "popular", "genre"];

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else if (c !== "\r") cur += c;
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

function sortKey(value: string): string {
  const folded = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const match = folded.match(/[A-Za-z0-9]/);
  if (!match || match.index == null) return "";
  return folded.slice(match.index).toLowerCase();
}

function matchLetter(value: string, letter: string): boolean {
  const key = sortKey(value);
  if (letter === "#") return !/^[a-z]/.test(key);
  return key.startsWith(letter.toLowerCase());
}

async function loadIndex(): Promise<Index> {
  const res = await fetch(CSV_URL, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(40_000),
  });
  if (!res.ok) throw new Error("The card catalog didn't answer.");
  const rows = parseCsv(await res.text());
  const header = rows[0] ?? [];
  const col = (name: string) => {
    const index = header.indexOf(name);
    if (index < 0) throw new Error("The catalog file changed shape.");
    return index;
  };
  const iId = col("Text#");
  const iType = col("Type");
  const iTitle = col("Title");
  const iLang = col("Language");
  const iAuthor = col("Authors");
  const iIssued = col("Issued");
  const iShelves = col("Bookshelves");
  const books: Rec[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row[iType] !== "Text") continue;
    const id = Number(row[iId]);
    if (!Number.isInteger(id) || id <= 0) continue;
    const year = Number((row[iIssued] ?? "").slice(0, 4));
    books.push({
      id,
      title: (row[iTitle] ?? "").trim() || "Untitled",
      author: (row[iAuthor] ?? "").split(";")[0]?.trim() ?? "",
      lang: (row[iLang] ?? "").trim().slice(0, 8),
      year: Number.isFinite(year) ? year : 0,
      shelves: row[iShelves] ?? "",
    });
  }
  const byId = new Map<number, number>();
  books.forEach((book, index) => byId.set(book.id, index));
  const compareTitle = (a: number, b: number) =>
    sortKey(books[a]!.title).localeCompare(sortKey(books[b]!.title)) || books[a]!.id - books[b]!.id;
  const titleOrder = books.map((_, index) => index).sort(compareTitle);
  const authorOrder = books.map((_, index) => index).sort((a, b) => {
    const authorCmp = sortKey(books[a]!.author || "zzzz").localeCompare(sortKey(books[b]!.author || "zzzz"));
    return authorCmp || compareTitle(a, b);
  });
  const newestOrder = books.map((_, index) => index).sort((a, b) => {
    const yearCmp = books[b]!.year - books[a]!.year;
    return yearCmp || compareTitle(a, b);
  });
  const genres: GenreStat[] = GENRES.map((genre) => ({
    id: genre.id,
    label: genre.label,
    count: books.reduce((sum, book) => sum + (matchGenre(book.shelves, genre.id) ? 1 : 0), 0),
  })).sort((a, b) => a.label.localeCompare(b.label));
  return { books, byId, titleOrder, authorOrder, newestOrder, genres };
}

function getIndex(): Promise<Index> {
  if (!indexPromise) {
    indexPromise = loadIndex().catch((error) => {
      indexPromise = null;
      throw error;
    });
  }
  return indexPromise;
}

function toCard(book: Rec): Card {
  return {
    id: book.id,
    title: book.title,
    author: authorLabel(book.author),
    lang: book.lang,
    year: book.year,
    shelf: primaryShelf(book.shelves),
  };
}

function clampPage(value: unknown): number {
  const page = Number(value);
  if (!Number.isFinite(page) || page < 1) return 1;
  return Math.min(10_000, Math.floor(page));
}

function readQuery(input: unknown): ShelfQuery {
  const data = (input ?? {}) as Record<string, unknown>;
  const order = ORDERS.includes(data.order as Order) ? (data.order as Order) : "popular";
  const letterRaw = typeof data.letter === "string" ? data.letter.trim().toUpperCase() : "";
  const letter = letterRaw === "#" || /^[A-Z]$/.test(letterRaw) ? letterRaw : "";
  return {
    q: typeof data.q === "string" ? data.q.trim().slice(0, 80) : "",
    order,
    genre: typeof data.genre === "string" ? data.genre.slice(0, 40) : "",
    lang: typeof data.lang === "string" ? data.lang.slice(0, 8) : "",
    letter,
    page: clampPage(data.page),
  };
}

function filtered(index: Index, query: ShelfQuery): number[] {
  const order = query.order === "author" ? index.authorOrder : query.order === "newest" ? index.newestOrder : index.titleOrder;
  const q = query.q.toLowerCase();
  const idQuery = /^#?\d+$/.test(q) ? Number(q.replace("#", "")) : 0;
  const out: number[] = [];
  for (const indexOf of order) {
    const book = index.books[indexOf]!;
    if (idQuery && book.id !== idQuery) continue;
    if (query.lang && book.lang !== query.lang) continue;
    if (query.genre && !matchGenre(book.shelves, query.genre)) continue;
    const letterSource = query.order === "author" ? book.author : book.title;
    if (query.letter && !matchLetter(letterSource, query.letter)) continue;
    if (q && !idQuery) {
      const hay = `${book.title} ${book.author} ${book.shelves}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }
    out.push(indexOf);
  }
  return out;
}

function pageOf(index: Index, ids: number[], page: number): ShelfOk {
  const pageCount = Math.max(1, Math.ceil(ids.length / PAGE_SIZE));
  const safe = Math.min(page, pageCount);
  const start = (safe - 1) * PAGE_SIZE;
  const books = ids.slice(start, start + PAGE_SIZE).map((i) => toCard(index.books[i]!));
  return {
    ok: true,
    total: ids.length,
    page: safe,
    pageCount,
    books,
    genres: index.genres,
    live: false,
  };
}

async function fetchPopular(page: number): Promise<{ ids: number[]; hasNext: boolean }> {
  const start = (page - 1) * 25 + 1;
  const url = `https://www.gutenberg.org/ebooks/search.opds/?query=&sort_order=downloads&start_index=${start}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error("The borrowed list is quiet right now.");
  const xml = await res.text();
  const ids: number[] = [];
  for (const entry of xml.split("<entry>").slice(1)) {
    const idMatch = entry.match(/\/ebooks\/(\d+)/);
    if (!idMatch) continue;
    const title = entry.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
    if (!title || title === "Authors" || title === "Bookshelves" || title === "Subjects") continue;
    ids.push(Number(idMatch[1]));
  }
  return { ids, hasNext: xml.includes('rel="next"') };
}

export const searchShelf = createServerFn({ method: "GET" })
  .validator(readQuery)
  .handler(async ({ data }): Promise<ShelfOk | ShelfErr> => {
    try {
      const index = await getIndex();
      if (data.order === "popular" && !data.q && !data.genre && !data.letter) {
        const live = await fetchPopular(data.page);
        const books: Card[] = [];
        for (const id of live.ids) {
          const at = index.byId.get(id);
          if (at == null) continue;
          const book = index.books[at]!;
          if (data.lang && book.lang !== data.lang) continue;
          books.push(toCard(book));
        }
        return {
          ok: true,
          total: -1,
          page: data.page,
          pageCount: live.hasNext ? data.page + 1 : data.page,
          books,
          genres: index.genres,
          live: true,
        };
      }
      const order: ShelfQuery =
        data.order === "genre"
          ? { ...data, order: "title" }
          : data;
      return pageOf(index, filtered(index, order), data.page);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "The card catalog didn't answer." };
    }
  });

export const spinDial = createServerFn({ method: "GET" })
  .validator(readQuery)
  .handler(async ({ data }): Promise<{ ok: true; book: Card } | ShelfErr> => {
    try {
      const index = await getIndex();
      const query: ShelfQuery = { ...data, order: data.order === "popular" || data.order === "genre" ? "title" : data.order };
      const ids = filtered(index, query);
      if (!ids.length) return { ok: false, error: "Nothing on that frequency." };
      const book = index.books[ids[Math.floor(Math.random() * ids.length)]!]!;
      return { ok: true, book: toCard(book) };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "The dial didn't catch." };
    }
  });

function rememberText(id: number, text: string) {
  textCache.set(id, text);
  if (textCache.size <= TEXT_CACHE_MAX) return;
  const oldest = textCache.keys().next().value;
  if (oldest != null) textCache.delete(oldest);
}

async function pullText(url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    redirect: "follow",
    signal: AbortSignal.timeout(40_000),
  });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text || text.length < 200) return null;
  const head = text.slice(0, 200).toLowerCase();
  if (head.includes("<!doctype html") || head.includes("<html")) return null;
  return text.length > 5_000_000 ? text.slice(0, 5_000_000) : text;
}

export const fetchBookText = createServerFn({ method: "GET" })
  .validator((input: unknown) => {
    const id = Number((input as { id?: unknown } | null)?.id);
    if (!Number.isInteger(id) || id <= 0 || id > 1_000_000) throw new Error("That isn't a Gutenberg book.");
    return { id };
  })
  .handler(async ({ data }): Promise<BookTextOk | BookTextErr> => {
    try {
      const cached = textCache.get(data.id);
      if (cached) return { ok: true, id: data.id, text: cached };
      const urls = [
        `https://www.gutenberg.org/cache/epub/${data.id}/pg${data.id}.txt`,
        `https://www.gutenberg.org/ebooks/${data.id}.txt.utf-8`,
        `https://www.gutenberg.org/files/${data.id}/${data.id}-0.txt`,
      ];
      for (const url of urls) {
        const text = await pullText(url);
        if (text) {
          rememberText(data.id, text);
          return { ok: true, id: data.id, text };
        }
      }
      return { ok: false, error: "This number has no plain text on the shelf. Try another edition." };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "The pages didn't come up." };
    }
  });
