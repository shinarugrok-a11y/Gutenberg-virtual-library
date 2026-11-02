import { LANGUAGES, type TranslationJob } from "./models";
import { readLeaf, writeLeaf } from "./cache";

let latest: TranslationJob | undefined;
let busy = false;
let activeModel = "";
type Translator = {
  (
    text: string,
    options: { max_new_tokens: number; num_beams: number },
  ): Promise<{ translation_text: string }[]>;
  dispose(): Promise<void>;
};
let translator: Translator | undefined;
let runtime: Promise<{ wasm: string; mjs: string }> | undefined;
async function cachedRuntime(version: string) {
  const cache = await caches.open("nightdesk.translation.runtime.v1");
  const urls: Record<string, string> = {};
  for (const extension of ["mjs", "wasm"]) {
    const url = `https://cdn.jsdelivr.net/npm/@huggingface/transformers@${version}/dist/ort-wasm-simd-threaded.jsep.${extension}`;
    let response = await cache.match(url);
    if (!response) {
      response = await fetch(url);
      if (!response.ok) throw new Error("Could not download the offline translation runtime");
      await cache.put(url, response.clone());
    }
    const blob = new Blob([await response.arrayBuffer()], {
      type: extension === "mjs" ? "text/javascript" : "application/wasm",
    });
    urls[extension] = URL.createObjectURL(blob);
  }
  return { mjs: urls.mjs, wasm: urls.wasm };
}
const cancelled = (job: TranslationJob) => latest?.id !== job.id;
function progress(job: TranslationJob, text: string) {
  self.postMessage({ id: job.id, progress: text });
}
async function model(id: string, job: TranslationJob) {
  if (translator && activeModel === id) return translator;
  if (translator) {
    await translator.dispose();
    translator = undefined;
    activeModel = "";
  }
  const { pipeline, env } = await import("@huggingface/transformers");
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  // One CPU thread keeps inference modest and does not require cross-origin isolation.
  if (env.backends.onnx.wasm) {
    env.backends.onnx.wasm.numThreads = 1;
    progress(job, "Preparing offline translation runtime…");
    runtime ??= cachedRuntime(env.version).catch((error) => {
      runtime = undefined;
      throw error;
    });
    env.backends.onnx.wasm.wasmPaths = await runtime;
  }
  progress(job, `Downloading ${id.replace("Xenova/opus-mt-", "")} language pack…`);
  const create = pipeline as unknown as (
    task: string,
    model: string,
    options: Record<string, unknown>,
  ) => Promise<Translator>;
  translator = await create("translation", id, {
    device: "wasm",
    dtype: "q8",
    progress_callback: (event: { status: string; progress: number; file: string }) => {
      if (event.status === "progress")
        progress(job, `Downloading language pack: ${Math.round(event.progress)}% (${event.file})`);
    },
  });
  activeModel = id;
  return translator;
}
async function route(job: TranslationJob): Promise<string[]> {
  if (!/^[a-z]{2,3}$/.test(job.source))
    throw new Error("This book’s source language is not supported.");
  const target = LANGUAGES.find((item) => item.code === job.target);
  if (!target) throw new Error("Choose a supported translation language.");
  if (job.source === job.target) return [];
  if (job.source === "en") return [target.model];
  const direct = `Xenova/opus-mt-${job.source}-${job.target}`;
  // Probe a small cached configuration, not a model download. Offline, a cached
  // direct model still works; otherwise use the English pivot.
  const url = `https://huggingface.co/${direct}/resolve/main/config.json`;
  const cache = await caches.open("nightdesk.translation.routes").catch(() => undefined);
  const cached = await cache?.match(url);
  if (cached) return [direct];
  if (navigator.onLine) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const config = await response.clone().json();
        if (config.model_type === "marian") {
          await cache?.put(url, response);
          return [direct];
        }
      }
    } catch {
      /* Pivot also works from cached packs while offline. */
    }
  }
  return [`Xenova/opus-mt-${job.source}-en`, target.model];
}
// Conservative chunks prevent Marian's 512-token input limit from silently
// truncating long prose; retain every character, including unspaced CJK text.
function chunks(text: string): string[] {
  const result: string[] = [];
  let remaining = text.trim();
  while (remaining.length) {
    let end = Math.min(remaining.length, 180);
    if (end < remaining.length) {
      const boundary = remaining.slice(0, end).search(/[.!?。！？]\s*[^.!?。！？]*$/u);
      const space = remaining.lastIndexOf(" ", end);
      if (boundary > 40) end = boundary + 1;
      else if (space > 40) end = space;
    }
    result.push(remaining.slice(0, end));
    remaining = remaining.slice(end).trimStart();
  }
  return result;
}
async function translate(job: TranslationJob) {
  const cached = await readLeaf(job);
  if (cached !== undefined) return cached;
  let paragraphs = job.text.split(/\n\s*\n/);
  for (const id of await route(job)) {
    if (cancelled(job)) throw new Error("Cancelled");
    const pipe = await model(id, job);
    const output: string[] = [];
    let count = 0;
    for (const paragraph of paragraphs) {
      const parts: string[] = [];
      for (const chunk of chunks(paragraph)) {
        if (cancelled(job)) throw new Error("Cancelled");
        progress(job, `Translating leaf ${job.leaf}… ${++count}`);
        const result = await pipe(chunk, { max_new_tokens: 256, num_beams: 1 });
        const item = result[0];
        parts.push(("translation_text" in item ? item.translation_text : "") as string);
      }
      output.push(parts.join(" "));
    }
    paragraphs = output;
  }
  const text = paragraphs.join("\n\n");
  await writeLeaf(job, text);
  return text;
}
self.onmessage = async (event: MessageEvent<TranslationJob | { cancel: true }>) => {
  if ("cancel" in event.data) {
    latest = undefined;
    return;
  }
  latest = event.data;
  if (busy) return;
  busy = true;
  while (latest) {
    const job: TranslationJob = latest;
    try {
      self.postMessage({ id: job.id, text: await translate(job) });
    } catch (error) {
      self.postMessage({
        id: job.id,
        error: `Translation unavailable: ${error instanceof Error ? error.message : String(error)}. Original text is preserved; choose the language again to retry.`,
      });
    }
    if (latest?.id === job.id) latest = undefined;
  }
  busy = false;
};
