import { describe, expect, it } from 'vitest';
import {
  normalizeTitle,
  normalizeDescription,
  normalizeDueDate,
  normalizePriority,
  normalizeStatus,
  sanitizeTask,
  escapeHtml,
} from '../../src/lib/validation.js';

describe('normalizeTitle', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeTitle('  hello    world  ')).toBe('hello world');
  });

  it('returns null for empty / whitespace-only', () => {
    expect(normalizeTitle('')).toBeNull();
    expect(normalizeTitle('   ')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(normalizeTitle(123)).toBeNull();
    expect(normalizeTitle(null)).toBeNull();
    expect(normalizeTitle(undefined)).toBeNull();
    expect(normalizeTitle({ a: 1 })).toBeNull();
  });

  it('caps at 200 chars', () => {
    const long = 'a'.repeat(500);
    expect(normalizeTitle(long)).toHaveLength(200);
  });

  it('keeps a short valid title intact', () => {
    expect(normalizeTitle('Ship it')).toBe('Ship it');
  });
});

describe('normalizeDescription', () => {
  it('returns empty string for non-string', () => {
    expect(normalizeDescription(undefined)).toBe('');
    expect(normalizeDescription(42)).toBe('');
  });

  it('trims and caps at 2000 chars', () => {
    expect(normalizeDescription('  hi  ')).toBe('hi');
    expect(normalizeDescription('x'.repeat(5000))).toHaveLength(2000);
  });

  it('allows an empty description', () => {
    expect(normalizeDescription('')).toBe('');
  });
});

describe('normalizeDueDate', () => {
  it('accepts a valid ISO date', () => {
    expect(normalizeDueDate('2026-12-31')).toBe('2026-12-31');
  });

  it('rejects malformed strings', () => {
    expect(normalizeDueDate('not a date')).toBeNull();
    expect(normalizeDueDate('2026/12/31')).toBeNull();
    expect(normalizeDueDate('2026-13-45')).toBeNull(); // invalid month/day
    expect(normalizeDueDate('')).toBeNull();
  });

  it('rejects non-string input', () => {
    expect(normalizeDueDate(null)).toBeNull();
    expect(normalizeDueDate(undefined)).toBeNull();
    expect(normalizeDueDate(12345)).toBeNull();
  });

  it('rejects out-of-range years', () => {
    expect(normalizeDueDate('0000-01-01')).toBeNull();
    expect(normalizeDueDate('9999-01-01')).toBeNull();
  });
});

describe('normalizePriority', () => {
  it('keeps valid priorities', () => {
    expect(normalizePriority('low')).toBe('low');
    expect(normalizePriority('medium')).toBe('medium');
    expect(normalizePriority('high')).toBe('high');
    expect(normalizePriority('urgent')).toBe('urgent');
  });

  it('coerces unknown values to the default (medium)', () => {
    expect(normalizePriority('bogus')).toBe('medium');
    expect(normalizePriority('')).toBe('medium');
    expect(normalizePriority(null)).toBe('medium');
    expect(normalizePriority(99)).toBe('medium');
  });
});

describe('normalizeStatus', () => {
  it('keeps valid statuses', () => {
    expect(normalizeStatus('backlog')).toBe('backlog');
    expect(normalizeStatus('in_progress')).toBe('in_progress');
    expect(normalizeStatus('blocked')).toBe('blocked');
    expect(normalizeStatus('done')).toBe('done');
  });

  it('coerces unknown values to the default (backlog)', () => {
    expect(normalizeStatus('nope')).toBe('backlog');
    expect(normalizeStatus('')).toBe('backlog');
    expect(normalizeStatus(null)).toBe('backlog');
  });
});

describe('sanitizeTask', () => {
  const base = {
    id: 'id-1',
    title: 'A task',
    description: 'details',
    priority: 'high' as const,
    status: 'in_progress' as const,
    dueDate: '2026-06-01',
    createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    completed: false,
  };

  it('returns null for non-object input', () => {
    expect(sanitizeTask(null)).toBeNull();
    expect(sanitizeTask(undefined)).toBeNull();
    expect(sanitizeTask('str')).toBeNull();
    expect(sanitizeTask(42)).toBeNull();
  });

  it('returns null when the record lacks a valid id', () => {
    expect(sanitizeTask({ ...base, id: '' })).toBeNull();
    expect(sanitizeTask({ ...base, id: 123 })).toBeNull();
    expect(sanitizeTask({ title: 'no id' })).toBeNull();
  });

  it('returns null when the record lacks a valid title', () => {
    expect(sanitizeTask({ ...base, title: '   ' })).toBeNull();
    expect(sanitizeTask({ ...base, title: 5 })).toBeNull();
  });

  it('keeps a fully valid task', () => {
    const result = sanitizeTask(base)!;
    expect(result.id).toBe('id-1');
    expect(result.title).toBe('A task');
    expect(result.description).toBe('details');
    expect(result.priority).toBe('high');
    expect(result.status).toBe('in_progress');
    expect(result.dueDate).toBe('2026-06-01');
    expect(result.completed).toBe(false);
  });

  it('forces completed in sync with status=done', () => {
    const done = sanitizeTask({ ...base, status: 'done', completed: false })!;
    expect(done.completed).toBe(true);
    const reopened = sanitizeTask({ ...base, status: 'backlog', completed: true })!;
    expect(reopened.completed).toBe(false);
  });

  it('coerces unknown priority/status to defaults', () => {
    const result = sanitizeTask({ ...base, priority: 'junk', status: 'junk' })!;
    expect(result.priority).toBe('medium');
    expect(result.status).toBe('backlog');
  });

  it('coerces an invalid dueDate to null', () => {
    const result = sanitizeTask({ ...base, dueDate: 'junk' })!;
    expect(result.dueDate).toBeNull();
  });

  it('falls back to the current time for a missing/invalid timestamp', () => {
    const before = Date.now();
    const result = sanitizeTask({ ...base, createdAt: 'junk', updatedAt: 'also junk' })!;
    const after = Date.now();
    expect(typeof result.createdAt).toBe('string');
    expect(!Number.isNaN(Date.parse(result.createdAt))).toBe(true);
    expect(!Number.isNaN(Date.parse(result.updatedAt))).toBe(true);
    // Both fall back to "now" — but `sanitizeTask` takes two independent
    // `new Date()` snapshots, so exact equality is not guaranteed (a tick can
    // elapse between them). Assert the values fall within this call's window
    // and are at most 1ms apart.
    expect(new Date(result.createdAt).getTime()).toBeGreaterThanOrEqual(before);
    expect(new Date(result.createdAt).getTime()).toBeLessThanOrEqual(after);
    expect(new Date(result.updatedAt).getTime()).toBeGreaterThanOrEqual(before);
    expect(new Date(result.updatedAt).getTime()).toBeLessThanOrEqual(after);
    expect(
      Math.abs(new Date(result.createdAt).getTime() - new Date(result.updatedAt).getTime()),
    ).toBeLessThanOrEqual(1);
  });

  it('normalizes the title (trim) on sanitize', () => {
    const result = sanitizeTask({ ...base, title: '  padded  ' })!;
    expect(result.title).toBe('padded');
  });
});

describe('escapeHtml', () => {
  it('escapes all five special characters', () => {
    expect(escapeHtml('<a href="x">&\'</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  });

  it('leaves plain text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('handles a string of only ampersands', () => {
    expect(escapeHtml('&&&')).toBe('&amp;&amp;&amp;');
  });

  it('escapes a user-injected script payload', () => {
    const payload = '<script>alert(1)</script>';
    expect(escapeHtml(payload)).not.toContain('<script>');
    expect(escapeHtml(payload)).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });
});
