import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';

let Database;
let renderTemplate;
let getMode;
let calculateDelay;
let checkBatchPause;
let normalizePhone;
let normalizeMediaPayload;

// Prepare shims before importing background module
beforeAll(async () => {
  globalThis.indexedDB = indexedDB;
  globalThis.IDBKeyRange = IDBKeyRange;
  globalThis.chrome = {
    runtime: {
      onMessage: { addListener: () => {} },
    },
    tabs: {
      query: async () => [],
      sendMessage: async () => ({ success: true }),
    },
    scripting: {
      executeScript: async () => [{ result: { exists: true, isBusiness: false } }],
    },
  };

  const bg = await import('../src/background.js');
  Database = bg.Database;
  renderTemplate = bg.renderTemplate;
  getMode = bg.getMode;
  calculateDelay = bg.calculateDelay;
  checkBatchPause = bg.checkBatchPause;
  normalizePhone = bg.normalizePhone;
  normalizeMediaPayload = bg.normalizeMediaPayload;
});

beforeEach(async () => {
  if (Database?.db) {
    Database.db.close();
    Database.db = null;
  }
});

describe('utility helpers', () => {
  it('normalizes phone numbers', () => {
    expect(normalizePhone('+91 88793-31633')).toBe('918879331633');
  });

  it('renders template with defaults', () => {
    const out = renderTemplate('Hi {{name}}, your phone {{phone}}', { phone: '123' });
    expect(out).toBe('Hi there, your phone 123');
  });

  it('selects correct mode by count', () => {
    expect(getMode(1)).toBe('instant');
    expect(getMode(3)).toBe('quick');
    expect(getMode(5)).toBe('normal');
    expect(getMode(10)).toBe('batch');
  });

  it('calculates delay within expected ranges', () => {
    const d1 = calculateDelay(1);
    expect(d1).toBe(0);
    const d2 = calculateDelay(3);
    expect(d2).toBeGreaterThanOrEqual(0);
    expect(d2).toBeLessThanOrEqual(6000); // 2-5s +/-10%
  });

  it('checks batch pause for batch mode', () => {
    const mockState = {
      recipients: Array.from({ length: 250 }),
      progress: { sent: 40, failed: 0 },
    };
    const res = checkBatchPause(mockState);
    expect(res.shouldPause).toBe(true);
    expect(res.duration).toBe(15000);
  });

  it('normalizes media payloads for legacy inputs', () => {
    expect(normalizeMediaPayload(null)).toBeNull();
    expect(normalizeMediaPayload({ type: 'url', url: 'x' }).url).toBe('x');
    expect(normalizeMediaPayload({ data: 'abc', mime: 'image/png' }).type).toBe('file');
    expect(normalizeMediaPayload({ url: 'https://x' }).type).toBe('url');
  });
});

describe('Database helpers', () => {
  it('sets and retrieves validation cache with TTL', async () => {
    await Database.setValidationCache('123', { exists: true, isBusiness: false });
    const cached = await Database.getValidationCache('123');
    expect(cached?.exists).toBe(true);

    // Expire entry
    cached.expiresAt = new Date(Date.now() - 1000).toISOString();
    await Database.put('numberValidation', cached);
    const expired = await Database.getValidationCache('123');
    expect(expired).toBeNull();
  });

  it('stores campaigns in IndexedDB', async () => {
    await Database.put('campaigns', { id: 'c1', status: 'running', createdAt: '2024-01-01' });
    const all = await Database.getAll('campaigns');
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('c1');
  });
});

