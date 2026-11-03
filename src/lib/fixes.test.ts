import assert from "node:assert/strict";
import test from "node:test";
import { packLeaves, type Block } from "./text.ts";
import { eraseNear, rebindMarks, type MarginNote, type Stroke } from "./notes.ts";
import { answerBook, tokenize } from "./ask.ts";

const para = (plain: string): Block => ({ type: "para", runs: [{ kind: "text", text: plain }], plain, flush: false, cont: false, salute: false, aside: false });

test("a block taller than the page is marked so the page scrolls instead of clipping", () => {
  const leaves = packLeaves([para("short"), para("huge"), para("after")], (block) => (block.type === "para" && block.plain === "huge" ? 900 : 40), 300);
  assert.equal(leaves.length, 3);
  assert.equal(leaves[1]?.tall, true);
  assert.equal(leaves[0]?.tall, undefined);
  assert.equal(leaves[2]?.tall, undefined);
});

test("marks on a repeated passage follow the nearest copy, not the first", () => {
  const refrain = "And still the river ran beneath the bridge, and still the night went on.";
  const oldPlains = ["one", refrain, "three", "four", "five", "six", refrain, "eight"];
  const nextPlains = ["one", "x", refrain, "three", "four", "five", "six", "y", refrain, "eight"];
  const stroke: Stroke = { id: "s", tool: "pen", color: "#000", size: 2, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] };
  const comment: MarginNote = { id: "c", leaf: 7, text: "again", at: 0 };
  const moved = rebindMarks(oldPlains, nextPlains, { "7": [stroke] }, [comment]);
  assert.equal(moved.strokes["9"]?.[0]?.id, "s");
  assert.equal(moved.comments[0]?.leaf, 9);
});

test("marks whose text vanished stay inside the book", () => {
  const moved = rebindMarks(["a", "b", "c", "d"], ["q", "r"], { "4": [{ id: "s", tool: "pen", color: "#000", size: 2, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }] }, []);
  assert.ok(moved.strokes["2"]);
});

test("erasing twice never produces duplicate stroke ids", () => {
  const points = Array.from({ length: 21 }, (_, i) => ({ x: i / 20, y: 0.5 }));
  const first = eraseNear([{ id: "s", tool: "pen", color: "#000", size: 2, points }], 0.5, 0.5, 0.06);
  const second = eraseNear(first, 0.25, 0.5, 0.06);
  const ids = second.map((stroke) => stroke.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(second.length >= 3);
});

test("ask understands accented and CJK text", () => {
  assert.deepEqual(tokenize("Élisabeth à Pémberley"), ["elisabeth", "pemberley"]);
  assert.ok(tokenize("孔子曰学而时习之").includes("学而"));
  const pages = [
    "Le notaire arriva de Londres avec une lettre cachetée pour la famille Bennet, et personne ne voulut l'ouvrir.",
    "Le château était silencieux. Élisabeth marchait seule dans le jardin de Pemberley, sous la pluie fine du soir.",
    "Monsieur Collins parla longuement de sa paroisse et de la bienveillance de sa protectrice, Lady Catherine.",
  ];
  assert.equal(answerBook("Où marchait Elisabeth ?", pages, "Livre").found, true);
});
