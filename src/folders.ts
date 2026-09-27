/**
 * "Open media library folder".
 *
 * VRCNext can reveal one photo at a time, from the right-click menu on it, but there is no way
 * to open the library's folders themselves. The library scan already reports the root each file
 * was found under, so the roots are simply the distinct `folder` values — the VRChat picture
 * directory plus whatever watch folders are configured.
 *
 * `revealInExplorer` insists on a path that is a file (`File.Exists`), so each button reveals
 * one file inside its folder; the file manager opens the folder around it either way. On Linux
 * VRCNext goes through the FileManager1 D-Bus interface and falls back to `xdg-open`.
 */

import { type PluginContext } from '@vrcnext/plugin-api';

/** A library root, and something inside it to point the file manager at. */
export interface Root {
  readonly folder: string;
  readonly sample: string;
  readonly count: number;
}

interface LibraryFile {
  readonly path?: unknown;
  readonly folder?: unknown;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** The distinct roots in a `libraryData` payload, most-populated first. */
export function rootsOf(payload: unknown): readonly Root[] {
  const files = (payload as { files?: unknown } | undefined)?.files;
  if (!Array.isArray(files)) return [];
  const found = new Map<string, { sample: string; count: number }>();
  for (const entry of files as readonly LibraryFile[]) {
    const folder = text(entry.folder);
    const path = text(entry.path);
    if (folder === '' || path === '') continue;
    const seen = found.get(folder);
    if (seen === undefined) found.set(folder, { sample: path, count: 1 });
    else seen.count += 1;
  }
  return [...found]
    .map(([folder, { sample, count }]) => ({ folder, sample, count }))
    .sort((a, b) => b.count - a.count);
}

/** The last path segment, for a button that is not 200 characters wide. */
export function shortName(folder: string): string {
  const parts = folder.split(/[\\/]/).filter((part) => part !== '');
  return parts[parts.length - 1] ?? folder;
}

export class FolderCard {
  readonly #ctx: PluginContext;
  #body: HTMLElement | undefined;
  #roots: readonly Root[] = [];
  #asked = false;

  constructor(ctx: PluginContext) {
    this.#ctx = ctx;
  }

  install(): void {
    this.#ctx.ui.addSettingsCard({
      title: 'Media library folders',
      icon: 'folder_open',
      // The plugin's settings are all about signing in; they belong on that card, not this one.
      settings: false,
      render: (card) => {
        card.appendChild(this.#ctx.ui.kit.description(
          'VRCNext can reveal a single photo from its right-click menu, but never the folders '
          + 'themselves. These are the roots the library is scanned from.',
        ));
        const body = document.createElement('div');
        this.#body = body;
        card.appendChild(body);
        this.#draw();
        void this.#load();
      },
    });
  }

  /** Asks for the library listing once; the scan is cached backend-side after the first one. */
  async #load(): Promise<void> {
    if (this.#asked) return;
    this.#asked = true;
    try {
      const payload = await this.#ctx.bridge.request('scanLibrary', {}, {
        expect: 'libraryData',
        timeoutMs: 30_000,
        signal: this.#ctx.signal,
      });
      this.#roots = rootsOf(payload);
      this.#ctx.logger.info(`Media library spans ${String(this.#roots.length)} folder(s).`);
    } catch (error) {
      this.#ctx.logger.warn(`Could not read the media library: ${String(error)}`);
    }
    this.#draw();
  }

  #draw(): void {
    const body = this.#body;
    if (body === undefined) return;
    const kit = this.#ctx.ui.kit;
    if (this.#roots.length === 0) {
      kit.setChildren(body, [kit.emptyState(this.#asked ? 'No media found to open.' : 'Reading the library…')]);
      return;
    }
    kit.setChildren(body, this.#roots.map((root) => kit.row({
      label: shortName(root.folder),
      detail: `${root.folder} · ${String(root.count)} file(s)`,
      value: kit.button({
        label: 'Open',
        icon: 'folder_open',
        onClick: () => { this.open(root); },
      }),
    })));
  }

  open(root: Root): void {
    this.#ctx.bridge.send('revealInExplorer', { path: root.sample });
    this.#ctx.ui.toast({ message: `Opening ${shortName(root.folder)}…` });
  }
}
