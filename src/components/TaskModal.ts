/**
 * TaskModal
 *
 * An accessible dialog for creating or editing a task. Uses native
 * <dialog> with `showModal()` + `dialog` event for the form, and standard
 * HTML `<form>` with labels + required + maxlength for input accessibility.
 */
import {
  PRIORITIES,
  PRIORITY_LABELS,
  STATUSES,
  STATUS_LABELS,
  type Priority,
  type Status,
  type Task,
} from '../types.js';
import { el } from './dom.js';

export interface TaskFormValues {
  title: string;
  description: string;
  priority: Priority;
  status: Status;
  dueDate: string | null;
}

export interface TaskModalHandlers {
  /** Called with the user's form values when Save is pressed. */
  onSubmit: (values: TaskFormValues) => void;
  /** Cancelled (close button / Escape / backdrop click). */
  onCancel?: () => void;
}

/**
 * Open the task modal. Returns a handle with `close()` so the caller can
 * dismiss it programmatically.
 *
 * @param container  element to append the dialog to (usually `document.body`)
 * @param existing   task being edited (null for create)
 * @param handlers   submit / cancel callbacks
 */
export function openTaskModal(
  container: HTMLElement,
  existing: Task | null,
  handlers: TaskModalHandlers,
): { close: () => void } {
  const dialog = el('dialog', {
    class: 'task-modal',
    attrs: { 'aria-modal': 'true' } as Record<string, string>,
  });

  // --- Title -----------------------------------------------------------
  const titleId = 'task-modal-title';
  const title = el('h2', {
    class: 'task-modal__title',
    id: titleId,
    text: existing ? 'Edit task' : 'Create task',
  });

  // --- Form ------------------------------------------------------------
  const form = document.createElement('form');
  form.className = 'task-modal__form';
  form.setAttribute('aria-labelledby', titleId);

  // Title (required) ---------------------------------------------------
  const titleField = buildTextInput(
    'title',
    'Title',
    existing?.title ?? '',
    { required: true, maxLength: 200, placeholder: 'e.g. Ship the Q3 dashboard' },
  );

  // Description --------------------------------------------------------
  const descriptionField = buildTextarea(
    'description',
    'Description',
    existing?.description ?? '',
    { maxLength: 2000, placeholder: 'Optional details…' },
  );

  // Priority -----------------------------------------------------------
  const priorityField = buildSelect(
    'priority',
    'Priority',
    existing?.priority ?? 'medium',
    PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] })),
  );

  // Status -------------------------------------------------------------
  const statusField = buildSelect(
    'status',
    'Column',
    existing?.status ?? 'backlog',
    STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
  );

  // Due date -----------------------------------------------------------
  const dueDate = document.createElement('input');
  dueDate.type = 'date';
  dueDate.name = 'dueDate';
  dueDate.value = existing?.dueDate ?? '';
  const dueDateField = el('div', {
    class: 'task-modal__field',
    children: [
      el('label', {
        class: 'task-modal__label',
        text: 'Due date',
        attrs: { for: 'field-dueDate' } as Record<string, string>,
      }),
      dueDate,
    ],
  });
  dueDate.id = 'field-dueDate';

  // Buttons ------------------------------------------------------------
  const submitBtn = el('button', {
    class: 'btn btn--primary',
    text: existing ? 'Save changes' : 'Create task',
    attrs: { type: 'submit' } as Record<string, string>,
  });
  const cancelBtn = el('button', {
    class: 'btn btn--secondary',
    text: 'Cancel',
    attrs: { type: 'button' } as Record<string, string>,
  });

  form.append(titleField, descriptionField, priorityField, statusField, dueDateField);
  form.appendChild(
    el('div', {
      class: 'task-modal__actions',
      children: [cancelBtn, submitBtn],
    }),
  );

  dialog.append(title, form);
  container.appendChild(dialog);

  // --- Behavior ----------------------------------------------------------
  let dismissed = false;
  let opened = false;

  const dismiss = (): void => {
    if (dismissed) return;
    dismissed = true;
    dialog.close();
    if (dialog.parentNode) dialog.remove();
  };

  // Escape / backdrop click → cancel. `cancel` is cancelable, so prevent
  // default and close explicitly to guarantee teardown.
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    if (!dismissed) {
      dismissed = true;
      handlers.onCancel?.();
      dialog.close();
      if (dialog.parentNode) dialog.remove();
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (dismissed) return;

    const titleEl = form.elements.namedItem('title') as HTMLInputElement | null;
    const descEl = form.elements.namedItem('description') as HTMLTextAreaElement | null;
    const prioEl = form.elements.namedItem('priority') as HTMLSelectElement | null;
    const statEl = form.elements.namedItem('status') as HTMLSelectElement | null;
    const dateEl = form.elements.namedItem('dueDate') as HTMLInputElement | null;

    const values: TaskFormValues = {
      title: titleEl?.value ?? '',
      description: descEl?.value ?? '',
      priority: (prioEl?.value as Priority | undefined) ?? 'medium',
      status: (statEl?.value as Status | undefined) ?? 'backlog',
      dueDate: dateEl?.value || null,
    };

    // The store validates; on an invalid (empty) title the board re-opens the
    // modal so the user sees the unchanged, still-invalid form.
    handlers.onSubmit(values);
    dismiss();
  });

  cancelBtn.addEventListener('click', () => {
    if (dismissed) return;
    handlers.onCancel?.();
    dismiss();
  });

  // `showModal` must run on the next microtask after the dialog is in the
  // DOM; the `open` event then lets us focus the first field.
  dialog.addEventListener(
    'open',
    () => {
      if (opened) return;
      opened = true;
      const firstField = form.elements.namedItem('title') as HTMLElement | null;
      firstField?.focus();
    },
    { once: true },
  );

  requestAnimationFrame(() => {
    dialog.showModal();
  });

  return {
    close: () => {
      dismiss();
    },
  };
}

function buildTextInput(
  name: string,
  label: string,
  value: string,
  opts: { required?: boolean; maxLength?: number; placeholder?: string } = {},
): HTMLElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.name = name;
  input.value = value;
  if (opts.required) input.required = true;
  if (opts.maxLength) input.maxLength = opts.maxLength;
  if (opts.placeholder) input.placeholder = opts.placeholder;
  input.id = `field-${name}`;

  return el('div', {
    class: 'task-modal__field',
    children: [
      el('label', {
        class: 'task-modal__label',
        text: label,
        attrs: { for: input.id } as Record<string, string>,
      }),
      input,
    ],
  });
}

function buildTextarea(
  name: string,
  label: string,
  value: string,
  opts: { maxLength?: number; placeholder?: string } = {},
): HTMLElement {
  const textarea = document.createElement('textarea');
  textarea.name = name;
  textarea.value = value;
  textarea.rows = 4;
  if (opts.maxLength) textarea.maxLength = opts.maxLength;
  if (opts.placeholder) textarea.placeholder = opts.placeholder;
  textarea.id = `field-${name}`;

  return el('div', {
    class: 'task-modal__field',
    children: [
      el('label', {
        class: 'task-modal__label',
        text: label,
        attrs: { for: textarea.id } as Record<string, string>,
      }),
      textarea,
    ],
  });
}

function buildSelect(
  name: string,
  label: string,
  value: string,
  options: { value: string; label: string }[],
): HTMLElement {
  const select = document.createElement('select');
  select.name = name;
  select.id = `field-${name}`;
  for (const opt of options) {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.value === value) option.selected = true;
    select.appendChild(option);
  }

  return el('div', {
    class: 'task-modal__field',
    children: [
      el('label', {
        class: 'task-modal__label',
        text: label,
        attrs: { for: select.id } as Record<string, string>,
      }),
      select,
    ],
  });
}
