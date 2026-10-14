/**
 * Keeps a friend card the same height when its avatar image fails to load.
 *
 * VRCNext answers a broken avatar with `onerror="this.style.display='none'"`. Removing the image
 * from the layout collapses its row to the card's padding, which leaves the status dot and the
 * nameplate frame floating over the neighbouring cards — most visible in the collapsed sidebar,
 * where a card is nothing but its avatar. A cache entry lost to an unclean shutdown is enough to
 * trigger it, so on a bad day a sidebar is half holes.
 *
 * It is CSS rather than script on purpose. The obvious fix is to replace the broken image with
 * the same initial-letter placeholder an account with no picture gets, but that means reaching
 * `avatarFallback` on the page, and the plugin source policy bans page globals — rightly, since
 * that is the host application's own code. The alternative, an observer watching for broken
 * images, would run over more than a thousand friend cards for a cosmetic fix. One stylesheet
 * costs nothing at any list size and cannot loop.
 *
 * The trade is that the slot stays empty rather than showing the person's initial. The reported
 * problem is the collapse, and this fixes that completely.
 */

import { type PluginContext } from '@vrcnext/plugin-api';

/**
 * Why the selectors look for any inline style at all: VRCNext's templates give these images no
 * `style` attribute, so one being there means the error handler is what put it there. Matching
 * the attribute rather than `display:none` exactly avoids depending on how the engine spells a
 * serialised inline style back out.
 *
 * `visibility` rather than a background or a placeholder glyph: a failed image that is still
 * displayed can draw the engine's own broken-image icon, which is worse than a gap. Hidden
 * visibility reserves the box and draws nothing at all.
 */
const CSS = `
img.vrc-friend-avatar[style],
img.vrc-avatar[style] {
  display: inline-block !important;
  visibility: hidden;
}
`;

/** Installs the stylesheet; the handle is owned by the host and removed when the plugin stops. */
export function installAvatarFallback(ctx: PluginContext<never>): void {
  ctx.ui.injectCss(CSS);
}

/** Exported for the test: the rule has to beat an inline style, so it has to be `!important`. */
export const AVATAR_FALLBACK_CSS = CSS;
