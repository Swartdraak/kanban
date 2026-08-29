/**
 * Board
 *
 * The top-level component. It:
 * - subscribes to the store so any state change re-renders the board
 * - renders the header (+ "New task"), filters bar, and the four columns
 * - wires all card / column / modal / dialog handlers to the store
 *
 * The store is created by main.ts and passed in so the board stays testable
 * and the app's root can own the lifetime of the store + its adapter.
 */
import {
  STATUSES,
  type Status,
  type Task,
} from '../types.js';
import {
  DEFAULT_FILTERS,
  TaskStore,
  type FilterState,
  type SortDirection,
  type SortKey,
} from '../lib/taskStore.js';
import { renderColumn } from './Column.js';
import { renderFiltersBar } from './FiltersBar.js';
import { openTaskModal, type TaskFormValues } from './TaskModal.js';
import { el } from './dom.js';

export interface BoardOptions {
  store: TaskStore;
  /** Where the modal will be appended (defaults to `document.body`). */
  modalContainer?: HTMLElement;
}

/**
 * Mount the board into a root element.
 *
 * @param root    the container to render into (e.g. `#app`)
 * @param options the store + optional modal container
 *
 * @returns a `dispose()` function that unsubscribes the store; call it when
 *          the board is being torn down (SPA navigation, tests, etc.).
 */
export function mountBoard(root: HTMLElement, options: BoardOptions): { dispose: () => void } {
  const { store, modalContainer = document.body } = options;

  let filters: FilterState = { ...DEFAULT_FILTERS };
  let sortKey: SortKey = 'createdAt';
  let sortDirection: SortDirection = 'desc';
  let modalHandle: { close: () => void } | null = null;

  // Handlers the cards and columns call back into.
  const handlers = {
    onEdit: (task: Task) => {
      renderModalFor(task);
    },
    onDelete: (task: Task) => {
      // Confirmation dialog — the spec explicitly requires a confirmation.
      const confirmed =
        typeof window !== 'undefined' &&
        window.confirm(`Delete "${task.title}"? This cannot be undone.`);
      if (confirmed) {
        store.deleteTask(task.id);
      }
    },
    onMove: (id: string, status: Status) => {
      store.moveTask(id, status);
    },
    onComplete: (id: string, completed: boolean) => {
      store.markComplete(id, completed);
    },
  };

  function render() {
    const all = store.view(filters, { key: sortKey, direction: sortDirection });

    // Per-column view: only the tasks that are in that column AND pass the
    // current filters. (The status filter already narrows the whole set, so
    // columns with excluded statuses will be empty — by design.)
    const byStatus: Record<Status, Task[]> = {
      backlog: [],
      in_progress: [],
      blocked: [],
      done: [],
    };
    for (const task of all) byStatus[task.status].push(task);

    // Header -----------------------------------------------------------
    const header = el('header', {
      class: 'board__header',
      children: [
        el('div', {
          class: 'board__title-wrap',
          children: [
            el('h1', { class: 'board__title', text: 'Kanban Task Board' }),
            el('p', {
              class: 'board__subtitle',
              text: 'Create, organize, and track your work — right in the browser.',
            }),
          ],
        }),
        el('button', {
          class: 'btn btn--primary board__new-task',
          text: '+ New task',
          attrs: { type: 'button' } as Record<string, string>,
          listeners: {
            click: () => renderModalFor(null),
          },
        }),
      ],
    });

    // Filters ------------------------------------------------------------
    const filtersBar = renderFiltersBar({
      filters,
      sortKey,
      sortDirection,
      onSortChange: (key, direction) => {
        sortKey = key;
        sortDirection = direction;
        render();
      },
      onFilterChange: (next) => {
        filters = next;
        render();
      },
    });

    // Columns ------------------------------------------------------------
    const columns = el('div', { class: 'board__columns' });
    for (const status of STATUSES) {
      columns.appendChild(
        renderColumn({
          status,
          tasks: byStatus[status],
          handlers,
        }),
      );
    }

    // Mount ----------------------------------------------------------
    root.replaceChildren(header, filtersBar, columns);
  }

  function renderModalFor(existing: Task | null) {
    // Close any existing modal first.
    modalHandle?.close();

    modalHandle = openTaskModal(
      modalContainer,
      existing,
      {
        onSubmit: (values: TaskFormValues) => {
          if (existing) {
            // Editing: validate that a (possibly new) title is non-empty.
            const updated = store.updateTask(existing.id, values);
            if (!updated) {
              // An invalid title was submitted — re-open the modal so the
              // user sees the (unchanged) form.
              renderModalFor(existing);
            }
          } else {
            const created = store.createTask(values);
            if (!created) {
              // Empty title on create — re-open the modal.
              renderModalFor(null);
            }
          }
        },
      },
    );
  }

  // First render + subscribe for future re-renders.
  render();
  const unsubscribe = store.subscribe(render);

  return {
    dispose: () => {
      unsubscribe();
      modalHandle?.close();
    },
  };
}
