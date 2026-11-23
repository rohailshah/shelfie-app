import { describe, expect, it } from 'vitest';
import {
  buildPairingUrl,
  extractSyncCodeFromHash,
  formatSyncCode,
  generateSyncCode,
  isEmptyAppState,
  isValidSyncCode,
  mergeAppStates,
} from './sync';
import { AppState } from './types';

function makeEmptyState(): AppState {
  return {
    progress: {},
    activeBoard: [],
    shelf: {},
    customAtoms: {},
    customContainers: [],
  };
}

describe('sync code helpers', () => {
  it('generates valid 16-char codes formatted as XXXX-XXXX-XXXX-XXXX', () => {
    const code = generateSyncCode();
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(code).not.toMatch(/[0OIL1]/);
    expect(isValidSyncCode(code)).toBe(true);
    expect(formatSyncCode(code.toLowerCase().replace(/-/g, ''))).toBe(code);
  });

  it('builds and parses hash pairing URLs without query params', () => {
    const code = 'ABCD-EFGH-2345-6789';
    const url = buildPairingUrl(code, 'https://shelfie-app-iota.vercel.app', '/');
    expect(url).toBe('https://shelfie-app-iota.vercel.app/#sync=ABCD-EFGH-2345-6789');
    expect(url).not.toContain('?sync=');

    expect(extractSyncCodeFromHash('#sync=abcd-efgh-2345-6789')).toBe(code);
    expect(extractSyncCodeFromHash('#sync=ABCDEFGH23456789')).toBe(code);
    expect(extractSyncCodeFromHash('#sync=short')).toBeNull();
    expect(extractSyncCodeFromHash('#other=123')).toBeNull();
    expect(extractSyncCodeFromHash('')).toBeNull();
  });
});

describe('mergeAppStates', () => {
  it('adopts remote when local is empty and keeps local when remote is empty', () => {
    const empty = makeEmptyState();
    const populated: AppState = {
      progress: {
        'tvmaze:1:s1:e1': {
          atomId: 'tvmaze:1:s1:e1',
          completedAt: '2026-11-22T20:00:00.000Z',
          sourceContainerId: 'c1',
        },
      },
      activeBoard: [
        {
          containerId: 'c1',
          trackSingleItem: false,
          addedAt: '2026-11-22T19:00:00.000Z',
        },
      ],
      shelf: { c1: 'owned_digital' },
      customAtoms: {
        'tvmaze:1:s1:e1': {
          id: 'tvmaze:1:s1:e1',
          title: 'Pilot',
          kind: 'episode',
          medium: 'tv',
        },
      },
      customContainers: [
        {
          id: 'c1',
          title: 'Severance',
          subtitle: 'TV · 1 eps',
          kind: 'season',
          kindLabel: 'TV Series',
          pillar: 'watch',
          medium: 'tv',
          atomIds: ['tvmaze:1:s1:e1'],
          accentFrom: '#4D8CE8',
          accentTo: '#16161A',
          monogram: 'SEV',
          unitPlural: 'eps',
        },
      ],
    };

    expect(isEmptyAppState(empty)).toBe(true);
    expect(isEmptyAppState(populated)).toBe(false);
    expect(mergeAppStates(empty, populated, true)).toEqual(populated);
    expect(mergeAppStates(populated, empty, false)).toEqual(populated);
  });

  it('unions concurrent progress, containers, atoms, and activeBoard across devices', () => {
    const desktop: AppState = {
      progress: {
        'ep-1': {
          atomId: 'ep-1',
          completedAt: '2026-11-22T20:00:00.000Z',
          sourceContainerId: 'show-1',
        },
      },
      activeBoard: [
        {
          containerId: 'show-1',
          trackSingleItem: false,
          addedAt: '2026-11-22T19:00:00.000Z',
        },
      ],
      shelf: { 'show-1': 'none' },
      customAtoms: {
        'ep-1': { id: 'ep-1', title: 'Ep 1', kind: 'episode', medium: 'tv' },
        'ep-2': { id: 'ep-2', title: 'Ep 2', kind: 'episode', medium: 'tv' },
      },
      customContainers: [
        {
          id: 'show-1',
          title: 'Show One',
          subtitle: 'TV · 2 eps',
          kind: 'season',
          kindLabel: 'TV Series',
          pillar: 'watch',
          medium: 'tv',
          atomIds: ['ep-1', 'ep-2'],
          accentFrom: '#4D8CE8',
          accentTo: '#16161A',
          monogram: 'SHW',
          unitPlural: 'eps',
        },
      ],
      profile: {
        displayName: 'Rohail',
        avatarColor: '#E87151',
        joinedAt: '2026-11-22T18:00:00.000Z',
      },
    };

    const phone: AppState = {
      progress: {
        'ep-2': {
          atomId: 'ep-2',
          completedAt: '2026-11-22T20:10:00.000Z',
          sourceContainerId: 'show-1',
        },
      },
      activeBoard: [
        {
          containerId: 'book-1',
          trackSingleItem: false,
          addedAt: '2026-11-22T20:05:00.000Z',
        },
        {
          containerId: 'show-1',
          trackSingleItem: false,
          addedAt: '2026-11-22T19:00:00.000Z',
        },
      ],
      shelf: { 'book-1': 'owned_physical' },
      customAtoms: {
        'ch-1': { id: 'ch-1', title: 'Issue #1', kind: 'issue', medium: 'comic' },
      },
      customContainers: [
        {
          id: 'book-1',
          title: 'All-Star Superman',
          subtitle: 'DC Compact · 1 issues',
          kind: 'tpb',
          kindLabel: 'DC Compact',
          pillar: 'read',
          medium: 'comic',
          atomIds: ['ch-1'],
          accentFrom: '#E87151',
          accentTo: '#16161A',
          monogram: 'ASS',
          unitPlural: 'issues',
        },
      ],
      profile: {
        displayName: 'My Shelfie',
        avatarColor: '#E87151',
        joinedAt: '2026-11-22T20:00:00.000Z',
      },
    };

    const merged = mergeAppStates(desktop, phone, true);
    expect(Object.keys(merged.progress)).toEqual(
      expect.arrayContaining(['ep-1', 'ep-2'])
    );
    expect(merged.customContainers.map((c) => c.id)).toEqual(['book-1', 'show-1']);
    expect(merged.activeBoard.map((e) => e.containerId)).toEqual(['book-1', 'show-1']);
    expect(Object.keys(merged.customAtoms)).toEqual(
      expect.arrayContaining(['ep-1', 'ep-2', 'ch-1'])
    );
    expect(merged.shelf['book-1']).toBe('owned_physical');
    expect(merged.shelf['show-1']).toBe('none');
    expect(merged.profile?.displayName).toBe('Rohail');
  });
});
