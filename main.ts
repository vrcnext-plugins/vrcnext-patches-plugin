/**
 * VRCNext Patches.
 *
 * Small things VRCNext does not do, done from the page. Each patch is independent and off until
 * it is switched on; nothing here changes VRCNext's own behaviour when the plugin is disabled.
 *
 * - **Media library folders**: a button per library root. VRCNext can only reveal one photo at
 *   a time, from its right-click menu.
 * - **Unattended sign-in**: presses Login and answers the authenticator prompt when the session
 *   expires. See `src/autologin.ts` for why VRCNext asks every single time.
 */

import { definePlugin, type PluginId } from '@vrcnext/plugin-api';

import { AutoLogin } from './src/autologin.js';
import { FolderCard } from './src/folders.js';
import { settings } from './src/settings.js';

export default definePlugin({
  id: 'patches' as PluginId,
  settings,

  activate(ctx) {
    new FolderCard(ctx).install();

    const login = new AutoLogin(ctx);
    login.install();
    ctx.disposables.add(ctx.settings.onChange(() => { login.rearm(); }));

    ctx.ui.addSettingsCard({
      title: 'Sign-in',
      icon: 'key',
      render: (card) => {
        card.appendChild(ctx.ui.kit.description(
          'VRCNext clears its saved twoFactorAuth cookie whenever the session ends, so VRChat '
          + 'asks for a code on every sign-in. The cookie lives in the backend and cannot be '
          + 'repaired from here — this answers the prompt instead.',
        ));
        card.appendChild(ctx.ui.kit.statusCard({
          tone: 'warn',
          label: 'The authenticator secret is stored in plain text',
        }));
        card.appendChild(ctx.ui.kit.description(
          'Plugin settings live in ~/.vrcnext-plugins/state.json, unencrypted, and every plugin '
          + 'in the page can read it. Anyone holding that file has permanent access to the '
          + 'account, and an authenticator secret cannot be rotated as easily as a password. '
          + 'Only turn this on for an account where that is an acceptable trade.',
        ));
      },
    });

    ctx.logger.info(`VRCNext Patches v${ctx.version} active.`);
  },

  deactivate() {
    // Every listener and card went through `ctx`, so the host tears them down.
  },
});
