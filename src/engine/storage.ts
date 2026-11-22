import { AppState, ShelfStatus } from './types';

export const STORAGE_KEY = 'shelfie_v2';
const LEGACY_KEYS = ['shelfie_alpha_v1', 'shelfie_covers_v1'];

const VALID_SHELF_STATUSES = new Set<ShelfStatus>([
  'none',
  'backlog',
  'owned_physical',
  'owned_digital',
  'wishlist',
]);

function clearLegacyKeys(): void {
  try {
    for (const key of LEGACY_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage errors
  }
}

export function validateImportedState(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const candidate = raw as Partial<AppState>;

  if (
    !candidate.progress ||
    typeof candidate.progress !== 'object' ||
    Array.isArray(candidate.progress) ||
    !Array.isArray(candidate.activeBoard) ||
    !candidate.shelf ||
    typeof candidate.shelf !== 'object' ||
    Array.isArray(candidate.shelf)
  ) {
    return null;
  }

  const progress: AppState['progress'] = {};
  for (const [key, value] of Object.entries(candidate.progress)) {
    if (
      value &&
      typeof value === 'object' &&
      typeof value.atomId === 'string' &&
      typeof value.completedAt === 'string'
    ) {
      progress[key] = {
        atomId: value.atomId,
        completedAt: value.completedAt,
        sourceContainerId:
          typeof value.sourceContainerId === 'string'
            ? value.sourceContainerId
            : undefined,
      };
    }
  }

  const activeBoard: AppState['activeBoard'] = [];
  for (const entry of candidate.activeBoard) {
    if (
      entry &&
      typeof entry === 'object' &&
      typeof entry.containerId === 'string'
    ) {
      activeBoard.push({
        containerId: entry.containerId,
        trackSingleItem: Boolean(entry.trackSingleItem),
        addedAt:
          typeof entry.addedAt === 'string'
            ? entry.addedAt
            : new Date().toISOString(),
      });
    }
  }

  const shelf: AppState['shelf'] = {};
  for (const [key, value] of Object.entries(candidate.shelf)) {
    if (typeof value === 'string' && VALID_SHELF_STATUSES.has(value as ShelfStatus)) {
      shelf[key] = value as ShelfStatus;
    }
  }

  const customAtoms: AppState['customAtoms'] = {};
  if (
    candidate.customAtoms &&
    typeof candidate.customAtoms === 'object' &&
    !Array.isArray(candidate.customAtoms)
  ) {
    for (const [key, atom] of Object.entries(candidate.customAtoms)) {
      if (
        atom &&
        typeof atom === 'object' &&
        typeof atom.id === 'string' &&
        typeof atom.title === 'string' &&
        typeof atom.kind === 'string' &&
        typeof atom.medium === 'string'
      ) {
        customAtoms[key] = atom;
      }
    }
  }

  const customContainers: AppState['customContainers'] = [];
  if (Array.isArray(candidate.customContainers)) {
    for (const container of candidate.customContainers) {
      if (
        container &&
        typeof container === 'object' &&
        typeof container.id === 'string' &&
        typeof container.title === 'string' &&
        Array.isArray(container.atomIds)
      ) {
        customContainers.push(container);
      }
    }
  }

  return {
    progress,
    activeBoard,
    shelf,
    customAtoms,
    customContainers,
  };
}

export function loadAppState(createDefault: () => AppState): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      clearLegacyKeys();
      return createDefault();
    }

    const parsed = JSON.parse(raw) as unknown;
    const validated = validateImportedState(parsed);
    if (!validated) {
      return createDefault();
    }

    return validated;
  } catch {
    return createDefault();
  }
}

export function saveAppState(state: AppState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearAppState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    clearLegacyKeys();
  } catch {
    // Ignore storage errors
  }
}
