import type { BookNotes, Pt, Stroke } from "./notes";

export function uniqueStrokes(strokes: Stroke[]): Stroke[] {
  const seen = new Set<string>();
  return strokes.filter((stroke) => {
    if (seen.has(stroke.id)) return false;
    seen.add(stroke.id);
    return true;
  });
}

// Iterative Ramer–Douglas–Peucker, in normalized page coordinates. Only used
// under quota pressure; endpoints and deviations above 0.0005 are preserved.
export function simplifyPoints(points: Pt[], tolerance = 0.0005): Pt[] {
  if (points.length <= 2) return points;
  const keep = new Set([0, points.length - 1]);
  const ranges = [[0, points.length - 1]];
  while (ranges.length) {
    const [first, last] = ranges.pop()!;
    const a = points[first!]!;
    const b = points[last!]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = dx * dx + dy * dy;
    let max = tolerance * tolerance;
    let selected = -1;
    for (let i = first! + 1; i < last!; i++) {
      const p = points[i]!;
      const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
      const distance = (p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2;
      if (distance > max) { max = distance; selected = i; }
    }
    if (selected >= 0) {
      keep.add(selected);
      ranges.push([first!, selected], [selected, last!]);
    }
  }
  return [...keep].sort((a, b) => a - b).map((index) => points[index]!);
}

export function compactNotes(notes: Record<string, BookNotes>): Record<string, BookNotes> {
  return Object.fromEntries(Object.entries(notes).map(([id, book]) => [id, {
    ...book,
    qa: book.qa.slice(-40),
    strokes: Object.fromEntries(Object.entries(book.strokes).map(([leaf, strokes]) => [leaf,
      uniqueStrokes(strokes).map((stroke) => ({ ...stroke, points: simplifyPoints(stroke.points) })),
    ])),
  }]));
}
