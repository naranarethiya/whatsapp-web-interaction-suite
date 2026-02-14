import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

let sendBase64Message;

// Minimal DOM/event shims for webapp.js
class SimpleEventTarget {
  constructor() {
    this.listeners = {};
  }
  addEventListener(type, cb) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(cb);
  }
  dispatchEvent(event) {
    const list = this.listeners[event.type] || [];
    list.forEach((cb) => cb(event));
  }
}

beforeAll(async () => {
  // Provide globals expected by webapp.js
  const doc = new SimpleEventTarget();
  globalThis.document = doc;
  globalThis.window = globalThis;
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = init?.detail;
    }
  };
});

beforeEach(async () => {
  // fresh import each test to reset module state
  const posted = [];
  globalThis.window.postMessage = (data) => posted.push(data);
  const mod = await import('../src/webapp.js?cache=' + Math.random());
  sendBase64Message = mod.default?.sendBase64Message || mod.sendBase64Message || globalThis.whatsappWebSuite.sendBase64Message;
  // expose helper for tests
  sendBase64Message.__posted = posted;
});

describe('webapp public API', () => {
  it('resolves when whatsappSendResponse success is dispatched', async () => {
    const promise = sendBase64Message('918879331633', 'ZGF0YQ==', 'application/pdf', 'file.pdf', 'hi');
    const [msg] = sendBase64Message.__posted;
    expect(msg.action).toBe('webAppToContentjs');
    expect(msg.uid).toBeDefined();
    // simulate background response
    document.dispatchEvent(new CustomEvent('whatsappSendResponse', {
      detail: { uid: msg.uid, success: true, response: 'ok' },
    }));
    const res = await promise;
    expect(res.success).toBe(true);
  });

  it('rejects on invalid mobile', async () => {
    await expect(sendBase64Message('123', 'ZGF0YQ==', 'application/pdf', 'file.pdf', 'hi')).rejects.toBeTruthy();
  });
});



