// Regression harness: screenshots at 4 sizes + feature checklist + ink round-trip.
// Usage: node tests/e2e/run.mjs <baseUrl> <outDir>
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const base = process.argv[2] ?? "http://127.0.0.1:8081/";
const out = process.argv[3] ?? "tests/e2e/out";
mkdirSync(out, { recursive: true });
const SIZES = [
  { name: "phone", width: 390, height: 844, touch: true },
  { name: "tablet", width: 768, height: 1024, touch: true },
  { name: "laptop", width: 1366, height: 800 },
  { name: "desktop", width: 1920, height: 1080 },
];
const BOOK = /Pride and Prejudice/;
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`);
};

const launch = { args: process.env.HOST_RULES ? [`--host-resolver-rules=${process.env.HOST_RULES}`] : [] };
if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
const browser = await chromium.launch(launch);

async function openBook(page) {
  await page.getByRole("button", { name: BOOK }).first().click();
  await page.locator(".ink-layer canvas").first().waitFor({ timeout: 60000 });
  await page.waitForFunction(() => { const b = document.querySelector('button[aria-label="Next page"]'); return b && !b.disabled; }, null, { timeout: 90000 });
  await page.waitForTimeout(1500);
}
async function inkPixels(page) {
  return page.evaluate(() => {
    const c = document.querySelector(".ink-layer canvas");
    if (!c) return -1;
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
    return n;
  });
}
async function freeze(page) {
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
}

for (const s of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: s.width, height: s.height }, hasTouch: !!s.touch, isMobile: !!s.touch, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(base, { waitUntil: "networkidle", timeout: 90000 });
  await page.getByRole("button", { name: BOOK }).first().waitFor({ timeout: 60000 });
  await freeze(page);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/${s.name}-shelf.png` });
  await openBook(page);
  await freeze(page);
  await page.screenshot({ path: `${out}/${s.name}-book.png` });
  check(`${s.name}: no console errors`, errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

// Touch pointer routing checks supplement native gesture checks below.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: "networkidle" });
  await openBook(page);
  const route = async (kind) => page.evaluate(async (kind) => {
    const c = document.querySelector(".ink-layer canvas");
    const r = c.getBoundingClientRect();
    const emit = (type, id, x, y, extra = {}) => c.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerType: "touch", pointerId: id,
      clientX: r.left + x, clientY: r.top + y, width: 8, height: 8, ...extra,
    }));
    const count = () => (localStorage.getItem("nightdesk.v1")?.match(/"points"/g) || []).length;
    const before = count();
    emit("pointerdown", 31, 65, 90, kind === "palm" ? { width: 60 } : {});
    emit("pointermove", 31, 95, 110);
    if (kind === "multi") emit("pointerdown", 32, 140, 120);
    emit("pointermove", 31, 120, 130);
    emit("pointerup", 31, 120, 130);
    if (kind === "multi") emit("pointerup", 32, 140, 120);
    await new Promise(resolve => setTimeout(resolve, 500));
    return count() - before;
  }, kind);
  check("touch: second finger cancels stroke", await route("multi") === 0);
  check("touch: palm ignored", await route("palm") === 0);
  check("touch: text stroke saved", await route("draw") === 1);
  const penPalm = await page.evaluate(async () => {
    const c = document.querySelector(".ink-layer canvas");
    const r = c.getBoundingClientRect();
    const count = () => (localStorage.getItem("nightdesk.v1")?.match(/"points"/g) || []).length;
    const before = count();
    const emit = (type, id, pointerType, x, y) => c.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: id, pointerType,
      clientX: r.left + x, clientY: r.top + y, width: 8, height: 8,
    }));
    emit("pointerdown", 71, "pen", 70, 100);
    emit("pointerdown", 72, "touch", 90, 100);
    emit("pointerdown", 73, "touch", 110, 100);
    emit("pointermove", 71, "pen", 140, 140);
    emit("pointerup", 72, "touch", 90, 100);
    emit("pointerup", 73, "touch", 110, 100);
    emit("pointerup", 71, "pen", 140, 140);
    emit("pointerdown", 74, "touch", 80, 110);
    emit("pointermove", 74, "touch", 160, 150);
    emit("pointerup", 74, "touch", 160, 150);
    await new Promise(resolve => setTimeout(resolve, 550));
    return count() - before;
  });
  check("pen: palm and recent touches leave pen stroke intact", penPalm === 1);

  const leaf = page.locator('input[aria-label="Page"]');
  const before = await leaf.inputValue();
  const cdp = await ctx.newCDPSession(page);
  const edgeBox = await page.locator(".ink-layer canvas").first().boundingBox();
  const edgeX = Math.min(385, edgeBox.x + edgeBox.width - 8);
  const edgeY = edgeBox.y + 120;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: edgeX, y: edgeY, id: 1 }] });
  for (let i = 1; i <= 8; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: edgeX - i * 12, y: edgeY, id: 1 }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(1200);
  check("touch: edge swipe turns page", await leaf.inputValue() !== before);
  // Real browser touch input: two fingers must pan overflowing page content.
  await page.evaluate(() => {
    const scroll = document.querySelector(".page-scroll");
    scroll.classList.add("has-extra");
    scroll.querySelector(".page-inner").style.minHeight = "1400px";
    scroll.scrollIntoView({ block: "center" });
  });
  const rect = await page.locator(".page-scroll").first().boundingBox();
  const x = rect.x + rect.width / 2;
  const y = Math.max(100, Math.min(600, rect.y + 200));
  const countStrokes = () => page.evaluate(() => (localStorage.getItem("nightdesk.v1")?.match(/"points"/g) || []).length);
  const singleBefore = await countStrokes();
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
  for (let i = 1; i <= 8; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + i * 3, y: y + i * 5, id: 1 }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(500);
  check("touch: native single-finger drawing saved", await countStrokes() === singleBefore + 1);
  const storedBefore = await page.evaluate(() => localStorage.getItem("nightdesk.v1"));
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x - 25, y, id: 1 }, { x: x + 25, y, id: 2 }] });
  for (let i = 1; i <= 8; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - 25, y: y - i * 12, id: 1 }, { x: x + 25, y: y - i * 12, id: 2 }] });
    await page.waitForTimeout(25);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(500);
  check("touch: native two-finger scroll", await page.locator(".page-scroll").first().evaluate(el => el.scrollTop > 0));
  check("touch: native two-finger scroll adds no ink", await page.evaluate(() => localStorage.getItem("nightdesk.v1")) === storedBefore);
  await ctx.close();
}

// Feature checklist + ink round trip (laptop size, mouse)
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: "networkidle", timeout: 90000 });
  for (const label of ["Read aloud", "Ask", "Borrowed", "Title", "Author", "Genre", "Newest", "Spin the dial"]) {
    check(`button "${label}" present`, await page.getByRole("button", { name: label, exact: true }).count());
  }
  check("search field present", await page.getByPlaceholder(/Title, author/).count());
  check("atmosphere select present", await page.locator("select").count());
  await openBook(page);
  for (const label of ["Ink", "Notes", "JSON"]) check(`book toolbar "${label}"`, await page.getByRole("button", { name: label }).count());
  const leafBox = page.locator('input[aria-label="Page"]');
  const before = await leafBox.inputValue();
  await page.getByRole("button", { name: "Next page" }).click();
  await page.waitForTimeout(1500);
  const after = await leafBox.inputValue();
  check("next leaf turns the page", before !== after, `${before}->${after}`);
  await page.getByRole("button", { name: "Previous page" }).click();
  await page.waitForTimeout(1500);
  const c = page.locator(".ink-layer canvas").first();
  const bb = await c.boundingBox();
  await page.mouse.move(bb.x + 60, bb.y + 80);
  await page.mouse.down();
  for (let i = 1; i < 20; i++) await page.mouse.move(bb.x + 60 + i * 10, bb.y + 80 + i * 4);
  await page.mouse.up();
  await page.waitForTimeout(1200);
  const drawn = await inkPixels(page);
  check("ink draws", drawn > 100, `pixels=${drawn}`);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  if (!(await page.locator(".ink-layer canvas").count())) await openBook(page);
  else await page.waitForTimeout(2500);
  const stored = await page.evaluate(() => (localStorage.getItem("nightdesk.v1")?.match(/"points"/g) || []).length);
  await page.waitForFunction(() => { const c = document.querySelector(".ink-layer canvas"); if (!c) return false; const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return true; return false; }, null, { timeout: 10000 }).catch(() => {});
  const back = await inkPixels(page);
  check("ink stroke still in storage after reload", stored > 0, `strokes=${stored}`);
  check("ink survives reload+reopen", back > 0 && Math.abs(back - drawn) / drawn < 0.15, `pixels=${back}`);
  // Fast close: draw a second stroke and reload almost immediately (user closes the tab right after drawing).
  const c2 = page.locator(".ink-layer canvas").first();
  const b2 = await c2.boundingBox();
  await page.mouse.move(b2.x + 80, b2.y + 200);
  await page.mouse.down();
  for (let i = 1; i < 20; i++) await page.mouse.move(b2.x + 80 + i * 10, b2.y + 200 + i * 3);
  await page.mouse.up();
  await page.waitForTimeout(50);
  await page.reload({ waitUntil: "networkidle" });
  const fast = await page.evaluate(() => (localStorage.getItem("nightdesk.v1")?.match(/"points"/g) || []).length);
  check("ink-fast-reload: stroke saved when the page closes right after drawing", fast >= 2, `strokes=${fast}`);
  if (!(await page.locator(".ink-layer canvas").count())) await openBook(page);
  await page.getByRole("button", { name: "Ink", exact: true }).click();
  await page.evaluate(() => {
    const scroll = document.querySelector(".page-scroll");
    scroll.classList.add("has-extra");
    scroll.querySelector(".page-inner").style.minHeight = "1800px";
    scroll.scrollIntoView({ block: "center" });
  });
  const wheelBox = await page.locator(".page-scroll").first().boundingBox();
  const deskBefore = await page.evaluate(() => window.scrollY);
  await page.mouse.move(wheelBox.x + wheelBox.width / 2, wheelBox.y + 120);
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(300);
  check("wheel: extra content scrolls inside page", await page.locator(".page-scroll").first().evaluate(el => el.scrollTop > 0));
  check("wheel: desk stays in place", await page.evaluate(() => window.scrollY) === deskBefore);
  const uncloaked = await inkPixels(page);
  const closedCanvas = await page.locator(".ink-layer canvas").first().boundingBox();
  await page.mouse.move(closedCanvas.x + 70, wheelBox.y + 100);
  await page.mouse.down();
  await page.mouse.move(closedCanvas.x + 150, wheelBox.y + 140, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  check("ink: draws with toolbar closed", await inkPixels(page) > uncloaked);

  await ctx.close();
}
// Resume checks run last, leaving the existing screenshot contexts unchanged.
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: "networkidle" });
  check("first visit stays on shelf", await page.locator('input[aria-label="Page"]').count() === 0);
  await openBook(page);
  const leaf = page.locator('input[aria-label="Page"]');
  await leaf.fill("5");
  await page.waitForTimeout(800);
  const passage = await page.locator(".book-card .page-inner .flow-block").first().textContent();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("nightdesk.v1")).positions[1342]);
  await page.reload({ waitUntil: "networkidle" });
  await leaf.waitFor({ timeout: 60000 });
  await page.waitForTimeout(3000);
  check("resume: reopen at leaf 5", await leaf.inputValue() === "5");
  check("resume: same text after reload", !!passage?.trim() && await page.locator(".book-card .page-inner").first().textContent().then(text => text.includes(passage)));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(1000);
  await page.reload({ waitUntil: "networkidle" });
  await leaf.waitFor({ timeout: 60000 });
  await page.waitForTimeout(3000);
  const resized = await page.evaluate(() => JSON.parse(localStorage.getItem("nightdesk.v1")).positions[1342]);
  check("resume: resize preserves text anchor", saved.anchor === resized.anchor);
  check("resume: resized leaf contains passage", await page.locator(".book-card .page-inner").first().textContent().then(text => text.includes(passage)));
  check("resume: continue reading hidden for open book", await page.getByRole("button", { name: /Continue reading Pride and Prejudice/ }).count() === 0);
  await leaf.fill("6");
  await page.reload({ waitUntil: "networkidle" });
  await leaf.waitFor({ timeout: 60000 });
  await page.waitForTimeout(3000);
  check("resume: immediate reload flushes leaf turn", await leaf.inputValue() === "6");
  await ctx.close();
}
await browser.close();
writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
// Known failures (documented bugs not yet fixed). A fix PR removes its entry.
const known = existsSync("tests/e2e/known-failures.json") ? JSON.parse(readFileSync("tests/e2e/known-failures.json", "utf8")) : [];
const failed = results.filter((r) => !r.ok && !known.some((k) => r.name.startsWith(k)));
const fixedKnown = known.filter((k) => results.some((r) => r.name.startsWith(k) && r.ok));
if (fixedKnown.length) console.log(`NOTE: known failures now passing, remove from known-failures.json: ${fixedKnown.join(", ")}`);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
