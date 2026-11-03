import { useState } from "react";
import { answerBook } from "@/lib/ask";
import { useDesk } from "@/lib/desk-store";

export function AskPanel({
  bookId,
  title,
  pagesReady,
  pages,
  onGoto,
}: {
  bookId: number;
  title: string;
  pagesReady: boolean;
  pages: string[];
  onGoto: (leaf: number) => void;
}) {
  const [q, setQ] = useState("");
  const addQa = useDesk((s) => s.addQa);
  const turns = useDesk((s) => s.notes[String(bookId)]?.qa ?? []);

  return (
    <section className="ask panel">
      <p className="eyebrow">Quill</p>
      <h2 className="mt-1 text-2xl">Ask this book</h2>
      <p className="text-muted mt-2 text-sm">
        Quill stays on this device. It answers only with lines from {title}. Nothing is sent out, and it will not guess past the page.
      </p>
      <form
        className="mt-3 flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const question = q.trim();
          if (!question || !pagesReady) return;
          const answer = answerBook(question, pages, title);
          addQa(bookId, { q: question, lead: answer.lead, found: answer.found, passages: answer.passages, at: Date.now() });
          setQ("");
        }}
      >
        <input
          className="desk-field"
          value={q}
          placeholder={pagesReady ? "Who walks to Netherfield?" : "Wait until the pages are on the desk"}
          disabled={!pagesReady}
          onChange={(event) => setQ(event.target.value)}
          aria-label="Question for this book"
        />
        <button type="submit" className="desk-btn is-on" disabled={!pagesReady || !q.trim()}>
          Read for an answer
        </button>
      </form>
      <div className="mt-4 flex flex-col gap-3">
        {[...turns].reverse().map((turn, turnIndex) => (
          <article key={`${turn.at}-${turns.length - turnIndex}`} className="flex flex-col gap-2">
            <h3 className="text-lg">{turn.q}</h3>
            <p className="text-sm">{turn.lead}</p>
            {turn.passages.map((passage, passageIndex) => (
              <blockquote key={`${passage.page}-${passageIndex}`} className="passage text-sm">
                <p>Page {passage.page}. {passage.text}</p>
                <button type="button" className="desk-btn" onClick={() => onGoto(passage.page)}>
                  Turn to page {passage.page}
                </button>
              </blockquote>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}
