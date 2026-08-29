# Sprint 2 — Progress & Decisions

Status: **Complete**
Owner: Dev Team (Nova / Sage / Milo)
Date: 2026-08-29

Sprint 2 delivers the full, feature-complete Kanban Task Board: a vanilla
TypeScript + Vite SPA with drag-and-drop, CRUD, priority/due-date handling,
sorting/filtering, and localStorage persistence — plus unit tests and CI.

---

## 1. What was built

**Scaffold & tooling**
- Vite + TypeScript project, `tsconfig` in **strict** mode (`noUnusedLocals`,
  `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`).
- ESLint 9 **flat config** (`eslint.config.js`) via `@eslint/js` +
  `typescript-eslint`. No `.eslintrc` — the project is ESM (`"type": "module"`),
  so the modern flat config is used.
- `package.json` scripts: `dev`, `build` (`tsc --noEmit && vite build`),
  `preview`, `test`, `test:watch`, `lint`, `typecheck`, `e2e`.
- `vite.config.ts` (build + preview + Vitest include), `playwright.config.ts`,
  `index.html` (references `/src/main.ts`), `.gitignore`, and a refreshed
  top-level `README.md` with setup/usage.

**Data layer (`src/lib/`)**
- `types.ts` — `Task`, `Priority`, `Status`, `STATUSES`/`PRIORITIES`, labels,
  `PRIORITY_RANK`, defaults, length caps, `STORAGE_KEY`.
- `storage.ts` — `StorageAdapter` interface + `LocalStorageAdapter`
  (key `kanban.tasks.v1`). `load()` never throws and returns `Task[] | null`;
  `save()` swallows quota/serialization errors; bad records are dropped
  individually.
- `validation.ts` — `normalizeTitle` (trim/collapse/200-cap),
  `normalizeDescription` (2000-cap), `normalizeDueDate` (ISO → validated,
  invalid → `null`), `normalizePriority`/`normalizeStatus` (coerce to
  defaults), `sanitizeTask` (full record), and `escapeHtml`.
- `taskStore.ts` — pure `TaskStore`: `createTask`, `updateTask`, `deleteTask`,
  `moveTask`, `setPriority`, `markComplete`, `clear`, `view(filters, sort)`,
  `getTask(s)`, `subscribe()`. Keeps `completed` synced with
  `status === 'done'` and bumps `updatedAt` on every mutation. Emits a
  `change` to subscribers on every state change (including no-op writes).
  Exports `comparator` + `FilterState`/`SortKey`/`SortDirection`.

**Components (`src/components/`)**
- `dom.ts` — `el()` DOM builder + `todayISO`/`isOverdue`/`formatDate` helpers.
- `Board.ts` — root: header + "New task", filters bar, 4 columns; wires all
  handlers to the store; subscribes for re-render; manages the modal lifecycle.
- `Column.ts` — a column with header + count and a drop-target body
  (dragover/dragleave/drop); renders its cards.
- `TaskCard.ts` — badge, title, description, due date (overdue highlighted),
  HTML5 drag, "Move to…" select, Edit/Complete/Delete, focus + keyboard support.
- `TaskModal.ts` — accessible create/edit `<dialog>` with a labelled form
  (title required, description, priority, column, due date).
- `FiltersBar.ts` — sort key/direction + priority/status filters + search +
  Clear.

**Styles (`src/styles/styles.css`)** — mobile-first, dark theme, design tokens,
priority badges, drop-target highlighting, `<dialog>` modal, responsive
breakpoints (1 col → 2 col @640 → 4 col @1024), `prefers-reduced-motion`.

**Tests**
- `tests/unit/storage.test.ts` — round-trip, corrupt JSON, non-array,
  sanitization drop, quota-save, corruption recovery.
- `tests/unit/validation.test.ts` — every normalize/sanitize/escape branch.
- `tests/unit/taskStore.test.ts` — create/edit/delete/move/sort/filter,
  `completed` sync, `updatedAt` bump, subscription, throw-safety.
- `tests/e2e/example.spec.ts` — Playwright smoke (boots, 4 columns, no
  console errors). Full E2E scenarios are Sprint 3's deliverable.

**Docs**
- `docs/sprint-2/progress.md` (this file).

---

## 2. Decisions & deviations

The planned stack (Vite + TS + vanilla DOM + HTML5 DnD + localStorage +
Vitest + Playwright, no backend) was used **as-is** — no structural changes.
- **ESLint 9 flat config** instead of the legacy `.eslintrc`: the project is
  ESM and ESLint 9 makes flat config the default. This is the expected,
  idiomatic setup, not a stack change.
- **CI shape**: the required pipeline is `npm ci → lint → typecheck
  (tsc --noEmit) → vitest run → vite build`. The `build` script is already
  `tsc --noEmit && vite build`, so the CI runs the **combined typecheck+build
  as one step** between `lint` and `vitest`. Every required check
  (typecheck, build, tests, lint) still executes; nothing is skipped.
- **Store emits on every write**, even when a write validates but no field
  changed (e.g. moving a card to its current column). The board re-render is
  idempotent, so this is cheap and keeps the event model simple and
  predictable. No-op operations with *no* matching task (e.g. deleting a
  missing id) do **not** emit or save.
- **Drag-and-drop**: the card is the draggable element (carries
  `data-task-id`); the column **body** is the drop target (keyed by
  `data-status`). Drop logic reads the id from `dataTransfer` with a
  `closest('[data-task-id]')` fallback. Column-level `dragover`/`dragleave`
  (rather than card-level) avoids flickering drop-target highlights when the
  pointer crosses card boundaries. The per-card "Move to…" select provides the
  keyboard/touch fallback required by the spec.
- **Overdue** = `dueDate < today` (local, `YYYY-MM-DD` lex compare). Done
  tasks are not flagged overdue.
- **Filters** (priority + status + search) are an explicit extra on top of the
  required **priority + due-date** sorting. The status filter works as a
  cross-column "show only tasks in column X" view (columns for other statuses
  render empty), which is the most useful semantics for a per-column board.
- **Safe DOM insertion**: all user-supplied strings go through
  `textContent` / `createTextNode` / `el({ text })`. `escapeHtml` exists and is
  unit-tested for the few places markup is needed; no raw user input is ever
  inserted via `innerHTML`.
- **Modal**: native `<dialog>` + `showModal()`; the first field is focused on
  `open`; Escape/backdrop fire `cancel` (preventDefault + explicit teardown)
  to guarantee the node is removed.

---

## 3. Test run summary

Commands and results (run on Node 20, Linux):

| Command | Result |
| ------- | ------ |
| `npm install` | ok — deps resolved |
| `npm run lint` | ok — 0 errors |
| `npx tsc --noEmit` | ok — strict, 0 errors |
| `npx vitest run` | **all tests pass** (storage + validation + taskStore) |
| `npm run build` | ok — `tsc --noEmit` + `vite build` → `dist/` |

The Playwright smoke spec is scaffolded but **not executed** here (browsers
are installed/run in Sprint 3's CI/E2E job); the unit + type + lint + build
checks that gate CI all pass.

Sprint 3 validation: 88/88 unit + 16/16 e2e passing — see docs/sprint-3/validation-report.md

---

## 4. Handoff for QA (Sprint 3)

- Write/expand the Playwright E2E suite against `npm run preview`:
  create → edit → delete → move (DnD **and** "Move to…") → complete →
  sort (priority/due date) → filter → **refresh persistence** → responsive
  (375px + 1440px).
- Verify corrupted-storage recovery: corrupt `kanban.tasks.v1` in DevTools,
  reload → empty board, no console errors, then create a task → recovers.
- Confirm no console errors on load (already asserted by the smoke test).
