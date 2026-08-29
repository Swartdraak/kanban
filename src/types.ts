/**
 * Shared types for the Kanban Task Board.
 *
 * These are the single source of truth for the data model used by the store,
 * components, validation, and tests.
 */

/** Priority levels. Display order: urgent → high → medium → low. */
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

/** Column keys the board is made of. Order matters for layout + drag hints. */
export type Status = 'backlog' | 'in_progress' | 'blocked' | 'done';

/** A single task on the board. */
export interface Task {
  /** Stable unique id (crypto.randomUUID when available, fallback otherwise). */
  id: string;
  /** Human-readable title. Required, trimmed, capped at {@link MAX_TITLE_LENGTH}. */
  title: string;
  /** Free-form detail. Optional, capped at {@link MAX_DESCRIPTION_LENGTH}. */
  description: string;
  priority: Priority;
  status: Status;
  /** ISO date (YYYY-MM-DD) or null when the task has no due date. */
  dueDate: string | null;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of last mutation. Bumped on every write. */
  updatedAt: string;
  /** Kept in sync with `status === 'done'` on every mutation. */
  completed: boolean;
}

/** Canonical ordering of the board columns (left → right on desktop). */
export const STATUSES: readonly Status[] = [
  'backlog',
  'in_progress',
  'blocked',
  'done',
] as const;

/** Canonical ordering of priorities, highest → lowest (used for sort + display). */
export const PRIORITIES: readonly Priority[] = [
  'urgent',
  'high',
  'medium',
  'low',
] as const;

/** Human-facing labels, used by headers, badges, and the "Move to…" control. */
export const STATUS_LABELS: Record<Status, string> = {
  backlog: 'Backlog',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  done: 'Done',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

/** Numeric rank used by the priority sort (higher = more urgent). */
export const PRIORITY_RANK: Record<Priority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/** Defaults used when a value is missing or unknown. */
export const DEFAULT_PRIORITY: Priority = 'medium';
export const DEFAULT_STATUS: Status = 'backlog';

/** Maximum allowed length for a task title (trimmed). */
export const MAX_TITLE_LENGTH = 200;
/** Maximum allowed length for a task description. */
export const MAX_DESCRIPTION_LENGTH = 2000;

/** localStorage key used by the LocalStorageAdapter. */
export const STORAGE_KEY = 'kanban.tasks.v1';
