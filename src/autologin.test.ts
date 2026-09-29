import assert from 'node:assert/strict';
import { afterEach, beforeEach, test, vi } from 'vitest';

import { AutoLogin } from './autologin.js';

type Listener = (payload: unknown) => void;

/** Just enough of the plugin context for the auto-login state machine. */
function fixture(maxAttempts = 2): { fire: (event: string, payload?: unknown) => void; sent: string[]; toasts: number } {
  const listeners = new Map<string, Listener>();
  const state = { sent: [] as string[], toasts: 0 };
  const settings: Record<string, unknown> = { autoLogin: true, answer2fa: false, secret: '', maxAttempts };
  const ctx = {
    disposables: { add: () => undefined },
    signal: new AbortController().signal,
    events: { on: (event: string, listener: Listener) => { listeners.set(event, listener); return () => undefined; } },
    settings: { get: (key: string) => settings[key] },
    bridge: { send: (action: string) => { state.sent.push(action); } },
    logger: { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined },
    ui: { toast: () => { state.toasts += 1; } },
  };
  new AutoLogin(ctx as unknown as ConstructorParameters<typeof AutoLogin>[0]).install();
  return {
    fire: (event, payload = {}) => { listeners.get(event)?.(payload); },
    get sent() { return state.sent; },
    get toasts() { return state.toasts; },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('document', { querySelector: () => null });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test('the user failing to sign in by hand does not count against the limit', async () => {
  const f = fixture(2);
  for (let i = 0; i < 5; i += 1) f.fire('vrcLoginError', { error: 'Invalid Username/Email or Password' });
  f.fire('vrcPrefillLogin', { username: 'u', password: 'p' });
  await vi.advanceTimersByTimeAsync(500);
  assert.deepEqual(f.sent, ['vrcLogin'], 'still armed after five manual failures');
  assert.equal(f.toasts, 0);
});

test('failures of its own attempts do count, and switch it off at the limit', async () => {
  const f = fixture(2);
  for (let i = 0; i < 2; i += 1) {
    f.fire('vrcPrefillLogin', { username: 'u', password: 'p' });
    await vi.advanceTimersByTimeAsync(500);
    f.fire('vrcLoginError', { error: 'bad' });
  }
  assert.deepEqual(f.sent, ['vrcLogin', 'vrcLogin']);
  assert.equal(f.toasts, 1, 'gave up and said so');
  f.fire('vrcPrefillLogin', { username: 'u', password: 'p' });
  await vi.advanceTimersByTimeAsync(500);
  assert.equal(f.sent.length, 2, 'no attempt after disarming');
});
