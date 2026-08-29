/**
 * Pure, unit-testable task store.
 *
 * Design notes
 * - The store is the single source of truth for the board's task list.
 * - All mutations go through the store, so `completed` stays in sync with
 *   `status === 'done'` and `updatedAt` is bumped on every write.
 * - The store is UI-agnostic: it exposes state + a `subscribe()` for re-render
 *   and emits a `change` event on every state change (including no-ops that
 *   do not actually mutate a task — the subscriber is cheap and idempotent).
 * - Persistence: every mutation that changes a task writes through the
 *   `StorageAdapter`. `load()` pulls from the adapter on construction.
 */
import { type Priority, type Status, type Task } from '../types.js';
import type { StorageAdapter } from './storage.js';
import {
  normalizeDescription,
  normalizeDueDate,
  normalizePriority,
  normalizeStatus,
  normalizeTitle,
  sanitizeTask,
} from './validation.js';

/** Input shape for `createTask`. `id`/timestamps/completed are store-owned. */
export interface NewTaskInput {
  title: string;
  description?: string;
  priority?: Priority;
  status?: Status;
  dueDate?: string | null;
}

/** Input shape for `updateTask` — all fields optional; missing = no change. */
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  priority?: Priority;
  status?: Status;
  dueDate?: string | null;
}

export type SortKey = 'createdAt' | 'priority' | 'dueDate';
export type SortDirection = 'asc' | 'desc';

/** FilterState drives the view, not the underlying data. */
export interface FilterState {
  /** Tasks whose priority is not in the set (or set empty) are hidden. */
  priority: Priority | 'all';
  /** Tasks in a status not in the set are hidden (cross-column search). */
  status: Status | 'all';
  /** Case-insensitive substring match over title + description. */
  search: string;
}

export const DEFAULT_FILTERS: FilterState = {
  priority: 'all',
  status: 'all',
  search: '',
};

/**
 * TaskStore
 *
 * Events: emits `'change'` on every state change so the board (and any
 * number of other listeners) can re-render.
 */
export class TaskStore {
  private tasks: Task[];
  private readonly listeners = new Set<() => void>();
  private readonly onTaskMutation = (): void => {
    // Persist the current state on every write.
    this.adapter.save(this.tasks);
  };

  constructor(private readonly adapter: StorageAdapter) {
    const loaded = this.safeLoad();
    this.tasks = loaded.map((t) => ({ ...t, completed: t.status === 'done' }));
  }

  /** Read-only snapshot of the task list (defensively copied). */
  getTasks(): readonly Task[] {
    return this.tasks;
  }

  /** Find a single task by id. */
  getTask(id: string): Task | undefined {
    return this.tasks.find((t) => t.id === id);
  }

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Create a new task. Returns the created task, or null when invalid. */
  createTask(input: NewTaskInput): Task | null {
    const title = normalizeTitle(input.title);
    if (title === null) return null;

    const now = new Date().toISOString();
    const status = normalizeStatus(input.status);
    const task: Task = {
      id: newId(),
      title,
      description: normalizeDescription(input.description ?? ''),
      priority: normalizePriority(input.priority),
      status,
      dueDate: normalizeDueDate(input.dueDate ?? null),
      createdAt: now,
      updatedAt: now,
      completed: status === 'done',
    };

    this.tasks = [...this.tasks, task];
    this.onTaskMutation();
    this.emitChange();
    return { ...task };
  }

  /** Update an existing task. Returns the updated task, or null when invalid. */
  updateTask(id: string, input: UpdateTaskInput): Task | undefined {
    const existing = this.getTask(id);
    if (!existing) return undefined;

    // Title is the only field that can invalidate the whole update: if the
    // caller passes a title and it is empty after normalization, drop it.
    let title = existing.title;
    if (input.title !== undefined) {
      const t = normalizeTitle(input.title);
      if (t === null) return undefined;
      title = t;
    }

    const now = new Date().toISOString();
    const updated: Task = {
      ...existing,
      title,
      description:
        input.description !== undefined
          ? normalizeDescription(input.description)
          : existing.description,
      priority:
        input.priority !== undefined ? normalizePriority(input.priority) : existing.priority,
      status: input.status !== undefined ? normalizeStatus(input.status) : existing.status,
      dueDate:
        input.dueDate !== undefined
          ? normalizeDueDate(input.dueDate)
          : existing.dueDate,
      updatedAt: now,
    };
    // Keep `completed` canonical regardless of which fields changed.
    updated.completed = updated.status === 'done';

    this.tasks = this.tasks.map((t) => (t.id === id ? updated : t));
    this.onTaskMutation();
    this.emitChange();
    return { ...this.getTask(id)! };
  }

  /** Delete a task. Returns true if a task was actually removed. */
  deleteTask(id: string): boolean {
    const before = this.tasks.length;
    this.tasks = this.tasks.filter((t) => t.id !== id);
    const removed = this.tasks.length < before;
    if (removed) {
      this.onTaskMutation();
      this.emitChange();
    }
    return removed;
  }

  /** Move a task to a new status. Returns the moved task, or undefined. */
  moveTask(id: string, status: Status): Task | undefined {
    return this.updateTask(id, { status });
  }

  /** Set the priority of a task. */
  setPriority(id: string, priority: Priority): Task | undefined {
    return this.updateTask(id, { priority });
  }

  /** Mark complete (status -> done) or incomplete (status -> backlog). */
  markComplete(id: string, completed: boolean): Task | undefined {
    return this.updateTask(id, { status: completed ? 'done' : 'backlog' });
  }

  /**
   * View helper — returns tasks filtered and sorted per `filters`/`sort`.
   * This does NOT mutate state; the store keeps the raw list intact.
   */
  view(filters: FilterState = DEFAULT_FILTERS, sort: { key: SortKey; direction: SortDirection } = { key: 'createdAt', direction: 'desc' }): readonly Task[] {
    const search = filters.search.trim().toLowerCase();
    const filtered = this.tasks.filter((t) => {
      if (filters.priority !== 'all' && t.priority !== filters.priority) return false;
      if (filters.status !== 'all' && t.status !== filters.status) return false;
      if (search.length > 0) {
        const haystack = `${t.title} ${t.description}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
    return filtered.sort(comparator(sort));
  }

  /** Clear the entire board. Emits change + persists. */
  clear(): void {
    if (this.tasks.length === 0) return;
    this.tasks = [];
    this.onTaskMutation();
    this.emitChange();
  }

  private safeLoad(): Task[] {
    try {
      const loaded = this.adapter.load();
      if (!loaded) return [];
      // Re-sanitize on load so one broken record can't poison the board.
      return loaded.filter((t): t is Task => {
        const s = sanitizeTask(t);
        return s !== null && s.id === t.id;
      });
    } catch {
      return [];
    }
  }

  private emitChange(): void {
    // Iterate over a copy so listeners can unsubscribe mid-emit.
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch (err) {
        // A single broken listener must not take down the store.
        if (typeof console !== 'undefined') {
          console.error('[taskStore] subscriber threw', err);
        }
      }
    }
  }
}

/** Stable ID generator: crypto.randomUUID when available, fallback otherwise. */
function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: time + random. Not cryptographically strong, but unique enough
  // for a client-only app and a deterministic test seam.
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Build a comparator for the requested sort key + direction.
 *
 * - priority: urgent > high > medium > low
 * - dueDate:  nearest first in asc; furthest first in desc; nulls (no due
 *             date) sort LAST in both directions (the most useful UX)
 * - createdAt: chronological; the store defaults to desc (newest first)
 */
export function comparator(
  { key, direction }: { key: SortKey; direction: SortDirection },
): (a: Task, b: Task) => number {
  const flip = direction === 'asc' ? 1 : -1;
  // Normalize a zero difference to +0: `flip * 0` yields -0, and
  // `Object.is(-0, +0)` is false — some consumers (and strict tests) rely on +0.
  const zero = (n: number): number => (n === 0 ? 0 : n);
  switch (key) {
    case 'priority': {
      const rank = (p: Priority) =>
        p === 'urgent' ? 4 : p === 'high' ? 3 : p === 'medium' ? 2 : 1;
      return (a, b) => zero(flip * (rank(a.priority) - rank(b.priority)));
    }
    case 'dueDate': {
      // nulls sort last regardless of direction (the most useful UX).
      return (a, b) => {
        if (a.dueDate === null && b.dueDate === null) return 0;
        if (a.dueDate === null) return 1;
        if (b.dueDate === null) return -1;
        return zero(flip * a.dueDate.localeCompare(b.dueDate));
      };
    }
    case 'createdAt':
    default: {
      return (a, b) => zero(flip * a.createdAt.localeCompare(b.createdAt));
    }
  }
}
