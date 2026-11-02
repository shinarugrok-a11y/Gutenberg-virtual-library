import { i as __toESM } from "../_runtime.mjs";
import { i as require_react, r as require_jsx_runtime, t as useQuery } from "../_libs/react+tanstack__react-query.mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { i as frequency, n as LANGUAGES } from "./shelf-Dj6RgV5J.mjs";
import { _ as ChevronRight, a as Search, c as Repeat1, d as PenLine, f as Pause, g as Download, h as Headphones, i as Shuffle, l as Radio, m as Library, n as SkipForward, o as ScrollText, p as LoaderCircle, r as SkipBack, s as Repeat, u as Play, v as ChevronLeft, y as BookOpen } from "../_libs/lucide-react.mjs";
import { i as keepPreviousData } from "../_libs/tanstack__query-core.mjs";
import { t as create } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-B_I1Rrs9.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var ORDERS$1 = [
	"title",
	"author",
	"newest",
	"popular",
	"genre"
];
function clampPage(value) {
	const page = Number(value);
	if (!Number.isFinite(page) || page < 1) return 1;
	return Math.min(1e4, Math.floor(page));
}
function readQuery(input) {
	const data = input ?? {};
	const order = ORDERS$1.includes(data.order) ? data.order : "popular";
	const letterRaw = typeof data.letter === "string" ? data.letter.trim().toUpperCase() : "";
	const letter = letterRaw === "#" || /^[A-Z]$/.test(letterRaw) ? letterRaw : "";
	return {
		q: typeof data.q === "string" ? data.q.trim().slice(0, 80) : "",
		order,
		genre: typeof data.genre === "string" ? data.genre.slice(0, 40) : "",
		lang: typeof data.lang === "string" ? data.lang.slice(0, 8) : "",
		letter,
		page: clampPage(data.page)
	};
}
var searchShelf = createServerFn({ method: "GET" }).validator(readQuery).handler(createSsrRpc("1929ea4be7d0bb0b3b5604e4a1ab569c042aa9c178090c8eb1fd26512ce448e4"));
var spinDial = createServerFn({ method: "GET" }).validator(readQuery).handler(createSsrRpc("8deb5494821677ac6a086d95bc23e8bf3d4c7b1665478576933d222e4450e3d7"));
var fetchBookText = createServerFn({ method: "GET" }).validator((input) => {
	const id = Number(input?.id);
	if (!Number.isInteger(id) || id <= 0 || id > 1e6) throw new Error("That isn't a Gutenberg book.");
	return { id };
}).handler(createSsrRpc("a6174307a4b52f20738c1cd96513c2520c1507c2e9a8b00bb8a69bc9759797c6"));
var INKS = [
	{
		id: "gall",
		label: "Iron gall",
		color: "#1c140e"
	},
	{
		id: "lamp",
		label: "Lampblack",
		color: "#14120f"
	},
	{
		id: "blue",
		label: "Fountain blue",
		color: "#1a3a6b"
	},
	{
		id: "oxblood",
		label: "Oxblood",
		color: "#6e2430"
	},
	{
		id: "graphite",
		label: "Graphite",
		color: "#3e434a"
	},
	{
		id: "cedar",
		label: "Cedar pencil",
		color: "#5c4636"
	}
];
function eraseNear(strokes, x, y, radius) {
	const out = [];
	for (const stroke of strokes) {
		let current = [];
		const flush = (points) => {
			if (points.length > 1) out.push({
				...stroke,
				id: `${stroke.id}-${out.length}`,
				points
			});
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
function xml(value) {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function strokesToSvg(strokes) {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140" width="320" height="448"><rect width="100" height="140" fill="#f4ecd8"/>${strokes.filter((stroke) => stroke.points.length > 1).map((stroke) => {
		const width = stroke.tool === "marker" ? stroke.size * .9 : stroke.tool === "brush" ? stroke.size * .55 : stroke.size * .28;
		const opacity = stroke.tool === "marker" ? .35 : stroke.tool === "pencil" ? .6 : stroke.tool === "brush" ? .8 : .92;
		return `<polyline points="${stroke.points.map((point) => `${(point.x * 100).toFixed(2)},${(point.y * 140).toFixed(2)}`).join(" ")}" fill="none" stroke="${xml(stroke.color)}" stroke-width="${width.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`;
	}).join("")}</svg>`;
}
function notesToMarkdown(notes, pageText) {
	const leaves = /* @__PURE__ */ new Set();
	Object.keys(notes.strokes).forEach((key) => {
		if (notes.strokes[key]?.length) leaves.add(Number(key));
	});
	notes.comments.forEach((comment) => leaves.add(comment.leaf));
	const ordered = [...leaves].sort((a, b) => a - b);
	const lines = [
		`# Notes — ${notes.title}`,
		"",
		`Author: ${notes.author}`,
		`Project Gutenberg #${notes.id}`,
		"",
		"Written on Night Desk. Marks are the ink on that page. The excerpt is the text those marks sit on.",
		""
	];
	if (!ordered.length) lines.push("_No ink or margin notes yet._", "");
	for (const leaf of ordered) {
		const label = leaf === 0 ? "Title page" : `Page ${leaf}`;
		lines.push(`## ${label}`, "");
		const excerpt = pageText(leaf).trim();
		if (excerpt) lines.push("### On the page", "", excerpt.slice(0, 1200), "");
		const comments = notes.comments.filter((comment) => comment.leaf === leaf);
		if (comments.length) {
			lines.push("### Margin notes", "");
			for (const comment of comments) lines.push(`- ${comment.text}`, "");
		}
		const strokes = notes.strokes[String(leaf)] ?? [];
		if (strokes.length) lines.push("### Ink", "", strokesToSvg(strokes), "");
	}
	if (notes.qa.length) {
		lines.push("## Questions asked of this book", "");
		for (const turn of notes.qa) {
			lines.push(`### ${turn.q}`, "", turn.lead, "");
			for (const passage of turn.passages) lines.push(`> Page ${passage.page}: ${passage.text}`, "");
		}
	}
	return lines.join("\n");
}
function downloadText(filename, contents, type) {
	const blob = new Blob([contents], { type });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}
var KEY = "nightdesk.v1";
function blank() {
	return {
		motion: null,
		skin: "amber",
		lcd: "amber",
		showPlaylist: true,
		showEq: false,
		volume: .8,
		eq: [
			0,
			0,
			0,
			0,
			0
		],
		tool: "pen",
		inkId: INKS[0].id,
		brush: 2.5,
		notes: {}
	};
}
var saveTimer = null;
function scheduleSave() {
	if (typeof window === "undefined") return;
	if (saveTimer) clearTimeout(saveTimer);
	saveTimer = setTimeout(() => {
		const state = useDesk.getState();
		const payload = {
			motion: state.motion,
			skin: state.skin,
			lcd: state.lcd,
			showPlaylist: state.showPlaylist,
			showEq: state.showEq,
			volume: state.volume,
			eq: state.eq,
			tool: state.tool,
			inkId: state.inkId,
			brush: state.brush,
			notes: state.notes
		};
		try {
			localStorage.setItem(KEY, JSON.stringify(payload));
			if (useDesk.getState().storageWarning) useDesk.setState({ storageWarning: false });
		} catch {
			useDesk.setState({ storageWarning: true });
		}
	}, 350);
}
var useDesk = create((set, get) => ({
	...blank(),
	storageWarning: false,
	setMotion: (motion) => {
		set({ motion });
		scheduleSave();
	},
	setSkin: (skin) => {
		set({ skin });
		scheduleSave();
	},
	setLcd: (lcd) => {
		set({ lcd });
		scheduleSave();
	},
	setShowPlaylist: (showPlaylist) => {
		set({ showPlaylist });
		scheduleSave();
	},
	setShowEq: (showEq) => {
		set({ showEq });
		scheduleSave();
	},
	setVolume: (volume) => {
		set({ volume });
		scheduleSave();
	},
	setEqBand: (index, value) => {
		const eq = get().eq.slice();
		eq[index] = value;
		set({ eq });
		scheduleSave();
	},
	setTool: (tool) => {
		set({ tool });
		scheduleSave();
	},
	setInkId: (inkId) => {
		set({ inkId });
		scheduleSave();
	},
	setBrush: (brush) => {
		set({ brush });
		scheduleSave();
	},
	ensureBook: (id, title, author) => {
		const key = String(id);
		if (get().notes[key]) return;
		set({ notes: {
			...get().notes,
			[key]: {
				id,
				title,
				author,
				strokes: {},
				comments: [],
				qa: []
			}
		} });
	},
	setStrokes: (id, leaf, strokes) => {
		const key = String(id);
		const current = get().notes[key] ?? {
			id,
			title: "",
			author: "",
			strokes: {},
			comments: [],
			qa: []
		};
		set({ notes: {
			...get().notes,
			[key]: {
				...current,
				strokes: {
					...current.strokes,
					[String(leaf)]: strokes
				}
			}
		} });
		scheduleSave();
	},
	addComment: (id, leaf, text) => {
		const trimmed = text.trim();
		if (!trimmed) return;
		const key = String(id);
		const current = get().notes[key] ?? {
			id,
			title: "",
			author: "",
			strokes: {},
			comments: [],
			qa: []
		};
		const comment = {
			id: `${Date.now()}`,
			leaf,
			text: trimmed.slice(0, 2e3),
			at: Date.now()
		};
		set({ notes: {
			...get().notes,
			[key]: {
				...current,
				comments: [...current.comments, comment]
			}
		} });
		scheduleSave();
	},
	addQa: (id, turn) => {
		const key = String(id);
		const current = get().notes[key] ?? {
			id,
			title: "",
			author: "",
			strokes: {},
			comments: [],
			qa: []
		};
		set({ notes: {
			...get().notes,
			[key]: {
				...current,
				qa: [...current.qa, turn].slice(-40)
			}
		} });
		scheduleSave();
	},
	hydrate: (motionDefault) => {
		if (typeof window === "undefined") return;
		try {
			const raw = localStorage.getItem(KEY);
			if (!raw) {
				set({ motion: motionDefault });
				return;
			}
			const data = JSON.parse(raw);
			set({
				motion: typeof data.motion === "boolean" ? data.motion : motionDefault,
				skin: [
					"amber",
					"classic",
					"paper",
					"nocturne",
					"phosphor"
				].includes(data.skin) ? data.skin : "amber",
				lcd: [
					"amber",
					"green",
					"ice",
					"paper"
				].includes(data.lcd) ? data.lcd : "amber",
				showPlaylist: data.showPlaylist !== false,
				showEq: Boolean(data.showEq),
				volume: typeof data.volume === "number" ? Math.min(1, Math.max(0, data.volume)) : .8,
				eq: Array.isArray(data.eq) && data.eq.length === 5 ? data.eq.map((n) => Number(n) || 0) : [
					0,
					0,
					0,
					0,
					0
				],
				tool: [
					"pen",
					"pencil",
					"brush",
					"marker",
					"eraser"
				].includes(data.tool) ? data.tool : "pen",
				inkId: INKS.some((ink) => ink.id === data.inkId) ? data.inkId : INKS[0].id,
				brush: typeof data.brush === "number" ? data.brush : 2.5,
				notes: data.notes && typeof data.notes === "object" ? data.notes : {}
			});
		} catch {
			set({ motion: motionDefault });
		}
	}
}));
var START_RE = /\*\*\*\s*START OF (THE |THIS )?PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i;
var END_RE = /\*\*\*\s*END OF (THE |THIS )?PROJECT GUTENBERG EBOOK[^*]*\*\*\*/i;
var OLD_END_RE = /End of (the )?Project Gutenberg('s)? .*?\*\*\*/i;
var CHAPTER_RE = /^(?:chapter|letter|book|part|volume|preface|introduction|contents|conclusion|epilogue|prologue|appendix|epistle|stave|act)\b/i;
var SCENE_RE = /^(?:scene|canto)\b/i;
var KEEP_HYPHEN = /(?:^|\s)(?:to|co|re|pre|non|ex|self|all|mid|neo|sub|un|de|pro|anti|over|under|semi|bi|tri|cross|well|ill|half|full)-$/i;
var SENT = /\u0001(em|sup|sub)([\s\S]*?)\u0001/g;
function extractBody(raw) {
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
function pushBreak(blocks) {
	if (!blocks.length) return;
	if (blocks[blocks.length - 1]?.type === "break") return;
	blocks.push({ type: "break" });
}
function isRule(line) {
	const t = line.trim();
	if (t.length < 3 || t.length > 80) return false;
	if (!/^[*_.=~·•\-–—\s]+$/.test(t)) return false;
	return t.replace(/\s/g, "").length >= 3;
}
function isRomanHead(line) {
	const match = line.trim().match(/^([IVXLCDM]{1,8})\.\s*(.*)$/);
	if (!match) return false;
	const rest = (match[2] ?? "").trim();
	if (!rest) return line.trim().length <= 8;
	if (rest.length > 60 || /[.!?]/.test(rest) || rest.split(/\s+/).length > 10) return false;
	const letters = rest.replace(/[^A-Za-z]/g, "");
	if (!letters) return false;
	return letters.replace(/[^A-Z]/g, "").length / letters.length > .6;
}
function isChapter(line) {
	const t = line.trim();
	if (t.length < 2 || t.length > 80) return false;
	if (/[,:;]$/.test(t)) return false;
	if (isTocLine(t)) return false;
	if (CHAPTER_RE.test(t)) return true;
	return isRomanHead(t);
}
function isScene(line) {
	const t = line.trim();
	if (t.length < 3 || t.length > 70) return false;
	if (/[,:;]$/.test(t)) return false;
	return SCENE_RE.test(t);
}
function isSubhead(line) {
	const t = line.trim();
	if (t.length < 2 || t.length > 68) return false;
	if (/[,:;]$/.test(t)) return false;
	const letters = t.replace(/[^A-Za-z]/g, "");
	if (letters.length < 2) return false;
	return letters.replace(/[^A-Z]/g, "").length / letters.length > .86 && t.split(/\s+/).length <= 12;
}
function isTocLine(line) {
	return /^.{2,90}?(?:\s{3,}|\s*\.{2,}\s*)([0-9]{1,4}|[ivxlcdm]{1,8})\s*$/i.test(line.trim());
}
function isPageMarker(raw) {
	const lead = raw.match(/^ */)?.[0].length ?? 0;
	const s = raw.trim();
	if (lead < 8) return false;
	if (/^\d{1,4}$/.test(s)) return true;
	return /^[ivxlcdm]{2,7}$/i.test(s);
}
function isSalute(line) {
	const s = line.trim();
	if (s.length > 180) return false;
	if (/^_[\s\S]+_$/.test(s)) return true;
	if (/^\(_[\s\S]+_\)$/.test(s)) return true;
	return false;
}
function bracketClosed(s) {
	let depth = 0;
	let seen = false;
	for (const c of s) if (c === "[") {
		depth++;
		seen = true;
	} else if (c === "]") depth--;
	return seen && depth <= 0;
}
function illustrationCaption(blob) {
	const start = blob.search(/\[Illustration\b/i);
	if (start < 0) return "";
	let depth = 0;
	let end = blob.length;
	for (let i = start; i < blob.length; i++) if (blob[i] === "[") depth++;
	else if (blob[i] === "]") {
		depth--;
		if (depth === 0) {
			end = i;
			break;
		}
	}
	let inner = blob.slice(start, end).replace(/^\[Illustration\b[:\s]*/i, "");
	inner = inner.replace(/\[(?:_|\s)*copyright[\s\S]*$/i, "");
	inner = inner.replace(/\s+/g, " ").trim();
	if (!inner || /^copyright\b/i.test(inner)) return "";
	return inner;
}
function smartQuotes(input) {
	let out = "";
	for (let i = 0; i < input.length; i++) {
		const c = input[i];
		if (c === "\"") {
			const prev = out.slice(-1) || " ";
			const open = out.length === 0 || /[\s(\[{—–-]/.test(prev);
			out += open ? "“" : "”";
			continue;
		}
		if (c === "'") {
			const prev = input[i - 1] ?? " ";
			const next = input[i + 1] ?? " ";
			if (/[A-Za-z]/.test(prev) && /[A-Za-z]/.test(next) || /[0-9]/.test(prev) && /[0-9s]/.test(next)) {
				out += "’";
				continue;
			}
			const open = i === 0 || /[\s(\[{—–\-"“]/.test(prev);
			out += open ? "‘" : "’";
			continue;
		}
		out += c;
	}
	return out;
}
function typograph(input) {
	let s = input.replace(/\u00a0/g, " ");
	s = s.replace(/__([^_\n]{1,400})__/g, "em$1");
	s = s.replace(/_\{([^{}\n]{1,40})\}/g, "sub$1");
	s = s.replace(/\^\{([^{}\n]{1,40})\}/g, "sup$1");
	s = s.replace(/_([^_\n]{1,4000})_/g, "em$1");
	s = s.replace(/(^|[\s(])\*([A-Za-z0-9][^*\n]{0,80}?)\*(?=[\s).,;:!?]|$)/g, "$1em$2");
	s = s.replace(/---/g, "—").replace(/--/g, "—");
	s = s.replace(/``/g, "“").replace(/''/g, "”");
	s = smartQuotes(s);
	s = s.replace(/(^|[\s(])_+(?=\S)/g, "$1“");
	s = s.replace(/_+(?=[),.;:!?\s]|$)/g, "”");
	s = s.replace(/_+/g, "");
	return s;
}
function parseRuns(input) {
	const text = typograph(input);
	const runs = [];
	let last = 0;
	SENT.lastIndex = 0;
	for (const match of text.matchAll(SENT)) {
		const at = match.index ?? 0;
		if (at > last) runs.push({
			kind: "text",
			text: text.slice(last, at)
		});
		const kind = match[1] === "em" || match[1] === "sup" || match[1] === "sub" ? match[1] : "text";
		if (match[2]) runs.push({
			kind,
			text: match[2]
		});
		last = at + match[0].length;
	}
	if (last < text.length) runs.push({
		kind: "text",
		text: text.slice(last)
	});
	return runs.filter((run) => run.text.length > 0);
}
function visible(input) {
	return parseRuns(input).map((run) => run.text).join("");
}
function unwrapLines(lines) {
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
function splitSentences(text) {
	const out = [];
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
function groupChunks(sentences, size) {
	const out = [];
	let buf = "";
	for (const sentence of sentences) if (buf && buf.length + sentence.length + 1 > size) {
		out.push(buf);
		buf = sentence;
	} else buf = buf ? `${buf} ${sentence}` : sentence;
	if (buf) out.push(buf);
	return out.length ? out : [sentences.join(" ")];
}
function makeHeading(line, level) {
	return {
		type: "heading",
		level,
		runs: parseRuns(line.trim()),
		plain: visible(line.trim())
	};
}
function splitToc(line) {
	const match = line.trim().match(/^(.*?)(?:\s{3,}|\s*\.{2,}\s*)([0-9]{1,4}|[ivxlcdm]{1,8})\s*$/i);
	if (!match) return {
		label: line.trim(),
		loc: ""
	};
	return {
		label: match[1]?.trim() ?? line.trim(),
		loc: match[2] ?? ""
	};
}
function tocBlock(line) {
	const split = splitToc(line);
	return {
		type: "toc",
		runs: parseRuns(split.label),
		loc: split.loc,
		plain: visible(split.label)
	};
}
function paraBlock(text, flags) {
	return {
		type: "para",
		runs: parseRuns(text),
		plain: visible(text),
		flush: flags.cont || flags.salute || flags.aside,
		cont: flags.cont,
		salute: flags.salute,
		aside: flags.aside
	};
}
function proseBlocks(rawLines, salute, aside) {
	const text = unwrapLines(rawLines);
	if (!text) return [];
	if (salute || aside || text.length <= 280) return [paraBlock(text, {
		cont: false,
		salute,
		aside
	})];
	return groupChunks(splitSentences(text), 260).map((chunk, index) => paraBlock(chunk, {
		cont: index > 0,
		salute: false,
		aside: false
	}));
}
function isCenterpiece(rawLines) {
	const content = rawLines.filter((line) => line.trim());
	if (content.length < 2 || content.length > 16) return false;
	const indents = content.map((line) => line.length - line.trimStart().length);
	const avgIndent = indents.reduce((sum, n) => sum + n, 0) / indents.length;
	const avgLen = content.reduce((sum, line) => sum + line.trim().length, 0) / content.length;
	const maxLen = Math.max(...content.map((line) => line.trim().length));
	return avgIndent >= 10 && avgLen <= 38 && maxLen <= 52;
}
function isVerse(rawLines) {
	const content = rawLines.map((line) => line.trim()).filter(Boolean);
	if (content.length < 3) return false;
	const lens = content.map((line) => line.length);
	const avg = lens.reduce((sum, n) => sum + n, 0) / lens.length;
	const max = Math.max(...lens);
	return avg < 48 && max < 62;
}
function classifyChunk(rawLines) {
	const content = rawLines.filter((line) => line.trim());
	const trimmed = content.map((line) => line.trim());
	if (!trimmed.length) return [];
	if (trimmed.length === 1 && isTocLine(trimmed[0] ?? "")) return [tocBlock(trimmed[0] ?? "")];
	const tocHits = trimmed.filter((line) => isChapter(line) || isTocLine(line)).length;
	if (trimmed.length >= 2 && tocHits / trimmed.length >= .7) return trimmed.map(tocBlock);
	if (trimmed.length === 1 && isChapter(trimmed[0] ?? "")) return [makeHeading(trimmed[0] ?? "", 1)];
	if (trimmed.length === 1 && (isSubhead(trimmed[0] ?? "") || isScene(trimmed[0] ?? ""))) return [makeHeading(trimmed[0] ?? "", 2)];
	if (trimmed.length === 1 && isSalute(trimmed[0] ?? "")) return proseBlocks(content, true, false);
	const joined = trimmed.join(" ");
	if (/^\[[\s\S]+\]$/.test(joined) && joined.length < 700 && !/illustration/i.test(joined)) return proseBlocks(content, false, true);
	if (isCenterpiece(content)) return [{
		type: "center",
		lines: trimmed.map((line) => ({
			runs: parseRuns(line),
			plain: visible(line)
		}))
	}];
	if (isVerse(content)) {
		const lines = trimmed.map((line) => ({
			runs: parseRuns(line),
			plain: visible(line)
		}));
		const chunks = [];
		for (let i = 0; i < lines.length; i += 12) chunks.push({
			type: "verse",
			lines: lines.slice(i, i + 12)
		});
		return chunks;
	}
	return proseBlocks(content, false, false);
}
function markFlush(blocks) {
	let flushNext = true;
	return blocks.map((block) => {
		if (block.type !== "para") {
			if (block.type === "heading" || block.type === "rule" || block.type === "plate" || block.type === "break" || block.type === "center") flushNext = true;
			return block;
		}
		const flush = flushNext || block.cont || block.salute || block.aside;
		if (!block.cont) flushNext = false;
		return flush === block.flush ? block : {
			...block,
			flush
		};
	});
}
function composeBook(raw) {
	if (!raw.trim()) return {
		blocks: [],
		plain: "",
		words: 0
	};
	const lines = extractBody(raw).split("\n");
	const blocks = [];
	let buf = [];
	const flush = () => {
		if (!buf.length) return;
		blocks.push(...classifyChunk(buf));
		buf = [];
	};
	const blankBefore = (index) => index === 0 || !lines[index - 1]?.trim() || lines[index - 1]?.includes("\f");
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
			blocks.push({
				type: "plate",
				runs: caption ? parseRuns(caption) : [],
				plain: caption ? visible(caption) : ""
			});
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
				const entries = [];
				while (i < lines.length) {
					const current = lines[i]?.trim() ?? "";
					if (!current) {
						let k = i + 1;
						while (k < lines.length && !lines[k]?.trim()) k++;
						const ahead = lines[k]?.trim() ?? "";
						let n = k + 1;
						while (n < lines.length && !lines[n]?.trim()) n++;
						const after = lines[n]?.trim() ?? "";
						const listLine = (value) => isChapter(value) || isTocLine(value) || value.length > 0 && value.length < 70 && isSubhead(value);
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
	return {
		blocks: ready,
		plain,
		words: wordCount(plain)
	};
}
function blockPlain(block) {
	switch (block.type) {
		case "break":
		case "rule": return "";
		case "verse":
		case "center": return block.lines.map((line) => line.plain).join("\n");
		case "toc": return block.loc ? `${block.plain} ${block.loc}` : block.plain;
		default: return block.plain;
	}
}
function leafPlain(blocks) {
	return blocks.map(blockPlain).filter(Boolean).join("\n\n");
}
function blockHeight(block, width) {
	const font = 16.8;
	const line = Math.round(font * 1.55);
	const cpl = Math.max(18, Math.floor(width / (font * .48)));
	switch (block.type) {
		case "break": return 0;
		case "rule": return 32;
		case "heading": return block.level === 1 ? 76 : 44;
		case "plate": return block.plain ? 96 : 30;
		case "center": return 10 + block.lines.length * Math.round(font * 1.35);
		case "verse": return 14 + block.lines.length * Math.round(font * 1.45);
		case "toc": return line;
		case "para": {
			const lines = Math.max(1, Math.ceil(block.plain.length / cpl));
			const extra = block.salute || block.aside ? 10 : 0;
			return lines * line + extra;
		}
	}
}
function packLeaves(blocks, heightOf, budget) {
	const room = budget >= 80 ? budget : 340;
	const leaves = [];
	let cur = [];
	let used = 0;
	let chapter = "";
	const push = () => {
		if (!cur.length) return;
		leaves.push({
			blocks: cur,
			chapter,
			plain: leafPlain(cur)
		});
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
function wordCount(text) {
	return text.match(/[A-Za-z0-9'’]+/g)?.length ?? 0;
}
var ORDERS = [
	{
		id: "popular",
		label: "Borrowed"
	},
	{
		id: "title",
		label: "Title"
	},
	{
		id: "author",
		label: "Author"
	},
	{
		id: "genre",
		label: "Genre"
	},
	{
		id: "newest",
		label: "Newest"
	}
];
function Shelf({ qInput, onQ, order, onOrder, genre, onGenre, lang, onLang, letter, onLetter, page, onPage, books, total, pageCount, live, genres, loading, error, onRetry, activeId, onOpen, onSpin, spinning }) {
	const showGenres = order === "genre" && !genre;
	const letters = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];
	const showLetters = order === "title" || order === "author" || order === "genre" && Boolean(genre);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "panel",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "eyebrow",
				children: "Card catalog"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "mt-1 mb-3 text-2xl",
				children: "Every text on the shelf"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "relative block",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {
					className: "text-muted pointer-events-none absolute top-3 left-3 size-5",
					"aria-hidden": true
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					className: "desk-field with-icon",
					value: qInput,
					placeholder: "Title, author, or #1342",
					onChange: (event) => onQ(event.target.value),
					"aria-label": "Search the catalog"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "row-scroll mt-3",
				children: ORDERS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: `desk-btn${order === item.id ? " is-on" : ""}`,
					"aria-pressed": order === item.id,
					onClick: () => onOrder(item.id),
					children: item.label
				}, item.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "mt-3 block text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-muted",
					children: "Language"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
					className: "desk-select mt-1",
					value: lang,
					onChange: (event) => onLang(event.target.value),
					"aria-label": "Language",
					children: LANGUAGES.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
						value: item.id,
						children: item.label
					}, item.id || "all"))
				})]
			}),
			showLetters && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "letters mt-3",
				"aria-label": order === "author" ? "Author letter" : "Title letter",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: `desk-btn${letter === "" ? " is-on" : ""}`,
					onClick: () => onLetter(""),
					children: "All"
				}), letters.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: `desk-btn${letter === item ? " is-on" : ""}`,
					onClick: () => onLetter(item),
					children: item
				}, item))]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "row-scroll mt-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "desk-btn is-on",
					onClick: onSpin,
					disabled: spinning,
					children: spinning ? "Spinning" : "Spin the dial"
				}), genre && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "desk-btn",
					onClick: () => onGenre(""),
					children: "Clear band"
				})]
			}),
			loading && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-muted mt-4 flex items-center gap-2 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
					className: "spin size-4",
					"aria-hidden": true
				}), "Opening the card catalog"]
			}),
			error && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "warn",
					children: error
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "desk-btn mt-2",
					onClick: onRetry,
					children: "Try again"
				})]
			}),
			!loading && !error && showGenres && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "genre-list",
				children: (genres.length ? genres : []).map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "shelf-item",
					onClick: () => onGenre(item.id),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "freq",
						children: item.label.slice(0, 1)
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: item.label }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "meta",
						children: [item.count.toLocaleString(), " books"]
					})] })]
				}, item.id))
			}),
			!loading && !error && !showGenres && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-muted mt-3 text-sm",
					children: [live ? "Most borrowed, live from Project Gutenberg" : `${total.toLocaleString()} books`, genre ? ` · ${genres.find((item) => item.id === genre)?.label ?? "band"}` : ""]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "shelf-list",
					children: [books.map((book) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: `shelf-item${activeId === book.id ? " is-on" : ""}`,
						onClick: () => onOpen(book),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "freq",
							children: frequency(book.id)
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: book.title }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "meta",
								children: [
									book.author,
									book.year ? ` · ${book.year}` : "",
									" · ",
									book.lang || "—"
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "meta",
								children: book.shelf
							})
						] })]
					}, book.id)), !books.length && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted text-sm",
						children: "Nothing on this frequency."
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "row-scroll mt-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "desk-btn",
							disabled: page <= 1,
							onClick: () => onPage(page - 1),
							children: "Previous stack"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-muted text-sm tabular-nums",
							children: [
								page,
								" / ",
								Math.max(pageCount, 1)
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "desk-btn",
							disabled: page >= pageCount,
							onClick: () => onPage(page + 1),
							children: "Next stack"
						})
					]
				})
			] })
		]
	});
}
function Runs({ runs }) {
	return runs.map((run, index) => {
		if (run.kind === "em") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: run.text }, index);
		if (run.kind === "sup") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("sup", { children: run.text }, index);
		if (run.kind === "sub") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("sub", { children: run.text }, index);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: run.text }, index);
	});
}
function Ornament() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "ornament",
		"aria-hidden": true,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("i", {})
		]
	});
}
function BlockView({ block, spoken }) {
	if (block.type === "heading") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
		className: block.level === 1 ? "chap" : "subhead",
		children: spoken ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("mark", {
			className: "spoken",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Runs, { runs: block.runs })
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Runs, { runs: block.runs })
	});
	if (block.type === "para") {
		const drop = block.flush && !block.cont && !block.salute && !block.aside && /^[A-Za-z]/.test(block.plain);
		const className = [
			block.salute ? "salute" : "",
			block.aside ? "aside" : "",
			block.flush || block.cont ? "flush" : "",
			drop ? "drop" : ""
		].filter(Boolean).join(" ");
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: className || void 0,
			children: spoken ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("mark", {
				className: "spoken",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Runs, { runs: block.runs })
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Runs, { runs: block.runs })
		});
	}
	if (block.type === "verse") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: `verse${spoken ? " is-spoken" : ""}`,
		children: block.lines.map((line, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "verse-line",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Runs, { runs: line.runs })
		}, index))
	});
	if (block.type === "center") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "centerpiece",
		children: block.lines.map((line, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Runs, { runs: line.runs }) }, index))
	});
	if (block.type === "plate") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("figure", {
		className: "plate",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ornament, {}), block.plain ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("figcaption", { children: spoken ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("mark", {
			className: "spoken",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Runs, { runs: block.runs })
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Runs, { runs: block.runs }) }) : null]
	});
	if (block.type === "toc") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
		className: "toc-line",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: spoken ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("mark", {
				className: "spoken",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Runs, { runs: block.runs })
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Runs, { runs: block.runs }) }),
			block.loc ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "leader" }) : null,
			block.loc ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "toc-loc",
				children: block.loc
			}) : null
		]
	});
	if (block.type === "rule") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ornament, {});
	return null;
}
function Flow({ blocks, cursor, lang }) {
	let offset = 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "page-prose",
		lang: lang || "en",
		children: blocks.map((block, index) => {
			const text = blockPlain(block);
			const start = offset;
			if (text) offset += text.length + 2;
			const spoken = Boolean(text) && cursor != null && cursor >= start && cursor < start + text.length;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: `flow-block${spoken ? " is-spoken" : ""}`,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BlockView, {
					block,
					spoken
				})
			}, index);
		})
	});
}
function paint(ctx, strokes, width, height) {
	ctx.clearRect(0, 0, width, height);
	for (const stroke of strokes) {
		if (stroke.points.length < 2) continue;
		ctx.save();
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		ctx.strokeStyle = stroke.color;
		if (stroke.tool === "pencil") {
			ctx.globalAlpha = .55;
			ctx.lineWidth = stroke.size;
		} else if (stroke.tool === "brush") {
			ctx.globalAlpha = .78;
			ctx.lineWidth = stroke.size * 2.3;
		} else if (stroke.tool === "marker") {
			ctx.globalAlpha = .32;
			ctx.lineWidth = stroke.size * 3.6;
		} else {
			ctx.globalAlpha = .92;
			ctx.lineWidth = stroke.size;
		}
		ctx.beginPath();
		const first = stroke.points[0];
		ctx.moveTo(first.x * width, first.y * height);
		for (let i = 1; i < stroke.points.length; i++) {
			const point = stroke.points[i];
			ctx.lineTo(point.x * width, point.y * height);
		}
		ctx.stroke();
		if (stroke.tool === "pencil") {
			ctx.globalAlpha = .28;
			ctx.beginPath();
			ctx.moveTo(first.x * width + .7, first.y * height + .4);
			for (let i = 1; i < stroke.points.length; i++) {
				const point = stroke.points[i];
				ctx.lineTo(point.x * width + .7, point.y * height + .4);
			}
			ctx.stroke();
		}
		ctx.restore();
	}
}
function InkLayer({ active, tool, color, size, strokes, onChange }) {
	const canvasRef = (0, import_react.useRef)(null);
	const wrapRef = (0, import_react.useRef)(null);
	const [live, setLive] = (0, import_react.useState)(null);
	const strokesRef = (0, import_react.useRef)(strokes);
	strokesRef.current = strokes;
	(0, import_react.useEffect)(() => {
		const canvas = canvasRef.current;
		const wrap = wrapRef.current;
		if (!canvas || !wrap) return;
		const draw = () => {
			const rect = wrap.getBoundingClientRect();
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			canvas.width = Math.max(1, Math.floor(rect.width * dpr));
			canvas.height = Math.max(1, Math.floor(rect.height * dpr));
			const ctx = canvas.getContext("2d");
			if (!ctx) return;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			paint(ctx, live ? [...strokes, live] : strokes, rect.width, rect.height);
		};
		draw();
		const observer = new ResizeObserver(draw);
		observer.observe(wrap);
		return () => observer.disconnect();
	}, [strokes, live]);
	function pointOf(event) {
		const rect = wrapRef.current.getBoundingClientRect();
		return {
			x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
			y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
		};
	}
	function down(event) {
		if (!active) return;
		event.currentTarget.setPointerCapture(event.pointerId);
		const point = pointOf(event);
		if (tool === "eraser") {
			onChange(eraseNear(strokesRef.current, point.x, point.y, size / 180));
			return;
		}
		setLive({
			id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
			tool,
			color,
			size,
			points: [point]
		});
	}
	function move(event) {
		if (!active || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
		const point = pointOf(event);
		if (tool === "eraser") {
			onChange(eraseNear(strokesRef.current, point.x, point.y, size / 180));
			return;
		}
		setLive((current) => {
			if (!current) return current;
			const last = current.points[current.points.length - 1];
			if (!last) return current;
			const dx = last.x - point.x;
			const dy = last.y - point.y;
			if (dx * dx + dy * dy < 4e-6) return current;
			const jitter = tool === "pencil" ? (Math.random() - .5) * .004 : 0;
			const next = {
				x: point.x + jitter,
				y: point.y + jitter
			};
			if (current.points.length > 1600) return current;
			return {
				...current,
				points: [...current.points, next]
			};
		});
	}
	function up() {
		if (tool === "eraser") return;
		setLive((current) => {
			if (current && current.points.length > 1) onChange([...strokesRef.current, current]);
			return null;
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		ref: wrapRef,
		className: `ink-layer${active ? "" : " is-off"}`,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
			ref: canvasRef,
			"aria-label": "Ink on this page",
			onPointerDown: down,
			onPointerMove: move,
			onPointerUp: up,
			onPointerCancel: up
		})
	});
}
function LeafBody({ card, index, leaf, cursor, words, pageCount, status, error, ink, comments }) {
	const extra = comments.length > 0;
	if (index <= 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "page-scroll",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "page-inner title-leaf",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "page-kicker",
					children: ["Project Gutenberg #", card.id]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: card.title }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "page-prose",
					children: card.author
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "page-kicker",
					children: [
						card.shelf,
						card.year ? ` · ${card.year}` : "",
						" · ",
						card.lang || "unknown language"
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "page-prose",
					children: [
						status === "loading" && "The pages are coming up from the stacks.",
						status === "error" && (error || "This text didn't arrive."),
						status === "ready" && `${words.toLocaleString()} words on ${pageCount.toLocaleString()} pages. The type is set. Turn the leaf from the spine.`,
						status === "idle" && "Waiting on the shelf."
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "page-kicker",
					children: "Public-domain text via Project Gutenberg."
				}),
				comments.map((comment) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "margin-note",
					children: comment
				}, comment)),
				ink
			]
		})
	});
	const opensChapter = leaf?.blocks.some((block) => block.type === "heading" && block.level === 1) ?? false;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: `page-scroll${extra ? " has-extra" : ""}`,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "page-inner",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "running-head",
					children: opensChapter ? card.title : leaf?.chapter || card.title
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Flow, {
					blocks: leaf?.blocks ?? [],
					cursor,
					lang: card.lang
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "folio",
					children: index
				}),
				comments.map((comment) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "margin-note",
					children: comment
				}, comment)),
				ink
			]
		})
	});
}
function BookStage({ card, blocks, words, leaf, onLeaf, onPages, onAir, onStopAir, motion, status, error }) {
	const tool = useDesk((s) => s.tool);
	const inkId = useDesk((s) => s.inkId);
	const brush = useDesk((s) => s.brush);
	const notes = useDesk((s) => s.notes[String(card.id)]);
	const setTool = useDesk((s) => s.setTool);
	const setInkId = useDesk((s) => s.setInkId);
	const setBrush = useDesk((s) => s.setBrush);
	const setStrokes = useDesk((s) => s.setStrokes);
	const addComment = useDesk((s) => s.addComment);
	const [inkOpen, setInkOpen] = (0, import_react.useState)(false);
	const [draft, setDraft] = (0, import_react.useState)("");
	const [confirmClear, setConfirmClear] = (0, import_react.useState)(false);
	const [anim, setAnim] = (0, import_react.useState)(null);
	const [pending, setPending] = (0, import_react.useState)(null);
	const [cursor, setCursor] = (0, import_react.useState)(null);
	const [rate, setRate] = (0, import_react.useState)(1);
	const [box, setBox] = (0, import_react.useState)({
		width: 0,
		budget: 0
	});
	const estimated = (0, import_react.useMemo)(() => packLeaves(blocks, (block) => blockHeight(block, 340), 360), [blocks]);
	const [leaves, setLeaves] = (0, import_react.useState)(estimated);
	const cardRef = (0, import_react.useRef)(null);
	const measureRef = (0, import_react.useRef)(null);
	const placeRef = (0, import_react.useRef)("");
	const animRef = (0, import_react.useRef)(null);
	const shown = pending ?? leaf;
	const shownRef = (0, import_react.useRef)(shown);
	shownRef.current = shown;
	const last = leaves.length;
	const ink = INKS.find((item) => item.id === inkId) ?? INKS[0];
	const strokes = notes?.strokes[String(shown)] ?? [];
	const plains = (0, import_react.useMemo)(() => leaves.map((item) => item.plain), [leaves]);
	(0, import_react.useEffect)(() => {
		animRef.current = anim;
	}, [anim]);
	(0, import_react.useEffect)(() => {
		onPages(plains);
	}, [plains, onPages]);
	(0, import_react.useEffect)(() => {
		if (shown > 0) placeRef.current = leaves[shown - 1]?.plain.slice(0, 70) ?? "";
	}, [shown]);
	(0, import_react.useEffect)(() => {
		if (pending != null && leaf === pending) setPending(null);
	}, [leaf, pending]);
	(0, import_react.useEffect)(() => {
		if (shown > last) onLeaf(last);
	}, [
		shown,
		last,
		onLeaf
	]);
	(0, import_react.useLayoutEffect)(() => {
		const root = cardRef.current;
		if (!root) return;
		const read = () => {
			const scroll = root.querySelector(".page-scroll");
			const inner = root.querySelector(".page-inner");
			if (!scroll || !inner) return;
			const style = getComputedStyle(inner);
			const budget = scroll.clientHeight - Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom) - 36;
			const width = scroll.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight);
			setBox((prev) => prev.width === Math.round(width) && prev.budget === Math.round(budget) ? prev : {
				width: Math.round(width),
				budget: Math.round(budget)
			});
		};
		read();
		const observer = new ResizeObserver(read);
		observer.observe(root);
		document.fonts?.ready.then(read).catch(() => void 0);
		return () => observer.disconnect();
	}, [card.id, status]);
	(0, import_react.useLayoutEffect)(() => {
		const root = measureRef.current;
		if (!root || box.width < 80 || box.budget < 80) return;
		const nodes = root.querySelectorAll("[data-idx]");
		const heights = blocks.map((block, index) => {
			const measured = nodes[index]?.offsetHeight ?? 0;
			return measured > 0 ? measured : blockHeight(block, box.width);
		});
		const next = packLeaves(blocks, (_block, index) => heights[index] ?? 0, box.budget);
		const place = placeRef.current;
		const page = shownRef.current;
		if (place && page > 0) {
			if (!(next[page - 1]?.plain ?? "").includes(place.slice(0, 40))) {
				const found = next.findIndex((item) => item.plain.includes(place.slice(0, 40)));
				if (found >= 0) onLeaf(found + 1);
			}
		}
		setLeaves(next);
	}, [
		blocks,
		box,
		onLeaf
	]);
	(0, import_react.useLayoutEffect)(() => {
		if (anim?.phase !== "prep") return;
		const id = requestAnimationFrame(() => {
			setAnim((current) => current && current.phase === "prep" ? {
				...current,
				phase: "run"
			} : current);
		});
		return () => cancelAnimationFrame(id);
	}, [anim]);
	const commit = (0, import_react.useCallback)((next) => {
		setAnim(null);
		setPending(next);
		onLeaf(next);
	}, [onLeaf]);
	function turn(dir) {
		if (anim) return;
		const next = shown + dir;
		if (next < 0 || next > last) return;
		if (!motion) {
			setPending(next);
			onLeaf(next);
			return;
		}
		setAnim({
			dir,
			incoming: next,
			phase: "prep"
		});
	}
	(0, import_react.useEffect)(() => {
		if (anim?.phase !== "run") return;
		const timer = window.setTimeout(() => {
			const current = animRef.current;
			if (!current || current.phase !== "run") return;
			commit(current.incoming);
		}, 980);
		return () => window.clearTimeout(timer);
	}, [anim, commit]);
	(0, import_react.useEffect)(() => {
		if (!onAir || typeof window === "undefined" || !window.speechSynthesis) {
			window.speechSynthesis?.cancel();
			setCursor(null);
			return;
		}
		let stopped = false;
		const timer = window.setTimeout(() => {
			if (stopped) return;
			const synth = window.speechSynthesis;
			synth.cancel();
			const text = shown <= 0 ? `${card.title}. By ${card.author}.` : leaves[shown - 1]?.plain ?? "";
			if (!text.trim()) return;
			const utter = new SpeechSynthesisUtterance(text.slice(0, 8e3));
			utter.rate = rate;
			utter.lang = card.lang === "fr" ? "fr-FR" : card.lang === "de" ? "de-DE" : card.lang === "es" ? "es-ES" : card.lang === "it" ? "it-IT" : "en-US";
			utter.onboundary = (event) => {
				if (typeof event.charIndex === "number") setCursor(event.charIndex);
			};
			utter.onend = () => {
				if (stopped) return;
				setCursor(null);
				if (shown < last) turn(1);
				else onStopAir();
			};
			synth.speak(utter);
		}, 70);
		return () => {
			stopped = true;
			window.clearTimeout(timer);
			window.speechSynthesis.cancel();
		};
	}, [
		onAir,
		shown,
		card.id,
		card.title,
		card.author,
		card.lang,
		rate,
		leaves,
		last,
		motion,
		onStopAir
	]);
	function finish(event) {
		if (event.target !== event.currentTarget || event.propertyName !== "transform") return;
		const current = animRef.current;
		if (!current || current.phase !== "run") return;
		commit(current.incoming);
	}
	function jump(next) {
		setAnim(null);
		setPending(next);
		onLeaf(next);
	}
	function inkFor(index, interactive) {
		const pageStrokes = notes?.strokes[String(index)] ?? [];
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InkLayer, {
			active: interactive && inkOpen,
			tool,
			color: ink.color,
			size: brush,
			strokes: pageStrokes,
			onChange: (next) => setStrokes(card.id, index, next)
		});
	}
	function face(index, interactive) {
		const pageComments = (notes?.comments ?? []).filter((comment) => comment.leaf === index).map((comment) => comment.text);
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LeafBody, {
			card,
			index,
			leaf: index > 0 ? leaves[index - 1] ?? null : null,
			cursor: onAir && index === shown ? cursor : null,
			words,
			pageCount: leaves.length,
			status,
			error,
			comments: pageComments,
			ink: inkFor(index, interactive)
		});
	}
	const underIndex = anim ? anim.dir === 1 ? anim.incoming : shown : shown;
	const frontIndex = anim ? anim.dir === 1 ? shown : anim.incoming : shown;
	let transform = "perspective(1700px) rotateY(0deg)";
	if (anim?.phase === "prep" && anim.dir === -1) transform = "perspective(1700px) rotateY(-86deg)";
	if (anim?.phase === "run" && anim.dir === 1) transform = "perspective(1700px) rotateY(-86deg)";
	if (anim?.phase === "run" && anim.dir === -1) transform = "perspective(1700px) rotateY(0deg)";
	function exportNotes(kind) {
		const bookNotes = notes ?? {
			id: card.id,
			title: card.title,
			author: card.author,
			strokes: {},
			comments: [],
			qa: []
		};
		const slug = card.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || `book-${card.id}`;
		if (kind === "json") {
			downloadText(`nightdesk-${slug}.json`, JSON.stringify({
				...bookNotes,
				pages: plains
			}, null, 2), "application/json");
			return;
		}
		const markdown = notesToMarkdown({
			...bookNotes,
			title: card.title,
			author: card.author
		}, (index) => index <= 0 ? `${card.title}\n\n${card.author}` : plains[index - 1] ?? "");
		downloadText(`nightdesk-${slug}.md`, markdown, "text/markdown");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "book-stage",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: `book-card${anim ? " is-turning" : ""}`,
			ref: cardRef,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "book-stack",
					"aria-hidden": true
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "spine",
					"aria-hidden": true
				}),
				anim && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "page-static under",
					children: face(underIndex, false)
				}),
				!anim && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "page-static top",
					children: face(shown, true)
				}),
				anim && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: `leaf${anim.phase === "run" ? " is-run" : ""}`,
					style: {
						transform,
						transformOrigin: "left center"
					},
					onTransitionEnd: finish,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "leaf-face",
						children: face(frontIndex, false)
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "measure-clip",
					style: { width: box.width > 80 ? box.width : 320 },
					"aria-hidden": true,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "page-prose",
						ref: measureRef,
						lang: card.lang || "en",
						children: blocks.map((block, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flow-block",
							"data-idx": index,
							children: block.type === "break" ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BlockView, {
								block,
								spoken: false
							})
						}, index))
					})
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "book-tools",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "row-scroll",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "desk-btn",
							onClick: () => turn(-1),
							disabled: shown <= 0 || Boolean(anim),
							"aria-label": "Previous page",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, {
								className: "inline size-5",
								"aria-hidden": true
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-muted text-sm tabular-nums",
							children: [
								shown === 0 ? "Title" : `Page ${shown}`,
								" of ",
								Math.max(last, 0)
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "desk-btn",
							onClick: () => turn(1),
							disabled: shown >= last || Boolean(anim) || status !== "ready",
							"aria-label": "Next page",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, {
								className: "inline size-5",
								"aria-hidden": true
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: `desk-btn${inkOpen ? " is-on" : ""}`,
							"aria-pressed": inkOpen,
							onClick: () => setInkOpen((value) => !value),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PenLine, {
								className: "mr-1 inline size-4",
								"aria-hidden": true
							}), "Ink"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "desk-btn",
							onClick: () => exportNotes("md"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, {
								className: "mr-1 inline size-4",
								"aria-hidden": true
							}), "Notes"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: "desk-btn",
							onClick: () => exportNotes("json"),
							children: "JSON"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					className: "range",
					type: "range",
					min: 0,
					max: Math.max(last, 0),
					value: Math.min(shown, Math.max(last, 0)),
					"aria-label": "Page",
					onChange: (event) => jump(Number(event.target.value))
				}),
				onAir && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "text-muted row-scroll text-sm",
					children: ["Reading speed", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: "range range-short",
						type: "range",
						min: .8,
						max: 1.35,
						step: .05,
						value: rate,
						onChange: (event) => setRate(Number(event.target.value))
					})]
				}),
				inkOpen && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ink-tray panel",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "row-scroll",
							children: [
								{
									id: "pen",
									label: "Pen"
								},
								{
									id: "pencil",
									label: "Pencil"
								},
								{
									id: "brush",
									label: "Brush"
								},
								{
									id: "marker",
									label: "Marker"
								},
								{
									id: "eraser",
									label: "Eraser"
								}
							].map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: `desk-btn${tool === item.id ? " is-on" : ""}`,
								"aria-pressed": tool === item.id,
								onClick: () => setTool(item.id),
								children: item.label
							}, item.id))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "row-scroll",
							children: [INKS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: `ink-swatch${inkId === item.id ? " is-on" : ""}`,
								style: { background: item.color },
								"aria-label": item.label,
								"aria-pressed": inkId === item.id,
								onClick: () => setInkId(item.id)
							}, item.id)), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "text-muted text-sm",
								children: ["Weight", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									className: "range",
									type: "range",
									min: 1.2,
									max: 7,
									step: .2,
									value: brush,
									onChange: (event) => setBrush(Number(event.target.value))
								})]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "row-scroll",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "desk-btn",
								onClick: () => setStrokes(card.id, shown, strokes.slice(0, -1)),
								disabled: !strokes.length,
								children: "Undo"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: "desk-btn",
								onClick: () => {
									if (!confirmClear) {
										setConfirmClear(true);
										return;
									}
									setStrokes(card.id, shown, []);
									setConfirmClear(false);
								},
								children: confirmClear ? "Clear this page" : "Clear"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
							className: "row-scroll",
							onSubmit: (event) => {
								event.preventDefault();
								addComment(card.id, shown, draft);
								setDraft("");
							},
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								className: "desk-field",
								value: draft,
								placeholder: "Margin note for this page",
								onChange: (event) => setDraft(event.target.value),
								maxLength: 2e3
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "submit",
								className: "desk-btn is-on",
								children: "Save note"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-muted text-sm",
							children: "Pen, pencil, brush, and marker stay on the page. Ink locks the leaf so the stroke does not scroll it. The download keeps each mark beside the passage it sits on."
						})
					]
				})
			]
		})]
	});
}
var STOP = new Set(`a an the of to and in that it is was for as with on be by this from at or are were which but not you your we they their his her she he i me my our who whom what when where why how into about over after before than then them these those its it's if so no yes do did does done have has had will would can could should may might must very just also only own same such other into onto per via`.split(/\s+/));
function tokenize(input) {
	return input.toLowerCase().replace(/[’']/g, "").match(/[a-z0-9]+/g)?.filter((token) => token.length > 1 && !STOP.has(token)) ?? [];
}
function sentencesOf(page) {
	return (page.match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g) ?? [page]).map((part) => part.replace(/\s+/g, " ").trim()).filter((part) => part.length > 40);
}
function answerBook(question, pages, title) {
	const qTokens = tokenize(question);
	if (!qTokens.length || !pages.length) return {
		found: false,
		lead: "Ask about a person, a place, or a line in this book. Quill only reads the pages on the desk.",
		passages: []
	};
	const docs = pages.map((page) => tokenize(page));
	const n = docs.length;
	const df = /* @__PURE__ */ new Map();
	for (const doc of docs) {
		const seen = new Set(doc);
		for (const token of seen) df.set(token, (df.get(token) ?? 0) + 1);
	}
	const avg = docs.reduce((sum, doc) => sum + doc.length, 0) / n || 1;
	const k1 = 1.4;
	const b = .65;
	const idf = (token) => {
		const d = df.get(token) ?? 0;
		return Math.log(1 + (n - d + .5) / (d + .5));
	};
	const ranked = docs.map((doc) => {
		const tf = /* @__PURE__ */ new Map();
		for (const token of doc) tf.set(token, (tf.get(token) ?? 0) + 1);
		let score = 0;
		for (const token of qTokens) {
			const freq = tf.get(token) ?? 0;
			if (!freq) continue;
			const denom = freq + k1 * (.35 + b * (doc.length / avg));
			score += idf(token) * (freq * 2.4 / denom);
		}
		return score;
	}).map((score, index) => ({
		score,
		index
	})).sort((a, b2) => b2.score - a.score).slice(0, 6).filter((item) => item.score > 0);
	const hits = [];
	for (const item of ranked) for (const sentence of sentencesOf(pages[item.index] ?? "")) {
		const tokens = tokenize(sentence);
		if (!tokens.length) continue;
		let score = 0;
		let overlap = 0;
		const positions = [];
		qTokens.forEach((token) => {
			const at = tokens.indexOf(token);
			if (at >= 0) {
				overlap += 1;
				positions.push(at);
				score += idf(token) + .15;
			}
		});
		if (!overlap) continue;
		if (overlap === qTokens.length && positions.length > 1) {
			const span = Math.max(...positions) - Math.min(...positions);
			score += 2.2 + Math.max(0, 2.4 - span / 8);
		}
		const phrase = qTokens.join(" ");
		if (sentence.toLowerCase().includes(phrase) && qTokens.length > 1) score += 1.4;
		score += Math.min(item.score, 4) * .05;
		if (sentence.length > 420) score *= .85;
		hits.push({
			page: item.index + 1,
			text: sentence,
			score
		});
	}
	hits.sort((a, b2) => b2.score - a.score);
	const picked = [];
	const seenPages = /* @__PURE__ */ new Set();
	for (const hit of hits) {
		if (picked.some((item) => item.text === hit.text)) continue;
		if (picked.length && seenPages.has(hit.page) && picked.length < 2) continue;
		picked.push(hit);
		seenPages.add(hit.page);
		if (picked.length === 3) break;
	}
	const best = picked[0];
	if (!best || best.score < 1.05) {
		const near = hits[0];
		return {
			found: false,
			lead: near ? `I can't find that in ${title}. The nearest line is on page ${near.page}, and it does not really answer it.` : `I can't find that in ${title}.`,
			passages: near ? [{
				page: near.page,
				text: near.text
			}] : []
		};
	}
	return {
		found: true,
		lead: `In ${title}, page ${best.page}: “${best.text}”`,
		passages: picked.map((hit) => ({
			page: hit.page,
			text: hit.text
		}))
	};
}
function AskPanel({ bookId, title, pagesReady, pages, onGoto }) {
	const [q, setQ] = (0, import_react.useState)("");
	const addQa = useDesk((s) => s.addQa);
	const turns = useDesk((s) => s.notes[String(bookId)]?.qa ?? []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "ask panel",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "eyebrow",
				children: "Quill"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "mt-1 text-2xl",
				children: "Ask this book"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-muted mt-2 text-sm",
				children: [
					"Quill stays on this device. It answers only with lines from ",
					title,
					". Nothing is sent out, and it will not guess past the page."
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "mt-3 flex flex-col gap-2",
				onSubmit: (event) => {
					event.preventDefault();
					const question = q.trim();
					if (!question || !pagesReady) return;
					const answer = answerBook(question, pages, title);
					addQa(bookId, {
						q: question,
						lead: answer.lead,
						found: answer.found,
						passages: answer.passages,
						at: Date.now()
					});
					setQ("");
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					className: "desk-field",
					value: q,
					placeholder: pagesReady ? "Who walks to Netherfield?" : "Wait until the pages are on the desk",
					disabled: !pagesReady,
					onChange: (event) => setQ(event.target.value),
					"aria-label": "Question for this book"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "submit",
					className: "desk-btn is-on",
					disabled: !pagesReady || !q.trim(),
					children: "Read for an answer"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 flex flex-col gap-3",
				children: [...turns].reverse().map((turn) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "flex flex-col gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
							className: "text-lg",
							children: turn.q
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm",
							children: turn.lead
						}),
						turn.passages.map((passage) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("blockquote", {
							className: "passage text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
								"Page ",
								passage.page,
								". ",
								passage.text
							] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "desk-btn",
								onClick: () => onGoto(passage.page),
								children: ["Turn to page ", passage.page]
							})]
						}, `${turn.at}-${passage.page}`))
					]
				}, turn.at))
			})
		]
	});
}
var SKINS = [
	{
		id: "amber",
		label: "Amber"
	},
	{
		id: "classic",
		label: "Classic"
	},
	{
		id: "paper",
		label: "Paper"
	},
	{
		id: "nocturne",
		label: "Nocturne"
	},
	{
		id: "phosphor",
		label: "Phosphor"
	}
];
var LCDS = [
	{
		id: "amber",
		label: "Amber"
	},
	{
		id: "green",
		label: "Green"
	},
	{
		id: "ice",
		label: "Ice"
	},
	{
		id: "paper",
		label: "Paper"
	}
];
var BANDS = [
	{
		label: "60",
		type: "lowshelf",
		freq: 60
	},
	{
		label: "250",
		type: "peaking",
		freq: 250
	},
	{
		label: "1k",
		type: "peaking",
		freq: 1e3
	},
	{
		label: "4k",
		type: "peaking",
		freq: 4e3
	},
	{
		label: "12k",
		type: "highshelf",
		freq: 12e3
	}
];
function clock(seconds) {
	if (!Number.isFinite(seconds)) return "00:00";
	const whole = Math.max(0, Math.floor(seconds));
	return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}
function Winamp({ onAir, motion }) {
	const skin = useDesk((s) => s.skin);
	const lcd = useDesk((s) => s.lcd);
	const showPlaylist = useDesk((s) => s.showPlaylist);
	const showEq = useDesk((s) => s.showEq);
	const volume = useDesk((s) => s.volume);
	const eq = useDesk((s) => s.eq);
	const setSkin = useDesk((s) => s.setSkin);
	const setLcd = useDesk((s) => s.setLcd);
	const setShowPlaylist = useDesk((s) => s.setShowPlaylist);
	const setShowEq = useDesk((s) => s.setShowEq);
	const setVolume = useDesk((s) => s.setVolume);
	const setEqBand = useDesk((s) => s.setEqBand);
	const [tracks, setTracks] = (0, import_react.useState)([]);
	const [index, setIndex] = (0, import_react.useState)(0);
	const [playing, setPlaying] = (0, import_react.useState)(false);
	const [time, setTime] = (0, import_react.useState)(0);
	const [duration, setDuration] = (0, import_react.useState)(0);
	const [shuffle, setShuffle] = (0, import_react.useState)(false);
	const [repeat, setRepeat] = (0, import_react.useState)("off");
	const [balance, setBalance] = (0, import_react.useState)(0);
	const [dressing, setDressing] = (0, import_react.useState)(false);
	const audioRef = (0, import_react.useRef)(null);
	const gainRef = (0, import_react.useRef)(null);
	const pannerRef = (0, import_react.useRef)(null);
	const filtersRef = (0, import_react.useRef)([]);
	const analyserRef = (0, import_react.useRef)(null);
	const barsRef = (0, import_react.useRef)(null);
	const ctxRef = (0, import_react.useRef)(null);
	const tracksRef = (0, import_react.useRef)(tracks);
	const indexRef = (0, import_react.useRef)(index);
	tracksRef.current = tracks;
	indexRef.current = index;
	(0, import_react.useEffect)(() => {
		const audio = new Audio();
		audio.preload = "auto";
		const ctx = new (window.AudioContext || window.webkitAudioContext)();
		const source = ctx.createMediaElementSource(audio);
		const filters = BANDS.map((band) => {
			const filter = ctx.createBiquadFilter();
			filter.type = band.type;
			filter.frequency.value = band.freq;
			filter.Q.value = .9;
			return filter;
		});
		const gain = ctx.createGain();
		const panner = ctx.createStereoPanner();
		const analyser = ctx.createAnalyser();
		analyser.fftSize = 64;
		let node = source;
		for (const filter of filters) {
			node.connect(filter);
			node = filter;
		}
		node.connect(gain);
		gain.connect(panner);
		panner.connect(analyser);
		analyser.connect(ctx.destination);
		audioRef.current = audio;
		gainRef.current = gain;
		pannerRef.current = panner;
		filtersRef.current = filters;
		analyserRef.current = analyser;
		ctxRef.current = ctx;
		const onTime = () => setTime(audio.currentTime);
		const onMeta = () => setDuration(audio.duration || 0);
		audio.addEventListener("timeupdate", onTime);
		audio.addEventListener("loadedmetadata", onMeta);
		audioRef.current = audio;
		gainRef.current = gain;
		pannerRef.current = panner;
		filtersRef.current = filters;
		analyserRef.current = analyser;
		ctxRef.current = ctx;
		return () => {
			audio.pause();
			audio.removeEventListener("timeupdate", onTime);
			audio.removeEventListener("loadedmetadata", onMeta);
			ctx.close();
		};
	}, []);
	(0, import_react.useEffect)(() => {
		const audio = audioRef.current;
		if (!audio) return;
		const onEnd = () => {
			const list = tracksRef.current;
			const at = indexRef.current;
			if (!list.length) return;
			if (repeat === "one") {
				audio.currentTime = 0;
				audio.play();
				return;
			}
			let next = shuffle && list.length > 1 ? Math.floor(Math.random() * list.length) : at + 1;
			if (shuffle && next === at) next = (next + 1) % list.length;
			if (next >= list.length) {
				if (repeat === "all") next = 0;
				else {
					setPlaying(false);
					return;
				}
			}
			setIndex(next);
			audio.src = list[next].url;
			audio.play();
		};
		audio.onended = onEnd;
	}, [repeat, shuffle]);
	(0, import_react.useEffect)(() => {
		if (gainRef.current) gainRef.current.gain.value = volume * (onAir ? .28 : 1);
	}, [volume, onAir]);
	(0, import_react.useEffect)(() => {
		if (pannerRef.current) pannerRef.current.pan.value = balance;
	}, [balance]);
	(0, import_react.useEffect)(() => {
		filtersRef.current.forEach((filter, i) => {
			filter.gain.value = eq[i] ?? 0;
		});
	}, [eq]);
	(0, import_react.useEffect)(() => {
		const wrap = barsRef.current;
		const analyser = analyserRef.current;
		if (!wrap || !analyser) return;
		const data = new Uint8Array(analyser.frequencyBinCount);
		let frame = 0;
		const bars = wrap.children;
		const draw = () => {
			analyser.getByteFrequencyData(data);
			const step = Math.max(1, Math.floor(data.length / bars.length));
			for (let i = 0; i < bars.length; i++) {
				const value = motion && playing ? (data[i * step] ?? 0) / 255 : .08;
				bars[i].style.height = `${Math.max(8, value * 100)}%`;
			}
			if (motion && playing) frame = requestAnimationFrame(draw);
		};
		draw();
		return () => cancelAnimationFrame(frame);
	}, [
		motion,
		playing,
		skin,
		lcd
	]);
	function loadFiles(list) {
		if (!list?.length) return;
		const next = [...tracks];
		for (const file of list) {
			if (!file.type.startsWith("audio/")) continue;
			next.push({
				id: `${file.name}-${file.size}-${next.length}`,
				name: file.name.replace(/\.[^.]+$/, ""),
				url: URL.createObjectURL(file)
			});
		}
		setTracks(next);
		if (!audioRef.current?.src && next[0]) {
			audioRef.current.src = next[0].url;
			setIndex(0);
		}
	}
	async function toggle() {
		const audio = audioRef.current;
		const ctx = ctxRef.current;
		if (!audio || !tracks.length) return;
		await ctx?.resume();
		if (playing) {
			audio.pause();
			setPlaying(false);
			return;
		}
		if (!audio.src) audio.src = tracks[index]?.url ?? tracks[0].url;
		await audio.play();
		setPlaying(true);
	}
	function go(next) {
		const audio = audioRef.current;
		if (!audio || !tracks.length) return;
		const at = (next + tracks.length) % tracks.length;
		setIndex(at);
		audio.src = tracks[at].url;
		if (playing) audio.play();
	}
	const track = tracks[index];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "player",
		"data-skin": skin,
		"data-lcd": lcd,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-2 flex items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "eyebrow",
					style: { color: "var(--p-lcd-fg)" },
					children: "Headphones"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "transport",
					onClick: () => setDressing((value) => !value),
					"aria-expanded": dressing,
					children: "Skin"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "lcd",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "m-0 text-xs tracking-widest uppercase",
						children: track ? "Plugged in" : "Jack empty"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "lcd-title",
						children: track ? track.name : "Plug in your own music"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "m-0 text-sm",
						children: [
							clock(time),
							" / ",
							clock(duration)
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						ref: barsRef,
						className: "viz",
						"aria-hidden": true,
						children: Array.from({ length: 24 }, (_, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {}, index))
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				className: "range mt-2",
				type: "range",
				min: 0,
				max: duration || 0,
				step: .1,
				value: Math.min(time, duration || 0),
				"aria-label": "Seek",
				onChange: (event) => {
					const audio = audioRef.current;
					if (!audio) return;
					audio.currentTime = Number(event.target.value);
					setTime(audio.currentTime);
				}
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex items-center justify-between gap-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: `transport${shuffle ? " is-on" : ""}`,
						"aria-pressed": shuffle,
						"aria-label": "Shuffle",
						onClick: () => setShuffle((value) => !value),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shuffle, { className: "size-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "transport",
						"aria-label": "Previous",
						onClick: () => go(index - 1),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SkipBack, { className: "size-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "transport",
						"aria-label": playing ? "Pause" : "Play",
						onClick: () => void toggle(),
						children: playing ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "transport",
						"aria-label": "Next",
						onClick: () => go(index + 1),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SkipForward, { className: "size-4" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: `transport${repeat !== "off" ? " is-on" : ""}`,
						"aria-label": "Repeat",
						onClick: () => setRepeat((value) => value === "off" ? "all" : value === "all" ? "one" : "off"),
						children: repeat === "one" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Repeat1, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Repeat, { className: "size-4" })
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "mt-2 block text-xs",
				style: { color: "var(--p-muted)" },
				children: ["Volume", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					className: "range",
					type: "range",
					min: 0,
					max: 1,
					step: .01,
					value: volume,
					onChange: (event) => setVolume(Number(event.target.value))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "mt-1 block text-xs",
				style: { color: "var(--p-muted)" },
				children: ["Balance", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					className: "range",
					type: "range",
					min: -1,
					max: 1,
					step: .01,
					value: balance,
					onChange: (event) => setBalance(Number(event.target.value))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "desk-btn mt-3 flex cursor-pointer items-center justify-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Headphones, {
						className: "size-4",
						"aria-hidden": true
					}),
					"Plug in records",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						className: "sr-only",
						type: "file",
						accept: "audio/*",
						multiple: true,
						onChange: (event) => loadFiles(event.target.files)
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-xs",
				style: { color: "var(--p-muted)" },
				children: "Your files stay in this browser. They are not uploaded. On air, the book ducks the music."
			}),
			showPlaylist && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "playlist mt-2",
				children: [tracks.map((item, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: i === index ? "is-on" : "",
					onClick: () => go(i),
					children: [
						i + 1,
						". ",
						item.name
					]
				}, item.id)), !tracks.length && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs",
					style: { color: "var(--p-muted)" },
					children: "No records yet."
				})]
			}),
			showEq && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "eq mt-3",
				children: BANDS.map((band, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "range",
					min: -12,
					max: 12,
					step: 1,
					value: eq[i] ?? 0,
					"aria-label": `${band.label} hertz`,
					onChange: (event) => setEqBand(i, Number(event.target.value))
				}), band.label] }, band.label))
			}),
			dressing && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex flex-col gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "row-scroll",
						children: SKINS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: `transport${skin === item.id ? " is-on" : ""}`,
							onClick: () => setSkin(item.id),
							children: item.label
						}, item.id))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "row-scroll",
						children: LCDS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: `transport${lcd === item.id ? " is-on" : ""}`,
							onClick: () => setLcd(item.id),
							children: [item.label, " lamp"]
						}, item.id))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "row-scroll",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: `transport${showPlaylist ? " is-on" : ""}`,
							onClick: () => setShowPlaylist(!showPlaylist),
							children: "Playlist"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							className: `transport${showEq ? " is-on" : ""}`,
							onClick: () => setShowEq(!showEq),
							children: "Equalizer"
						})]
					})
				]
			})
		]
	});
}
function Desk() {
	const [booted, setBooted] = (0, import_react.useState)(false);
	const [qInput, setQInput] = (0, import_react.useState)("");
	const [q, setQ] = (0, import_react.useState)("");
	const [order, setOrder] = (0, import_react.useState)("popular");
	const [genre, setGenre] = (0, import_react.useState)("");
	const [lang, setLang] = (0, import_react.useState)("");
	const [letter, setLetter] = (0, import_react.useState)("");
	const [page, setPage] = (0, import_react.useState)(1);
	const [card, setCard] = (0, import_react.useState)(null);
	const [leaf, setLeaf] = (0, import_react.useState)(0);
	const [textPages, setTextPages] = (0, import_react.useState)([]);
	const onPages = (0, import_react.useCallback)((next) => {
		setTextPages((prev) => {
			if (prev.length === next.length && prev.every((page, index) => page === next[index])) return prev;
			return next;
		});
	}, []);
	const [onAir, setOnAir] = (0, import_react.useState)(false);
	const [pane, setPane] = (0, import_react.useState)("tune");
	const [askOpen, setAskOpen] = (0, import_react.useState)(false);
	const [spinning, setSpinning] = (0, import_react.useState)(false);
	const [spinError, setSpinError] = (0, import_react.useState)(null);
	const motionOn = useDesk((s) => s.motion !== false);
	const setMotion = useDesk((s) => s.setMotion);
	const storageWarning = useDesk((s) => s.storageWarning);
	const stopAir = (0, import_react.useCallback)(() => setOnAir(false), []);
	(0, import_react.useEffect)(() => {
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		useDesk.getState().hydrate(!reduce);
		setBooted(true);
	}, []);
	(0, import_react.useEffect)(() => {
		const timer = window.setTimeout(() => {
			setQ(qInput);
			setPage(1);
		}, 280);
		return () => window.clearTimeout(timer);
	}, [qInput]);
	const shelfQuery = useQuery({
		queryKey: [
			"shelf",
			q,
			order,
			genre,
			lang,
			letter,
			page
		],
		enabled: booted,
		placeholderData: keepPreviousData,
		queryFn: () => searchShelf({ data: {
			q,
			order,
			genre,
			lang,
			letter,
			page
		} })
	});
	const textQuery = useQuery({
		queryKey: ["book-text", card?.id],
		enabled: booted && card != null,
		staleTime: Infinity,
		queryFn: () => fetchBookText({ data: { id: card.id } })
	});
	const edition = (0, import_react.useMemo)(() => textQuery.data?.ok ? composeBook(textQuery.data.text) : null, [textQuery.data]);
	const shelf = shelfQuery.data?.ok ? shelfQuery.data : null;
	const shelfError = shelfQuery.data && !shelfQuery.data.ok ? shelfQuery.data.error : shelfQuery.isError ? "The card catalog didn't answer." : null;
	function open(book) {
		setCard(book);
		setLeaf(0);
		setTextPages([]);
		setOnAir(false);
		setPane("read");
		setAskOpen(false);
		useDesk.getState().ensureBook(book.id, book.title, book.author);
	}
	async function spin() {
		setSpinning(true);
		setSpinError(null);
		const result = await spinDial({ data: {
			q,
			order,
			genre,
			lang,
			letter,
			page: 1
		} });
		setSpinning(false);
		if (result.ok) open(result.book);
		else setSpinError(result.error);
	}
	const status = !card ? "idle" : textQuery.data?.ok ? "ready" : textQuery.data && !textQuery.data.ok ? "error" : textQuery.isError ? "error" : "loading";
	const bookError = textQuery.data && !textQuery.data.ok ? textQuery.data.error : textQuery.isError ? "The pages didn't come up." : null;
	const freq = card ? frequency(card.id) : "91.1";
	const now = card ? card.title : "The whole Gutenberg shelf";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "desk",
		"data-motion": motionOn ? "on" : "off",
		"data-on-air": onAir ? "true" : "false",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "fascia",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "eyebrow",
						children: "Station K-GUT"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "wordmark",
						children: "Night Desk"
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "well",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "needle-wrap",
								"aria-hidden": true,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "needle" })
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "freq",
								children: freq
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "now-playing",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-muted text-xs tracking-widest uppercase",
									children: onAir ? "On air" : "Tuned"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "ticker",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "ticker-track",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: now }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: now })]
									})
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "row-scroll",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: `desk-btn${onAir ? " is-on" : ""}`,
								"aria-pressed": onAir,
								disabled: !card,
								onClick: () => setOnAir((value) => !value),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radio, {
									className: "mr-1 inline size-4",
									"aria-hidden": true
								}), onAir ? "On air" : "Read aloud"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: `desk-btn${askOpen || pane === "ask" ? " is-on" : ""}`,
								onClick: () => {
									setAskOpen(true);
									setPane("ask");
								},
								disabled: !card,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScrollText, {
									className: "mr-1 inline size-4",
									"aria-hidden": true
								}), "Ask"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								className: `desk-btn${motionOn ? " is-on" : ""}`,
								"aria-pressed": motionOn,
								onClick: () => setMotion(!motionOn),
								children: motionOn ? "Animation on" : "Animation off"
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "layout",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `${pane === "tune" ? "block" : "hidden"} show-wide`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shelf, {
							qInput,
							onQ: setQInput,
							order,
							onOrder: (next) => {
								setOrder(next);
								setPage(1);
								if (next !== "genre") setGenre("");
							},
							genre,
							onGenre: (next) => {
								setGenre(next);
								setPage(1);
								if (next) setOrder("genre");
							},
							lang,
							onLang: (next) => {
								setLang(next);
								setPage(1);
							},
							letter,
							onLetter: (next) => {
								setLetter(next);
								setPage(1);
							},
							page,
							onPage: setPage,
							books: shelf?.books ?? [],
							total: shelf?.total ?? 0,
							pageCount: shelf?.pageCount ?? 1,
							live: Boolean(shelf?.live),
							genres: shelf?.genres ?? [],
							loading: shelfQuery.isPending,
							error: shelfError,
							onRetry: () => void shelfQuery.refetch(),
							activeId: card?.id ?? null,
							onOpen: open,
							onSpin: () => void spin(),
							spinning
						}), spinError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "warn mt-2",
							children: spinError
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `${pane === "read" ? "block" : "hidden"} show-wide`,
						children: [card ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookStage, {
							card,
							blocks: edition?.blocks ?? [],
							words: edition?.words ?? 0,
							leaf,
							onLeaf: setLeaf,
							onPages,
							onAir,
							onStopAir: stopAir,
							motion: motionOn,
							status,
							error: bookError
						}, card.id) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "closed-book",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "page-inner title-leaf",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "page-kicker",
										children: "K-GUT"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "The desk is clear." }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "page-prose",
										children: "Spin the dial or pick a book. Title order, author order, and genre walk the whole Project Gutenberg text catalog. Borrowed is the live most-read list."
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										className: "desk-btn is-on mt-4",
										onClick: () => setPane("tune"),
										children: "Open the shelf"
									})
								]
							})
						}), storageWarning && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "warn mt-2",
							children: "This desk is full of ink. Download your notes before they stop saving on this browser."
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: `${pane === "ask" || pane === "music" ? "flex" : "hidden"} show-wide-flex flex-col gap-4`,
						children: [card && (pane === "ask" || askOpen) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: pane === "ask" ? "block" : "hidden show-wide",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AskPanel, {
								bookId: card.id,
								title: card.title,
								pagesReady: status === "ready",
								pages: textPages,
								onGoto: (next) => {
									setLeaf(next);
									setPane("read");
								}
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: pane === "music" ? "block" : "hidden show-wide",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Winamp, {
								onAir,
								motion: motionOn
							})
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
				className: "tabbar",
				"aria-label": "Desk",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: pane === "read" ? "is-on" : "",
						onClick: () => setPane("read"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, {
							className: "size-5",
							"aria-hidden": true
						}), "Read"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: pane === "tune" ? "is-on" : "",
						onClick: () => setPane("tune"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Library, {
							className: "size-5",
							"aria-hidden": true
						}), "Tune"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: pane === "ask" ? "is-on" : "",
						onClick: () => setPane("ask"),
						disabled: !card,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScrollText, {
							className: "size-5",
							"aria-hidden": true
						}), "Ask"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: pane === "music" ? "is-on" : "",
						onClick: () => setPane("music"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Headphones, {
							className: "size-5",
							"aria-hidden": true
						}), "Music"]
					})
				]
			})
		]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Desk, {});
}
//#endregion
export { Home as component };
