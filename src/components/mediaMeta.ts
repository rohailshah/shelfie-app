import { Medium, Pillar, ShelfStatus } from '../engine/types';

export const MEDIUM_LABELS: Record<Medium, string> = {
  tv: 'TV',
  anime: 'Anime',
  movie: 'Movie',
  comic: 'Comic',
  manga: 'Manga',
  game: 'Game',
  book: 'Book',
};

export const PILLAR_LABELS: Record<Pillar, string> = {
  watch: 'Watch',
  read: 'Read',
  play: 'Play',
};

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
  if (title.toLowerCase().startsWith(subtitle.toLowerCase())) {
    return title;
  }
  return `${subtitle} · ${title}`;
}
