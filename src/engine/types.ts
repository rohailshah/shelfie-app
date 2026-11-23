export type Pillar = 'watch' | 'read' | 'play';

export type Medium =
  | 'tv'
  | 'anime'
  | 'movie'
  | 'comic'
  | 'manga'
  | 'game'
  | 'book';

export type AtomKind =
  | 'episode'
  | 'movie'
  | 'issue'
  | 'chapter'
  | 'game_chapter'
  | 'dlc'
  | 'part';

export type ContainerKind =
  | 'season'
  | 'cour'
  | 'trilogy'
  | 'saga'
  | 'tpb'
  | 'hardcover'
  | 'omnibus'
  | 'event'
  | 'manga_series'
  | 'manga_volume'
  | 'game'
  | 'edition'
  | 'book'
  | 'book_series';

export type ShelfStatus =
  | 'none'
  | 'backlog'
  | 'owned_physical'
  | 'owned_digital'
  | 'wishlist';

export interface AtomNode {
  id: string;
  title: string;
  subtitle?: string;
  kind: AtomKind;
  medium: Medium;
  meta?: string;
}

export interface ContainerNode {
  id: string;
  title: string;
  subtitle: string;
  kind: ContainerKind;
  kindLabel: string;
  pillar: Pillar;
  medium: Medium;
  atomIds: string[];
  accentFrom: string;
  accentTo: string;
  monogram: string;
  coverUrl?: string;
  hqCoverUrl?: string;
  fallbackCoverUrl?: string;
  year?: string;
  creator?: string;
  unitPlural: string;
  description?: string;
  isCustom?: boolean;
  externalSource?: string;
  externalId?: string | number;
  relatedWorkKeys?: string[];
  publisher?: string;
}

export interface ProgressEntry {
  atomId: string;
  completedAt: string;
  sourceContainerId?: string;
}

export interface ActiveBoardEntry {
  containerId: string;
  trackSingleItem: boolean;
  addedAt: string;
  paused?: boolean;
}

export interface UserProfile {
  displayName: string;
  tagline?: string;
  avatarColor: string;
  joinedAt: string;
}

export interface RippleCompletedContainer {
  id: string;
  title: string;
  kindLabel: string;
  isImplicit: boolean;
}

export interface RippleOneLeftContainer {
  id: string;
  title: string;
  kindLabel: string;
  nextAtomTitle: string;
}

export interface RippleAdvancedContainer {
  id: string;
  title: string;
  kindLabel: string;
  completed: number;
  total: number;
}

export interface RippleEvent {
  id: string;
  atomId: string;
  atomIds?: string[];
  atomTitle: string;
  sourceContainerId: string;
  sourceContainerTitle: string;
  completedContainers: RippleCompletedContainer[];
  oneLeftContainers: RippleOneLeftContainer[];
  advancedContainers: RippleAdvancedContainer[];
  createdAt: string;
}

export interface AppState {
  progress: Record<string, ProgressEntry>;
  activeBoard: ActiveBoardEntry[];
  shelf: Record<string, ShelfStatus>;
  customAtoms: Record<string, AtomNode>;
  customContainers: ContainerNode[];
  profile?: UserProfile;
}
