import { useEffect, useRef, useState } from "react";
import type { Leaf } from "../text";
import type { TranslationJob } from "./models";
import workerURL from "./worker.ts?worker&url";

async function createWorker() {
  if (!import.meta.env.PROD) return new Worker(workerURL, { type: "module" });
  const cache = await caches.open("nightdesk.translation.worker.v1");
  let response = await cache.match(workerURL);
  if (!response) {
    response = await fetch(workerURL);
    if (!response.ok) throw new Error("Could not download the translation worker");
    await cache.put(workerURL, response.clone());
  }
  const url = URL.createObjectURL(new Blob([await response.text()], { type: "text/javascript" }));
  const worker = new Worker(url, { type: "module" });
  // Keep the object URL alive until the worker has loaded its script.
  worker.addEventListener("message", () => URL.revokeObjectURL(url), { once: true });
  return worker;
}

export function useTranslation(book: number, source: string, leaves: Leaf[], shown: number) {
  const [target, setTarget] = useState("");
  const [original, setOriginal] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ key: string; text: string } | null>(null);
  const worker = useRef<Worker | null>(null);
  const sequence = useRef(0);
  const loading = useRef<Promise<Worker> | null>(null);
  const text = shown > 0 ? (leaves[shown - 1]?.plain ?? "") : "";
  const next = leaves[shown]?.plain ?? "";
  const key = JSON.stringify([book, source, target, shown, text]);
  useEffect(
    () => () => {
      void loading.current?.then((instance) => instance.terminate()).catch(() => undefined);
    },
    [],
  );
  useEffect(() => {
    const id = ++sequence.current;
    setMessage("");
    if (!target || original) {
      worker.current?.postMessage({ cancel: true });
      return;
    }
    // Picking a language on the title page prepares leaf 1, never the whole book.
    const index = shown > 0 ? shown : 1;
    const plain = shown > 0 ? text : next;
    if (!plain) return;
    setMessage("Preparing local translation…");
    loading.current ??= createWorker().catch((error) => {
      loading.current = null;
      throw error;
    });
    void loading.current
      .then((current) => {
        if (sequence.current !== id) return;
        worker.current = current;
        current.onmessage = (event) => {
          if (sequence.current !== id || event.data.id !== id) return;
          if (event.data.progress) setMessage(event.data.progress);
          if (event.data.error) setMessage(event.data.error);
          if (typeof event.data.text === "string") {
            if (shown > 0) setResult({ key, text: event.data.text });
            setMessage("");
            // The only speculative work is the immediately following leaf.
            if (shown > 0 && next)
              current.postMessage({
                id: -id,
                book,
                source,
                target,
                leaf: shown + 1,
                text: next,
              } satisfies TranslationJob);
          }
        };
        current.onerror = () => {
          if (sequence.current === id)
            setMessage("Translation worker could not load. Choose the language again to retry.");
        };
        current.postMessage({
          id,
          book,
          source,
          target,
          leaf: index,
          text: plain,
        } satisfies TranslationJob);
      })
      .catch((error) => {
        if (sequence.current === id) setMessage(`Translation unavailable: ${String(error)}`);
      });
    return () => {
      ++sequence.current;
      worker.current?.postMessage({ cancel: true });
    };
  }, [book, source, target, original, shown, text, next, key]);
  return {
    target,
    original,
    message,
    translated: target && !original && result?.key === key ? result.text : undefined,
    select: (language: string) => {
      setTarget(language);
      setOriginal(false);
    },
    toggle: () => setOriginal((value) => !value),
  };
}
