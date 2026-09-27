/**
 * RFC 6238 TOTP, on WebCrypto.
 *
 * VRChat's authenticator codes are the default everything uses: SHA-1, six digits, a thirty
 * second step. The secret is the base32 string the site shows beside the QR code.
 *
 * No dependency — `crypto.subtle` does the HMAC and base32 is a dozen lines.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const DIGITS = 6;
const STEP_SECONDS = 30;

/** Whether a string could be a base32 secret at all, so a typo is caught before a login is tried. */
export function isSecret(text: string): boolean {
  return normalise(text).length >= 16;
}

/** Upper case, no spaces or padding — how the secret is written on a screen versus stored. */
function normalise(text: string): string {
  return text.replace(/[\s-]/g, '').replace(/=+$/, '').toUpperCase();
}

/** base32 → bytes. Throws on a character that is not in the alphabet. */
function decode(secret: string): Uint8Array {
  const text = normalise(secret);
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of text) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error(`Not a base32 secret: "${char}" is not allowed.`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

/** The counter as the eight big-endian bytes HMAC is taken over. */
function counterBytes(counter: number): Uint8Array {
  const bytes = new Uint8Array(8);
  let rest = counter;
  for (let i = 7; i >= 0; i -= 1) {
    bytes[i] = rest & 0xff;
    rest = Math.floor(rest / 256);
  }
  return bytes;
}

/** The six digits for `at` (default: now). */
export async function totp(secret: string, at: number = Date.now()): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    decode(secret) as unknown as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const counter = Math.floor(at / 1000 / STEP_SECONDS);
  const mac = new Uint8Array(await crypto.subtle.sign(
    'HMAC', key, counterBytes(counter) as unknown as ArrayBuffer,
  ));
  // RFC 4226 dynamic truncation: the low nibble of the last byte picks the four bytes to read.
  const offset = (mac[mac.length - 1] ?? 0) & 0x0f;
  const binary = (((mac[offset] ?? 0) & 0x7f) << 24)
    | (((mac[offset + 1] ?? 0) & 0xff) << 16)
    | (((mac[offset + 2] ?? 0) & 0xff) << 8)
    | ((mac[offset + 3] ?? 0) & 0xff);
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

/** Seconds until the current code is replaced — shown so a near-expiry code is not submitted. */
export function secondsLeft(at: number = Date.now()): number {
  return STEP_SECONDS - (Math.floor(at / 1000) % STEP_SECONDS);
}
