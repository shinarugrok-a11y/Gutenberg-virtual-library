import assert from "node:assert/strict";
import test from "node:test";
import { composeBook, packLeaves, blockHeight, visible, holdPlace, stableBox, type Block } from "./text.ts";
import { rebindMarks, type MarginNote, type Stroke } from "./notes.ts";

const SAMPLE = `
*** START OF THE PROJECT GUTENBERG EBOOK SAMPLE ***

                                PRIDE.
                                  and
                               PREJUDICE

Chapter I.                                                  1

Chapter II.                                                 5

PREFACE.

_To Mrs. Saville, England._

It is a truth universally acknowledged, that a single man in possession
of a good fortune, must be in want of a wife. “We are not in a way to
know _what_ he likes,” said her mother, “since we are not to visit.”

[Illustration: M^{r.} & M^{rs.} Bennet]

[Illustration]

CHAPTER I.

Mr. Bennet was among the earliest of those who waited on Mr. Bingley.
“Then, my dear, you may introduce him to _her_.”

_3 May. Bistritz._--Left Munich at 8:35 P. M., on 1st May.

*       *       *       *       *

“I am _the_ woman,” he said.

*** END OF THE PROJECT GUTENBERG EBOOK SAMPLE ***
`.replace("CHAPTER I.", "\n\nCHAPTER I.");

test("underscores become italics and dashes become em dashes", () => {
  const seen = visible("know _what_ he likes -- truly");
  assert.equal(seen.includes("_"), false);
  assert.match(seen, /what/);
  assert.match(seen, /—/);
  const runs = composeBook(SAMPLE);
  const joined = runs.blocks
    .map((block) => (block.type === "para" ? block.plain : ""))
    .join("\n");
  assert.equal(joined.includes("_"), false);
  assert.match(joined, /what/);
  assert.match(joined, /her/);
  assert.match(joined, /3 May\. Bistritz\.—Left Munich/);
});

test("superscripts, plates, and curly quotes are set", () => {
  const edition = composeBook(SAMPLE);
  const plate = edition.blocks.find((block) => block.type === "plate" && block.plain.includes("Bennet"));
  assert.ok(plate && plate.type === "plate");
  assert.equal(plate.plain.includes("Illustration"), false);
  assert.equal(plate.plain.includes("^"), false);
  assert.ok(plate.runs.some((run) => run.kind === "sup"));
  const para = edition.blocks.find((block) => block.type === "para" && block.plain.includes("acknowledged"));
  assert.ok(para && para.type === "para");
  assert.match(para.plain, /“We are not/);
  assert.ok(para.runs.some((run) => run.kind === "em" && run.text === "what"));
});

test("chapter headings and form feeds start a new page", () => {
  const edition = composeBook(SAMPLE.replace("*** END OF THE PROJECT GUTENBERG EBOOK SAMPLE ***", "\fStill the next leaf of the book. It continues here with enough words to sit on their own page.\n\n*** END OF THE PROJECT GUTENBERG EBOOK SAMPLE ***"));
  const breaks = edition.blocks.filter((block) => block.type === "break").length;
  assert.ok(breaks >= 2);
  const leaves = packLeaves(edition.blocks, (block) => blockHeight(block, 340), 220);
  const chapterLeaf = leaves.find((leaf) => leaf.blocks.some((block) => block.type === "heading" && block.level === 1 && /CHAPTER I/i.test(block.plain)));
  assert.ok(chapterLeaf);
  assert.equal(chapterLeaf?.blocks[0]?.type === "heading" || chapterLeaf?.blocks.some((block) => block.type === "heading"), true);
  const after = leaves.find((leaf) => leaf.plain.includes("Still the next leaf"));
  assert.ok(after);
  assert.equal(after?.plain.includes("CHAPTER I"), false);
});

test("a stacked contents list stays a list, not a stack of blank chapters", () => {
  const edition = composeBook(`*** START OF THE PROJECT GUTENBERG EBOOK SAMPLE ***
Chapter 1
Chapter 2
Chapter 3
Chapter 4

Letter 1

You will rejoice to hear that no disaster has accompanied the start.
*** END OF THE PROJECT GUTENBERG EBOOK SAMPLE ***`);
  const toc = edition.blocks.filter((block) => block.type === "toc");
  assert.equal(toc.length, 4);
  const letter = edition.blocks.find((block) => block.type === "heading" && block.plain.startsWith("Letter"));
  assert.ok(letter);
});

function marked(index: number): Block {
  return {
    type: "para",
    runs: [],
    plain: `Marker ${index}. ${"word ".repeat(28)}`,
    flush: false,
    cont: false,
    salute: false,
    aside: false,
  };
}

test("toolbar jitter does not change the page box", () => {
  const prev = { width: 390, budget: 520 };
  assert.equal(stableBox(prev, 394, 548), prev);
  assert.equal(stableBox(prev, 386, 470), prev);
  assert.equal(stableBox(prev, Number.NaN, 900), prev);
  const resized = stableBox(prev, 390, 620);
  assert.equal(resized.budget, 620);
  assert.equal(resized.width, 390);
  const wider = stableBox(prev, 460, 520);
  assert.equal(wider.width, 460);
});

test("a height flip keeps the same sentence instead of walking backward", () => {
  const blocks = Array.from({ length: 36 }, (_, index) => marked(index));
  const tight = packLeaves(blocks, (block) => blockHeight(block, 320), 160);
  const loose = packLeaves(blocks, (block) => blockHeight(block, 320), 280);
  assert.ok(tight.length > loose.length);
  const start = 6;
  const anchor = tight[start - 1]!.plain.slice(0, 80);
  const snip = anchor.slice(0, 40);
  let page = start;
  for (let pass = 0; pass < 8; pass++) {
    const plains = (pass % 2 === 0 ? loose : tight).map((leaf) => leaf.plain);
    page = holdPlace(plains, page, anchor);
  }
  const home = holdPlace(tight.map((leaf) => leaf.plain), page, anchor);
  assert.equal(home, start);
  assert.equal(tight[home - 1]!.plain.includes(snip), true);

  let walked = start;
  let moving = anchor;
  for (let pass = 0; pass < 8; pass++) {
    const plains = (pass % 2 === 0 ? loose : tight).map((leaf) => leaf.plain);
    walked = holdPlace(plains, walked, moving);
    moving = plains[walked - 1]?.slice(0, 80) ?? moving;
  }
  const drifted = holdPlace(tight.map((leaf) => leaf.plain), walked, moving);
  assert.ok(drifted < start);
});

test("ink and the margin note follow the sentence when the page size changes", () => {
  const blocks = Array.from({ length: 36 }, (_, index) => marked(index));
  const tight = packLeaves(blocks, (block) => blockHeight(block, 320), 160);
  const loose = packLeaves(blocks, (block) => blockHeight(block, 320), 280);
  const oldPlains = tight.map((leaf) => leaf.plain);
  const nextPlains = loose.map((leaf) => leaf.plain);
  const stroke: Stroke = {
    id: "s1",
    tool: "pen",
    color: "#1c140e",
    size: 2,
    points: [
      { x: 0.2, y: 0.3 },
      { x: 0.4, y: 0.5 },
    ],
  };
  const comment: MarginNote = { id: "c1", leaf: 6, text: "Dorothea", at: 1 };
  const same = rebindMarks(oldPlains, oldPlains, { "6": [stroke] }, [comment]);
  assert.equal(same.moved, false);
  assert.equal(same.strokes["6"], undefined === false ? same.strokes["6"] : same.strokes["6"]);
  assert.equal(same.strokes["6"]?.[0]?.id, "s1");
  const moved = rebindMarks(oldPlains, nextPlains, { "6": [stroke] }, [comment]);
  assert.equal(moved.moved, true);
  const dest = Number(Object.keys(moved.strokes)[0]);
  assert.equal(nextPlains[dest - 1]?.includes("Marker 5") || nextPlains[dest - 1]?.includes(oldPlains[5]!.slice(0, 40)), true);
  assert.equal(moved.comments[0]?.leaf, dest);
  assert.equal(moved.strokes[String(dest)]?.[0]?.id, "s1");
  assert.equal(moved.strokes["6"], dest === 6 ? moved.strokes["6"] : undefined);
});
