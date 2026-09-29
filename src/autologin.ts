/**
 * Unattended sign-in.
 *
 * Why this exists: when VRChat drops the session, VRCNext clears both saved cookies — including
 * the `twoFactorAuth` one, which is exactly the thing that would let the next sign-in skip the
 * code — and then hands the page the saved username and password so the form can fill itself
 * in. Every re-login therefore costs a button press and a fresh authenticator code. On a
 * connection whose address changes daily that is a daily chore.
 *
 * None of it can be fixed from the page: the cookie jar lives in the backend. What the page can
 * do is press the button and type the code, which is all this does.
 *
 * It never stores the password — `vrcPrefillLogin` carries it, from VRCNext's own encrypted
 * store, every time it is needed.
 */

import { type PluginContext } from '@vrcnext/plugin-api';

import { isSecret, secondsLeft, totp } from './totp.js';
import { type Settings } from './settings.js';

type Ctx = PluginContext<Settings>;

/** Let VRCNext finish its own prefill handler before the form is submitted under it. */
const SUBMIT_DELAY_MS = 400;
/** A code this close to rolling over is likely to be rejected; wait for the next one. */
const MIN_CODE_LIFE_S = 3;
/** How long one sign-in attempt may be in flight before another is allowed. */
const BUSY_MS = 30_000;

function field(payload: unknown, name: string): string {
  const value = (payload as Record<string, unknown> | undefined)?.[name];
  return typeof value === 'string' ? value : '';
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}

export class AutoLogin {
  readonly #ctx: Ctx;
  /** Cleared when the attempt limit is reached, so a wrong secret cannot hammer VRChat. */
  #armed = true;
  #attempts = 0;
  #busyUntil = 0;
  /**
   * Whether the last `vrcLogin` / `vrc2FA` was ours. A failure only counts against the limit
   * when it answers one of our attempts: the user typing a wrong password by hand must not
   * switch the patch off.
   */
  #ours = false;

  constructor(ctx: Ctx) {
    this.#ctx = ctx;
  }

  install(): void {
    const bag = this.#ctx.disposables;
    // Sent when the session expired, never when the user logged out on purpose — VRCNext's
    // explicit logout path does not prefill. So this cannot fight someone switching accounts.
    bag.add(this.#ctx.events.on('vrcPrefillLogin', (payload) => {
      void this.#onPrefill(field(payload, 'username'), field(payload, 'password'));
    }));
    bag.add(this.#ctx.events.on('vrcNeeds2FA', (payload) => {
      void this.#onNeeds2fa(field(payload, 'type') || 'totp');
    }));
    bag.add(this.#ctx.events.on('vrcLoginError', (payload) => {
      this.#onError(field(payload, 'error'));
    }));
    bag.add(this.#ctx.events.on('vrcUser', () => {
      if (this.#attempts > 0) this.#ctx.logger.info('Signed in; attempt counter reset.');
      this.#attempts = 0;
      this.#busyUntil = 0;
      this.#ours = false;
    }));
    // The prefill for a session that was already dead at startup can land before this plugin
    // activates. The fields VRCNext filled are still sitting there, so read them instead.
    void this.#catchUp();
  }

  async #catchUp(): Promise<void> {
    await sleep(SUBMIT_DELAY_MS, this.#ctx.signal);
    if (!this.#enabled()) return;
    const user = document.querySelector<HTMLInputElement>('#vrcQuickUser')?.value ?? '';
    const pass = document.querySelector<HTMLInputElement>('#vrcQuickPass')?.value ?? '';
    if (user === '' || pass === '') return;
    this.#ctx.logger.info('Login form was already waiting at startup; signing in.');
    await this.#onPrefill(user, pass);
  }

  #enabled(): boolean {
    return this.#armed && this.#ctx.settings.get('autoLogin');
  }

  async #onPrefill(username: string, password: string): Promise<void> {
    if (!this.#enabled() || username === '' || password === '') return;
    if (Date.now() < this.#busyUntil) return;
    this.#busyUntil = Date.now() + BUSY_MS;
    await sleep(SUBMIT_DELAY_MS, this.#ctx.signal);
    if (this.#ctx.signal.aborted) return;
    this.#ctx.logger.info(`Signing in as ${username}.`);
    this.#ours = true;
    this.#ctx.bridge.send('vrcLogin', { username, password });
  }

  async #onNeeds2fa(type: string): Promise<void> {
    if (!this.#enabled() || !this.#ctx.settings.get('answer2fa')) return;
    if (type === 'emailotp') {
      this.#ctx.logger.warn('VRChat asked for an emailed code, which this cannot answer. Over to you.');
      this.#ctx.ui.toast({ message: 'VRChat wants an emailed code — enter it yourself.', ok: false });
      return;
    }
    const secret = this.#ctx.settings.get('secret');
    if (!isSecret(secret)) {
      this.#ctx.logger.warn('No authenticator secret set; leaving the prompt to you.');
      return;
    }
    try {
      // A code with a second left on it is a wasted attempt against the limit.
      if (secondsLeft() < MIN_CODE_LIFE_S) await sleep(MIN_CODE_LIFE_S * 1000, this.#ctx.signal);
      if (this.#ctx.signal.aborted) return;
      const code = await totp(secret);
      this.#ctx.logger.info('Answering the 2FA prompt.');
      this.#ours = true;
      this.#ctx.bridge.send('vrc2FA', { code, type: 'totp' });
    } catch (error) {
      this.#ctx.logger.error(`Could not generate a code: ${String(error)}`);
      this.#ctx.ui.toast({ message: 'The authenticator secret is not valid base32.', ok: false });
      this.#disarm();
    }
  }

  #onError(error: string): void {
    if (!this.#ctx.settings.get('autoLogin') || !this.#ours) return;
    this.#ours = false;
    this.#busyUntil = 0;
    this.#attempts += 1;
    this.#ctx.logger.warn(`Sign-in attempt ${String(this.#attempts)} failed: ${error}`);
    if (this.#attempts >= this.#ctx.settings.get('maxAttempts')) this.#disarm();
  }

  /**
   * Stops trying until the plugin is next enabled. VRChat locks an account that is fed bad
   * codes, so the failure mode has to be "stop and say so", never "keep going".
   */
  #disarm(): void {
    if (!this.#armed) return;
    this.#armed = false;
    this.#ctx.logger.error('Automatic sign-in switched off after repeated failures. Sign in by hand.');
    this.#ctx.ui.toast({
      message: 'Automatic sign-in gave up — check the secret and sign in yourself.',
      ok: false,
    });
  }

  /** Re-arms after the user changes the settings, so a fixed secret does not need a restart. */
  rearm(): void {
    this.#armed = true;
    this.#attempts = 0;
  }
}
