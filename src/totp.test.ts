import { describe, expect, it } from 'vitest';

import { isSecret, secondsLeft, totp } from './totp.js';

// RFC 6238's test vectors use the ASCII secret "12345678901234567890", which is this in base32.
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('totp', () => {
  it('matches the RFC 6238 SHA-1 vectors', async () => {
    // The RFC prints eight digits; a six-digit code is the last six of the same number.
    await expect(totp(RFC_SECRET, 59_000)).resolves.toBe('287082');
    await expect(totp(RFC_SECRET, 1_111_111_109_000)).resolves.toBe('081804');
    await expect(totp(RFC_SECRET, 1_234_567_890_000)).resolves.toBe('005924');
    await expect(totp(RFC_SECRET, 2_000_000_000_000)).resolves.toBe('279037');
  });

  it('reads a secret the way a user pastes it, with spaces and padding', async () => {
    const spaced = 'gezd gnbv gy3t qojq gezd gnbv gy3t qojq==';
    await expect(totp(spaced, 59_000)).resolves.toBe('287082');
  });

  it('holds the same code for a whole 30 second step', async () => {
    const start = 1_234_567_890_000;
    const first = await totp(RFC_SECRET, start);
    await expect(totp(RFC_SECRET, start + 29_000)).resolves.toBe(first);
    await expect(totp(RFC_SECRET, start + 31_000)).resolves.not.toBe(first);
  });

  it('refuses a secret that is not base32', async () => {
    await expect(totp('not-a-secret-1088')).rejects.toThrow(/base32/);
  });

  it('rejects something too short to be a secret before a login is wasted on it', () => {
    expect(isSecret('JBSWY3DPEHPK3PXP')).toBe(true);
    expect(isSecret('123456')).toBe(false);
    expect(isSecret('')).toBe(false);
  });

  it('counts down to the end of the step', () => {
    expect(secondsLeft(0)).toBe(30);
    expect(secondsLeft(29_000)).toBe(1);
    expect(secondsLeft(30_000)).toBe(30);
  });
});
