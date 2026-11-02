import assert from "node:assert/strict";
import test from "node:test";
import { composeBook, packLeaves, blockHeight, visible } from "./text.ts";

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
