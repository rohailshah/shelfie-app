import { describe, expect, it } from 'vitest';
import {
  computeRippleOnBulkComplete,
  computeRippleOnComplete,
  DUST_THRESHOLD_DAYS,
  formatDateGroupLabel,
  getContainerProgress,
  getLatestCompletedAt,
  getOverlappingContainers,
  getUnlockedCollections,
  isItemCollectingDust,
} from './graph';
import { ActiveBoardEntry, AtomNode, ContainerNode, ProgressEntry } from './types';

const ATOMS: Record<string, AtomNode> = {
  'ch-1': { id: 'ch-1', title: 'Ch. 1', kind: 'chapter', medium: 'manga' },
  'ch-2': { id: 'ch-2', title: 'Ch. 2', kind: 'chapter', medium: 'manga' },
  'ch-3': { id: 'ch-3', title: 'Ch. 3', kind: 'chapter', medium: 'manga' },
  'ch-4': { id: 'ch-4', title: 'Ch. 4', kind: 'chapter', medium: 'manga' },
};

const SERIES: ContainerNode = {
  id: 'series',
  title: 'Test Manga',
  subtitle: 'Ch. 1-4',
  kind: 'manga_series',
  kindLabel: 'Manga',
  pillar: 'read',
  medium: 'manga',
  atomIds: ['ch-1', 'ch-2', 'ch-3', 'ch-4'],
  accentFrom: '#E87151',
  accentTo: '#1B1D24',
  monogram: 'TST',
  unitPlural: 'ch',
};

const VOL_1: ContainerNode = {
  id: 'vol-1',
  title: 'Test Manga Vol. 1',
  subtitle: 'Ch. 1-2',
  kind: 'manga_volume',
  kindLabel: 'Volume 1',
  pillar: 'read',
  medium: 'manga',
  atomIds: ['ch-1', 'ch-2'],
  accentFrom: '#E87151',
  accentTo: '#1B1D24',
  monogram: 'V01',
  unitPlural: 'ch',
};

const OMNIBUS: ContainerNode = {
  id: 'omnibus',
  title: 'Test Manga Omnibus',
  subtitle: 'Ch. 1-3',
  kind: 'omnibus',
  kindLabel: 'Omnibus',
  pillar: 'read',
  medium: 'manga',
  atomIds: ['ch-1', 'ch-2', 'ch-3'],
  accentFrom: '#E87151',
  accentTo: '#1B1D24',
  monogram: 'OMN',
  unitPlural: 'ch',
};

const CONTAINERS = [SERIES, VOL_1, OMNIBUS];

describe('graph engine', () => {
  it('computes container progress and nextAtom accurately', () => {
    const completed = new Set(['ch-1']);
    const prog = getContainerProgress(SERIES, completed, ATOMS);
    expect(prog.completed).toBe(1);
    expect(prog.total).toBe(4);
    expect(prog.percent).toBe(25);
    expect(prog.remaining).toBe(3);
    expect(prog.isComplete).toBe(false);
    expect(prog.nextAtom?.id).toBe('ch-2');

    const full = getContainerProgress(
      VOL_1,
      new Set(['ch-1', 'ch-2']),
      ATOMS
    );
    expect(full.isComplete).toBe(true);
    expect(full.remaining).toBe(0);
    expect(full.nextAtom).toBeNull();
  });

  it('finds overlapping containers sorted by shared atom count', () => {
    const overlaps = getOverlappingContainers('series', CONTAINERS);
    expect(overlaps.map((o) => [o.container.id, o.sharedAtomCount])).toEqual([
      ['omnibus', 3],
      ['vol-1', 2],
    ]);
  });

  it('computes direct completion, implicit unlock, 1-left, and partial advance on single log', () => {
    const prev = new Set(['ch-1']);
    const ev = computeRippleOnComplete('ch-2', 'series', prev, CONTAINERS, ATOMS);

    expect(ev.atomIds).toEqual(['ch-2']);
    expect(ev.completedContainers).toEqual([
      {
        id: 'vol-1',
        title: 'Test Manga Vol. 1',
        kindLabel: 'Volume 1',
        isImplicit: true,
      },
    ]);
    expect(ev.oneLeftContainers).toEqual([
      {
        id: 'omnibus',
        title: 'Test Manga Omnibus',
        kindLabel: 'Omnibus',
        nextAtomTitle: 'Ch. 3',
      },
    ]);
    expect(ev.advancedContainers).toEqual([]);

    const prevZero = new Set<string>();
    const partial = computeRippleOnComplete('ch-1', 'series', prevZero, CONTAINERS, ATOMS);
    expect(partial.oneLeftContainers.map((o) => o.id)).toEqual(['vol-1']);
    expect(partial.advancedContainers).toEqual([
      {
        id: 'omnibus',
        title: 'Test Manga Omnibus',
        kindLabel: 'Omnibus',
        completed: 1,
        total: 3,
      },
    ]);

    const finalEv = computeRippleOnComplete(
      'ch-2',
      'vol-1',
      new Set(['ch-1']),
      [VOL_1],
      ATOMS
    );
    expect(finalEv.completedContainers).toEqual([
      {
        id: 'vol-1',
        title: 'Test Manga Vol. 1',
        kindLabel: 'Volume 1',
        isImplicit: false,
      },
    ]);
  });

  it('computes bulk completion ripples and carries full atomIds for batch undo', () => {
    const prev = new Set(['ch-1']);
    const remaining = ['ch-2', 'ch-3', 'ch-4'];
    const ev = computeRippleOnBulkComplete(
      remaining,
      'series',
      prev,
      CONTAINERS,
      ATOMS
    );

    expect(ev.atomIds).toEqual(['ch-2', 'ch-3', 'ch-4']);
    expect(ev.completedContainers).toEqual([
      { id: 'series', title: 'Test Manga', kindLabel: 'Manga', isImplicit: false },
      { id: 'vol-1', title: 'Test Manga Vol. 1', kindLabel: 'Volume 1', isImplicit: true },
      { id: 'omnibus', title: 'Test Manga Omnibus', kindLabel: 'Omnibus', isImplicit: true },
    ]);

    const partialBulk = computeRippleOnBulkComplete(
      ['ch-1'],
      'series',
      new Set(),
      CONTAINERS,
      ATOMS
    );
    expect(partialBulk.advancedContainers).toEqual([
      {
        id: 'omnibus',
        title: 'Test Manga Omnibus',
        kindLabel: 'Omnibus',
        completed: 1,
        total: 3,
      },
    ]);
  });

  it('tracks unlocked collections and distinguishes implicit vs active', () => {
    const unlocked = getUnlockedCollections(
      CONTAINERS,
      new Set(['ch-1', 'ch-2']),
      ATOMS,
      new Set(['series'])
    );
    expect(unlocked.map((u) => [u.container.id, u.isImplicit])).toEqual([
      ['vol-1', true],
    ]);
  });

  it('returns the latest completedAt timestamp for a container', () => {
    const progressMap: Record<string, ProgressEntry> = {
      'ch-1': { atomId: 'ch-1', completedAt: '2026-11-20T10:00:00.000Z' },
      'ch-2': { atomId: 'ch-2', completedAt: '2026-11-22T12:30:00.000Z' },
    };
    expect(getLatestCompletedAt(VOL_1, progressMap)).toBe('2026-11-22T12:30:00.000Z');
    expect(getLatestCompletedAt(SERIES, {})).toBeNull();
  });

  it('syncs a Full Series container with an individual Season container via canonical episode IDs', () => {
    const tvAtoms: Record<string, AtomNode> = {
      'tvmaze:99:s1:e1': { id: 'tvmaze:99:s1:e1', title: 'Pilot', subtitle: 'S1 · E1', kind: 'episode', medium: 'tv' },
      'tvmaze:99:s1:e2': { id: 'tvmaze:99:s1:e2', title: 'Arc', subtitle: 'S1 · E2', kind: 'episode', medium: 'tv' },
      'tvmaze:99:s2:e1': { id: 'tvmaze:99:s2:e1', title: 'Return', subtitle: 'S2 · E1', kind: 'episode', medium: 'tv' },
    };

    const fullShow: ContainerNode = {
      id: 'show-full',
      title: 'Test Show',
      subtitle: 'Full Series · 3 eps',
      kind: 'saga',
      kindLabel: 'Full Series',
      pillar: 'watch',
      medium: 'tv',
      atomIds: ['tvmaze:99:s1:e1', 'tvmaze:99:s1:e2', 'tvmaze:99:s2:e1'],
      accentFrom: '#4D8CE8',
      accentTo: '#1B1D24',
      monogram: 'TS',
      unitPlural: 'eps',
    };

    const season1: ContainerNode = {
      id: 'show-s1',
      title: 'Test Show · Season 1',
      subtitle: 'Season 1 · 2 eps',
      kind: 'season',
      kindLabel: 'Season 1',
      pillar: 'watch',
      medium: 'tv',
      atomIds: ['tvmaze:99:s1:e1', 'tvmaze:99:s1:e2'],
      accentFrom: '#4D8CE8',
      accentTo: '#1B1D24',
      monogram: 'TS',
      unitPlural: 'eps',
    };

    const ev = computeRippleOnComplete(
      'tvmaze:99:s1:e2',
      'show-full',
      new Set(['tvmaze:99:s1:e1']),
      [fullShow, season1],
      tvAtoms
    );

    expect(ev.completedContainers).toEqual([
      {
        id: 'show-s1',
        title: 'Test Show · Season 1',
        kindLabel: 'Season 1',
        isImplicit: true,
      },
    ]);

    const fullShowProg = getContainerProgress(
      fullShow,
      new Set(['tvmaze:99:s1:e1', 'tvmaze:99:s1:e2']),
      tvAtoms
    );
    expect(fullShowProg.completed).toBe(2);
    expect(fullShowProg.nextAtom?.id).toBe('tvmaze:99:s2:e1');
  });

  it('identifies Collecting dust items across backlog, paused, and 14-day stale states', () => {
    const now = new Date('2026-11-22T12:00:00.000Z').getTime();
    const recentIso = new Date(now - 3 * 86_400_000).toISOString();
    const staleIso = new Date(
      now - (DUST_THRESHOLD_DAYS + 1) * 86_400_000
    ).toISOString();

    // Unpinned backlog -> collecting dust
    expect(isItemCollectingDust(SERIES, undefined, 'backlog', {}, now)).toBe(true);
    // Unpinned non-backlog -> not collecting dust
    expect(isItemCollectingDust(SERIES, undefined, 'wishlist', {}, now)).toBe(false);

    // Manually paused -> collecting dust even if just added
    const pausedEntry: ActiveBoardEntry = {
      containerId: SERIES.id,
      trackSingleItem: false,
      addedAt: recentIso,
      paused: true,
    };
    expect(isItemCollectingDust(SERIES, pausedEntry, 'none', {}, now)).toBe(true);

    // Active entry older than 14 days with no recent logs -> collecting dust
    const staleEntry: ActiveBoardEntry = {
      containerId: SERIES.id,
      trackSingleItem: false,
      addedAt: staleIso,
    };
    expect(isItemCollectingDust(SERIES, staleEntry, 'none', {}, now)).toBe(true);

    // Same stale entry becomes active if a unit was logged within 14 days
    const recentProgress: Record<string, ProgressEntry> = {
      'ch-1': { atomId: 'ch-1', completedAt: recentIso, sourceContainerId: SERIES.id },
    };
    expect(isItemCollectingDust(SERIES, staleEntry, 'none', recentProgress, now)).toBe(
      false
    );
  });

  it('formats diary date group labels cleanly', () => {
    const now = new Date(2026, 10, 22, 15, 0, 0).getTime();
    const todayIso = new Date(2026, 10, 22, 9, 30, 0).toISOString();
    const yesterdayIso = new Date(2026, 10, 21, 20, 0, 0).toISOString();
    const olderIso = new Date(2026, 10, 10, 12, 0, 0).toISOString();

    expect(formatDateGroupLabel(todayIso, now)).toBe('Today');
    expect(formatDateGroupLabel(yesterdayIso, now)).toBe('Yesterday');
    expect(formatDateGroupLabel(olderIso, now)).toBe('Nov 10, 2026');
  });
});
