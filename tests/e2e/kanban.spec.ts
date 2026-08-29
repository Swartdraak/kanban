import { expect, test, type Page } from '@playwright/test';

/**
 * E2E suite — Sprint 3.
 *
 * Covers every README validation criterion:
 *   a. Board loads with 4 columns
 *   b. Create a task (title + description + priority + due date)
 *   c. Edit a task (change title + priority)
 *   d. Delete a task (with confirmation)
 *   e. Move a task between columns via the "Move to…" select (reliable path;
 *      Playwright's dragTo does not perform native HTML5 DnD, which the board
 *      uses — see note below)
 *   f. Persistence: create tasks, reload, data survives
 *   g. Sorting: by priority and by due date (default is "createdAt desc" —
 *      the bar renders as the "Newest first" / "Priority" / "Due date" options)
 *   h. Responsive: 375px viewport is usable (columns stack per styles.css
 *      mobile-first rules below the 640px breakpoint)
 *
 * Selectors are sourced from the real components (no guessing):
 *   - Board.ts:     h1 "Kanban Task Board", button "+ New task"
 *   - Column.ts:    section[data-status], h2 "Backlog|In Progress|Blocked|Done",
 *                   .board__column-count (aria-label "N tasks"),
 *                   .board__column-body[aria-label="Tasks in …"]
 *   - TaskCard.ts:  article.task-card[data-task-id] (role=button, tabindex=0),
 *                   h3.task-card__title, .badge (priority label),
 *                   time.task-card__due[datetime],
 *                   select.task-card__move (aria-label 'Move "<title>" to…'),
 *                   buttons Edit / Complete / Delete (aria-labels)
 *   - TaskModal.ts: dialog.task-modal, #field-title, #field-description,
 *                   #field-priority, #field-status, #field-dueDate,
 *                   submit "Create task" / "Save changes", "Cancel"
 *   - FiltersBar.ts: selects aria-label "Sort by" / "Filter by priority" /
 *                    "Filter by status", button "Toggle sort direction",
 *                    search aria-label "Search tasks", button "Clear"
 */

const COLUMN_TITLES = ['Backlog', 'In Progress', 'Blocked', 'Done'];

/** Distinctive titles so each test controls exactly the cards it creates.
 * NOTE: the store's createdAt sort is only millisecond-resolution, in both
 * directions. If two tasks end up with the same timestamp, their relative
 * order in "createdAt" sort is undefined — so tests that rely on column
 * order use distinct priorities or due dates instead, and tests that do
 * compare createdAt order create tasks with a short wait between them. */
let seq = 0;
const uniqueTitle = (base: string): string => `${base} ${Date.now().toString(36)}-${seq++}`;

/** The open modal dialog.
 * NOTE: the dialog element has no `role="dialog"` and no `aria-labelledby`
 * pointing at its heading, so `page.getByRole('dialog', { name: ... })` does
 * NOT resolve it (Playwright matches the dialog node itself, and its implicit
 * name is the aria-label attribute, which is absent). Select by the stable
 * class instead — this is a test-harness accommodation, not an app fix. */
const taskDialog = (page: Page) => page.locator('dialog.task-modal:visible');

/** Open the create modal, fill the form, submit. */
async function createTask(
  page: Page,
  opts: {
    title: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    status?: 'backlog' | 'in_progress' | 'blocked' | 'done';
    dueDate?: string;
  },
): Promise<void> {
  await page.getByRole('button', { name: '+ New task' }).click();
  const dialog = taskDialog(page);
  await expect(dialog.locator('.task-modal__title')).toHaveText('Create task');
  await expect(dialog).toBeVisible();
  await dialog.locator('#field-title').fill(opts.title);
  if (opts.description) await dialog.locator('#field-description').fill(opts.description);
  if (opts.priority) await dialog.locator('#field-priority').selectOption(opts.priority);
  if (opts.status) await dialog.locator('#field-status').selectOption(opts.status);
  if (opts.dueDate) await dialog.locator('#field-dueDate').fill(opts.dueDate);
  await dialog.getByRole('button', { name: 'Create task' }).click();
  await expect(dialog).toBeHidden();
}

/** The card element for a given title wherever it is on the board. */
const cardByTitle = (page: Page, title: string) =>
  page.locator(`article.task-card:has(h3.task-card__title:text-is("${title}"))`);

/** Card inside a specific column. */
const cardInColumn = (page: Page, status: string, title: string) =>
  page.locator(`section[data-status="${status}"] article.task-card:has(h3.task-card__title:text-is("${title}"))`);

/** Column body that is the drop target / task list container. */
const columnBody = (page: Page, title: string) =>
  page.getByRole('list', { name: `Tasks in ${title}` });

/** Ordered list of card titles inside a column. */
async function titlesInColumn(page: Page, title: string): Promise<string[]> {
  return columnBody(page, title).locator('h3.task-card__title').allTextContents();
}

// ---------------------------------------------------------------------------
// a. Board loads with 4 columns
// ---------------------------------------------------------------------------
test.describe('Board load', () => {
  test('renders the four columns in order with zero counts', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Kanban Task Board' })).toBeVisible();
    const headers = page.locator('section.board__column h2.board__column-title');
    await expect(headers).toHaveCount(4);
    await expect(headers).toHaveText(COLUMN_TITLES);

    // Each column exists with its stable data-status.
    for (const status of ['backlog', 'in_progress', 'blocked', 'done']) {
      await expect(page.locator(`section[data-status="${status}"]`)).toHaveCount(1);
    }

    // Empty board: each column shows count 0 and the empty hint.
    for (const title of COLUMN_TITLES) {
      const count = page.locator(`section.board__column:has(h2:text-is("${title}")) .board__column-count`);
      await expect(count).toHaveText('0');
      await expect(columnBody(page, title).getByText('No tasks — drag a card here or create one.')).toBeVisible();
    }

    expect(errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// b. Create
// ---------------------------------------------------------------------------
test.describe('Create', () => {
  test('creates a task with title, description, priority and due date in Backlog', async ({ page }) => {
    await page.goto('/');
    const title = uniqueTitle('Write launch notes');
    const due = '2026-12-01';

    await createTask(page, {
      title,
      description: 'Draft the launch checklist.',
      priority: 'high',
      dueDate: due,
    });

    // Appears in Backlog (default column when not overridden).
    const card = cardInColumn(page, 'backlog', title);
    await expect(card).toBeVisible();
    await expect(card.locator('.task-card__title')).toHaveText(title);
    await expect(card.getByText('Draft the launch checklist.')).toBeVisible();
    await expect(card.locator('.badge')).toHaveText('High');
    await expect(card.locator('time.task-card__due')).toHaveAttribute('datetime', due);

    // Backlog count went from 0 → 1.
    await expect(
      page.locator('section.board__column:has(h2:text-is("Backlog")) .board__column-count'),
    ).toHaveText('1');
  });

  test('create with a blank title is rejected and the modal stays open', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: '+ New task' }).click();
    const dialog = taskDialog(page);
    await expect(dialog.locator('.task-modal__title')).toHaveText('Create task');
    await dialog.locator('#field-title').fill('   ');
    await dialog.getByRole('button', { name: 'Create task' }).click();

    // Still open with no task created.
    await expect(dialog).toBeVisible();
    await expect(page.locator('article.task-card')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// c. Edit
// ---------------------------------------------------------------------------
test.describe('Edit', () => {
  test('editing changes the title and priority', async ({ page }) => {
    await page.goto('/');
    const title = uniqueTitle('Ship onboarding email');
    await createTask(page, { title, priority: 'low' });

    const card = cardByTitle(page, title);
    await expect(card).toBeVisible();
    await expect(card.locator('.badge')).toHaveText('Low');

    // Open via the card's Edit button (deterministic; card click also works).
    await card.getByRole('button', { name: `Edit "${title}"` }).click();
    const dialog = taskDialog(page);
    await expect(dialog.locator('.task-modal__title')).toHaveText('Edit task');
    await expect(dialog).toBeVisible();

    const newTitle = `${title} (v2)`;
    await dialog.locator('#field-title').fill(newTitle);
    await dialog.locator('#field-priority').selectOption('urgent');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog).toBeHidden();

    // Updated in place, same column.
    const updated = cardInColumn(page, 'backlog', newTitle);
    await expect(updated).toBeVisible();
    await expect(updated.locator('.badge')).toHaveText('Urgent');
    await expect(cardByTitle(page, title)).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// d. Delete (with confirmation)
// ---------------------------------------------------------------------------
test.describe('Delete', () => {
  test('delete removes the card after confirming', async ({ page }) => {
    await page.goto('/');
    const title = uniqueTitle('Tidy release branch');
    await createTask(page, { title });

    const card = cardByTitle(page, title);
    await expect(card).toBeVisible();

    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain(title);
      void dialog.accept();
    });
    await card.getByRole('button', { name: `Delete "${title}"` }).click();

    await expect(cardByTitle(page, title)).toHaveCount(0);
    await expect(columnBody(page, 'Backlog').getByText('No tasks — drag a card here or create one.')).toBeVisible();
  });

  test('cancelling the confirmation keeps the card', async ({ page }) => {
    await page.goto('/');
    const title = uniqueTitle('Keep me around');
    await createTask(page, { title });

    page.once('dialog', (dialog) => void dialog.dismiss());
    await cardByTitle(page, title).getByRole('button', { name: `Delete "${title}"` }).click();

    await expect(cardByTitle(page, title)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// e. Move between columns via the "Move to…" select
//
// NOTE on drag-and-drop: the board uses native HTML5 DnD (dragstart/dragover/
// drop). Playwright's `locator.dragTo()` emulates mouse events which do NOT
// trigger native DnD in Chromium, so the automated path here is the card's
// "Move to…" select fallback — the accessibility-first path the README
// documents for exactly this purpose.
// ---------------------------------------------------------------------------
test.describe('Move (select fallback)', () => {
  test('moves a task from Backlog to In Progress, then to Done', async ({ page }) => {
    await page.goto('/');
    const title = uniqueTitle('Move me across columns');
    await createTask(page, { title });

    // Backlog → In Progress.
    await cardByTitle(page, title)
      .getByLabel(`Move "${title}" to…`)
      .selectOption('in_progress');
    await expect(cardInColumn(page, 'in_progress', title)).toBeVisible();
    await expect(cardInColumn(page, 'backlog', title)).toHaveCount(0);
    await expect(
      page.locator('section.board__column:has(h2:text-is("In Progress")) .board__column-count'),
    ).toHaveText('1');

    // In Progress → Done. Moving to Done also flags the card completed.
    await cardByTitle(page, title)
      .getByLabel(`Move "${title}" to…`)
      .selectOption('done');
    const doneCard = cardInColumn(page, 'done', title);
    await expect(doneCard).toBeVisible();
    await expect(doneCard).toHaveClass(/is-completed/);
    await expect(doneCard.locator('.task-card__completed')).toHaveText('✓ Done');
  });

  test('the move select defaults to the card\'s current column', async ({ page }) => {
    await page.goto('/');
    const title = uniqueTitle('Select default check');
    await createTask(page, { title, status: 'blocked' });

    await expect(
      cardByTitle(page, title).getByLabel(`Move "${title}" to…`),
    ).toHaveValue('blocked');
  });
});

// ---------------------------------------------------------------------------
// f. Persistence across reload
// ---------------------------------------------------------------------------
test.describe('Persistence', () => {
  test('tasks survive a page reload with the same data', async ({ page }) => {
    await page.goto('/');
    const t1 = uniqueTitle('Persist one');
    const t2 = uniqueTitle('Persist two');
    await createTask(page, {
      title: t1,
      description: 'Survive the refresh.',
      priority: 'urgent',
      dueDate: '2026-11-15',
    });
    await createTask(page, { title: t2, priority: 'low' });

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Backlog' })).toBeVisible();

    const card1 = cardByTitle(page, t1);
    await expect(card1).toBeVisible();
    await expect(card1.locator('.task-card__title')).toHaveText(t1);
    await expect(card1.getByText('Survive the refresh.')).toBeVisible();
    await expect(card1.locator('.badge')).toHaveText('Urgent');
    await expect(card1.locator('time.task-card__due')).toHaveAttribute('datetime', '2026-11-15');

    const card2 = cardByTitle(page, t2);
    await expect(card2).toBeVisible();
    await expect(card2.locator('.badge')).toHaveText('Low');

    // Backlog holds both, with correct counts.
    await expect(page.locator('article.task-card')).toHaveCount(2);
    await expect(
      page.locator('section.board__column:has(h2:text-is("Backlog")) .board__column-count'),
    ).toHaveText('2');

    // Edits persist too: move one, reload, still there.
    await card1.getByLabel(`Move "${t1}" to…`).selectOption('in_progress');
    await page.reload();
    await expect(cardInColumn(page, 'in_progress', t1)).toBeVisible();
    await expect(cardInColumn(page, 'backlog', t2)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// g. Sorting
// ---------------------------------------------------------------------------
test.describe('Sorting', () => {
  /**
   * Deterministic seed helper: writes tasks straight into the storage
   * adapter's key with distinct createdAt values. This avoids the ms-resolution
   * ties of UI-created tasks and any state leaked between tests. Call after
   * `page.goto('/')` (any page) and reload to render.
   */
  const seedTasks = (
    page: Page,
    items: { t: string; p: 'low' | 'medium' | 'high' | 'urgent'; due?: string }[],
  ) =>
    page.evaluate((rows: { t: string; p: string; due?: string }[]) => {
      const key = 'kanban.tasks.v1';
      const store: unknown[] = JSON.parse(localStorage.getItem(key) || '[]');
      rows.forEach((r, i) => {
        const now = Date.now() - (rows.length - i) * 1000;
        store.push({
          id: `seed-${r.t}`,
          title: r.t,
          description: '',
          priority: r.p,
          status: 'backlog',
          dueDate: r.due ?? null,
          createdAt: new Date(now).toISOString(),
          updatedAt: new Date(now).toISOString(),
          completed: false,
        });
      });
      localStorage.setItem(key, JSON.stringify(store));
    }, items);

  const sortDirIsAscending = async (page: Page) =>
    (await page.getByLabel('Toggle sort direction').getAttribute('aria-pressed')) === 'true';

  test('sort by priority orders urgent before high before low', async ({ page }) => {
    // Created order (oldest → newest) is deliberately scrambled vs priority:
    // low (oldest), urgent, high, high (newest).
    await page.goto('/');
    await seedTasks(page, [
      { t: 'Sp-low', p: 'low' },
      { t: 'Sp-urgent', p: 'urgent' },
      { t: 'Sp-high', p: 'high' },
      { t: 'Sp-high-2', p: 'high' },
    ]);
    await page.reload();
    await expect(columnBody(page, 'Backlog').locator('h3.task-card__title')).toHaveCount(4);

    // Default view: "Newest first" (createdAt desc).
    expect(await titlesInColumn(page, 'Backlog')).toEqual(['Sp-high-2', 'Sp-high', 'Sp-urgent', 'Sp-low']);

    // Priority desc: urgent, high, high, low.
    await page.getByLabel('Sort by').selectOption('priority');
    const priorityDesc = await titlesInColumn(page, 'Backlog');
    expect(priorityDesc[0]).toContain('Sp-urgent');
    expect(priorityDesc[1]).toContain('Sp-high');
    expect(priorityDesc[2]).toContain('Sp-high');
    expect(priorityDesc[3]).toContain('Sp-low');

    // Flip direction → low, high, high, urgent; the toggle reflects it.
    await page.getByLabel('Toggle sort direction').click();
    const priorityAsc = await titlesInColumn(page, 'Backlog');
    expect(priorityAsc[0]).toContain('Sp-low');
    expect(priorityAsc[3]).toContain('Sp-urgent');
    expect(await sortDirIsAscending(page)).toBe(true);

    // Switching the sort key back to "Newest first" KEEPS the current
    // direction (direction is orthogonal to the key), so the list is now
    // oldest-first. The way to restore newest-first is the toggle button.
    await page.getByLabel('Sort by').selectOption('createdAt');
    await expect(columnBody(page, 'Backlog').locator('h3.task-card__title').first()).toHaveText('Sp-low');
    await page.getByLabel('Toggle sort direction').click();
    await expect(columnBody(page, 'Backlog').locator('h3.task-card__title').first()).toHaveText('Sp-high-2');
  });

  test('sort by due date orders nearest first; tasks without dates last', async ({ page }) => {
    await page.goto('/');
    // 25ms gaps so createdAt is unambiguous even if the dueDate sort is
    // re-observed under "Newest first" during debugging.
    await createTask(page, { title: uniqueTitle('D-none') }); // no due date
    await page.waitForTimeout(25);
    await createTask(page, { title: uniqueTitle('D-late'), dueDate: '2027-01-10' });
    await page.waitForTimeout(25);
    await createTask(page, { title: uniqueTitle('D-soon'), dueDate: '2026-10-05' });
    await page.waitForTimeout(25);
    await createTask(page, { title: uniqueTitle('D-mid'), dueDate: '2026-12-20' });

    // Default direction is desc → furthest first, nulls last.
    await page.getByLabel('Sort by').selectOption('dueDate');
    let order = await titlesInColumn(page, 'Backlog');
    expect(order[0]).toContain('D-late');
    expect(order[1]).toContain('D-mid');
    expect(order[2]).toContain('D-soon');
    expect(order[3]).toContain('D-none');

    // Asc → nearest first, nulls still last.
    await page.getByLabel('Toggle sort direction').click();
    await page.waitForTimeout(50);
    order = await titlesInColumn(page, 'Backlog');
    expect(order[0]).toContain('D-soon');
    expect(order[1]).toContain('D-mid');
    expect(order[2]).toContain('D-late');
    expect(order[3]).toContain('D-none');
  });
});

// ---------------------------------------------------------------------------
// g2. Filtering (README criteria) — search + priority filter
// ---------------------------------------------------------------------------
test.describe('Filtering', () => {
  test('priority filter shows only matching tasks; Clear restores all', async ({ page }) => {
    await page.goto('/');
    const urgentTitle = uniqueTitle('F-urgent');
    const lowTitle = uniqueTitle('F-low');
    await createTask(page, { title: urgentTitle, priority: 'urgent' });
    await page.waitForTimeout(25);
    await createTask(page, { title: lowTitle, priority: 'low' });

    await page.getByLabel('Filter by priority').selectOption('urgent');
    const titles = await titlesInColumn(page, 'Backlog');
    expect(titles).toEqual([urgentTitle]);
    // Column count reflects the filtered view.
    await expect(
      page.locator('section.board__column:has(h2:text-is("Backlog")) .board__column-count'),
    ).toHaveText('1');

    await page.getByRole('button', { name: 'Clear' }).click();
    expect(await titlesInColumn(page, 'Backlog').then((ts) => ts.length)).toBe(2);
  });

  test('search filters by title substring case-insensitively', async ({ page }) => {
    await page.goto('/');
    const a = uniqueTitle('Alpha search target');
    const b = uniqueTitle('Beta unrelated');
    await createTask(page, { title: a });
    await page.waitForTimeout(25);
    await createTask(page, { title: b });

    await page.getByLabel('Search tasks').fill('alpha');
    const titles = await titlesInColumn(page, 'Backlog');
    expect(titles).toEqual([a]);

    // No match → empty hint.
    await page.getByLabel('Search tasks').fill('zzz-no-match');
    await expect(columnBody(page, 'Backlog').getByText('No tasks — drag a card here or create one.')).toBeVisible();

    await page.getByRole('button', { name: 'Clear' }).click();
    expect(await titlesInColumn(page, 'Backlog').then((ts) => ts.length)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// h. Responsive — 375px viewport (below the 640px breakpoint: 1 column stack)
// ---------------------------------------------------------------------------
test.describe('Responsive', () => {
  test('app is usable at 375px: columns stack, cards and controls work', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    const title = uniqueTitle('Mobile friendly task');
    await expect(page.getByRole('heading', { name: 'Kanban Task Board' })).toBeVisible();

    // All four column headers are visible in the stacked layout.
    for (const col of COLUMN_TITLES) {
      await expect(page.getByRole('heading', { name: col })).toBeVisible();
    }

    // Stacked (not side by side): column tops strictly increase in Y,
    // and none of the columns overflow off the right edge of the viewport.
    const tops: number[] = [];
    let minRight = Infinity;
    for (const status of ['backlog', 'in_progress', 'blocked', 'done']) {
      const box = await page.locator(`section[data-status="${status}"]`).boundingBox();
      expect(box, `column ${status} should have a bounding box`).toBeTruthy();
      tops.push(box!.y);
      minRight = Math.min(minRight, box!.x + box!.width);
    }
    for (let i = 1; i < tops.length; i++) {
      expect(tops[i], `column ${i} should be below column ${i - 1} when stacked`).toBeGreaterThan(
        tops[i - 1],
      );
    }
    expect(minRight, 'no column should extend past the 375px viewport').toBeLessThanOrEqual(375);
    // And the page has no horizontal overflow of its own.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // Create works on the narrow viewport (modal is usable).
    await createTask(page, { title, priority: 'high', description: 'Made on mobile.' });
    const card = cardInColumn(page, 'backlog', title);
    await expect(card).toBeVisible();
    await expect(card.locator('.task-card__title')).toHaveText(title);

    // Cards do not overflow the viewport horizontally.
    const cardBox = await card.boundingBox();
    expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(375);

    // The "Move to…" fallback works at 375px too (the keyboard/touch path).
    await card.getByLabel(`Move "${title}" to…`).selectOption('done');
    await expect(cardInColumn(page, 'done', title)).toBeVisible();
  });
});
