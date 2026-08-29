import { expect, test } from '@playwright/test';

/**
 * E2E smoke test — Sprint 2 scaffold.
 *
 * The full E2E suite (create / edit / delete / DnD + fallback move /
 * persistence across refresh / sorting / responsive viewports) is written in
 * Sprint 3. This spec only proves the Playwright harness is wired up: the app
 * boots, renders the header, and lays out all four columns.
 */
test.describe('Board smoke', () => {
  test('boots and renders the four columns', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Kanban Task Board' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Backlog' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'In Progress' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Blocked' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Done' })).toBeVisible();

    // Filters bar controls should be present and usable.
    await expect(page.getByLabel('Sort by')).toBeVisible();
    await expect(page.getByLabel('Filter by priority')).toBeVisible();
    await expect(page.getByLabel('Filter by status')).toBeVisible();

    // Empty board shows a hint in each column.
    await expect(page.getByText('No tasks — drag a card here or create one.').first()).toBeVisible();

    // No console / page errors on load.
    expect(errors).toEqual([]);
  });

  test('the "New task" control is present and focusable', async ({ page }) => {
    await page.goto('/');
    const newTask = page.getByRole('button', { name: '+ New task' });
    await expect(newTask).toBeVisible();
    await newTask.focus();
    await expect(newTask).toBeFocused();
  });
});
