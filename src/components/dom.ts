/**
 * Tiny helpers for building the board's DOM without a framework.
 *
 * `el()` creates and configures an element from a simple description object:
 * tag, optional class(es), data attributes, aria attributes, text content,
 * child nodes, and event listeners. It is intentionally small — the goal is
 * readable, testable DOM construction, not a mini templating engine.
 */

/** Attribute map: keys prefixed with `data-` or `aria-` go to setAttribute. */
export interface ElOptions<T extends HTMLElement = HTMLElement> {
  class?: string;
  text?: string;
  html?: string;
  /** Element id (mapped to the `id` attribute). */
  id?: string;
  attrs?: Record<string, string | null | undefined>;
  /** Children; `null` entries are skipped (useful for conditional nodes). */
  children?: Array<Node | null | (() => Node)>;
  listeners?: { [K in keyof HTMLElementEventMap]?: EventListenerOrEventListenerObject } &
    Record<string, EventListenerOrEventListenerObject>;
  ref?: (node: T) => void;
}

/**
 * Create an element.
 *
 * @example
 * const btn = el('button', {
 *   class: 'btn',
 *   text: 'Save',
 *   listeners: { click: () => save() },
 * });
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options?: ElOptions<HTMLElementTagNameMap[K]>,
): HTMLElementTagNameMap[K];
export function el(tag: string, options?: ElOptions): HTMLElement;
export function el(tag: string, options: ElOptions = {}): HTMLElement {
  const node = document.createElement(tag);

  if (options.class) {
    const classes = options.class.split(/\s+/).filter(Boolean);
    if (classes.length > 0) node.className = classes.join(' ');
  }

  if (options.id !== undefined) {
    node.id = options.id;
  }

  if (options.text !== undefined) {
    // `text` and `html` are mutually exclusive; text wins for safety.
    node.textContent = options.text;
  } else if (options.html !== undefined) {
    // Only ever used for static, non-user markup in this codebase.
    node.innerHTML = options.html;
  }

  if (options.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) {
      if (value === null || value === undefined) {
        node.removeAttribute(key);
      } else {
        node.setAttribute(key, String(value));
      }
    }
  }

  if (options.children) {
    for (const child of options.children) {
      if (child === null) continue;
      const resolved = typeof child === 'function' ? child() : child;
      node.appendChild(resolved);
    }
  }

  if (options.listeners) {
    for (const [eventName, listener] of Object.entries(options.listeners)) {
      if (listener) {
        node.addEventListener(eventName, listener as EventListenerOrEventListenerObject);
      }
    }
  }

  if (options.ref) {
    options.ref(node as HTMLElement);
  }

  return node;
}

/**
 * Return today's date as a YYYY-MM-DD string in the user's local timezone.
 * Used to decide whether a task's dueDate is overdue.
 */
export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** True when `dueDate` (YYYY-MM-DD) is earlier than today (local). */
export function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  // ISO YYYY-MM-DD strings compare lexicographically in chronological order.
  return dueDate < todayISO();
}

/** Render an ISO date (YYYY-MM-DD) as a human string in the local timezone. */
export function formatDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
