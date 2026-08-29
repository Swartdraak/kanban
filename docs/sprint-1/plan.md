# Sprint 1: Architecture & Project Plan — Kanban Task Board

Status: **Complete** (see `done.md`)
Owner: Remy (Producer)
Date: 2026-08-29

---

## 1. Architecture Plan

Keep it simple: a **static frontend SPA**. No backend, no build-time server logic.

```
┌──────────────────────────────────────────────┐
│                  UI Layer                     │
│  Board → Columns → Cards (vanilla DOM render) │
│  TaskModal (create/edit)  |  FiltersBar      │
├──────────────────────────────────────────────┤
│              State / Logic Layer              │
│  taskStore (pure TS: CRUD, move, sort,       │
│  filter, validation)                          │
├──────────────────────────────────────────────┤
│             Storage Layer (interface)         │
│  StorageAdapter                              │
│    └── LocalStorageAdapter (Sprint 2 impl.)  │
└──────────────────────────────────────────────┘
```

- **Unidirectional flow**: user action → taskStore mutates state (pure, testable) → adapter persists → UI re-renders.
- The storage layer is **abstracted behind a `StorageAdapter` interface** so `localStorage` can later be swapped for an API/database without touching UI or store logic.
- Drag-and-drop is implemented with the **HTML5 Drag-and-Drop API** (no library) and falls back to an explicit "Move to…" control on each card (required fallback per README) — this also makes the move mechanism testable without simulating pixels in E2E.

## 2. Tech Stack & Rationale

| Choice | Rationale |
|---|---|
| **TypeScript (plain, vanilla)** | Type safety for the data model (Task, Priority, Status); no framework runtime cost; small bundle. README asks for an appropriate stack with justification — minimal is defensible for a single-page, offline-capable tool. |
| **Vite** | Instant dev server (`npm run dev`), first-class TS support, trivial production build (`vite build` / preview). Satisfies "runs locally with clear startup steps" out of the box. |
| **HTML5 Drag-and-Drop API (vanilla)** | Zero-dependency DnD for the 4-column board. Fallback: per-card "Move to…" dropdown (keeps feature usable on touch, and E2E-testable). |
| **localStorage persistence (via `StorageAdapter`)** | Meets README requirement ("browser local storage" is explicitly allowed). Backend-less = nothing to host, survives refresh. |
| **Vitest** | Unit tests for the store/data layer (fast, TS-native, runs in CI with the Vite toolchain). |
| **Playwright** | E2E validation: create/edit/delete/move/persist-on-refresh/sorting/responsive — produces the evidence the README's validation criteria demand. |
| **No backend** | Persistence requirement is satisfied by localStorage; a server would add setup friction for no functional gain in Sprint 2. |

## 3. File / Folder Structure

```
kanban/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── playwright.config.ts
├── .github/workflows/ci.yml      # lint + typecheck + unit + build (+ e2e in Sprint 3)
├── docs/
│   ├── sprint-1/                 # this plan + done.md
│   ├── sprint-2/progress.md
│   └── sprint-3/validation-report.md
├── src/
│   ├── main.ts                   # bootstrap: load store, mount, DnD wiring
│   ├── types.ts                  # Task, Priority, Status, FilterState
│   ├── lib/
│   │   ├── taskStore.ts          # pure CRUD/move/sort/filter + validation
│   │   ├── storage.ts            # StorageAdapter interface + LocalStorageAdapter
│   │   └── validation.ts         # input sanitization / defensive checks
│   ├── components/
│   │   ├── Board.ts
│   │   ├── Column.ts
│   │   ├── TaskCard.ts
│   │   ├── TaskModal.ts          # create + edit form
│   │   └── FiltersBar.ts         # sort/filter controls
│   └── styles/
│       └── styles.css            # responsive layout (CSS grid/flex + media queries)
└── tests/
    ├── unit/
    │   ├── taskStore.test.ts
    │   ├── storage.test.ts
    │   └── validation.test.ts
    └── e2e/
        ├── board.spec.ts         # create/edit/delete/move
        ├── persistence.spec.ts   # survives refresh
        └── responsive.spec.ts    # desktop + mobile viewports
```

## 4. Data Model

```ts
type Priority = 'low' | 'medium' | 'high' | 'urgent';
type Status   = 'backlog' | 'in_progress' | 'blocked' | 'done';

interface Task {
  id: string;            // crypto.randomUUID()
  title: string;         // required, trimmed, max length enforced
  description: string;   // optional, sanitized
  priority: Priority;    // default 'medium'
  status: Status;        // default 'backlog'
  dueDate: string | null;// ISO date (YYYY-MM-DD) or null
  createdAt: string;     // ISO timestamp
  updatedAt: string;     // ISO timestamp
  completed: boolean;    // true when status === 'done'
}
```

- **Validation (defensive)**: title required & non-empty after trim (cap ~200 chars); description capped (~2000 chars); dueDate parsed with `Date` and rejected if invalid → stored as `null`; unknown priority/status values fall back to defaults on load; corrupted/stale localStorage JSON is caught and reset to `[]` with a console warning (never crash the app).
- `completed` is kept in sync with `status === 'done'` on every mutation.

## 5. Validation & Testing Plan

**Unit (Vitest)** — `taskStore` and adapters:
- create: valid task added; empty/whitespace title rejected; overlong title truncated/rejected
- edit: field updates bump `updatedAt`; invalid inputs ignored
- delete: removes task, no-op on missing id
- move: status transitions legal; `completed` synced for Done
- sort/filter: by priority (urgent→low), by due date (nulls last), by status
- storage: round-trip persist/load; corrupted JSON → returns `[]` (no throw)

**E2E (Playwright)** — against `vite preview`/dev server:
- Create a task via modal → appears in Backlog
- Edit title/description/priority/dueDate → changes persist
- Delete task → removed from board
- Drag card Backlog → In Progress (HTML5 DnD) and via "Move to…" fallback → column updates
- **Reload page → board state identical** (persistence proof)
- Sort by priority / due date → correct ordering
- Responsive: 375px mobile and 1440px desktop viewports render usable board

**Manual checklist** (also recorded in the Sprint 3 validation report): each README validation criterion 1–6 with expected vs actual result and steps to reproduce.

## 6. Sprint Breakdown

| Sprint | Scope |
|---|---|
| **1 (this doc)** | Architecture, stack rationale, structure, data model, testing plan. GitHub issues filed. |
| **2** | Full implementation: Vite+TS app, 4 columns, CRUD+move (DnD + fallback), priorities/descriptions/due dates, filtering/sorting, responsive UI, defensive validation, Vitest unit tests, GitHub Actions CI (lint + typecheck + unit + build). Docs in `docs/sprint-2/`. |
| **3** | QA: Playwright E2E suite (create/edit/delete/move/persist/responsive/sort), run, remediate failures (root cause → fix → re-run → record), produce `docs/sprint-3/validation-report.md` proving every README validation criterion. Final deliverables pass. |

## 7. Success Criteria

**Sprint 1 (done):** this plan exists; 5 tracking issues filed; plan reviewed against every README requirement — no requirement left unaddressed.

**Sprint 2 (Definition of Done):**
- `npm install && npm run dev` serves a working board locally
- All 4 columns present; create/edit/delete/move work; priorities, descriptions, due dates, mark-complete work
- Move via drag-and-drop **and** fallback control
- Filter/sort by priority **and** due date (and status)
- localStorage persistence; corrupted storage recovered gracefully
- Responsive at mobile + desktop widths
- Defensive input handling in place and unit-tested
- Vitest unit tests pass in CI; GitHub Actions green (lint, typecheck, unit, build)

**Sprint 3 (Definition of Done):**
- All Playwright E2E scenarios pass (`npm run test:e2e`)
- `docs/sprint-3/validation-report.md` documents expected vs actual for README validation criteria 1–6 with execution steps and any logs/screenshots
- Remediation loop applied to any findings; revalidation recorded
- README updated with setup/usage/architecture; all 5 deliverables present; all 5 README completion criteria verified
