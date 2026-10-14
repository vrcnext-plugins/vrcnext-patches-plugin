import assert from 'node:assert/strict';
import { test } from 'vitest';

import { AVATAR_FALLBACK_CSS } from './avatar-fallback.js';

test('the rule beats the inline style VRCNext writes, and reserves the box', () => {
  // `onerror="this.style.display='none'"` is an inline style, so nothing without `!important`
  // can win against it — a rule that loses is a patch that silently does nothing.
  assert.match(AVATAR_FALLBACK_CSS, /display:\s*inline-block\s*!important/);
  // The whole point is that the row keeps its height; `display:none` would reintroduce the bug.
  assert.doesNotMatch(AVATAR_FALLBACK_CSS, /display:\s*none/);
  // Nothing is drawn in the reserved box: a shown broken image draws the engine's own icon.
  assert.match(AVATAR_FALLBACK_CSS, /visibility:\s*hidden/);
});

test('both places VRCNext renders an avatar are covered', () => {
  // The sidebar friend card and the profile header. Missing either leaves half the bug.
  assert.match(AVATAR_FALLBACK_CSS, /img\.vrc-friend-avatar\[style\]/);
  assert.match(AVATAR_FALLBACK_CSS, /img\.vrc-avatar\[style\]/);
});
