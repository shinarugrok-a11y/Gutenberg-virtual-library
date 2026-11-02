import { create } from "zustand";
import { INKS, type BookNotes, type MarginNote, type QaTurn, type Stroke, type Tool } from "@/lib/notes";

export type SkinId = "amber" | "classic" | "paper" | "nocturne" | "phosphor";
export type LcdId = "amber" | "green" | "ice" | "paper";
export type Atmosphere = "chalkboard" | "forest" | "vintage";

type Persisted = {
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

function blank(): Persisted {
  return {
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

function scheduleSave() {
  if (typeof window === "undefined") return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const state = useDesk.getState();
    const payload: Persisted = {
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
      localStorage.setItem(KEY, JSON.stringify(payload));
      if (useDesk.getState().storageWarning) useDesk.setState({ storageWarning: false });
    } catch {
      useDesk.setState({ storageWarning: true });
    }
  }, 350);
}

export const useDesk = create<State>((set, get) => ({
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
        [key]: { ...current, strokes: { ...current.strokes, [String(leaf)]: strokes } },
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
    const comment = { id: `${Date.now()}`, leaf, text: trimmed.slice(0, 2000), at: Date.now() };
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
      set({
        motion: typeof data.motion === "boolean" ? data.motion : motionDefault,
        skin: skins.includes(data.skin as SkinId) ? (data.skin as SkinId) : "amber",
        lcd: lcds.includes(data.lcd as LcdId) ? (data.lcd as LcdId) : "amber",
        showPlaylist: data.showPlaylist !== false,
        showEq: Boolean(data.showEq),
        volume: typeof data.volume === "number" ? Math.min(1, Math.max(0, data.volume)) : 0.8,
        eq: Array.isArray(data.eq) && data.eq.length === 5 ? data.eq.map((n) => Number(n) || 0) : [0, 0, 0, 0, 0],
        tool: tools.includes(data.tool as Tool) ? (data.tool as Tool) : "pen",
        inkId: INKS.some((ink) => ink.id === data.inkId) ? (data.inkId as string) : INKS[0]!.id,
        brush: typeof data.brush === "number" ? data.brush : 2.5,
        atmosphere: rooms.includes(data.atmosphere as Atmosphere) ? (data.atmosphere as Atmosphere) : "chalkboard",
        notes: data.notes && typeof data.notes === "object" ? data.notes : {},
      });
    } catch {
      set({ motion: motionDefault });
    }
  },
}));
