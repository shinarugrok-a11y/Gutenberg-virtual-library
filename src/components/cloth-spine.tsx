import type { Card } from "@/lib/shelf";

const CLOTHS = [
  ["#1f5c3a", "#2f7a4c", "#174830"],
  ["#245e46", "#34785a", "#183e30"],
  ["#1d5c62", "#2a7a80", "#123e44"],
  ["#3d4f86", "#5568a4", "#2a3760"],
  ["#5a3478", "#744894", "#3c2254"],
  ["#6a3358", "#8a4574", "#4a2240"],
  ["#6b4428", "#8a5c38", "#4a2e1a"],
  ["#7a3a32", "#9a5248", "#54241e"],
  ["#2c5a34", "#3e7848", "#1c3c24"],
  ["#3a4a2a", "#526838", "#28341c"],
  ["#1e4a68", "#2c6890", "#143248"],
  ["#6a5830", "#8a7444", "#4a3c1e"],
] as const;

function rng(id: number) {
  let n = id >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = (n ^ (n >>> 16)) >>> 0;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}

function bandOf(book: Card) {
  const piece = (book.shelf || "")
    .split(";")
    .map((part) => part.replace(/^(Category|Subject|LoC Class):\s*/i, "").trim())
    .find((part) => part.length > 1 && part.length < 36);
  return piece || "Stories";
}

function metrics(book: Card) {
  const r = rng(book.id);
  const cloth = CLOTHS[Math.floor(r() * CLOTHS.length)]!;
  return {
    cloth,
    width: Math.round(36 + Math.min(12, book.title.length * 0.12) + r() * 8),
  };
}

function clip(value: string, max: number) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function ClothSpine({ book, active, onOpen }: { book: Card; active: boolean; onOpen: (book: Card) => void }) {
  const { cloth, width } = metrics(book);
  const title = clip(book.title, 42);
  const author = clip(book.author || "Unknown", 28);
  const gid = `cloth-${book.id}`;
  const height = 196;
  return (
    <button
      type="button"
      className={`cloth${active ? " is-on" : ""}`}
      style={{ width }}
      title={`${book.title} — ${book.author}`}
      aria-label={`${book.title} by ${book.author}`}
      aria-pressed={active}
      onClick={() => onOpen(book)}
    >
      <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" x2="1" y1="0" y2="0">
            <stop stopColor={cloth[2]} />
            <stop offset="0.18" stopColor={cloth[1]} />
            <stop offset="0.55" stopColor={cloth[0]} />
            <stop offset="1" stopColor={cloth[2]} />
          </linearGradient>
        </defs>
        <rect width={width} height={height} rx="2" fill={`url(#${gid})`} />
        <rect width="3" height={height} fill="rgb(255 255 255 / 0.16)" />
        <rect x={width - 3} width="3" height={height} fill="rgb(0 0 0 / 0.28)" />
        <path d={`M5 14H${width - 5}M5 18H${width - 5}M5 176H${width - 5}M5 180H${width - 5}`} stroke="#e4c78a" strokeWidth="0.8" />
        <path d={`M${width / 2} 28 l4 4 -4 4 -4 -4 z`} fill="#f0ddb0" />
        <text
          transform={`translate(${width / 2 + 4},40) rotate(90)`}
          fill="#f6edd4"
          fontFamily="Georgia, 'Iowan Old Style', serif"
          fontSize="11"
          textLength="128"
          lengthAdjust="spacingAndGlyphs"
        >
          {title}
        </text>
        <text
          transform="translate(11,42) rotate(90)"
          fill="#e4d2aa"
          fontFamily="Georgia, serif"
          fontSize="7"
          textLength="120"
          lengthAdjust="spacingAndGlyphs"
        >
          {author}
        </text>
      </svg>
    </button>
  );
}

export function SpineWall({
  books,
  activeId,
  onOpen,
  perShelf,
  tall,
}: {
  books: Card[];
  activeId: number | null;
  onOpen: (book: Card) => void;
  perShelf: number;
  tall?: boolean;
}) {
  const rows: { label: string; books: Card[] }[] = [];
  for (let index = 0; index < books.length; index += perShelf) {
    const slice = books.slice(index, index + perShelf);
    const counts = new Map<string, number>();
    for (const book of slice) {
      const label = bandOf(book);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    let label = "Stories";
    let best = 0;
    for (const [name, count] of counts) {
      if (count > best) {
        best = count;
        label = name;
      }
    }
    const part = Math.floor(index / perShelf) + 1;
    rows.push({ label: `${label} · ${part}`, books: slice });
  }

  if (!books.length) return <p className="text-muted text-sm">Nothing standing on this shelf.</p>;

  return (
    <div className={`wall${tall ? " is-tall" : ""}`}>
      {rows.map((row) => (
        <section key={row.label} className="wood" aria-label={row.label}>
          <p className="wood-label">{row.label}</p>
          <div className="wood-books">
            {row.books.map((book) => (
              <ClothSpine key={book.id} book={book} active={activeId === book.id} onOpen={onOpen} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
