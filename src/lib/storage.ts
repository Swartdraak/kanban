/**
 * Storage layer for the Kanban board.
 *
 * The rest of the app talks to `Task` arrays through the {@link StorageAdapter}
 * interface, which keeps the persistence mechanism swappable (localStorage now,
 * IndexedDB / a real API later) without touching UI or store logic.
 */
import { STORAGE_KEY, type Task } from '../types.js';
import { sanitizeTask } from './validation.js';

/**
 * Persistence boundary. Implementations MUST NOT throw on read/write errors:
 * they should degrade gracefully (e.g. return `null` for load, no-op for save)
 * so a corrupt or quota-exceeded localStorage never crashes the app.
 */
export interface StorageAdapter {
  /**
   * Load all tasks from persistence.
   *
   * @returns the full task list, or `null` when there is no data, the data
   *          is not an array, or it cannot be parsed.
   */
  load(): Task[] | null;
  /** Persist the task list. Failures (quota, private mode) are swallowed. */
  save(tasks: Task[]): void;
}

/**
 * localStorage-backed adapter. Key: {@link STORAGE_KEY}.
 *
 * Guarantees:
 * - `load()` never throws; always returns `Task[] | null`.
 * - `save()` never throws; swallows quota / serialization errors.
 * - Records that fail sanitization are dropped individually (so one bad
 *   task does not poison the whole board).
 */
export class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly storage: Storage, private readonly key: string = STORAGE_KEY) {}

  load(): Task[] | null {
    try {
      const raw = this.storage.getItem(this.key);
      if (raw === null || raw === undefined) return null;

      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;

      const tasks: Task[] = [];
      for (const item of parsed) {
        const task = sanitizeTask(item);
        if (task !== null) tasks.push(task);
      }
      // Treat an array that sanitized to nothing as "no usable data".
      return tasks.length > 0 ? tasks : null;
    } catch {
      // Corrupt / non-JSON / storage-throw — degrade to "no data".
      return null;
    }
  }

  save(tasks: Task[]): void {
    try {
      this.storage.setItem(this.key, JSON.stringify(tasks));
    } catch {
      // Quota exceeded, private-mode, or serialization failure — non-fatal.
      // The in-memory state is already consistent; the user will lose this
      // write on refresh, which is an acceptable degradation.
    }
  }
}
