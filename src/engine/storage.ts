import { AppState } from './types';

export const STORAGE_KEY = 'shelfie_alpha_v1';

export function loadAppState(createDefault: () => AppState): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefault();

    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !parsed.progress ||
      !Array.isArray(parsed.activeBoard) ||
      !parsed.shelf
    ) {
      return createDefault();
    }

    return {
      progress: parsed.progress,
      activeBoard: parsed.activeBoard,
      shelf: parsed.shelf,
      customAtoms: parsed.customAtoms ?? {},
      customContainers: Array.isArray(parsed.customContainers)
        ? parsed.customContainers
        : [],
    };
  } catch {
    return createDefault();
  }
}

export function saveAppState(state: AppState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors in alpha
  }
}

export function clearAppState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}
