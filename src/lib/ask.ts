export type Passage = { page: number; text: string };

export type BookAnswer = {
  found: boolean;
  lead: string;
  passages: Passage[];
};

const STOP = new Set(
  `a an the of to and in that it is was for as with on be by this from at or are were which but not you your we they their his her she he i me my our who whom what when where why how into about over after before than then them these those its it's if so no yes do did does done have has had will would can could should may might must very just also only own same such other into onto per via`.split(
    /\s+/,
  ),
);

function tokenize(input: string): string[] {
  return (
    input
      .toLowerCase()
      .replace(/[’']/g, "")
      .match(/[a-z0-9]+/g)
      ?.filter((token) => token.length > 1 && !STOP.has(token)) ?? []
  );
}

function sentencesOf(page: string): string[] {
  const parts = page.match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g) ?? [page];
  return parts.map((part) => part.replace(/\s+/g, " ").trim()).filter((part) => part.length > 40);
}

export function answerBook(question: string, pages: string[], title: string): BookAnswer {
  const qTokens = tokenize(question);
  if (!qTokens.length || !pages.length) {
    return {
      found: false,
      lead: "Ask about a person, a place, or a line in this book. Quill only reads the pages on the desk.",
      passages: [],
    };
  }

  const docs = pages.map((page) => tokenize(page));
  const n = docs.length;
  const df = new Map<string, number>();
  for (const doc of docs) {
    const seen = new Set(doc);
    for (const token of seen) df.set(token, (df.get(token) ?? 0) + 1);
  }
  const avg = docs.reduce((sum, doc) => sum + doc.length, 0) / n || 1;
  const k1 = 1.4;
  const b = 0.65;
  const idf = (token: string) => {
    const d = df.get(token) ?? 0;
    return Math.log(1 + (n - d + 0.5) / (d + 0.5));
  };

  const pageScores = docs.map((doc) => {
    const tf = new Map<string, number>();
    for (const token of doc) tf.set(token, (tf.get(token) ?? 0) + 1);
    let score = 0;
    for (const token of qTokens) {
      const freq = tf.get(token) ?? 0;
      if (!freq) continue;
      const denom = freq + k1 * (1 - b + b * (doc.length / avg));
      score += idf(token) * ((freq * (k1 + 1)) / denom);
    }
    return score;
  });

  const ranked = pageScores
    .map((score, index) => ({ score, index }))
    .sort((a, b2) => b2.score - a.score)
    .slice(0, 6)
    .filter((item) => item.score > 0);

  type Hit = { page: number; text: string; score: number };
  const hits: Hit[] = [];
  for (const item of ranked) {
    for (const sentence of sentencesOf(pages[item.index] ?? "")) {
      const tokens = tokenize(sentence);
      if (!tokens.length) continue;
      let score = 0;
      let overlap = 0;
      const positions: number[] = [];
      qTokens.forEach((token) => {
        const at = tokens.indexOf(token);
        if (at >= 0) {
          overlap += 1;
          positions.push(at);
          score += idf(token) + 0.15;
        }
      });
      if (!overlap) continue;
      if (overlap === qTokens.length && positions.length > 1) {
        const span = Math.max(...positions) - Math.min(...positions);
        score += 2.2 + Math.max(0, 2.4 - span / 8);
      }
      const phrase = qTokens.join(" ");
      if (sentence.toLowerCase().includes(phrase) && qTokens.length > 1) score += 1.4;
      score += Math.min(item.score, 4) * 0.05;
      if (sentence.length > 420) score *= 0.85;
      hits.push({ page: item.index + 1, text: sentence, score });
    }
  }
  hits.sort((a, b2) => b2.score - a.score);

  const picked: Hit[] = [];
  const seenPages = new Set<number>();
  for (const hit of hits) {
    if (picked.some((item) => item.text === hit.text)) continue;
    if (picked.length && seenPages.has(hit.page) && picked.length < 2) continue;
    picked.push(hit);
    seenPages.add(hit.page);
    if (picked.length === 3) break;
  }

  const best = picked[0];
  if (!best || best.score < 1.05) {
    const near = hits[0];
    return {
      found: false,
      lead: near
        ? `I can't find that in ${title}. The nearest line is on page ${near.page}, and it does not really answer it.`
        : `I can't find that in ${title}.`,
      passages: near ? [{ page: near.page, text: near.text }] : [],
    };
  }

  return {
    found: true,
    lead: `In ${title}, page ${best.page}: “${best.text}”`,
    passages: picked.map((hit) => ({ page: hit.page, text: hit.text })),
  };
}
