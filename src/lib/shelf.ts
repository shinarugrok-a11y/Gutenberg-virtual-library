export type Order = "title" | "author" | "newest" | "popular" | "genre";

export type Card = {
  id: number;
  title: string;
  author: string;
  lang: string;
  year: number;
  shelf: string;
};

export type GenreStat = { id: string; label: string; count: number };

export type ShelfQuery = {
  q: string;
  order: Order;
  genre: string;
  lang: string;
  letter: string;
  page: number;
};

export type ShelfOk = {
  ok: true;
  total: number;
  page: number;
  pageCount: number;
  books: Card[];
  genres: GenreStat[];
  live: boolean;
};

export type ShelfErr = { ok: false; error: string };

export type BookTextOk = { ok: true; id: number; text: string };
export type BookTextErr = { ok: false; error: string };

export const PAGE_SIZE = 24;

export const LANGUAGES: { id: string; label: string }[] = [
  { id: "", label: "All languages" },
  { id: "en", label: "English" },
  { id: "fr", label: "French" },
  { id: "de", label: "German" },
  { id: "es", label: "Spanish" },
  { id: "it", label: "Italian" },
  { id: "pt", label: "Portuguese" },
  { id: "nl", label: "Dutch" },
  { id: "fi", label: "Finnish" },
  { id: "la", label: "Latin" },
  { id: "zh", label: "Chinese" },
];

export const GENRES: { id: string; label: string; any: string[]; none?: string[] }[] = [
  { id: "adventure", label: "Adventure", any: ["Category: Adventure"] },
  { id: "biography", label: "Biographies", any: ["Category: Biographies"] },
  { id: "children", label: "Children & young adult", any: ["Category: Children & Young Adult Reading"] },
  { id: "crime", label: "Crime & mystery", any: ["Crime", "Detective", "Mystery"] },
  { id: "essays", label: "Essays & speeches", any: ["Category: Essays, Letters & Speeches"] },
  { id: "history", label: "History", any: ["Category: History"] },
  { id: "horror", label: "Horror & gothic", any: ["Horror", "Gothic"] },
  { id: "humour", label: "Humour", any: ["Category: Humour"] },
  { id: "myth", label: "Myth & folklore", any: ["Category: Mythology, Legends & Folklore"] },
  { id: "novels", label: "Novels", any: ["Category: Novels"] },
  { id: "philosophy", label: "Philosophy & ethics", any: ["Category: Philosophy & Ethics"] },
  { id: "plays", label: "Plays & drama", any: ["Category: Plays/Films/Dramas"] },
  { id: "poetry", label: "Poetry", any: ["Category: Poetry"] },
  { id: "religion", label: "Religion & spirituality", any: ["Category: Religion/Spirituality"] },
  { id: "romance", label: "Romance", any: ["Category: Romance"] },
  { id: "scifi", label: "Science fiction & fantasy", any: ["Category: Science-Fiction & Fantasy"] },
  { id: "science", label: "Science", any: ["Category: Science -"] },
  { id: "short", label: "Short stories", any: ["Category: Short Stories"] },
  { id: "travel", label: "Travel writing", any: ["Category: Travel Writing"] },
];

export function matchGenre(shelves: string, genreId: string): boolean {
  const g = GENRES.find((item) => item.id === genreId);
  if (!g) return false;
  if (g.none?.some((part) => shelves.includes(part))) return false;
  return g.any.some((part) => shelves.includes(part));
}

export function frequency(id: number): string {
  const n = 88 + ((id * 17) % 2000) / 100;
  return n.toFixed(1);
}

export function primaryShelf(shelves: string): string {
  const first = shelves
    .split(";")
    .map((part) => part.trim().replace(/^Category:\s*/, ""))
    .find(Boolean);
  return first ?? "General";
}

export function authorLabel(author: string): string {
  const name = author.trim();
  return name || "Unknown author";
}
