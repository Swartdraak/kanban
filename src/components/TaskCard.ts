/**
 * TaskCard
 *
 * A single task rendered inside a column. Wires up:
 * - HTML5 drag-and-drop (the card is the draggable element)
 * - "Move to…" fallback select (keyboard + touch accessible)
 * - Edit / complete / delete actions
 * - Priority badge + due-date display (overdue highlighted)
 */
import {
  PRIORITY_LABELS,
  STATUSES,
  STATUS_LABELS,
  type Priority,
  type Status,
  type Task,
} from '../types.js';
import { el, formatDate, isOverdue } from './dom.js';

/** Wire-up the board needs to provide the card. */
export interface CardHandlers {
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onMove: (id: string, status: Status) => void;
  onComplete: (id: string, completed: boolean) => void;
}

/**
 * Build the DOM for a task card.
 *
 * @param task    task to render
 * @param handlers wiring provided by the board
 */
export function renderTaskCard(task: Task, handlers: CardHandlers): HTMLElement {
  const dueDate = task.dueDate;
  const overdue = isOverdue(dueDate);

  const card = el('article', {
    class: `task-card task-card--${task.priority}${task.completed ? ' is-completed' : ''}${overdue ? ' is-overdue' : ''}`,
    attrs: {
      draggable: 'true',
      'data-task-id': task.id,
      'data-status': task.status,
      tabindex: '0',
      role: 'button',
      'aria-label': buildAriaLabel(task),
    } as Record<string, string>,
  });

  // --- Priority badge ----------------------------------------------------
  const priorityBadge = el('span', {
    class: `badge badge--${task.priority}`,
    text: PRIORITY_LABELS[task.priority],
  });

  // --- Title + description ------------------------------------------------
  const titleEl = el('h3', { class: 'task-card__title', text: task.title });
  const descriptionEl =
    task.description.length > 0
      ? el('p', { class: 'task-card__description', text: task.description })
      : null;

  // --- Due date + completed indicator -------------------------------------
  const meta = el('div', { class: 'task-card__meta' });
  if (dueDate) {
    const due = el('time', {
      class: `task-card__due${overdue ? ' task-card__due--overdue' : ''}`,
      attrs: { datetime: dueDate } as Record<string, string>,
    });
      due.appendChild(el('span', { class: 'task-card__due-icon', text: overdue ? '⚠' : '📅' }));
      due.appendChild(el('span', { text: formatDate(dueDate) }));
      if (overdue) {
        due.appendChild(el('span', { class: 'task-card__due-label', text: 'Overdue' }));
      }
    meta.appendChild(due);
  }
  if (task.completed) {
    meta.appendChild(el('span', { class: 'task-card__completed', text: '✓ Done' }));
  }

  // --- Move-to fallback select -------------------------------------------
  const moveSelect = document.createElement('select');
  moveSelect.className = 'task-card__move';
  moveSelect.setAttribute('aria-label', `Move "${task.title}" to…`);
  for (const status of STATUSES) {
    const opt = document.createElement('option');
    opt.value = status;
    opt.textContent = STATUS_LABELS[status];
    if (status === task.status) opt.selected = true;
    moveSelect.appendChild(opt);
  }
  moveSelect.addEventListener('change', (event) => {
    const value = (event.target as HTMLSelectElement).value;
    // Normalize defensively so a corrupted value can't move the card nowhere.
    if ((STATUSES as readonly string[]).includes(value)) {
      handlers.onMove(task.id, value as Status);
    }
  });

  // --- Action buttons -----------------------------------------------------
  const editBtn = el('button', {
    class: 'task-card__action task-card__action--edit',
    text: 'Edit',
    attrs: { type: 'button', 'aria-label': `Edit "${task.title}"` } as Record<string, string>,
    listeners: {
      click: (event) => {
        event.stopPropagation();
        handlers.onEdit(task);
      },
    },
  });

  const completeBtn = el('button', {
    class: 'task-card__action task-card__action--complete',
    text: task.completed ? 'Reopen' : 'Complete',
    attrs: {
      type: 'button',
      'aria-label': task.completed ? `Reopen "${task.title}"` : `Mark "${task.title}" complete`,
      'aria-pressed': String(task.completed),
    } as Record<string, string>,
    listeners: {
      click: (event) => {
        event.stopPropagation();
        handlers.onComplete(task.id, !task.completed);
      },
    },
  });

  const deleteBtn = el('button', {
    class: 'task-card__action task-card__action--delete',
    text: 'Delete',
    attrs: { type: 'button', 'aria-label': `Delete "${task.title}"` } as Record<string, string>,
    listeners: {
      click: (event) => {
        event.stopPropagation();
        handlers.onDelete(task);
      },
    },
  });

  // --- Drag events --------------------------------------------------------
  // We attach dragstart/dragend on the card. The column (see Column.ts)
  // handles dragover/drop and reads the task id from `dataTransfer` (or, as a
  // fallback, from the dragged element's `data-task-id`).
  const markDragging = () => {
    // Double-rAF so the drag image (captured synchronously on dragstart) is
    // taken before the visual "lifting" class is applied.
    (globalThis as { requestAnimationFrame?: (cb: FrameRequestCallback) => number })
      .requestAnimationFrame?.(() => {
        (globalThis as { requestAnimationFrame?: (cb: FrameRequestCallback) => number })
          .requestAnimationFrame?.(() => card.classList.add('is-dragging'));
      });
  };

  card.addEventListener('dragstart', (event: DragEvent) => {
    if (!event.dataTransfer) return;
    event.dataTransfer.effectAllowed = 'move';
    // Some browsers require setData for a drag to start at all.
    event.dataTransfer.setData('text/plain', task.id);
    card.setAttribute('data-dragging', 'true');
    markDragging();
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('is-dragging');
    card.removeAttribute('data-dragging');
  });

  // Click → edit (with a stopPropagation so the column-body click doesn't
  // also fire). Keyboard: Enter/Space on the card opens the edit modal.
  card.addEventListener('click', (event) => {
    // If the click was on an inner control, let its handler win.
    if ((event.target as HTMLElement).closest('button,select,input,textarea')) return;
    handlers.onEdit(task);
  });
  card.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handlers.onEdit(task);
    }
  });

  // Visible focus ring for keyboard users: the card is focusable (tabindex=0)
  // and Enter/Space above opens the edit modal, so it must be discoverable.
  card.addEventListener('focus', () => card.classList.add('is-focused'));
  card.addEventListener('blur', () => card.classList.remove('is-focused'));

  // -- Compose the card body ------------------------------------------------
  const body = el('div', {
    class: 'task-card__body',
    children: [
      el('div', { class: 'task-card__header', children: [priorityBadge] }),
      titleEl,
      descriptionEl,
      meta,
    ],
  });

  const controls = el('div', {
    class: 'task-card__controls',
    children: [moveSelect, editBtn, completeBtn, deleteBtn],
  });

  card.append(body, controls);
  return card;
}

function buildAriaLabel(task: Task): string {
  const parts = [
    `Task: ${task.title}`,
    `Priority: ${PRIORITY_LABELS[task.priority as Priority]}`,
    `Status: ${STATUS_LABELS[task.status]}`,
  ];
  if (task.dueDate) parts.push(`Due: ${formatDate(task.dueDate)}`);
  if (task.completed) parts.push('Completed');
  return parts.join(', ');
}
