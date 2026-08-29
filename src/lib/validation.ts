/**
 * Defensive input handling for the Kanban board.
 *
 * These are pure helpers with no DOM or storage dependency, so they are easy
 * to unit-test. The store uses them to sanitize every write; components use
 * {@link escapeHtml} anywhere user content must be rendered as markup.
 */
import {
  DEFAULT_PRIORITY,
  DEFAULT_STATUS,
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
  type Priority,
  type Status,
} from '../types.js';

/** Escape a string for safe insertion via `innerHTML`. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validate and normalize a title.
 *
 * Returns:
 * - `null` when the title is empty / whitespace-only after trimming.
 * - A trimmed string truncated to {@link MAX_TITLE_LENGTH} otherwise.
 */
export function normalizeTitle(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim().slice(0, MAX_TITLE_LENGTH);
  // Collapse internal runs of whitespace to a single space so a "  padded
  //  title" doesn't slip through as an odd-looking card.
  const collapsed = trimmed.replace(/\s+/g, ' ').trim();
  return collapsed.length > 0 ? collapsed : null;
}

/** Validate and normalize a description. Empty string is allowed (optional). */
export function normalizeDescription(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.slice(0, MAX_DESCRIPTION_LENGTH).trim();
}

/**
 * Validate a due date string.
 *
 * Accepts ISO-ish YYYY-MM-DD. Anything invalid (not a date, not in the right
 * shape) is coerced to `null` — the UI treats that as "no due date".
 */
export function normalizeDueDate(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  // Parse as UTC midnight so the re-serialized date is stable across timezones.
  const date = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  // Reject obviously implausible years (e.g. 0000 or 9999).
  const year = date.getUTCFullYear();
  if (year < 1970 || year > 2100) return null;
  // Re-serialize in UTC so the stored form matches the parsed form.
  return date.toISOString().slice(0, 10);
}

/** Coerce an unknown value to a valid {@link Priority} (defaults on unknown). */
export function normalizePriority(input: unknown): Priority {
  if (
    input === 'low' ||
    input === 'medium' ||
    input === 'high' ||
    input === 'urgent'
  ) {
    return input;
  }
  return DEFAULT_PRIORITY;
}

/** Coerce an unknown value to a valid {@link Status} (defaults on unknown). */
export function normalizeStatus(input: unknown): Status {
  if (
    input === 'backlog' ||
    input === 'in_progress' ||
    input === 'blocked' ||
    input === 'done'
  ) {
    return input;
  }
  return DEFAULT_STATUS;
}

/**
 * Validate a raw task shape coming out of storage.
 *
 * Returns a fully-sanitized `Task` when the record is structurally sound, or
 * `null` when it is not (the caller decides whether to drop it or log).
 */
export function sanitizeTask(raw: unknown): import('../types.js').Task | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;

  const id = typeof record.id === 'string' && record.id.length > 0 ? record.id : null;
  const title = normalizeTitle(record.title);
  if (id === null || title === null) return null;

  const priority = normalizePriority(record.priority);
  const status = normalizeStatus(record.status);
  const dueDate = normalizeDueDate(record.dueDate);
  const createdAt =
    typeof record.createdAt === 'string' && !Number.isNaN(Date.parse(record.createdAt))
      ? record.createdAt
      : new Date().toISOString();
  const updatedAt =
    typeof record.updatedAt === 'string' && !Number.isNaN(Date.parse(record.updatedAt))
      ? record.updatedAt
      : createdAt;

  return {
    id,
    title,
    description: normalizeDescription(record.description),
    priority,
    status,
    dueDate,
    createdAt,
    updatedAt,
    completed: status === 'done',
  };
}
