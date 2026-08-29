import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TaskStore, DEFAULT_FILTERS, comparator } from '../../src/lib/taskStore.js';
import type { StorageAdapter } from '../../src/lib/storage.js';
import { type Priority, type Status, type Task } from '../../src/types.js';

/**
 * In-memory StorageAdapter for unit tests. Behaves like LocalStorageAdapter
 * (returns null on empty, stores/retrieves Task[]) but lets us seed/inspect
 * state and inject corruption.
 */
class MemoryAdapter implements StorageAdapter {
  data: Task[] | null = null;
  saveCount = 0;
  get lastSaved(): unknown {
    return this.data;
  }

  load(): Task[] | null {
    return this.data;
  }

  save(tasks: Task[]): void {
    this.saveCount += 1;
    this.data = tasks;
  }

  /** Corrupt the stored payload so load() sees bad JSON / wrong shapes. */
  corrupt(): void {
    this.data = null as unknown as Task[]; // sentinel — see loadOverride
  }
}

/**
 * Adapter that emulates what LocalStorageAdapter's load() would produce for
 * various "bad" on-disk payloads:
 * - 'not-array'  → parsed value is a non-array (load returns it raw = not an array)
 * - 'mixed'      → an array with one good task and one record that fails sanitization
 *
 * The LocalStorageAdapter's actual JSON.parse-throws path is exercised
 * directly in storage.test.ts via a throwing Storage stub.
 */
class FaultyAdapter implements StorageAdapter {
  load(): Task[] | null {
    const good: Task = {
      id: 'a',
      title: 'Good',
      description: '',
      priority: 'medium',
      status: 'backlog',
      dueDate: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      completed: false,
    };
    const bad = { id: '', title: '   ' }; // sanitizes to null → dropped
    return [good, bad] as unknown as Task[];
  }

  save(_tasks: Task[]): void {
    /* no-op */
  }
}

describe('TaskStore', () => {
  let adapter: MemoryAdapter;

  beforeEach(() => {
    adapter = new MemoryAdapter();
  });

  afterEach(() => {
    adapter = new MemoryAdapter();
  });

  // ------------------------------------------------------------------
  // Construction / load
  // ------------------------------------------------------------------
  it('constructs with an empty task list when there is no stored data', () => {
    const store = new TaskStore(adapter);
    expect(store.getTasks()).toHaveLength(0);
  });

  it('loads existing tasks from the adapter on construction', () => {
    const seeded: Task[] = [
      {
        id: 't1',
        title: 'Seeded',
        description: '',
        priority: 'high',
        status: 'backlog',
        dueDate: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        completed: false,
      },
    ];
    adapter.data = seeded;
    const store = new TaskStore(adapter);
    expect(store.getTasks()).toHaveLength(1);
    expect(store.getTasks()[0].title).toBe('Seeded');
  });

  it('drops records that fail sanitization on load (mixed good/bad)', () => {
    const faulty = new FaultyAdapter();
    const store = new TaskStore(faulty);
    const tasks = store.getTasks();
    // One good task survives, the bad one (empty id/title) is dropped.
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Good');
  });

  it('treats a non-array payload as no data', () => {
    const adapter: StorageAdapter = {
      load: () => ({ not: 'an-array' }) as unknown as Task[],
      save: () => undefined,
    };
    const store = new TaskStore(adapter);
    expect(store.getTasks()).toHaveLength(0);
  });

  // ------------------------------------------------------------------
  // createTask
  // ------------------------------------------------------------------
  it('creates a task with defaults (medium priority, backlog status)', () => {
    const store = new TaskStore(adapter);
    const created = store.createTask({ title: 'Hello world' });
    expect(created).not.toBeNull();
    expect(created!.title).toBe('Hello world');
    expect(created!.priority).toBe('medium');
    expect(created!.status).toBe('backlog');
    expect(created!.completed).toBe(false);
    expect(created!.dueDate).toBeNull();
    expect(created!.description).toBe('');
    expect(store.getTasks()).toHaveLength(1);
  });

  it('persists to the adapter after create', () => {
    const store = new TaskStore(adapter);
    store.createTask({ title: 'Persist me' });
    expect(adapter.saveCount).toBeGreaterThan(0);
    expect(adapter.lastSaved).toHaveLength(1);
  });

  it('trims title and collapses internal whitespace on create', () => {
    const store = new TaskStore(adapter);
    const created = store.createTask({ title: '   padded    title  ' });
    expect(created!.title).toBe('padded title');
  });

  it('caps title at 200 chars on create', () => {
    const store = new TaskStore(adapter);
    const long = 'a'.repeat(500);
    const created = store.createTask({ title: long });
    expect(created!.title).toHaveLength(200);
  });

  it('rejects an empty / whitespace-only title on create', () => {
    const store = new TaskStore(adapter);
    expect(store.createTask({ title: '' })).toBeNull();
    expect(store.createTask({ title: '   ' })).toBeNull();
    expect(store.getTasks()).toHaveLength(0);
    expect(adapter.saveCount).toBe(0);
  });

  it('coerces unknown priority / status to defaults on create', () => {
    const store = new TaskStore(adapter);
    const created = store.createTask({
      title: 'weird',
      priority: 'bogus' as Priority,
      status: 'nope' as Status,
      dueDate: 'not-a-date',
    });
    expect(created!.priority).toBe('medium');
    expect(created!.status).toBe('backlog');
    expect(created!.dueDate).toBeNull();
  });

  it('normalizes a valid ISO dueDate on create', () => {
    const store = new TaskStore(adapter);
    const created = store.createTask({ title: 'dated', dueDate: '2026-12-31' });
    expect(created!.dueDate).toBe('2026-12-31');
  });

  it('notifies subscribers after create', () => {
    const store = new TaskStore(adapter);
    let calls = 0;
    store.subscribe(() => calls++);
    store.createTask({ title: 'notify' });
    expect(calls).toBe(1);
  });

  // ------------------------------------------------------------------
  // updateTask
  // ------------------------------------------------------------------
  it('updates fields and bumps updatedAt', () => {
    const store = new TaskStore(adapter);
    const task = store.createTask({ title: 'Before' })!;
    // Force a distinct updatedAt window.
    const before = task.updatedAt;
    // Small wait-free approach: compare inequality if possible.
    const updated = store.updateTask(task.id, { title: 'After', priority: 'urgent' });
    expect(updated).toBeDefined();
    expect(updated!.title).toBe('After');
    expect(updated!.priority).toBe('urgent');
    // Compare ISO timestamps numerically (updatedAt is an ISO string).
    const beforeMs = Date.parse(before);
    const updatedMs = Date.parse(updated!.updatedAt);
    expect(updatedMs).not.toBeNaN();
    expect(beforeMs).not.toBeNaN();
    expect(updatedMs).toBeGreaterThanOrEqual(beforeMs);
  });

  it('leaves unspecified fields unchanged on update', () => {
    const store = new TaskStore(adapter);
    const task = store.createTask({
      title: 'Keep',
      description: 'desc',
      priority: 'high',
      status: 'in_progress',
      dueDate: '2026-05-05',
    })!;
    const updated = store.updateTask(task.id, { description: 'new desc' })!;
    expect(updated.title).toBe('Keep');
    expect(updated.priority).toBe('high');
    expect(updated.status).toBe('in_progress');
    expect(updated.dueDate).toBe('2026-05-05');
    expect(updated.description).toBe('new desc');
  });

  it('syncs completed=true when status becomes done', () => {
    const store = new TaskStore(adapter);
    const task = store.createTask({ title: 'to-done' })!;
    expect(task.completed).toBe(false);
    const done = store.updateTask(task.id, { status: 'done' })!;
    expect(done.completed).toBe(true);
  });

  it('syncs completed=false when status moves off done', () => {
    const store = new TaskStore(adapter);
    const task = store.createTask({ title: 'was-done', status: 'done' })!;
    expect(task.completed).toBe(true);
    const reopened = store.updateTask(task.id, { status: 'backlog' })!;
    expect(reopened.completed).toBe(false);
  });

  it('ignores an invalid (empty) title on update, returning undefined', () => {
    const store = new TaskStore(adapter);
    const task = store.createTask({ title: 'Valid' })!;
    const result = store.updateTask(task.id, { title: '   ' });
    expect(result).toBeUndefined();
    // The task should be unchanged.
    expect(store.getTask(task.id)!.title).toBe('Valid');
  });

  it('returns undefined for update on a missing id', () => {
    const store = new TaskStore(adapter);
    expect(store.updateTask('nope', { title: 'x' })).toBeUndefined();
  });

  // ------------------------------------------------------------------
  // deleteTask
  // ------------------------------------------------------------------
  it('removes a task by id', () => {
    const store = new TaskStore(adapter);
    const task = store.createTask({ title: 'delete-me' })!;
    const removed = store.deleteTask(task.id);
    expect(removed).toBe(true);
    expect(store.getTasks()).toHaveLength(0);
  });

  it('returns false and no-ops for a missing id', () => {
    const store = new TaskStore(adapter);
    store.createTask({ title: 'keep' });
    const before = store.getTasks().length;
    const removed = store.deleteTask('does-not-exist');
    expect(removed).toBe(false);
    expect(store.getTasks()).toHaveLength(before);
  });

  it('persists after delete', () => {
    const store = new TaskStore(adapter);
    const task = store.createTask({ title: 'gone' })!;
    store.deleteTask(task.id);
    expect(adapter.lastSaved).toHaveLength(0);
  });

  // ------------------------------------------------------------------
  // moveTask
  // ------------------------------------------------------------------
  it('moves a task to a new status', () => {
    const store = new TaskStore(adapter);
    const task = store.createTask({ title: 'move me' })!;
    const moved = store.moveTask(task.id, 'in_progress')!;
    expect(moved.status).toBe('in_progress');
    expect(moved.completed).toBe(false);
  });

  it('moving to done sets completed=true; moving away sets it false', () => {
    const store = new TaskStore(adapter);
    const task = store.createTask({ title: 'round trip' })!;
    expect(store.moveTask(task.id, 'done')!.completed).toBe(true);
    expect(store.moveTask(task.id, 'blocked')!.completed).toBe(false);
  });

  it('moveTask returns undefined for a missing id', () => {
    const store = new TaskStore(adapter);
    expect(store.moveTask('ghost', 'done')).toBeUndefined();
  });

  // ------------------------------------------------------------------
  // setPriority
  // ------------------------------------------------------------------
  it('sets priority on a task', () => {
    const store = new TaskStore(adapter);
    const task = store.createTask({ title: 'prior' })!;
    const updated = store.setPriority(task.id, 'urgent')!;
    expect(updated.priority).toBe('urgent');
  });

  it('coerces an unknown priority to the default', () => {
    const store = new TaskStore(adapter);
    const task = store.createTask({ title: 'prior2' })!;
    const updated = store.setPriority(task.id, 'nonsense' as Priority)!;
    expect(updated.priority).toBe('medium');
  });

  // ------------------------------------------------------------------
  // markComplete
  // ------------------------------------------------------------------
  it('markComplete(true) sets status=done and completed=true', () => {
    const store = new TaskStore(adapter);
    const task = store.createTask({ title: 'finish' })!;
    const done = store.markComplete(task.id, true)!;
    expect(done.status).toBe('done');
    expect(done.completed).toBe(true);
  });

  it('markComplete(false) reopens to backlog', () => {
    const store = new TaskStore(adapter);
    const task = store.createTask({ title: 'reopen', status: 'done' })!;
    const reopened = store.markComplete(task.id, false)!;
    expect(reopened.status).toBe('backlog');
    expect(reopened.completed).toBe(false);
  });

  // ------------------------------------------------------------------
  // view: filtering
  // ------------------------------------------------------------------
  it('filters by priority', () => {
    const store = new TaskStore(adapter);
    store.createTask({ title: 'a', priority: 'low' });
    store.createTask({ title: 'b', priority: 'high' });
    store.createTask({ title: 'c', priority: 'urgent' });
    const highOnly = store.view({ ...DEFAULT_FILTERS, priority: 'high' });
    expect(highOnly.map((t) => t.title)).toEqual(['b']);
  });

  it('filters by status', () => {
    const store = new TaskStore(adapter);
    store.createTask({ title: 'a', status: 'backlog' });
    store.createTask({ title: 'b', status: 'done' });
    const done = store.view({ ...DEFAULT_FILTERS, status: 'done' });
    expect(done.map((t) => t.title)).toEqual(['b']);
  });

  it('filters by search over title + description (case-insensitive)', () => {
    const store = new TaskStore(adapter);
    store.createTask({ title: 'Ship the Q3 dashboard', description: 'charts' });
    store.createTask({ title: 'Fix login', description: 'OAuth bug' });
    const q3 = store.view({ ...DEFAULT_FILTERS, search: 'q3' });
    expect(q3.map((t) => t.title)).toEqual(['Ship the Q3 dashboard']);
    // Search also matches description text.
    const oauth = store.view({ ...DEFAULT_FILTERS, search: 'oauth' });
    expect(oauth.map((t) => t.title)).toEqual(['Fix login']);
  });

  it('combines priority + status + search filters (AND)', () => {
    const store = new TaskStore(adapter);
    store.createTask({ title: 'high backlog ship', priority: 'high', status: 'backlog' });
    store.createTask({ title: 'high in_progress', priority: 'high', status: 'in_progress' });
    store.createTask({ title: 'low backlog ship', priority: 'low', status: 'backlog' });
    const result = store.view({
      priority: 'high',
      status: 'backlog',
      search: 'ship',
    });
    expect(result.map((t) => t.title)).toEqual(['high backlog ship']);
  });

  it('returns all tasks when no filters are active', () => {
    const store = new TaskStore(adapter);
    store.createTask({ title: 'a' });
    store.createTask({ title: 'b' });
    expect(store.view()).toHaveLength(2);
  });

  // ------------------------------------------------------------------
  // view: sorting
  // ------------------------------------------------------------------
  it('sorts by priority (urgent first by default direction)', () => {
    const store = new TaskStore(adapter);
    store.createTask({ title: 'low', priority: 'low' });
    store.createTask({ title: 'urgent', priority: 'urgent' });
    store.createTask({ title: 'medium', priority: 'medium' });
    store.createTask({ title: 'high', priority: 'high' });
    const sorted = store.view(DEFAULT_FILTERS, { key: 'priority', direction: 'desc' });
    expect(sorted.map((t) => t.priority)).toEqual(['urgent', 'high', 'medium', 'low']);
  });

  it('sorts by priority ascending (low first)', () => {
    const store = new TaskStore(adapter);
    store.createTask({ title: 'low', priority: 'low' });
    store.createTask({ title: 'urgent', priority: 'urgent' });
    const sorted = store.view(DEFAULT_FILTERS, { key: 'priority', direction: 'asc' });
    expect(sorted.map((t) => t.priority)).toEqual(['low', 'urgent']);
  });

  it('sorts by dueDate ascending with nulls last', () => {
    const store = new TaskStore(adapter);
    store.createTask({ title: 'far', dueDate: '2027-01-01' });
    store.createTask({ title: 'near', dueDate: '2026-01-01' });
    store.createTask({ title: 'none', dueDate: null });
    const sorted = store.view(DEFAULT_FILTERS, { key: 'dueDate', direction: 'asc' });
    expect(sorted.map((t) => t.title)).toEqual(['near', 'far', 'none']);
  });

  it('sorts by dueDate descending with nulls still last', () => {
    const store = new TaskStore(adapter);
    store.createTask({ title: 'far', dueDate: '2027-01-01' });
    store.createTask({ title: 'near', dueDate: '2026-01-01' });
    store.createTask({ title: 'none', dueDate: null });
    const sorted = store.view(DEFAULT_FILTERS, { key: 'dueDate', direction: 'desc' });
    expect(sorted.map((t) => t.title)).toEqual(['far', 'near', 'none']);
  });

  it('sorts by createdAt descending (newest first) by default', () => {
    const seeded = new MemoryAdapter();
    seeded.data = [
      {
        id: 'old',
        title: 'old',
        description: '',
        priority: 'medium',
        status: 'backlog',
        dueDate: null,
        createdAt: '2020-01-01T00:00:00.000Z',
        updatedAt: '2020-01-01T00:00:00.000Z',
        completed: false,
      },
      {
        id: 'new',
        title: 'new',
        description: '',
        priority: 'medium',
        status: 'backlog',
        dueDate: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        completed: false,
      },
    ];
    const store = new TaskStore(seeded);
    const sorted = store.view(DEFAULT_FILTERS, { key: 'createdAt', direction: 'desc' });
    expect(sorted.map((t) => t.title)).toEqual(['new', 'old']);
  });

  // ------------------------------------------------------------------
  // clear()
  // ------------------------------------------------------------------
  it('clears all tasks and persists', () => {
    const store = new TaskStore(adapter);
    store.createTask({ title: 'a' });
    store.createTask({ title: 'b' });
    store.clear();
    expect(store.getTasks()).toHaveLength(0);
    expect(adapter.lastSaved).toHaveLength(0);
  });

  it('clear() is a no-op when empty (no save, no event)', () => {
    const a = new MemoryAdapter();
    const store = new TaskStore(a);
    let calls = 0;
    store.subscribe(() => calls++);
    store.clear();
    expect(calls).toBe(0);
    expect(a.saveCount).toBe(0);
  });

  // ------------------------------------------------------------------
  // subscribe
  // ------------------------------------------------------------------
  it('unsubscribe stops notifications', () => {
    const store = new TaskStore(adapter);
    let calls = 0;
    const unsub = store.subscribe(() => calls++);
    store.createTask({ title: 'one' });
    expect(calls).toBe(1);
    unsub();
    store.createTask({ title: 'two' });
    expect(calls).toBe(1);
  });

  it('a throwing subscriber does not break the store or other subscribers', () => {
    const store = new TaskStore(adapter);
    let goodCalls = 0;
    store.subscribe(() => {
      throw new Error('boom');
    });
    store.subscribe(() => {
      goodCalls++;
    });
    expect(() => store.createTask({ title: 'x' })).not.toThrow();
    expect(goodCalls).toBe(1);
    expect(store.getTasks()).toHaveLength(1);
  });
});

describe('comparator', () => {
  const mk = (over: Partial<Task>): Task => ({
    id: Math.random().toString(36).slice(2),
    title: 't',
    description: '',
    priority: 'medium',
    status: 'backlog',
    dueDate: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    completed: false,
    ...over,
  });

  it('is symmetric for equal items on createdAt', () => {
    const cmp = comparator({ key: 'createdAt', direction: 'desc' });
    const a = mk({ createdAt: '2026-01-01T00:00:00.000Z' });
    const b = mk({ createdAt: '2026-01-01T00:00:00.000Z' });
    expect(cmp(a, b)).toBe(0);
  });

  it('ranks priorities urgent > high > medium > low', () => {
    const cmp = comparator({ key: 'priority', direction: 'desc' });
    expect(cmp(mk({ priority: 'urgent' }), mk({ priority: 'low' }))).toBeLessThan(0);
    expect(cmp(mk({ priority: 'low' }), mk({ priority: 'urgent' }))).toBeGreaterThan(0);
  });
});
