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
