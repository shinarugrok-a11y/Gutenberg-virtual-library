import { compactNotes, uniqueStrokes } from "@/lib/ink-persistence";
import { create } from "zustand";
import { INKS, type BookNotes, type MarginNote, type QaTurn, type Stroke, type Tool } from "@/lib/notes";

import type { Card } from "@/lib/shelf";

export type ReadingPosition = { anchor: number | null; leaf: number; updatedAt: number };

export type SkinId = "amber" | "classic" | "paper" | "nocturne" | "phosphor";
export type LcdId = "amber" | "green" | "ice" | "paper";
export type Atmosphere = "chalkboard" | "forest" | "vintage";

type Persisted = {
  lastBook: Card | null;
  positions: Record<string, ReadingPosition>;
  motion: boolean | null;
  skin: SkinId;
  lcd: LcdId;
  showPlaylist: boolean;
  showEq: boolean;
  volume: number;
  eq: number[];
  tool: Tool;
  inkId: string;
  brush: number;
  atmosphere: Atmosphere;
  notes: Record<string, BookNotes>;
};

const KEY = "nightdesk.v1";

type State = Persisted & {
  storageWarning: boolean;
  rememberBook: (book: Card) => void;
  savePosition: (id: number, anchor: number | null, leaf: number) => void;
  setMotion: (motion: boolean) => void;
  setSkin: (skin: SkinId) => void;
  setLcd: (lcd: LcdId) => void;
  setShowPlaylist: (show: boolean) => void;
  setShowEq: (show: boolean) => void;
  setVolume: (volume: number) => void;
  setEqBand: (index: number, value: number) => void;
  setTool: (tool: Tool) => void;
  setInkId: (inkId: string) => void;
  setBrush: (brush: number) => void;
  setAtmosphere: (atmosphere: Atmosphere) => void;
  ensureBook: (id: number, title: string, author: string) => void;
  setStrokes: (id: number, leaf: number, strokes: Stroke[]) => void;
  rebindBook: (id: number, strokes: Record<string, Stroke[]>, comments: MarginNote[]) => void;
  addComment: (id: number, leaf: number, text: string) => void;
  addQa: (id: number, turn: QaTurn) => void;
  hydrate: (motionDefault: boolean) => void;
};

function cleanStrokes(value: unknown): Stroke[] {
  if (!Array.isArray(value)) return [];
  const tools = ["pen", "pencil", "brush", "marker"];
  return value.filter(
    (stroke): stroke is Stroke =>
      Boolean(stroke) &&
      typeof stroke.id === "string" &&
      tools.includes(stroke.tool) &&
      typeof stroke.color === "string" &&
      Number.isFinite(stroke.size) &&
      Array.isArray(stroke.points) &&
      stroke.points.every((point: unknown) => {
        const p = point as { x?: unknown; y?: unknown } | null;
        return Boolean(p) && Number.isFinite(p!.x) && Number.isFinite(p!.y);
      }),
  );
}

/** Saved notes come from storage that other tabs, extensions or old versions may have written. */
function cleanNotes(value: unknown): Record<string, BookNotes> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, BookNotes> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const book = raw as Partial<BookNotes> | null;
    const id = Number(key);
    if (!book || typeof book !== "object" || !Number.isInteger(id) || id <= 0) continue;
    const strokes: Record<string, Stroke[]> = {};
    if (book.strokes && typeof book.strokes === "object") {
      for (const [leaf, list] of Object.entries(book.strokes)) {
        if (!/^\d+$/.test(leaf)) continue;
        const clean = cleanStrokes(list);
        if (clean.length) strokes[leaf] = clean;
      }
    }
    const comments: MarginNote[] = Array.isArray(book.comments)
      ? book.comments
          .filter((c) => c && typeof c.text === "string" && Number.isInteger(c.leaf) && c.leaf >= 0)
          .map((c, i) => ({ id: typeof c.id === "string" ? c.id : `restored-${i}`, leaf: c.leaf, text: c.text.slice(0, 2000), at: Number(c.at) || 0 }))
      : [];
    const qa: QaTurn[] = Array.isArray(book.qa)
      ? book.qa.filter((t) => t && typeof t.q === "string" && typeof t.lead === "string" && Array.isArray(t.passages)).slice(-40)
      : [];
    out[key] = {
      id,
      title: typeof book.title === "string" ? book.title : "",
      author: typeof book.author === "string" ? book.author : "",
      strokes,
      comments,
      qa,
    };
  }
  return out;
}

function blank(): Persisted {
  return {
    lastBook: null,
    positions: {},
    motion: null,
    skin: "amber",
    lcd: "amber",
    showPlaylist: true,
    showEq: false,
    volume: 0.8,
    eq: [0, 0, 0, 0, 0],
    tool: "pen",
    inkId: INKS[0]!.id,
    brush: 2.5,
    atmosphere: "chalkboard",
    notes: {},
  };
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

let dirty = false;
let lifecycleInstalled = false;

function installSaveLifecycle() {
  if (lifecycleInstalled || typeof window === "undefined") return;
  lifecycleInstalled = true;
  window.addEventListener("pagehide", flushDeskSave);
  window.addEventListener("beforeunload", flushDeskSave);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushDeskSave();
  });
}

/** Synchronous: safe to call from pointerup and page lifecycle events. */
export function flushDeskSave() {
  if (typeof window === "undefined" || !dirty) return;
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = null;
  const state = useDesk.getState();
  const payload: Persisted = {
    lastBook: state.lastBook,
    positions: state.positions,
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
    atmosphere: state.atmosphere,
    notes: state.notes,
  };
  try {
    try {
      localStorage.setItem(KEY, JSON.stringify(payload));
    } catch (error) {
      if (!(error instanceof Error) || !["QuotaExceededError", "NS_ERROR_DOM_QUOTA_REACHED"].includes(error.name)) throw error;
      const notes = compactNotes(payload.notes);
      localStorage.setItem(KEY, JSON.stringify({ ...payload, notes }));
      // Keep future saves compact, but only after the retry actually succeeds.
      useDesk.setState({ notes });
    }
    dirty = false;
    if (useDesk.getState().storageWarning) useDesk.setState({ storageWarning: false });
  } catch {
    // Retain the unsaved state for export and another lifecycle/save attempt.
    useDesk.setState({ storageWarning: true });
  }
}

// Preserve the resume flow’s synchronous flush API.
export const flushDesk = flushDeskSave;

function scheduleSave() {
  if (typeof window === "undefined") return;
  installSaveLifecycle();
  dirty = true;
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushDeskSave, 350);
}

export const useDesk = create<State>((set, get) => ({
  ...blank(),
  storageWarning: false,
  rememberBook: (lastBook) => {
    set({ lastBook });
    scheduleSave();
  },
  savePosition: (id, anchor, leaf) => {
    set({ positions: { ...get().positions, [String(id)]: { anchor, leaf, updatedAt: Date.now() } } });
    scheduleSave();
  },
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
  setAtmosphere: (atmosphere) => {
    set({ atmosphere });
    scheduleSave();
  },
  ensureBook: (id, title, author) => {
    const key = String(id);
    if (get().notes[key]) return;
    set({
      notes: {
        ...get().notes,
        [key]: { id, title, author, strokes: {}, comments: [], qa: [] },
      },
    });
  },
  setStrokes: (id, leaf, strokes) => {
    const key = String(id);
    const current = get().notes[key] ?? { id, title: "", author: "", strokes: {}, comments: [], qa: [] };
    set({
      notes: {
        ...get().notes,
        [key]: { ...current, strokes: { ...current.strokes, [String(leaf)]: uniqueStrokes(strokes) } },
      },
    });
    scheduleSave();
  },
  rebindBook: (id, strokes, comments) => {
    const key = String(id);
    const current = get().notes[key];
    if (!current) return;
    set({
      notes: {
        ...get().notes,
        [key]: { ...current, strokes, comments },
      },
    });
    scheduleSave();
  },
  addComment: (id, leaf, text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const key = String(id);
    const current = get().notes[key] ?? { id, title: "", author: "", strokes: {}, comments: [], qa: [] };
    const comment = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, leaf, text: trimmed.slice(0, 2000), at: Date.now() };
    set({
      notes: {
        ...get().notes,
        [key]: { ...current, comments: [...current.comments, comment] },
      },
    });
    scheduleSave();
  },
  addQa: (id, turn) => {
    const key = String(id);
    const current = get().notes[key] ?? { id, title: "", author: "", strokes: {}, comments: [], qa: [] };
    set({
      notes: {
        ...get().notes,
        [key]: { ...current, qa: [...current.qa, turn].slice(-40) },
      },
    });
    scheduleSave();
  },
  hydrate: (motionDefault) => {
    if (typeof window === "undefined") return;
    installSaveLifecycle();
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        set({ motion: motionDefault });
        return;
      }
      const data = JSON.parse(raw) as Partial<Persisted>;
      const skins: SkinId[] = ["amber", "classic", "paper", "nocturne", "phosphor"];
      const lcds: LcdId[] = ["amber", "green", "ice", "paper"];
      const tools: Tool[] = ["pen", "pencil", "brush", "marker", "eraser"];
      const rooms: Atmosphere[] = ["chalkboard", "forest", "vintage"];
      const positions: Record<string, ReadingPosition> = {};
      for (const [id, position] of Object.entries(data.positions ?? {})) {
        if (!position || !Number.isInteger(position.leaf) || position.leaf < 0) continue;
        positions[id] = {
          anchor: Number.isInteger(position.anchor) && position.anchor! >= 0 ? position.anchor : null,
          leaf: position.leaf,
          updatedAt: Number.isFinite(position.updatedAt) ? position.updatedAt : 0,
        };
      }
      const book = data.lastBook;
      const lastBook = book && Number.isInteger(book.id) && book.id > 0 && typeof book.title === "string" && typeof book.author === "string"
        ? { id: book.id, title: book.title, author: book.author, lang: typeof book.lang === "string" ? book.lang : "en", year: Number(book.year) || 0, shelf: typeof book.shelf === "string" ? book.shelf : "" }
        : null;
      set({
        lastBook,
        positions,
        motion: typeof data.motion === "boolean" ? data.motion : motionDefault,
        skin: skins.includes(data.skin as SkinId) ? (data.skin as SkinId) : "amber",
        lcd: lcds.includes(data.lcd as LcdId) ? (data.lcd as LcdId) : "amber",
        showPlaylist: data.showPlaylist !== false,
        showEq: Boolean(data.showEq),
        volume: typeof data.volume === "number" ? Math.min(1, Math.max(0, data.volume)) : 0.8,
        eq: Array.isArray(data.eq) && data.eq.length === 5 ? data.eq.map((n) => Math.max(-12, Math.min(12, Number(n) || 0))) : [0, 0, 0, 0, 0],
        tool: tools.includes(data.tool as Tool) ? (data.tool as Tool) : "pen",
        inkId: INKS.some((ink) => ink.id === data.inkId) ? (data.inkId as string) : INKS[0]!.id,
        brush: typeof data.brush === "number" && data.brush >= 1.2 && data.brush <= 7 ? data.brush : 2.5,
        atmosphere: rooms.includes(data.atmosphere as Atmosphere) ? (data.atmosphere as Atmosphere) : "chalkboard",
        notes: cleanNotes(data.notes),
      });
    } catch {
      set({ motion: motionDefault });
    }
  },
}));
