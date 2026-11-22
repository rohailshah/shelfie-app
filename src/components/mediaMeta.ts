import { AtomKind, ContainerKind, Medium, Pillar, ShelfStatus } from '../engine/types';

export const MEDIUM_LABELS: Record<Medium, string> = {
  tv: 'TV',
  anime: 'Anime',
  movie: 'Movie',
  comic: 'Comic',
  manga: 'Manga',
  game: 'Game',
  book: 'Book',
};

export const MEDIUM_COLORS: Record<Medium, string> = {
  tv: '#4D8CE8',
  anime: '#C95252',
  movie: '#30B884',
  comic: '#D99B43',
  manga: '#E87151',
  game: '#7B6CE6',
  book: '#D99B43',
};

export const PILLAR_LABELS: Record<Pillar, string> = {
  watch: 'Watch',
  read: 'Read',
  play: 'Play',
};

export const PILLAR_COLORS: Record<Pillar, string> = {
  watch: '#4D8CE8',
  read: '#E87151',
  play: '#7B6CE6',
};

export interface MediumPreset {
  medium: Medium;
  pillar: Pillar;
  atomKind: AtomKind;
  containerKind: ContainerKind;
  defaultKindLabel: string;
  defaultUnitPrefix: string;
  defaultUnitPlural: string;
  accentColor: string;
}

export const MEDIUM_PRESETS: MediumPreset[] = [
  {
    medium: 'comic',
    pillar: 'read',
    atomKind: 'issue',
    containerKind: 'tpb',
    defaultKindLabel: 'TPB',
    defaultUnitPrefix: 'Issue #',
    defaultUnitPlural: 'issues',
    accentColor: '#D99B43',
  },
  {
    medium: 'manga',
    pillar: 'read',
    atomKind: 'chapter',
    containerKind: 'manga_series',
    defaultKindLabel: 'Manga',
    defaultUnitPrefix: 'Ch. ',
    defaultUnitPlural: 'ch',
    accentColor: '#E87151',
  },
  {
    medium: 'movie',
    pillar: 'watch',
    atomKind: 'movie',
    containerKind: 'trilogy',
    defaultKindLabel: 'Movie',
    defaultUnitPrefix: 'Part ',
    defaultUnitPlural: 'films',
    accentColor: '#30B884',
  },
  {
    medium: 'tv',
    pillar: 'watch',
    atomKind: 'episode',
    containerKind: 'season',
    defaultKindLabel: 'Season',
    defaultUnitPrefix: 'Ep. ',
    defaultUnitPlural: 'eps',
    accentColor: '#4D8CE8',
  },
  {
    medium: 'anime',
    pillar: 'watch',
    atomKind: 'episode',
    containerKind: 'cour',
    defaultKindLabel: 'Anime',
    defaultUnitPrefix: 'Ep. ',
    defaultUnitPlural: 'eps',
    accentColor: '#C95252',
  },
  {
    medium: 'game',
    pillar: 'play',
    atomKind: 'game_chapter',
    containerKind: 'game',
    defaultKindLabel: 'Game',
    defaultUnitPrefix: 'Chapter ',
    defaultUnitPlural: 'chapters',
    accentColor: '#7B6CE6',
  },
  {
    medium: 'book',
    pillar: 'read',
    atomKind: 'part',
    containerKind: 'book',
    defaultKindLabel: 'Book',
    defaultUnitPrefix: 'Part ',
    defaultUnitPlural: 'parts',
    accentColor: '#D99B43',
  },
];

export function getMediumPreset(medium: Medium): MediumPreset {
  return MEDIUM_PRESETS.find((m) => m.medium === medium) ?? MEDIUM_PRESETS[0];
}

export const SHELF_STATUS_OPTIONS: { value: ShelfStatus; label: string; shortLabel: string }[] = [
  { value: 'none', label: 'Not on Shelf', shortLabel: 'None' },
  { value: 'backlog', label: 'Backlog', shortLabel: 'Backlog' },
  { value: 'owned_physical', label: 'Owned · Physical', shortLabel: 'Physical' },
  { value: 'owned_digital', label: 'Owned · Digital', shortLabel: 'Digital' },
  { value: 'wishlist', label: 'Wishlist', shortLabel: 'Wishlist' },
];

export function formatShelfLabel(status: ShelfStatus | undefined): string {
  const found = SHELF_STATUS_OPTIONS.find((opt) => opt.value === status);
  return found ? found.label : 'Not on Shelf';
}

export function formatNextAtomLine(subtitle: string | undefined, title: string): string {
  if (!subtitle) return title;
  const subTrim = subtitle.trim();
  const titleLower = title.toLowerCase();
  const subLower = subTrim.toLowerCase();

  if (titleLower.startsWith(subLower)) {
    return title;
  }

  const unitMatch = subTrim.match(/^(?:issue|ep\.?|ch\.?|part|chapter|#)\s*#?(\d+)$/i);
  if (unitMatch) {
    const num = unitMatch[1];
    const dupPattern = new RegExp(
      `(?:#|issue\\s*#?|ep\\.?\\s*|ch\\.?\\s*|chapter\\s+|part\\s+)${num}(?!\\d)`,
      'i'
    );
    if (dupPattern.test(title)) {
      return title;
    }
  }

  return `${subtitle} · ${title}`;
}
