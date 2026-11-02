import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
import { a as matchGenre, o as primaryShelf, r as authorLabel, t as GENRES } from "./shelf-Dj6RgV5J.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/catalog.functions-UisF33nt.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var UA = "NightDesk/1.0 (public-domain reading radio; +https://www.gutenberg.org)";
var CSV_URL = "https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv";
var indexPromise = null;
var textCache = /* @__PURE__ */ new Map();
var TEXT_CACHE_MAX = 5;
var ORDERS = [
	"title",
	"author",
	"newest",
	"popular",
	"genre"
];
function parseCsv(text) {
	const rows = [];
	let row = [];
	let cur = "";
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c === "\"") {
				if (text[i + 1] === "\"") {
					cur += "\"";
					i++;
				} else quoted = false;
			} else cur += c;
		} else if (c === "\"") quoted = true;
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
function sortKey(value) {
	const folded = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
	const match = folded.match(/[A-Za-z0-9]/);
	if (!match || match.index == null) return "";
	return folded.slice(match.index).toLowerCase();
}
function matchLetter(value, letter) {
	const key = sortKey(value);
	if (letter === "#") return !/^[a-z]/.test(key);
	return key.startsWith(letter.toLowerCase());
}
async function loadIndex() {
	const res = await fetch(CSV_URL, {
		headers: { "User-Agent": UA },
		signal: AbortSignal.timeout(4e4)
	});
	if (!res.ok) throw new Error("The card catalog didn't answer.");
	const rows = parseCsv(await res.text());
	const header = rows[0] ?? [];
	const col = (name) => {
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
	const books = [];
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
			shelves: row[iShelves] ?? ""
		});
	}
	const byId = /* @__PURE__ */ new Map();
	books.forEach((book, index) => byId.set(book.id, index));
	const compareTitle = (a, b) => sortKey(books[a].title).localeCompare(sortKey(books[b].title)) || books[a].id - books[b].id;
	return {
		books,
		byId,
		titleOrder: books.map((_, index) => index).sort(compareTitle),
		authorOrder: books.map((_, index) => index).sort((a, b) => {
			return sortKey(books[a].author || "zzzz").localeCompare(sortKey(books[b].author || "zzzz")) || compareTitle(a, b);
		}),
		newestOrder: books.map((_, index) => index).sort((a, b) => {
			return books[b].year - books[a].year || compareTitle(a, b);
		}),
		genres: GENRES.map((genre) => ({
			id: genre.id,
			label: genre.label,
			count: books.reduce((sum, book) => sum + (matchGenre(book.shelves, genre.id) ? 1 : 0), 0)
		})).sort((a, b) => a.label.localeCompare(b.label))
	};
}
function getIndex() {
	if (!indexPromise) indexPromise = loadIndex().catch((error) => {
		indexPromise = null;
		throw error;
	});
	return indexPromise;
}
function toCard(book) {
	return {
		id: book.id,
		title: book.title,
		author: authorLabel(book.author),
		lang: book.lang,
		year: book.year,
		shelf: primaryShelf(book.shelves)
	};
}
function clampPage(value) {
	const page = Number(value);
	if (!Number.isFinite(page) || page < 1) return 1;
	return Math.min(1e4, Math.floor(page));
}
function readQuery(input) {
	const data = input ?? {};
	const order = ORDERS.includes(data.order) ? data.order : "popular";
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
function filtered(index, query) {
	const order = query.order === "author" ? index.authorOrder : query.order === "newest" ? index.newestOrder : index.titleOrder;
	const q = query.q.toLowerCase();
	const idQuery = /^#?\d+$/.test(q) ? Number(q.replace("#", "")) : 0;
	const out = [];
	for (const indexOf of order) {
		const book = index.books[indexOf];
		if (idQuery && book.id !== idQuery) continue;
		if (query.lang && book.lang !== query.lang) continue;
		if (query.genre && !matchGenre(book.shelves, query.genre)) continue;
		const letterSource = query.order === "author" ? book.author : book.title;
		if (query.letter && !matchLetter(letterSource, query.letter)) continue;
		if (q && !idQuery) {
			if (!`${book.title} ${book.author} ${book.shelves}`.toLowerCase().includes(q)) continue;
		}
		out.push(indexOf);
	}
	return out;
}
function pageOf(index, ids, page) {
	const pageCount = Math.max(1, Math.ceil(ids.length / 24));
	const safe = Math.min(page, pageCount);
	const start = (safe - 1) * 24;
	const books = ids.slice(start, start + 24).map((i) => toCard(index.books[i]));
	return {
		ok: true,
		total: ids.length,
		page: safe,
		pageCount,
		books,
		genres: index.genres,
		live: false
	};
}
async function fetchPopular(page) {
	const url = `https://www.gutenberg.org/ebooks/search.opds/?query=&sort_order=downloads&start_index=${(page - 1) * 25 + 1}`;
	const res = await fetch(url, {
		headers: { "User-Agent": UA },
		signal: AbortSignal.timeout(25e3)
	});
	if (!res.ok) throw new Error("The borrowed list is quiet right now.");
	const xml = await res.text();
	const ids = [];
	for (const entry of xml.split("<entry>").slice(1)) {
		const idMatch = entry.match(/\/ebooks\/(\d+)/);
		if (!idMatch) continue;
		const title = entry.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
		if (!title || title === "Authors" || title === "Bookshelves" || title === "Subjects") continue;
		ids.push(Number(idMatch[1]));
	}
	return {
		ids,
		hasNext: xml.includes("rel=\"next\"")
	};
}
var searchShelf_createServerFn_handler = createServerRpc({
	id: "1929ea4be7d0bb0b3b5604e4a1ab569c042aa9c178090c8eb1fd26512ce448e4",
	name: "searchShelf",
	filename: "src/lib/catalog.functions.ts"
}, (opts) => searchShelf.__executeServer(opts));
var searchShelf = createServerFn({ method: "GET" }).validator(readQuery).handler(searchShelf_createServerFn_handler, async ({ data }) => {
	try {
		const index = await getIndex();
		if (data.order === "popular" && !data.q && !data.genre && !data.letter) {
			const live = await fetchPopular(data.page);
			const books = [];
			for (const id of live.ids) {
				const at = index.byId.get(id);
				if (at == null) continue;
				const book = index.books[at];
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
				live: true
			};
		}
		return pageOf(index, filtered(index, data.order === "genre" ? {
			...data,
			order: "title"
		} : data), data.page);
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "The card catalog didn't answer."
		};
	}
});
var spinDial_createServerFn_handler = createServerRpc({
	id: "8deb5494821677ac6a086d95bc23e8bf3d4c7b1665478576933d222e4450e3d7",
	name: "spinDial",
	filename: "src/lib/catalog.functions.ts"
}, (opts) => spinDial.__executeServer(opts));
var spinDial = createServerFn({ method: "GET" }).validator(readQuery).handler(spinDial_createServerFn_handler, async ({ data }) => {
	try {
		const index = await getIndex();
		const ids = filtered(index, {
			...data,
			order: data.order === "popular" || data.order === "genre" ? "title" : data.order
		});
		if (!ids.length) return {
			ok: false,
			error: "Nothing on that frequency."
		};
		const book = index.books[ids[Math.floor(Math.random() * ids.length)]];
		return {
			ok: true,
			book: toCard(book)
		};
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "The dial didn't catch."
		};
	}
});
function rememberText(id, text) {
	textCache.set(id, text);
	if (textCache.size <= TEXT_CACHE_MAX) return;
	const oldest = textCache.keys().next().value;
	if (oldest != null) textCache.delete(oldest);
}
async function pullText(url) {
	const res = await fetch(url, {
		headers: { "User-Agent": UA },
		redirect: "follow",
		signal: AbortSignal.timeout(4e4)
	});
	if (!res.ok) return null;
	const text = await res.text();
	if (!text || text.length < 200) return null;
	const head = text.slice(0, 200).toLowerCase();
	if (head.includes("<!doctype html") || head.includes("<html")) return null;
	return text.length > 5e6 ? text.slice(0, 5e6) : text;
}
var fetchBookText_createServerFn_handler = createServerRpc({
	id: "a6174307a4b52f20738c1cd96513c2520c1507c2e9a8b00bb8a69bc9759797c6",
	name: "fetchBookText",
	filename: "src/lib/catalog.functions.ts"
}, (opts) => fetchBookText.__executeServer(opts));
var fetchBookText = createServerFn({ method: "GET" }).validator((input) => {
	const id = Number(input?.id);
	if (!Number.isInteger(id) || id <= 0 || id > 1e6) throw new Error("That isn't a Gutenberg book.");
	return { id };
}).handler(fetchBookText_createServerFn_handler, async ({ data }) => {
	try {
		const cached = textCache.get(data.id);
		if (cached) return {
			ok: true,
			id: data.id,
			text: cached
		};
		const urls = [
			`https://www.gutenberg.org/cache/epub/${data.id}/pg${data.id}.txt`,
			`https://www.gutenberg.org/ebooks/${data.id}.txt.utf-8`,
			`https://www.gutenberg.org/files/${data.id}/${data.id}-0.txt`
		];
		for (const url of urls) {
			const text = await pullText(url);
			if (text) {
				rememberText(data.id, text);
				return {
					ok: true,
					id: data.id,
					text
				};
			}
		}
		return {
			ok: false,
			error: "This number has no plain text on the shelf. Try another edition."
		};
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "The pages didn't come up."
		};
	}
});
//#endregion
export { fetchBookText_createServerFn_handler, searchShelf_createServerFn_handler, spinDial_createServerFn_handler };
