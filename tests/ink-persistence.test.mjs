import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Load the actual store without a browser bundler; resolve its two local aliases.
function moduleUrl(path, replacements = {}) {
  let source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  for (const [from, to] of Object.entries(replacements)) source = source.replaceAll(`"${from}"`, JSON.stringify(to));
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}

const helperUrl = moduleUrl("../src/lib/ink-persistence.ts");
const storeUrl = moduleUrl("../src/lib/desk-store.ts", {
  "@/lib/ink-persistence": helperUrl,
  "@/lib/notes": moduleUrl("../src/lib/notes.ts"),
  zustand: import.meta.resolve("zustand"),
});

test("desk persistence: lifecycle flush, dedupe, quota recovery and old data", async () => {
  const original = { window: globalThis.window, document: globalThis.document, localStorage: globalThis.localStorage };
  const win = new EventTarget();
  const doc = new EventTarget();
  doc.visibilityState = "visible";
  globalThis.window = win;
  globalThis.document = doc;
  let stored = null;
  let attempts = 0;
  let failCount = 0;
  let errorName = "QuotaExceededError";
  globalThis.localStorage = {
    getItem: () => stored,
    setItem: (key, value) => {
      assert.equal(key, "nightdesk.v1");
      attempts++;
      if (failCount-- > 0) throw new DOMException("Storage unavailable", errorName);
      stored = value;
    },
  };
  const { useDesk, flushDeskSave } = await import(storeUrl);
  const { simplifyPoints } = await import(helperUrl);
  try {
    // A v1 record still hydrates without migration or schema changes.
    stored = JSON.stringify({ skin: "paper", notes: {} });
    useDesk.getState().hydrate(false);
    assert.equal(useDesk.getState().skin, "paper");
    assert.equal(useDesk.getState().motion, false);
    for (const event of ["pagehide", "beforeunload", "visibilitychange"]) {
      const before = attempts;
      useDesk.getState().setVolume(Math.random());
      assert.equal(attempts, before, "high-frequency changes stay debounced");
      if (event === "visibilitychange") {
        doc.dispatchEvent(new Event(event));
        assert.equal(attempts, before, "visible page does not flush");
        doc.visibilityState = "hidden";
        doc.dispatchEvent(new Event(event));
      } else win.dispatchEvent(new Event(event));
      assert.equal(attempts, before + 1);
      assert.equal(JSON.parse(stored).volume, useDesk.getState().volume);
      flushDeskSave();
      assert.equal(attempts, before + 1, "clean flush is a no-op");
    }
    const points = Array.from({ length: 100 }, (_, i) => ({ x: i / 100, y: i / 100 }));
    const stroke = { id: "one", tool: "pen", color: "#000", size: 2, points };
    useDesk.getState().ensureBook(1, "Book", "Author");
    useDesk.getState().setStrokes(1, 0, [stroke, stroke]);
    assert.equal(useDesk.getState().notes[1].strokes[0].length, 1);
    const book = useDesk.getState().notes[1];
    useDesk.setState({ notes: { 1: { ...book, qa: Array.from({ length: 45 }, (_, at) => ({ at })), comments: [{ text: "Keep this" }] } } });
    failCount = 1;
    const before = attempts;
    flushDeskSave();
    assert.equal(attempts, before + 2, "quota failure retries once");
    const saved = JSON.parse(stored).notes[1];
    assert.equal(saved.strokes[0][0].points.length, 2);
    assert.equal(saved.qa.length, 40);
    assert.equal(saved.qa[0].at, 5);
    assert.deepEqual(saved.comments, [{ text: "Keep this" }]);
    assert.equal(useDesk.getState().storageWarning, false);
    assert.deepEqual(simplifyPoints([{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 0 }]).length, 3);
    const previous = stored;
    failCount = 2;
    useDesk.getState().setSkin("nocturne");
    flushDeskSave();
    assert.equal(stored, previous, "failed retries preserve previous save");
    assert.equal(useDesk.getState().skin, "nocturne", "unsaved state remains available");
    assert.equal(useDesk.getState().storageWarning, true);
    win.dispatchEvent(new Event("pagehide"));
    assert.equal(JSON.parse(stored).skin, "nocturne", "failed save is retried on lifecycle flush");
    assert.equal(useDesk.getState().storageWarning, false);
    errorName = "SecurityError";
    failCount = 1;
    useDesk.getState().setBrush(3);
    const beforeSecurity = attempts;
    flushDeskSave();
    assert.equal(attempts, beforeSecurity + 1, "non-quota errors do not compact");
    assert.equal(useDesk.getState().storageWarning, true);
    flushDeskSave();
    useDesk.getState().setBrush(4);
    const beforeDebounce = attempts;
    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.equal(attempts, beforeDebounce + 1);
    assert.equal(JSON.parse(stored).brush, 4);
  } finally {
    flushDeskSave();
    Object.assign(globalThis, original);
  }
});
