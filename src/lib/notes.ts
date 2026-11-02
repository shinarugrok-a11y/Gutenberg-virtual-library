import type { Card } from "@/lib/shelf";
import type { Passage } from "@/lib/ask";

export type Tool = "pen" | "pencil" | "brush" | "marker" | "eraser";

export type Pt = { x: number; y: number };

export type Stroke = {
  id: string;
  tool: Exclude<Tool, "eraser">;
  color: string;
  size: number;
  points: Pt[];
};

export type MarginNote = {
  id: string;
  leaf: number;
  text: string;
  at: number;
};

export type QaTurn = {
  q: string;
  lead: string;
  found: boolean;
  passages: Passage[];
  at: number;
};

export type BookNotes = {
  id: number;
  title: string;
  author: string;
  strokes: Record<string, Stroke[]>;
  comments: MarginNote[];
  qa: QaTurn[];
};

export const INKS: { id: string; label: string; color: string }[] = [
  { id: "gall", label: "Iron gall", color: "#1c140e" },
  { id: "lamp", label: "Lampblack", color: "#14120f" },
  { id: "blue", label: "Fountain blue", color: "#1a3a6b" },
  { id: "oxblood", label: "Oxblood", color: "#6e2430" },
  { id: "graphite", label: "Graphite", color: "#3e434a" },
  { id: "cedar", label: "Cedar pencil", color: "#5c4636" },
];

export function emptyNotes(card: Pick<Card, "id" | "title" | "author">): BookNotes {
  return { id: card.id, title: card.title, author: card.author, strokes: {}, comments: [], qa: [] };
}

export function eraseNear(strokes: Stroke[], x: number, y: number, radius: number): Stroke[] {
  const out: Stroke[] = [];
  for (const stroke of strokes) {
    let current: Pt[] = [];
    const flush = (points: Pt[]) => {
      if (points.length > 1) out.push({ ...stroke, id: `${stroke.id}-${out.length}`, points });
    };
    for (const point of stroke.points) {
      const dx = point.x - x;
      const dy = point.y - y;
      if (dx * dx + dy * dy < radius * radius) {
        flush(current);
        current = [];
      } else current.push(point);
    }
    flush(current);
  }
  return out;
}

function xml(value: string): string {
  return value
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;");
}

export function strokesToSvg(strokes: Stroke[]): string {
  const paths = strokes
    .filter((stroke) => stroke.points.length > 1)
    .map((stroke) => {
      const width = stroke.tool === "marker" ? stroke.size * 0.9 : stroke.tool === "brush" ? stroke.size * 0.55 : stroke.size * 0.28;
      const opacity = stroke.tool === "marker" ? 0.35 : stroke.tool === "pencil" ? 0.6 : stroke.tool === "brush" ? 0.8 : 0.92;
      const points = stroke.points.map((point) => `${(point.x * 100).toFixed(2)},${(point.y * 140).toFixed(2)}`).join(" ");
      return `<polyline points="${points}" fill="none" stroke="${xml(stroke.color)}" stroke-width="${width.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140" width="320" height="448"><rect width="100" height="140" fill="#f4ecd8"/>${paths}</svg>`;
}

export function notesToMarkdown(notes: BookNotes, pageText: (leaf: number) => string): string {
  const leaves = new Set<number>();
  Object.keys(notes.strokes).forEach((key) => {
    if (notes.strokes[key]?.length) leaves.add(Number(key));
  });
  notes.comments.forEach((comment) => leaves.add(comment.leaf));
  const ordered = [...leaves].sort((a, b) => a - b);
  const lines: string[] = [
    `# Notes — ${notes.title}`,
    "",
    `Author: ${notes.author}`,
    `Project Gutenberg #${notes.id}`,
    "",
    "Written on Night Desk. Marks are the ink on that page. The excerpt is the text those marks sit on.",
    "",
  ];
  if (!ordered.length) lines.push("_No ink or margin notes yet._", "");
  for (const leaf of ordered) {
    const label = leaf === 0 ? "Title page" : `Page ${leaf}`;
    lines.push(`## ${label}`, "");
    const excerpt = pageText(leaf).trim();
    if (excerpt) {
      lines.push("### On the page", "", excerpt.slice(0, 1200), "");
    }
    const comments = notes.comments.filter((comment) => comment.leaf === leaf);
    if (comments.length) {
      lines.push("### Margin notes", "");
      for (const comment of comments) lines.push(`- ${comment.text}`, "");
    }
    const strokes = notes.strokes[String(leaf)] ?? [];
    if (strokes.length) {
      lines.push("### Ink", "", strokesToSvg(strokes), "");
    }
  }
  if (notes.qa.length) {
    lines.push("## Questions asked of this book", "");
    for (const turn of notes.qa) {
      lines.push(`### ${turn.q}`, "", turn.lead, "");
      for (const passage of turn.passages) {
        lines.push(`> Page ${passage.page}: ${passage.text}`, "");
      }
    }
  }
  return lines.join("\n");
}

export function downloadText(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
