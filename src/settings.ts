/**
 * What the patches need to know. Everything is off until it is turned on.
 */

import { type SettingsSchema, type SettingsValues } from '@vrcnext/plugin-api';

export const settings = {
  autoLogin: {
    kind: 'boolean',
    label: 'Sign in again by itself',
    description:
      'When VRChat drops the session, VRCNext hands the page the saved username and password '
      + 'and waits for you to press Login. This presses it.',
    default: false,
  },
  answer2fa: {
    kind: 'boolean',
    label: 'Answer the 2FA prompt',
    description:
      'VRCNext throws away its saved twoFactorAuth cookie on every sign-out, so VRChat asks for '
      + 'a code every single time. This generates it from the secret below.',
    default: false,
    disabled: (values) => values['autoLogin'] !== true,
  },
  secret: {
    kind: 'string',
    label: 'Authenticator secret',
    description:
      'The base32 secret from VRChat\'s two-factor setup screen — the text beside the QR code, '
      + 'not a six-digit code. STORED IN PLAIN TEXT: see the warning on this page.',
    default: '',
    format: 'password',
    placeholder: 'JBSWY3DPEHPK3PXP',
    disabled: (values) => values['answer2fa'] !== true,
  },
  maxAttempts: {
    kind: 'number',
    label: 'Give up after',
    description:
      'Consecutive failed sign-ins before the patch switches itself off for this session. '
      + 'VRChat locks an account that is hammered with bad codes.',
    default: 2,
    min: 1,
    max: 5,
    markers: [1, 2, 3, 4, 5],
    integer: true,
    unit: ' tries',
    disabled: (values) => values['autoLogin'] !== true,
  },
} as const satisfies SettingsSchema;

export type Settings = typeof settings;
export type Values = SettingsValues<Settings>;
