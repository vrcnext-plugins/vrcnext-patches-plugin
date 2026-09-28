# VRCNext Patches

Small things VRCNext does not do, done from the page. Each patch is independent and off until
you switch it on; disabling the plugin puts everything back.

## Media library folders

VRCNext reveals one photo at a time, from the right-click menu on it. There is no way to open
the folders the library is scanned from. This adds a button per root — the VRChat picture
directory and any watch folders — under Settings → VRCNext Patches.

## Unattended sign-in

When VRChat drops the session, VRCNext clears both saved cookies, **including the
`twoFactorAuth` one** — the very thing that would let the next sign-in skip the authenticator
code — and then hands the page the saved username and password so the login form can fill
itself in. Every re-login therefore costs a button press and a fresh code. On a connection whose
address changes daily, that is a daily chore.

None of that can be fixed from a plugin: the cookie jar lives in the VRCNext backend. What a
plugin can do is press the button and type the code.

- The password is **never stored here**. VRCNext hands it over on `vrcPrefillLogin`, from its
  own encrypted store, each time it is needed.
- Only a TOTP ("authenticator app") prompt can be answered. An emailed code is left to you.
- After a configurable number of consecutive failures the patch switches itself off for the
  session, because VRChat locks an account that is fed bad codes.
- It reacts only to an *expired* session. VRCNext does not prefill after a deliberate logout, so
  this cannot fight you while you switch accounts.

### The secret is stored in plain text

Plugin settings live in `~/.vrcnext-plugins/state.json`, unencrypted, and every plugin in the
page can read it. Anyone holding that file has permanent access to the account, and an
authenticator secret cannot be rotated as easily as a password. Only turn this on for an account
where that is an acceptable trade.

A `secrets` service in the VRCNext Bridge, backed by the freedesktop Secret Service (KWallet,
GNOME Keyring), would keep the secret out of the page entirely — the plugin would ask for a
*code* and never see the seed. Until that exists, the warning above stands.

## Permissions

`host:actions` and `host:events`, each narrowed to an exact list in `plugin.json`:
`revealInExplorer`, `scanLibrary`, `openShortcutFolder`, `vrcLogin`, `vrc2FA` and the events
that answer them. No network access, no VRChat API access, no game log.

## Signature

Every release of this plugin is signed; the bridge refuses to install or update it otherwise,
and it stays pinned to this key. Check the fingerprint against the one VRCNext shows you when it
asks whether to trust a new signing key:

```
1bc6-e13e-c44c-3bd0-f5a8-5618-8b9b-919c
```

If an update ever says the key changed, stop and ask before confirming.
