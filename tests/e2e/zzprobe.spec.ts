// NOTE (Remy, 2026-08-29): the exploratory debug probes the QA agent used
// while validating sort behavior were removed. All validated behavior now
// lives in kanban.spec.ts. This file is a documented skip marker only —
// a full `npm run e2e` run collects zero active cases from it.
import { test } from '@playwright/test';

test.skip('sort-direction probe retired — see kanban.spec.ts Sorting suite', () => {
  // intentionally empty — the probe has been folded into kanban.spec.ts
});
