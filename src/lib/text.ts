const START_RE = /\*\*\*\s*START OF (THE |THIS )?PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i;
const END_RE = /\*\*\*\s*END OF (THE |THIS )?PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i;
const OLD_END_RE = /End of (the )?Project Gutenberg('s)? .*?\*\*\*/i;
const CHAPTER_RE =
  /^(?:chapter|letter|book|part|volume|preface|introduction|contents|conclusion|epilogue|prologue|appendix|epistle|stave|act)\b/i;
const SCENE_RE = /^(?:scene|canto)\b/i;
const KEEP_HYPHEN =
  /(?:^|\s)(?:to|co|re|pre|non|ex|self|all|mid|neo|sub|un|de|pro|anti|over|under|semi|bi|tri|cross|well|ill|half|full)-$/i;

export type Run = { kind: "text" | "em" | "sup" | "sub"; text: string };

export type Block =
  | { type: "heading"; level: 1 | 2; runs: Run[]; plain: string }
  | { type: "para"; runs: Run[]; plain: string; flush: boolean; cont: boolean; salute: boolean; aside: boolean }
  | { type: "verse"; lines: { runs: Run[]; plain: string }[] }
  | { type: "center"; lines: { runs: Run[]; plain: string }[] }
  | { type: "plate"; runs: Run[]; plain: string }
  | { type: "toc"; runs: Run[]; loc: string; plain: string }
  | { type: "rule" }
  | { type: "break" };

export type Edition = { blocks: Block[]; plain: string; words: number };

export type Leaf = { blocks: Block[]; chapter: string; plain: string };

const SENT = /\u0001(em|sup|sub)([\s\S]*?)\u0001/g;

export function extractBody(raw: string): string {
  let text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const start = text.search(START_RE);
  if (start >= 0) {
    const marker = text.match(START_RE);
    text = text.slice(start + (marker?.[0].length ?? 0));
  }
  const end = text.search(END_RE);
  if (end >= 0) text = text.slice(0, end);
  else {
    const oldEnd = text.search(OLD_END_RE);
    if (oldEnd >= 0) text = text.slice(0, oldEnd);
  }
  return text.replace(/[ \t]+\n/g, "\n").trim();
}

function pushBreak(blocks: Block[]) {
  if (!blocks.length) return;
  if (blocks[blocks.length - 1]?.type === "break") return;
  blocks.push({ type: "break" });
}

function isRule(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 80) return false;
  if (!/^[*_.=~·•\-–—\s]+$/.test(t)) return false;
  const marks = t.replace(/\s/g, "");
  return marks.length >= 3;
}

function isRomanHead(line: string): boolean {
  const match = line.trim().match(/^([IVXLCDM]{1,8})\.\s*(.*)$/);
  if (!match) return false;
  const rest = (match[2] ?? "").trim();
  if (!rest) return line.trim().length <= 8;
  if (rest.length > 60 || /[.!?]/.test(rest) || rest.split(/\s+/).length > 10) return false;
  const letters = rest.replace(/[^A-Za-z]/g, "");
  if (!letters) return false;
  return letters.replace(/[^A-Z]/g, "").length / letters.length > 0.6;
}

function isChapter(line: string): boolean {
  const t = line.trim();
  if (t.length < 2 || t.length > 80) return false;
  if (/[,:;]$/.test(t)) return false;
  if (isTocLine(t)) return false;
  if (CHAPTER_RE.test(t)) return true;
  return isRomanHead(t);
}

function isScene(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 70) return false;
  if (/[,:;]$/.test(t)) return false;
  return SCENE_RE.test(t);
}

function isSubhead(line: string): boolean {
  const t = line.trim();
  if (t.length < 2 || t.length > 68) return false;
  if (/[,:;]$/.test(t)) return false;
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (letters.length < 2) return false;
  const upper = letters.replace(/[^A-Z]/g, "").length;
  return upper / letters.length > 0.86 && t.split(/\s+/).length <= 12;
}

function isTocLine(line: string): boolean {
  return /^.{2,90}?(?:\s{3,}|\s*\.{2,}\s*)([0-9]{1,4}|[ivxlcdm]{1,8})\s*$/i.test(line.trim());
}

function isPageMarker(raw: string): boolean {
  const lead = raw.match(/^ */)?.[0].length ?? 0;
  const s = raw.trim();
  if (lead < 8) return false;
  if (/^\d{1,4}$/.test(s)) return true;
  return /^[ivxlcdm]{2,7}$/i.test(s);
}

function isSalute(line: string): boolean {
  const s = line.trim();
  if (s.length > 180) return false;
  if (/^_[\s\S]+_$/.test(s)) return true;
  if (/^\(_[\s\S]+_\)$/.test(s)) return true;
  return false;
}

function bracketClosed(s: string): boolean {
  let depth = 0;
  let seen = false;
  for (const c of s) {
    if (c === "[") {
      depth++;
      seen = true;
    } else if (c === "]") depth--;
  }
  return seen && depth <= 0;
}

function illustrationCaption(blob: string): string {
  const start = blob.search(/\[Illustration\b/i);
  if (start < 0) return "";
  let depth = 0;
  let end = blob.length;
  for (let i = start; i < blob.length; i++) {
    if (blob[i] === "[") depth++;
    else if (blob[i] === "]") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  let inner = blob.slice(start, end).replace(/^\[Illustration\b[:\s]*/i, "");
  inner = inner.replace(/\[(?:_|\s)*copyright[\s\S]*$/i, "");
  inner = inner.replace(/\s+/g, " ").trim();
  if (!inner || /^copyright\b/i.test(inner)) return "";
  return inner;
}

function smartQuotes(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      const prev = out.slice(-1) || " ";
      const open = out.length === 0 || /[\s(\[{—–-]/.test(prev);
      out += open ? "\u201c" : "\u201d";
      continue;
    }
    if (c === "'") {
      const prev = input[i - 1] ?? " ";
      const next = input[i + 1] ?? " ";
      if ((/[A-Za-z]/.test(prev) && /[A-Za-z]/.test(next)) || (/[0-9]/.test(prev) && /[0-9s]/.test(next))) {
        out += "\u2019";
        continue;
      }
      const open = i === 0 || /[\s(\[{—–\-"“]/.test(prev);
      out += open ? "\u2018" : "\u2019";
      continue;
    }
    out += c;
  }
  return out;
}

function typograph(input: string): string {
  let s = input.replace(/\u00a0/g, " ");
  s = s.replace(/__([^_\n]{1,400})__/g, "\u0001em$1\u0001");
  s = s.replace(/_\{([^{}\n]{1,40})\}/g, "\u0001sub$1\u0001");
  s = s.replace(/\^\{([^{}\n]{1,40})\}/g, "\u0001sup$1\u0001");
  s = s.replace(/_([^_\n]{1,4000})_/g, "\u0001em$1\u0001");
  s = s.replace(/(^|[\s(])\*([A-Za-z0-9][^*\n]{0,80}?)\*(?=[\s).,;:!?]|$)/g, "$1\u0001em$2\u0001");
  s = s.replace(/---/g, "\u2014").replace(/--/g, "\u2014");
  s = s.replace(/``/g, "\u201c").replace(/''/g, "\u201d");
  s = smartQuotes(s);
  s = s.replace(/(^|[\s(])_+(?=\S)/g, "$1\u201c");
  s = s.replace(/_+(?=[),.;:!?\s]|$)/g, "\u201d");
  s = s.replace(/_+/g, "");
  return s;
}

export function parseRuns(input: string): Run[] {
  const text = typograph(input);
  const runs: Run[] = [];
  let last = 0;
  SENT.lastIndex = 0;
  for (const match of text.matchAll(SENT)) {
    const at = match.index ?? 0;
    if (at > last) runs.push({ kind: "text", text: text.slice(last, at) });
    const kind = match[1] === "em" || match[1] === "sup" || match[1] === "sub" ? match[1] : "text";
    if (match[2]) runs.push({ kind, text: match[2] });
    last = at + match[0].length;
  }
  if (last < text.length) runs.push({ kind: "text", text: text.slice(last) });
  return runs.filter((run) => run.text.length > 0);
}

export function visible(input: string): string {
  return parseRuns(input)
    .map((run) => run.text)
    .join("");
}

function unwrapLines(lines: string[]): string {
  let out = "";
  for (const line of lines) {
    const piece = line.trim();
    if (!piece) continue;
    if (!out) {
      out = piece;
      continue;
    }
    if (/[A-Za-z]-$/.test(out)) {
      if (KEEP_HYPHEN.test(out)) out += piece;
      else out = out.slice(0, -1) + piece;
    } else out += " " + piece;
  }
  return out;
}

function splitSentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (!/[.!?]/.test(text[i] ?? "")) continue;
    let j = i + 1;
    while (j < text.length && /["'”’)\]]/.test(text[j] ?? "")) j++;
    if (j < text.length && !/\s/.test(text[j] ?? "")) continue;
    const chunk = text.slice(start, j);
    if (/\b(?:Mr|Mrs|Ms|Dr|St|Prof|Sr|Jr|vs|etc|Fig|No|Vol|pp|Rev|Gen|Col|Capt|Lt|Sgt|i\.e|e\.g)\.\s*$/i.test(chunk)) continue;
    if (/\b[A-Z]\.\s*$/.test(chunk)) continue;
    const piece = chunk.trim();
    if (piece) out.push(piece);
    while (j < text.length && /\s/.test(text[j] ?? "")) j++;
    start = j;
    i = j - 1;
  }
  const tail = text.slice(start).trim();
  if (tail) out.push(tail);
  return out.length ? out : [text];
}

function groupChunks(sentences: string[], size: number): string[] {
  const out: string[] = [];
  let buf = "";
  for (const sentence of sentences) {
    if (buf && buf.length + sentence.length + 1 > size) {
      out.push(buf);
      buf = sentence;
    } else buf = buf ? `${buf} ${sentence}` : sentence;
  }
  if (buf) out.push(buf);
  return out.length ? out : [sentences.join(" ")];
}

function makeHeading(line: string, level: 1 | 2): Block {
  return { type: "heading", level, runs: parseRuns(line.trim()), plain: visible(line.trim()) };
}

function splitToc(line: string): { label: string; loc: string } {
  const match = line.trim().match(/^(.*?)(?:\s{3,}|\s*\.{2,}\s*)([0-9]{1,4}|[ivxlcdm]{1,8})\s*$/i);
  if (!match) return { label: line.trim(), loc: "" };
  return { label: match[1]?.trim() ?? line.trim(), loc: match[2] ?? "" };
}

function tocBlock(line: string): Block {
  const split = splitToc(line);
  return { type: "toc", runs: parseRuns(split.label), loc: split.loc, plain: visible(split.label) };
}

function paraBlock(text: string, flags: { cont: boolean; salute: boolean; aside: boolean }): Block {
  return {
    type: "para",
    runs: parseRuns(text),
    plain: visible(text),
    flush: flags.cont || flags.salute || flags.aside,
    cont: flags.cont,
    salute: flags.salute,
    aside: flags.aside,
  };
}

function proseBlocks(rawLines: string[], salute: boolean, aside: boolean): Block[] {
  const text = unwrapLines(rawLines);
  if (!text) return [];
  if (salute || aside || text.length <= 280) return [paraBlock(text, { cont: false, salute, aside })];
  return groupChunks(splitSentences(text), 260).map((chunk, index) =>
    paraBlock(chunk, { cont: index > 0, salute: false, aside: false }),
  );
}

function isCenterpiece(rawLines: string[]): boolean {
  const content = rawLines.filter((line) => line.trim());
  if (content.length < 2 || content.length > 16) return false;
  const indents = content.map((line) => line.length - line.trimStart().length);
  const avgIndent = indents.reduce((sum, n) => sum + n, 0) / indents.length;
  const avgLen = content.reduce((sum, line) => sum + line.trim().length, 0) / content.length;
  const maxLen = Math.max(...content.map((line) => line.trim().length));
  return avgIndent >= 10 && avgLen <= 38 && maxLen <= 52;
}

function isVerse(rawLines: string[]): boolean {
  const content = rawLines.map((line) => line.trim()).filter(Boolean);
  if (content.length < 3) return false;
  const lens = content.map((line) => line.length);
  const avg = lens.reduce((sum, n) => sum + n, 0) / lens.length;
  const max = Math.max(...lens);
  return avg < 48 && max < 62;
}

function classifyChunk(rawLines: string[]): Block[] {
  const content = rawLines.filter((line) => line.trim());
  const trimmed = content.map((line) => line.trim());
  if (!trimmed.length) return [];
  if (trimmed.length === 1 && isTocLine(trimmed[0] ?? "")) return [tocBlock(trimmed[0] ?? "")];
  const tocHits = trimmed.filter((line) => isChapter(line) || isTocLine(line)).length;
  if (trimmed.length >= 2 && tocHits / trimmed.length >= 0.7) return trimmed.map(tocBlock);
  if (trimmed.length === 1 && isChapter(trimmed[0] ?? "")) return [makeHeading(trimmed[0] ?? "", 1)];
  if (trimmed.length === 1 && (isSubhead(trimmed[0] ?? "") || isScene(trimmed[0] ?? ""))) return [makeHeading(trimmed[0] ?? "", 2)];
  if (trimmed.length === 1 && isSalute(trimmed[0] ?? "")) return proseBlocks(content, true, false);
  const joined = trimmed.join(" ");
  if (/^\[[\s\S]+\]$/.test(joined) && joined.length < 700 && !/illustration/i.test(joined)) return proseBlocks(content, false, true);
  if (isCenterpiece(content)) {
    return [
      {
        type: "center",
        lines: trimmed.map((line) => ({ runs: parseRuns(line), plain: visible(line) })),
      },
    ];
  }
  if (isVerse(content)) {
    const lines = trimmed.map((line) => ({ runs: parseRuns(line), plain: visible(line) }));
    const chunks: Block[] = [];
    for (let i = 0; i < lines.length; i += 12) chunks.push({ type: "verse", lines: lines.slice(i, i + 12) });
    return chunks;
  }
  return proseBlocks(content, false, false);
}

function markFlush(blocks: Block[]): Block[] {
  let flushNext = true;
  return blocks.map((block) => {
    if (block.type !== "para") {
      if (block.type === "heading" || block.type === "rule" || block.type === "plate" || block.type === "break" || block.type === "center") {
        flushNext = true;
      }
      return block;
    }
    const flush = flushNext || block.cont || block.salute || block.aside;
    if (!block.cont) flushNext = false;
    return flush === block.flush ? block : { ...block, flush };
  });
}

export function composeBook(raw: string): Edition {
  if (!raw.trim()) return { blocks: [], plain: "", words: 0 };
  const lines = extractBody(raw).split("\n");
  const blocks: Block[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (!buf.length) return;
    blocks.push(...classifyChunk(buf));
    buf = [];
  };
  const blankBefore = (index: number) => index === 0 || !lines[index - 1]?.trim() || lines[index - 1]?.includes("\f");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.includes("\f")) {
      flush();
      pushBreak(blocks);
      const rest = line.replace(/\f/g, "").trim();
      if (rest) buf.push(rest);
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    const trimmed = line.trim();
    if (isRule(trimmed)) {
      flush();
      blocks.push({ type: "rule" });
      continue;
    }
    if (/\[Illustration\b/i.test(line)) {
      flush();
      let blob = line;
      let guard = 0;
      while (!bracketClosed(blob) && i + 1 < lines.length && guard < 40) {
        i++;
        blob += "\n" + (lines[i] ?? "");
        guard++;
      }
      const caption = illustrationCaption(blob);
      blocks.push({ type: "plate", runs: caption ? parseRuns(caption) : [], plain: caption ? visible(caption) : "" });
      continue;
    }
    if (isPageMarker(line)) {
      flush();
      pushBreak(blocks);
      continue;
    }
    if (blankBefore(i) && (isChapter(trimmed) || isScene(trimmed))) {
      let j = i + 1;
      while (j < lines.length && !lines[j]?.trim()) j++;
      const next = lines[j]?.trim() ?? "";
      if (isChapter(trimmed) && (isChapter(next) || isTocLine(next))) {
        flush();
        const entries: string[] = [];
        while (i < lines.length) {
          const current = lines[i]?.trim() ?? "";
          if (!current) {
            let k = i + 1;
            while (k < lines.length && !lines[k]?.trim()) k++;
            const ahead = lines[k]?.trim() ?? "";
            let n = k + 1;
            while (n < lines.length && !lines[n]?.trim()) n++;
            const after = lines[n]?.trim() ?? "";
            const listLine = (value: string) => isChapter(value) || isTocLine(value) || (value.length > 0 && value.length < 70 && isSubhead(value));
            if (listLine(ahead) && (listLine(after) || isTocLine(ahead))) {
              i = k;
              continue;
            }
            break;
          }
          if (isChapter(current) || isTocLine(current) || isSubhead(current)) {
            entries.push(current);
            i++;
            continue;
          }
          i--;
          break;
        }
        blocks.push(...entries.map(tocBlock));
        continue;
      }
      flush();
      if (isChapter(trimmed)) {
        pushBreak(blocks);
        blocks.push(makeHeading(trimmed, 1));
      } else blocks.push(makeHeading(trimmed, 2));
      continue;
    }
    buf.push(line);
  }
  flush();
  while (blocks[0]?.type === "break") blocks.shift();
  const ready = markFlush(blocks);
  const plain = leafPlain(ready);
  return { blocks: ready, plain, words: wordCount(plain) };
}

export function blockPlain(block: Block): string {
  switch (block.type) {
    case "break":
    case "rule":
      return "";
    case "verse":
    case "center":
      return block.lines.map((line) => line.plain).join("\n");
    case "toc":
      return block.loc ? `${block.plain} ${block.loc}` : block.plain;
    default:
      return block.plain;
  }
}

export function leafPlain(blocks: Block[]): string {
  return blocks
    .map(blockPlain)
    .filter(Boolean)
    .join("\n\n");
}

export function blockHeight(block: Block, width: number): number {
  const font = 16.8;
  const line = Math.round(font * 1.55);
  const cpl = Math.max(18, Math.floor(width / (font * 0.48)));
  switch (block.type) {
    case "break":
      return 0;
    case "rule":
      return 32;
    case "heading":
      return block.level === 1 ? 76 : 44;
    case "plate":
      return block.plain ? 96 : 30;
    case "center":
      return 10 + block.lines.length * Math.round(font * 1.35);
    case "verse":
      return 14 + block.lines.length * Math.round(font * 1.45);
    case "toc":
      return line;
    case "para": {
      const lines = Math.max(1, Math.ceil(block.plain.length / cpl));
      const extra = block.salute || block.aside ? 10 : 0;
      return lines * line + extra;
    }
  }
}

export function packLeaves(blocks: Block[], heightOf: (block: Block, index: number) => number, budget: number): Leaf[] {
  const room = budget >= 80 ? budget : 340;
  const leaves: Leaf[] = [];
  let cur: Block[] = [];
  let used = 0;
  let chapter = "";
  const push = () => {
    if (!cur.length) return;
    leaves.push({ blocks: cur, chapter, plain: leafPlain(cur) });
    cur = [];
    used = 0;
  };
  blocks.forEach((block, index) => {
    if (block.type === "heading" && block.level === 1) chapter = block.plain;
    if (block.type === "break") {
      push();
      return;
    }
    const height = heightOf(block, index);
    if (cur.length > 0 && used + height > room) push();
    cur.push(block);
    used += height;
  });
  push();
  return leaves;
}

/** Ignore toolbar and scrollbar jitter. A real resize still updates. */
export function stableBox(
  prev: { width: number; budget: number },
  width: number,
  budget: number,
): { width: number; budget: number } {
  const nextWidth = Math.round(width);
  const nextBudget = Math.round(budget);
  if (!Number.isFinite(nextWidth) || !Number.isFinite(nextBudget) || nextWidth < 80 || nextBudget < 80) return prev;
  if (prev.width >= 80 && Math.abs(nextWidth - prev.width) < 16 && Math.abs(nextBudget - prev.budget) < 64) return prev;
  return { width: nextWidth, budget: nextBudget };
}

/** Keep the reader on the leaf that still contains the anchor. Does not move the anchor. */
export function holdPlace(plains: string[], page: number, anchor: string): number {
  if (page <= 0 || !anchor) return page;
  const snip = anchor.slice(0, 40);
  if (!snip) return page;
  const here = plains[page - 1] ?? "";
  if (here.includes(snip)) return page;
  const found = plains.findIndex((plain) => plain.includes(snip));
  if (found >= 0) return found + 1;
  return Math.min(Math.max(page, 0), plains.length);
}

export function wordCount(text: string): number {
  const words = text.match(/[A-Za-z0-9'’]+/g);
  return words?.length ?? 0;
}

export function cleanBook(raw: string): string {
  return composeBook(raw).plain;
}

/** Plain-text pages for callers that already hold cleaned prose. */
export function paginate(text: string, size = 900): string[] {
  const paras = text
    .split(/\n\s*\n/)
    .map((para) => para.trim())
    .filter(Boolean);
  const pages: string[] = [];
  let buf: string[] = [];
  let len = 0;
  const flush = () => {
    if (!buf.length) return;
    pages.push(buf.join("\n\n"));
    buf = [];
    len = 0;
  };
  for (const para of paras) {
    if (len > 0 && len + para.length + 2 > size) flush();
    buf.push(para);
    len += para.length + 2;
  }
  flush();
  return pages.length ? pages : [""];
}
