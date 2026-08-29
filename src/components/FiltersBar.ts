/**
 * FiltersBar
 *
 * A horizontal strip of controls above the board:
 * - sort key (created / priority / due date)
 * - sort direction (asc / desc)
 * - priority filter (all / urgent / high / medium / low)
 * - status filter (all / backlog / in_progress / blocked / done)
 * - search text (matches title + description)
 * - "Clear" button
 *
 * The bar does not own the state — it renders from a {@link FiltersState}
 * and emits `onSortChange` / `onFilterChange` callbacks.
 */
import {
  PRIORITIES,
  PRIORITY_LABELS,
  STATUSES,
  STATUS_LABELS,
  type Priority,
  type Status,
} from '../types.js';
import type { FilterState, SortDirection, SortKey } from '../lib/taskStore.js';
import { el } from './dom.js';

export type { FilterState } from '../lib/taskStore.js';

export interface FiltersBarSpec {
  filters: FilterState;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSortChange: (key: SortKey, direction: SortDirection) => void;
  onFilterChange: (next: FilterState) => void;
}

/** Build the DOM for the filters bar. */
export function renderFiltersBar(spec: FiltersBarSpec): HTMLElement {
  const { filters, sortKey, sortDirection, onSortChange, onFilterChange } = spec;

  const bar = el('div', { class: 'filters-bar' });

  // --- Sort key ---------------------------------------------------------
  const sortKeySelect = document.createElement('select');
  sortKeySelect.className = 'filters-bar__control';
  sortKeySelect.setAttribute('aria-label', 'Sort by');
  for (const [value, label] of [
    ['createdAt', 'Newest first'],
    ['priority', 'Priority'],
    ['dueDate', 'Due date'],
  ] as const) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    if (value === sortKey) opt.selected = true;
    sortKeySelect.appendChild(opt);
  }
  sortKeySelect.addEventListener('change', (event) => {
    const next = (event.target as HTMLSelectElement).value as SortKey;
    onSortChange(next, sortDirection);
  });
  bar.appendChild(buildLabeled('Sort by', sortKeySelect));

  // --- Sort direction ---------------------------------------------------
  const dirBtn = el('button', {
    class: 'filters-bar__control filters-bar__dir',
    text: sortDirection === 'asc' ? '↑ Ascending' : '↓ Descending',
    attrs: {
      type: 'button',
      'aria-label': 'Toggle sort direction',
      'aria-pressed': String(sortDirection === 'asc'),
    } as Record<string, string>,
    listeners: {
      click: () => {
        const next: SortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        onSortChange(sortKey, next);
      },
    },
  });
  bar.appendChild(buildLabeled(sortKey === 'createdAt' ? 'Order' : 'Direction', dirBtn));

  // --- Priority filter --------------------------------------------------
  const prioritySelect = document.createElement('select');
  prioritySelect.className = 'filters-bar__control';
  prioritySelect.setAttribute('aria-label', 'Filter by priority');
  const allP = document.createElement('option');
  allP.value = 'all';
  allP.textContent = 'All priorities';
  if (filters.priority === 'all') allP.selected = true;
  prioritySelect.appendChild(allP);
  for (const p of PRIORITIES) {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = PRIORITY_LABELS[p];
    if (filters.priority === p) opt.selected = true;
    prioritySelect.appendChild(opt);
  }
  prioritySelect.addEventListener('change', (event) => {
    const value = (event.target as HTMLSelectElement).value as Priority | 'all';
    onFilterChange({ ...filters, priority: value });
  });
  bar.appendChild(buildLabeled('Priority', prioritySelect));

  // --- Status filter ----------------------------------------------------
  const statusSelect = document.createElement('select');
  statusSelect.className = 'filters-bar__control';
  statusSelect.setAttribute('aria-label', 'Filter by status');
  const allS = document.createElement('option');
  allS.value = 'all';
  allS.textContent = 'All columns';
  if (filters.status === 'all') allS.selected = true;
  statusSelect.appendChild(allS);
  for (const s of STATUSES) {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = STATUS_LABELS[s];
    if (filters.status === s) opt.selected = true;
    statusSelect.appendChild(opt);
  }
  statusSelect.addEventListener('change', (event) => {
    const value = (event.target as HTMLSelectElement).value as Status | 'all';
    onFilterChange({ ...filters, status: value });
  });
  bar.appendChild(buildLabeled('Status', statusSelect));

  // --- Search ----------------------------------------------------------
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'filters-bar__control filters-bar__search';
  search.setAttribute('aria-label', 'Search tasks');
  search.placeholder = 'Search…';
  search.value = filters.search;
  search.addEventListener('input', (event) => {
    const value = (event.target as HTMLInputElement).value;
    onFilterChange({ ...filters, search: value });
  });
  bar.appendChild(buildLabeled('Search', search));

  // --- Clear ------------------------------------------------------------
  const clearBtn = el('button', {
    class: 'btn btn--ghost filters-bar__clear',
    text: 'Clear',
    attrs: { type: 'button' } as Record<string, string>,
    listeners: {
      click: () => {
        onFilterChange({ priority: 'all', status: 'all', search: '' });
        onSortChange('createdAt', 'desc');
      },
    },
  });
  bar.appendChild(clearBtn);

  return bar;
}

function buildLabeled(control: string, node: HTMLElement): HTMLElement {
  // A simple visually-hidden label keeps the control accessible without
  // taking layout space.
  const label = document.createElement('label');
  label.className = 'visually-hidden';
  label.textContent = control;
  // `for` requires an id; we set one here because each control is unique
  // within the bar.
  const id = `filters-${control.replace(/\s+/g, '-').toLowerCase()}`;
  label.setAttribute('for', id);
  node.id = id;
  return el('div', { class: 'filters-bar__item', children: [label, node] });
}
