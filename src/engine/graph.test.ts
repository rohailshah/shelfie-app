import { describe, expect, it } from 'vitest';
import {
  computeRippleOnBulkComplete,
  computeRippleOnComplete,
  getContainerProgress,
  getLatestCompletedAt,
  getOverlappingContainers,
  getUnlockedCollections,
} from './graph';
import { AtomNode, ContainerNode, ProgressEntry } from './types';

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
});
