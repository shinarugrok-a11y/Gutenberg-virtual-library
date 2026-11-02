# Feature checklist (must stay green on every PR)
Automated in `tests/e2e/run.mjs`; manual items marked (m).
- Shelf: search, Borrowed/Title/Author/Genre/Newest sorts, language filter, Spin the dial
- Open a book; next/prev leaf; slider jump (m)
- Read aloud + rate (m); Ask panel (m); Animation toggle; Atmosphere; Skin/LCD (m); music player (m)
- Ink: pen/pencil/brush/marker/eraser/undo (m); ink survives reload + reopen (auto)
- Margin notes (m); Notes export; JSON export
- Translation: pick language, download, toggle back to original
- No console errors at 390, 768, 1366, 1920
- Visual diff vs `v0-live-baseline-2026-11-02` <= 2% pixels per screenshot unless the PR is explicitly visual
