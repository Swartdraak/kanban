/**
 * Column
 *
 * Renders a single board column: a header with title + count, a body that
 * is the drop target for HTML5 drag-and-drop, and a list of task cards.
 * The column's `data-status` is the drop destination for that status.
 */
import { STATUS_LABELS, type Status, type Task } from '../types.js';
import { renderTaskCard, type CardHandlers } from './TaskCard.js';
import { el } from './dom.js';

/** A column in the board. */
export interface ColumnSpec {
  status: Status;
  tasks: readonly Task[];
  handlers: CardHandlers;
  /** Whether this column is the currently-dragged-over destination. */
  isDropTarget?: boolean;
}

/**
 * Build the DOM for a column.
 *
 * @param spec    column contents — status, tasks, and card handlers
 */
export function renderColumn(spec: ColumnSpec): HTMLElement {
  const { status, tasks, handlers, isDropTarget } = spec;

  const column = el('section', {
    class: `board__column board__column--${status}${isDropTarget ? ' is-drop-target' : ''}`,
    attrs: {
      'data-status': status,
      'aria-labelledby': `column-header-${status}`,
    } as Record<string, string>,
  });

  // Header ---------------------------------------------------------------
  const header = el('header', {
    class: 'board__column-header',
    children: [
      el('h2', {
        class: 'board__column-title',
        id: `column-header-${status}`,
        text: STATUS_LABELS[status],
      }),
      el('span', {
        class: 'board__column-count',
        text: String(tasks.length),
        attrs: { 'aria-label': `${tasks.length} task${tasks.length === 1 ? '' : 's'}` } as Record<string, string>,
      }),
    ],
  });

  // Body (drop target) -----------------------------------------------------
  const body = el('div', {
    class: 'board__column-body',
    attrs: {
      role: 'list',
      'aria-label': `Tasks in ${STATUS_LABELS[status]}`,
      'data-status': status,
    } as Record<string, string>,
  });

  // Drop handling. We attach to the column body, NOT the cards, so a drag
  // that oscillates between cards and empty space inside the body does not
  // flicker drop-target highlights.
  let dragOverActive = false;
  const handleDragOver = (event: DragEvent) => {
    event.preventDefault(); // required to allow a drop
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    if (!dragOverActive) {
      dragOverActive = true;
      column.classList.add('is-drop-target');
    }
  };
  const handleDragLeave = (event: DragEvent) => {
    // Only clear if we actually left the column (not just moved to a child).
    const related = event.relatedTarget as Node | null;
    if (!related || !column.contains(related)) {
      dragOverActive = false;
      column.classList.remove('is-drop-target');
    }
  };
  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    dragOverActive = false;
    column.classList.remove('is-drop-target');

    const taskId =
      event.dataTransfer?.getData('text/plain') ||
      (event.target as Element | null)?.closest('[data-task-id]')?.getAttribute('data-task-id') ||
      '';
    if (taskId) {
      handlers.onMove(taskId, status);
    }
  };

  body.addEventListener('dragover', handleDragOver);
  body.addEventListener('dragleave', handleDragLeave);
  body.addEventListener('drop', handleDrop);

  // Cards ------------------------------------------------------------------
  if (tasks.length === 0) {
    body.appendChild(
      el('p', { class: 'board__column-empty', text: 'No tasks — drag a card here or create one.' }),
    );
  } else {
    for (const task of tasks) {
      const card = renderTaskCard(task, handlers);
      card.setAttribute('role', 'listitem');
      body.appendChild(card);
    }
  }

  column.append(header, body);
  return column;
}

/** Build the full board row (all four columns for a status). */
export function renderBoardRow(specs: ColumnSpec[]): HTMLElement {
  const row = el('div', { class: 'board__row' });
  for (const spec of specs) {
    row.appendChild(renderColumn(spec));
  }
  return row;
}
