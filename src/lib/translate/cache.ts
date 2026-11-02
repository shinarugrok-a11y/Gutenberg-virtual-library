// Separate from nightdesk.v1. Include source text to invalidate on repagination.
import type { TranslationJob } from "./models";
let database: Promise<IDBDatabase> | undefined;
function db() {
  return (database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("nightdesk.translation.v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("leaves");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}
function key(job: TranslationJob) {
  return JSON.stringify([job.book, job.source, job.target, job.leaf, job.text]);
}
export async function readLeaf(job: TranslationJob): Promise<string | undefined> {
  try {
    const database = await db();
    return await new Promise((resolve, reject) => {
      const request = database.transaction("leaves").objectStore("leaves").get(key(job));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return undefined;
  }
}
export async function writeLeaf(job: TranslationJob, text: string) {
  try {
    const database = await db();
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction("leaves", "readwrite");
      tx.objectStore("leaves").put(text, key(job));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    /* Storage may be unavailable or full; translation still works. */
  }
}
