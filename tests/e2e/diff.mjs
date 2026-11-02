// Pixel diff two screenshot dirs. Usage: node tests/e2e/diff.mjs <baseDir> <headDir> [maxRatio]
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
const [a, b, max = "0.02"] = process.argv.slice(2);
let bad = 0;
const rows = [];
for (const f of readdirSync(a).filter((f) => f.endsWith(".png") && !f.startsWith("diff-"))) {
  let A, B;
  try { A = PNG.sync.read(readFileSync(`${a}/${f}`)); B = PNG.sync.read(readFileSync(`${b}/${f}`)); } catch { rows.push(`${f}: MISSING`); bad++; continue; }
  if (A.width !== B.width || A.height !== B.height) { rows.push(`${f}: SIZE ${A.width}x${A.height} vs ${B.width}x${B.height}`); bad++; continue; }
  const D = new PNG({ width: A.width, height: A.height });
  const n = pixelmatch(A.data, B.data, D.data, A.width, A.height, { threshold: 0.15 });
  const r = n / (A.width * A.height);
  writeFileSync(`${b}/diff-${f}`, PNG.sync.write(D));
  const ok = r <= Number(max);
  if (!ok) bad++;
  rows.push(`${f}: ${(r * 100).toFixed(3)}% ${ok ? "ok" : "OVER"}`);
}
console.log(rows.join("\n"));
process.exit(bad ? 1 : 0);
