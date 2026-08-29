import { beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageAdapter } from '../../src/lib/storage.js';
import { STORAGE_KEY, type Task } from '../../src/types.js';

/**
 * A minimal in-memory `Storage` stub implementing the surface of
 * `window.localStorage` that LocalStorageAdapter uses (getItem/setItem).
 */
class FakeLocalStorage implements Storage {
  private map = new Map<string, string>();
  private throwing = false;

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  key(index: number): string | null {
    const keys = [...this.map.keys()];
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.throwing) {
      throw new Error('QuotaExceededError (simulated)');
    }
    this.map.set(key, value);
  }

  /** Inject a raw (possibly corrupt) value under the given key. */
  inject(key: string, raw: string): void {
    this.map.set(key, raw);
  }

  /** Make setItem throw (e.g. to simulate quota exceeded). */
  setThrowingOnWrite(value: boolean): void {
    this.throwing = value;
  }

  raw(key: string): string | null {
    return this.map.get(key) ?? null;
  }
}

function makeTask(over: Partial<Task> = {}): Task {
  return {
    id: `id-${Math.random().toString(36).slice(2)}`,
    title: 'Task',
    description: '',
    priority: 'medium',
    status: 'backlog',
    dueDate: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    completed: false,
    ...over,
  };
}

describe('LocalStorageAdapter', () => {
  let storage: FakeLocalStorage;
  beforeEach(() => {
    storage = new FakeLocalStorage();
  });

  // ------------------------------------------------------------------
  // load()
  // ------------------------------------------------------------------
  it('returns null when the key is absent', () => {
    const adapter = new LocalStorageAdapter(storage);
    expect(adapter.load()).toBeNull();
  });

  it('persists to the default key (kanban.tasks.v1)', () => {
    const adapter = new LocalStorageAdapter(storage);
    adapter.save([makeTask({ title: 'one' })]);
    expect(storage.raw(STORAGE_KEY)).not.toBeNull();
  });

  it('round-trips tasks: save then load returns an equal list', () => {
    const adapter = new LocalStorageAdapter(storage);
    const tasks = [
      makeTask({ id: 'a', title: 'First', priority: 'urgent', status: 'done' }),
      makeTask({ id: 'b', title: 'Second', dueDate: '2026-07-04' }),
    ];
    adapter.save(tasks);
    const loaded = adapter.load();
    expect(loaded).not.toBeNull();
    expect(loaded).toHaveLength(2);
    expect(loaded!.map((t) => t.id)).toEqual(['a', 'b']);
    expect(loaded![0].title).toBe('First');
    expect(loaded![0].priority).toBe('urgent');
    expect(loaded![0].completed).toBe(true);
    expect(loaded![1].dueDate).toBe('2026-07-04');
  });

  it('respects a custom key', () => {
    const adapter = new LocalStorageAdapter(storage, 'custom.key');
    adapter.save([makeTask({ title: 'c' })]);
    expect(storage.raw('custom.key')).not.toBeNull();
    expect(storage.raw(STORAGE_KEY)).toBeNull();
  });

  it('returns null for corrupt JSON (JSON.parse throws) — never throws to caller', () => {
    storage.inject(STORAGE_KEY, '{"this is not valid json');
    const adapter = new LocalStorageAdapter(storage);
    expect(() => adapter.load()).not.toThrow();
    expect(adapter.load()).toBeNull();
  });

  it('returns null for a JSON value that is not an array', () => {
    storage.inject(STORAGE_KEY, JSON.stringify({ a: 1 }));
    const adapter = new LocalStorageAdapter(storage);
    expect(adapter.load()).toBeNull();
  });

  it('returns null for an empty JSON array', () => {
    storage.inject(STORAGE_KEY, '[]');
    const adapter = new LocalStorageAdapter(storage);
    expect(adapter.load()).toBeNull();
  });

  it('drops records that fail sanitization and keeps the rest', () => {
    const good = makeTask({ id: 'good', title: 'Good' });
    const bad1 = { id: '', title: '   ' }; // no valid id/title
    const bad2 = { title: 'no id' }; // no id
    storage.inject(STORAGE_KEY, JSON.stringify([good, bad1, bad2]));
    const adapter = new LocalStorageAdapter(storage);
    const loaded = adapter.load();
    expect(loaded).toHaveLength(1);
    expect(loaded![0].id).toBe('good');
  });

  it('coerces completed to match status on load', () => {
    const task = { ...makeTask({ id: 'x', status: 'done' }), completed: false };
    storage.inject(STORAGE_KEY, JSON.stringify([task]));
    const adapter = new LocalStorageAdapter(storage);
    const loaded = adapter.load()!;
    expect(loaded[0].completed).toBe(true);
  });

  // ------------------------------------------------------------------
  // save()
  // ------------------------------------------------------------------
  it('save() never throws even if the storage write fails (quota)', () => {
    const adapter = new LocalStorageAdapter(storage);
    storage.setThrowingOnWrite(true);
    expect(() => adapter.save([makeTask()])).not.toThrow();
  });

  it('save() writes a JSON array of tasks', () => {
    const adapter = new LocalStorageAdapter(storage);
    const task = makeTask({ id: 'z', title: 'Zed' });
    adapter.save([task]);
    const parsed = JSON.parse(storage.raw(STORAGE_KEY) as string) as Task[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('z');
  });

  it('save() overwrites previous state', () => {
    const adapter = new LocalStorageAdapter(storage);
    adapter.save([makeTask({ id: 'first' })]);
    adapter.save([makeTask({ id: 'second' })]);
    const loaded = adapter.load()!;
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('second');
  });

  it('save() with an empty list clears the stored data to a falsy load', () => {
    const adapter = new LocalStorageAdapter(storage);
    adapter.save([makeTask({ id: 'a' })]);
    adapter.save([]);
    // An empty array is persisted as "[]" which load() treats as no data.
    expect(adapter.load()).toBeNull();
  });

  // ------------------------------------------------------------------
  // Corrupted-JSON recovery story (end-to-end through the adapter)
  // ------------------------------------------------------------------
  it('recovering from corruption: a fresh save after bad data restores a board', () => {
    storage.inject(STORAGE_KEY, '<!DOCTYPE html><html>not json</html>');
    const adapter = new LocalStorageAdapter(storage);
    // First read sees corruption → null (board shows empty, no crash).
    expect(adapter.load()).toBeNull();
    // After the user creates a task, save overwrites the corrupt payload.
    adapter.save([makeTask({ id: 'fresh', title: 'Rebuilt' })]);
    const recovered = adapter.load()!;
    expect(recovered).toHaveLength(1);
    expect(recovered[0].title).toBe('Rebuilt');
    // And it remains parseable for the next session.
    expect(() => JSON.parse(storage.raw(STORAGE_KEY) as string)).not.toThrow();
  });

  it('does not crash when getItem itself throws', () => {
    const real = new FakeLocalStorage();
    const throwingStorage: Storage = new Proxy(real, {
      get(target, prop) {
        if (prop === 'getItem') return () => {
          throw new Error('SecurityError (simulated)');
        };
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const adapter = new LocalStorageAdapter(throwingStorage);
    expect(() => adapter.load()).not.toThrow();
    expect(adapter.load()).toBeNull();
  });
});
