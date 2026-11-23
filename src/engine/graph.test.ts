import { describe, expect, it } from 'vitest';
import {
  computeRippleOnBulkComplete,
  computeRippleOnComplete,
  DUST_THRESHOLD_DAYS,
  formatBingersCode,
  formatDateGroupLabel,
  getContainerProgress,
  getLatestCompletedAt,
  getOverlappingContainers,
  getUnlockedCollections,
  isItemCollectingDust,
  reconcileEditionAtoms,
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

  it('formats zero-padded Bingers episode codes cleanly', () => {
    expect(formatBingersCode('S1 · E2', 'TV')).toBe('S01 E02');
    expect(formatBingersCode('S3 E4', 'TV')).toBe('S03 E04');
    expect(formatBingersCode('S12 · E105', 'TV')).toBe('S12 E105');
    expect(formatBingersCode('Ch. 7', 'Manga')).toBe('Ch. 7');
    expect(formatBingersCode(undefined, 'Movie')).toBe('Movie');
  });

  it('reconciles 6-issue series to 13-issue DC Compact without losing checked progress', () => {
    const comicContainer: ContainerNode = {
      id: 'flash-1',
      title: 'The Flash: Rebirth',
      subtitle: 'Digital · 6 issues',
      kind: 'tpb',
      kindLabel: 'Digital',
      pillar: 'read',
      medium: 'comic',
      atomIds: [
        'ol:comic:the-flash-rebirth:1',
        'ol:comic:the-flash-rebirth:2',
        'ol:comic:the-flash-rebirth:3',
        'ol:comic:the-flash-rebirth:4',
        'ol:comic:the-flash-rebirth:5',
        'ol:comic:the-flash-rebirth:6',
      ],
      accentFrom: '#D99B43',
      accentTo: '#16161A',
      monogram: 'TFR',
      unitPlural: 'issues',
    };

    const existingAtoms: Record<string, AtomNode> = {};
    for (let i = 1; i <= 6; i += 1) {
      const id = `ol:comic:the-flash-rebirth:${i}`;
      existingAtoms[id] = {
        id,
        title: `The Flash: Rebirth #${i}`,
        kind: 'issue',
        medium: 'comic',
      };
    }

    const progressMap: Record<string, ProgressEntry> = {
      'ol:comic:the-flash-rebirth:1': {
        atomId: 'ol:comic:the-flash-rebirth:1',
        completedAt: '2026-11-22T20:00:00.000Z',
        sourceContainerId: 'flash-1',
      },
      'ol:comic:the-flash-rebirth:2': {
        atomId: 'ol:comic:the-flash-rebirth:2',
        completedAt: '2026-11-22T20:01:00.000Z',
        sourceContainerId: 'flash-1',
      },
    };

    const compactUnits = [
      ...Array.from({ length: 6 }, (_, i) => ({
        title: `The Flash: Rebirth #${i + 1}`,
        subtitle: 'The Flash: Rebirth',
        unitNumber: i + 1,
        canonicalKey: `the-flash-rebirth:${i + 1}`,
      })),
      ...Array.from({ length: 7 }, (_, i) => ({
        title: `The Flash (vol. 3) #${i + 1}`,
        subtitle: 'The Flash (vol. 3)',
        unitNumber: i + 1,
        canonicalKey: `the-flash-vol-3:${i + 1}`,
      })),
    ];

    const expanded = reconcileEditionAtoms({
      container: comicContainer,
      existingAtomsById: existingAtoms,
      progressMap,
      targetUnits: compactUnits,
      unitPrefix: 'Issue #',
      atomKind: 'issue',
    });

    expect(expanded.nextAtomIds).toHaveLength(13);
    expect(expanded.nextAtomIds[0]).toBe('ol:comic:the-flash-rebirth:1');
    expect(expanded.nextAtomIds[6]).toBe('ol:comic:the-flash-vol-3:1');
    expect(Object.keys(expanded.newAtoms)).toHaveLength(7);

    // Completed issues #1, #2 and #10 stay preserved if shrinking back down to 6 issues
    const progressWithVol3: Record<string, ProgressEntry> = {
      ...progressMap,
      'ol:comic:the-flash-vol-3:4': {
        atomId: 'ol:comic:the-flash-vol-3:4',
        completedAt: '2026-11-22T20:05:00.000Z',
        sourceContainerId: 'flash-1',
      },
    };

    const expandedContainer: ContainerNode = {
      ...comicContainer,
      atomIds: expanded.nextAtomIds,
    };

    const shrunk = reconcileEditionAtoms({
      container: expandedContainer,
      existingAtomsById: { ...existingAtoms, ...expanded.newAtoms },
      progressMap: progressWithVol3,
      targetUnits: compactUnits.slice(0, 6),
      unitPrefix: 'Issue #',
      atomKind: 'issue',
    });

    expect(shrunk.nextAtomIds).toContain('ol:comic:the-flash-rebirth:1');
    expect(shrunk.nextAtomIds).toContain('ol:comic:the-flash-rebirth:2');
    expect(shrunk.nextAtomIds).toContain('ol:comic:the-flash-vol-3:4');
  });
});
