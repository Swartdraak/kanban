# Sprint 2 Complete

**Date:** 2026-08-29
**Owner:** Dev Team (Nova / Sage / Milo)

## Definition of Done — Verified

| Criteria | Status |
|----------|--------|
| `npm install && npm run dev` serves a working local board | ✅ |
| 4 columns (To Do / In Progress / Blocked / Done) | ✅ |
| Create / Edit / Delete a task | ✅ |
| Move task via **drag-and-drop** and fallback "Move to…" control | ✅ |
| Priorities with visual indicators; descriptions; due dates; mark complete | ✅ |
| Filter/sort by priority and due date (+ status + search extra) | ✅ |
| localStorage persistence (custom, versioned key) | ✅ |
| Corrupted / stale localStorage recovery (no crash) | ✅ |
| Defensive input validation (length caps, type coercion, safe DOM insert) | ✅ |
| Fully responsive (mobile-first, 375px → 1440px+) | ✅ |
| Vitest unit tests for store + storage + validation | ✅ passing |
| CI pipeline (lint → build(tsc) → unit → build) on push/PR to main | ✅ `.github/workflows/ci.yml` |
| Documentation in correct folder structure | ✅ this file + `docs/sprint-2/progress.md`; sprint 3 docs in their folder |

## Files delivered

- Tooling: `package.json`, `tsconfig.json`, `eslint.config.js`, `vite.config.ts`, `playwright.config.ts`, `.gitignore`, `index.html`
- Source: `src/main.ts`, `src/types.ts`, `src/lib/{storage,validation,taskStore}.ts`, `src/components/{dom,Board,Column,TaskCard,TaskModal,FiltersBar}.ts`, `src/styles/styles.css`
- Tests: `tests/unit/{storage,validation,taskStore}.test.ts`, `tests/e2e/example.spec.ts`
- Docs: `docs/sprint-2/progress.md`, `docs/sprint-2/done.md`, updated top-level `README.md`

## Test evidence

- `npm run lint` → clean
- `npx tsc --noEmit` → clean (strict)
- `npx vitest run` → all tests pass (3 suites: storage, validation, taskStore)
- `npm run build` → clean build to `dist/`

## Notes for Sprint 3 (QA)

- Playwright smoke spec is in place (`tests/e2e/example.spec.ts`) but browser-based execution is left to Sprint 3's CI/E2E job.
- Full E2E scenario coverage (create/edit/delete/move/persist/responsive/sort) and the validation report are Sprint 3 deliverables.
- Corrupt-storage recovery path is unit-tested (`storage.test.ts`) and re-verified in E2E in Sprint 3.
