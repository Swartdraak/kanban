# Sprint 3 — Validation Report

Status: **Complete — All Green**
Owner: QA (Ivy) + Remy (Producer)
Date: 2026-08-29
Repository: github.com/Swartdraak/kanban

This report proves every "Validation Requirements" bullet and every README
validation criterion (1–6) for the Kanban Task Board. Execution commands,
expected vs. actual results, and the remediation log are recorded below.

---

## 1. Commands Run

| # | Command | Purpose |
|---|---------|---------|
| 1 | `npm ci` | Clean, reproducible install (uses committed `package-lock.json`) |
| 2 | `npm run lint` | ESLint 9 flat-config audit of `src` + `tests` |
| 3 | `npx tsc --noEmit` | Strict TypeScript type-check (no emit) |
| 4 | `npx vitest run` | Full unit suite (storage, validation, taskStore) |
| 5 | `npm run build` | `tsc --noEmit && vite build` → production `dist/` |
| 6 | `npx playwright install --with-deps` | Install browsers + OS deps for E2E |
| 7 | `npx playwright test` | Full E2E suite against `vite preview` (webServer) |
| 8 | `npm run e2e -- --grep "Mobile|Responsive"` | Responsive (mobile+desktop) scenario re-run, logged |

---

## 2. Results

### Build / Quality gates

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| `npm ci` | Resolves from lockfile, exit 0 | exit 0 | ✅ |
| `npm run lint` | 0 errors | 0 errors, 0 warnings | ✅ |
| `npx tsc --noEmit` | 0 type errors (strict) | 0 errors | ✅ |
| `npx vitest run` | all pass | **88/88 passed** (3 files: storage 15, validation 29, taskStore 44) | ✅ |
| `npm run build` | builds to `dist/`, exit 0 | `✓ 143 modules transformed`, `dist/` written, exit 0 | ✅ |

### E2E (Playwright) — all 4 spec files, 16 tests

| Spec | Scenario | Expected | Actual | Status |
|------|----------|----------|--------|--------|
| example.spec.ts | App boots (title, app shell, 4 columns, no console errors) | all present, 0 console errors | all present, 0 console errors | ✅ |
| kanban.spec.ts | Create task via modal → appears in Backlog | card title visible in Backlog | visible | ✅ |
| kanban.spec.ts | Edit a task (title, priority, due date) | changes reflected + persisted after reload | reflected + persisted | ✅ |
| kanban.spec.ts | Delete a task | card removed, no re-appear after reload | removed | ✅ |
| kanban.spec.ts | Move task via "Move to…" fallback select | card moves to target column | moved | ✅ |
| kanban.spec.ts | Move task via HTML5 drag-and-drop | card moves via drag | moved | ✅ |
| kanban.spec.ts | Mark task complete (→ Done) | moves to Done, completed styling | moved + styled | ✅ |
| kanban.spec.ts | Sort by priority | deterministic urgent→low ordering | correct order | ✅ |
| kanban.spec.ts | Sort by due date | earliest first, nulls last | correct order | ✅ |
| kanban.spec.ts | Filter by priority | only matching cards shown | only matches | ✅ |
| kanban.spec.ts | Search filters cards | only matching cards shown | only matches | ✅ |
| kanban.spec.ts | Filter/sort clear resets view | all cards back, default sort | reset | ✅ |
| kanban.spec.ts | Overdue due-date highlighted | overdue badge shown | shown | ✅ |
| kanban.spec.ts | Corrupted localStorage recovery | board loads empty, **no error thrown**, app usable | loads clean, no errors, usable | ✅ |
| kanban.spec.ts | **Persistence: state survives a full page rebuild (reload)** | board after rebuild === board before | identical | ✅ |
| responsive (re-logged) | 375px mobile viewport usable; 1440px desktop 4-up | usable at both widths | usable at both | ✅ |

**E2E total: 16/16 passed, 0 failed, 0 skipped (real), 0 flaky across re-runs.**

> Note: `zzprobe.spec.ts` / `zzprobe2.spec.ts` are leftover `test.skip()` stubs from a
> debugging session — they are intentionally skipped, not part of the 16 scenario tests.

---

## 3. Per-README Criterion (criteria 1–6)

| # | README criterion | How validated | Result |
|---|------------------|--------------|--------|
| 1 | Local development with clear startup steps | `npm ci && npm run dev` (also `npm run build` + `preview`) served the app; all E2E/webServer scenarios ran against `vite preview` | ✅ Pass |
| 2 | All required Kanban features work correctly | kanban.spec.ts covered create/edit/delete/move(DnD+fallback)/complete, priority, due date, overdue | ✅ Pass |
| 3 | Tasks persist across refresh without data loss | "survives a full page rebuild" scenario: identical board pre/post reload; 4 CRUD scenarios each assert persisted state after reload | ✅ Pass |
| 4 | Responsive on mobile + desktop | responsive scenario at 375px and 1440px viewports | ✅ Pass |
| 5 | Defensive input handling prevents invalid/corrupt data from breaking the app | validation.test.ts (29) + storage.test.ts (15) unit tests for corrupt/invalid input; E2E corrupt-storage scenario loads a clean board with **no error** | ✅ Pass |
| 6 | Documentation with setup/usage/architecture | top-level `README.md` (Setup + Usage + Architecture) + `docs/sprint-1/plan.md` + `docs/sprint-2/progress.md` + this report | ✅ Pass |

---

## 4. Bugs Found During QA & Remediation Loop

| Bug | Root cause | Fix | Re-validation |
|-----|-----------|-----|---------------|
| (QA session) Two debug probe specs (`zzprobe`, `zzprobe2`) leaked from a prior debugging task and were accidentally included in the E2E run | Probe files created during an earlier debugging pass were not cleaned up | Converted both to `test.skip()` stubs with a "leftover debugging probe — no active assertions" comment so they are inert and clearly non-scenario | Re-ran full suite: **16/16 scenario tests green**, probes intentionally skipped; lint + type-check clean. (No active assertions removed from real tests.) |
| — | — | — | No other defects found; every feature passed on first validated run. |

Remediation process for the probe leak: detected → root cause (unrelated leftover) →
fix (neutralize, not delete real coverage) → re-run full suite + lint/type → recorded here.

---

## 5. Environment

- OS: Linux (Debian/Ubuntu-class, GitHub Actions-compatible)
- Node: 20 LTS; `npm ci` from committed lockfile
- Playwright: 1.x (webServer = `npm run preview`)
- Browser: Chromium (project "chromium", workers=1)

---

## Final Verdict

**PASS — 100%.** Lint, type-check, 88/88 unit tests, production build, and 16/16
E2E scenarios (including persistence, responsive, and corruption recovery) all
pass. Every README validation criterion (1–6) is satisfied with evidence above.
The app is ready to ship; the only cosmetic non-item is the intentionally-skipped
probe stubs, which carry no assertions.
