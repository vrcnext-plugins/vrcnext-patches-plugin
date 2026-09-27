import { describe, expect, it } from 'vitest';

import { rootsOf, shortName } from './folders.js';

describe('rootsOf', () => {
  it('collapses the files to their roots, busiest first', () => {
    const roots = rootsOf({
      files: [
        { path: '/home/b/Pictures/VRChat/2026-09/a.png', folder: '/home/b/Pictures/VRChat' },
        { path: '/home/b/Pictures/VRChat/2026-09/b.png', folder: '/home/b/Pictures/VRChat' },
        { path: '/mnt/shots/c.png', folder: '/mnt/shots' },
      ],
    });
    expect(roots).toEqual([
      { folder: '/home/b/Pictures/VRChat', sample: '/home/b/Pictures/VRChat/2026-09/a.png', count: 2 },
      { folder: '/mnt/shots', sample: '/mnt/shots/c.png', count: 1 },
    ]);
  });

  it('ignores entries without both a path and a folder', () => {
    expect(rootsOf({ files: [{ folder: '/a' }, { path: '/a/b.png' }, {}] })).toEqual([]);
  });

  it('survives a payload that is not what it expects', () => {
    expect(rootsOf(undefined)).toEqual([]);
    expect(rootsOf({})).toEqual([]);
    expect(rootsOf({ files: 'nope' })).toEqual([]);
  });
});

describe('shortName', () => {
  it('names a folder by its last segment, on either separator', () => {
    expect(shortName('/home/b/Pictures/VRChat')).toBe('VRChat');
    expect(shortName('C:\\Users\\b\\Pictures\\VRChat')).toBe('VRChat');
    expect(shortName('/home/b/Pictures/VRChat/')).toBe('VRChat');
  });
});
