import { validateImportedState } from './storage';
import { ActiveBoardEntry, AppState, ContainerNode, ProgressEntry } from './types';

export const SYNC_META_STORAGE_KEY = 'shelfie_sync_meta_v1';

const SYNC_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export type SyncStatus = 'unlinked' | 'idle' | 'syncing' | 'synced' | 'error';

export interface SyncMetadata {
  syncCode: string;
  revision: number;
  lastSyncedAt: string | null;
}

export interface SyncEnvelope {
  version: 1;
  updatedAt: string;
  revision: number;
  state: AppState;
}

export function normalizeSyncCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function formatSyncCode(raw: string): string {
  const normalized = normalizeSyncCode(raw);
  if (!normalized) return '';
  return (normalized.match(/.{1,4}/g) ?? []).join('-');
}

export function isValidSyncCode(raw: string): boolean {
  return /^[A-Z0-9]{12,32}$/.test(normalizeSyncCode(raw));
}

export function generateSyncCode(): string {
  const randomValues = new Uint32Array(16);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(randomValues);
  } else {
    for (let i = 0; i < 16; i += 1) {
      randomValues[i] = Math.floor(Math.random() * 0xffffffff);
    }
  }

  let raw = '';
  for (let i = 0; i < 16; i += 1) {
    raw += SYNC_ALPHABET[randomValues[i] % SYNC_ALPHABET.length];
  }
  return formatSyncCode(raw);
}

export function buildPairingUrl(
  syncCode: string,
  origin: string,
  pathname = '/'
): string {
  const cleanPath = pathname || '/';
  return `${origin}${cleanPath}#sync=${formatSyncCode(syncCode)}`;
}

export function extractSyncCodeFromHash(hash: string): string | null {
  if (!hash) return null;
  const match = hash.match(/^#?sync=([a-z0-9-]+)(?:&|$)/i);
  if (!match) return null;
  const candidate = match[1];
  if (!isValidSyncCode(candidate)) return null;
  return formatSyncCode(candidate);
}

export function isEmptyAppState(state: AppState): boolean {
  return (
    state.customContainers.length === 0 &&
    Object.keys(state.progress).length === 0 &&
    state.activeBoard.length === 0
  );
}

export function mergeAppStates(
  local: AppState,
  remote: AppState,
  remoteIsNewer: boolean
): AppState {
  if (isEmptyAppState(local) && !isEmptyAppState(remote)) {
    return remote;
  }
  if (isEmptyAppState(remote) && !isEmptyAppState(local)) {
    return local;
  }

  const newer = remoteIsNewer ? remote : local;
  const older = remoteIsNewer ? local : remote;

  const customAtoms = { ...older.customAtoms, ...newer.customAtoms };

  // Merge containers (newer list first, then older-only, union atomIds)
  const containerMap = new Map<string, ContainerNode>();
  const containerOrder: string[] = [];

  for (const c of newer.customContainers) {
    containerMap.set(c.id, c);
    containerOrder.push(c.id);
  }
  for (const c of older.customContainers) {
    const existing = containerMap.get(c.id);
    if (!existing) {
      containerMap.set(c.id, c);
      containerOrder.push(c.id);
    } else {
      const mergedAtomIds = Array.from(
        new Set([...existing.atomIds, ...c.atomIds])
      );
      if (mergedAtomIds.length !== existing.atomIds.length) {
        containerMap.set(c.id, { ...existing, atomIds: mergedAtomIds });
      }
    }
  }
  const customContainers = containerOrder.map(
    (id) => containerMap.get(id) as ContainerNode
  );

  // Merge progress (union by atomId; keep latest completedAt)
  const progress: Record<string, ProgressEntry> = { ...older.progress };
  for (const [atomId, entry] of Object.entries(newer.progress)) {
    const prev = progress[atomId];
    if (!prev) {
      progress[atomId] = entry;
      continue;
    }
    const prevMs = new Date(prev.completedAt).getTime();
    const nextMs = new Date(entry.completedAt).getTime();
    if (Number.isNaN(prevMs) || (!Number.isNaN(nextMs) && nextMs >= prevMs)) {
      progress[atomId] = entry;
    }
  }

  // Merge activeBoard (newer order first, append older-only)
  const seenBoard = new Set<string>();
  const activeBoard: ActiveBoardEntry[] = [];
  for (const entry of newer.activeBoard) {
    if (seenBoard.has(entry.containerId)) continue;
    seenBoard.add(entry.containerId);
    activeBoard.push(entry);
  }
  for (const entry of older.activeBoard) {
    if (seenBoard.has(entry.containerId)) continue;
    seenBoard.add(entry.containerId);
    activeBoard.push(entry);
  }

  const shelf = { ...older.shelf, ...newer.shelf };

  let profile = newer.profile ?? older.profile;
  if (
    (!newer.profile || newer.profile.displayName === 'My Shelfie') &&
    older.profile &&
    older.profile.displayName !== 'My Shelfie'
  ) {
    profile = older.profile;
  }

  return {
    progress,
    activeBoard,
    shelf,
    customAtoms,
    customContainers,
    ...(profile ? { profile } : {}),
  };
}

export function loadSyncMeta(): SyncMetadata | null {
  try {
    const raw = window.localStorage.getItem(SYNC_META_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SyncMetadata>;
    if (
      !parsed ||
      typeof parsed.syncCode !== 'string' ||
      !isValidSyncCode(parsed.syncCode)
    ) {
      return null;
    }
    return {
      syncCode: formatSyncCode(parsed.syncCode),
      revision: typeof parsed.revision === 'number' ? parsed.revision : 0,
      lastSyncedAt:
        typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : null,
    };
  } catch {
    return null;
  }
}

export function saveSyncMeta(meta: SyncMetadata | null): void {
  try {
    if (!meta) {
      window.localStorage.removeItem(SYNC_META_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(SYNC_META_STORAGE_KEY, JSON.stringify(meta));
  } catch {
    // Ignore storage errors
  }
}

export async function pullCloudState(
  syncCode: string,
  signal?: AbortSignal
): Promise<{ exists: boolean; envelope?: SyncEnvelope }> {
  const res = await fetch('/api/sync', {
    method: 'GET',
    cache: 'no-store',
    headers: {
      'x-shelfie-sync-code': normalizeSyncCode(syncCode),
    },
    signal,
  });

  if (res.status === 404) {
    return { exists: false };
  }

  const data = (await res.json().catch(() => ({}))) as {
    exists?: boolean;
    error?: string;
    envelope?: {
      version?: number;
      updatedAt?: string;
      revision?: number;
      state?: unknown;
    };
  };

  if (!res.ok) {
    throw new Error(data.error || `Sync pull failed (${res.status})`);
  }

  if (!data.exists || !data.envelope) {
    return { exists: false };
  }

  const validatedState = validateImportedState(data.envelope.state);
  if (!validatedState) {
    throw new Error('Remote sync state was malformed');
  }

  return {
    exists: true,
    envelope: {
      version: 1,
      updatedAt:
        typeof data.envelope.updatedAt === 'string'
          ? data.envelope.updatedAt
          : new Date().toISOString(),
      revision:
        typeof data.envelope.revision === 'number' ? data.envelope.revision : 1,
      state: validatedState,
    },
  };
}

export async function pushCloudState(
  syncCode: string,
  envelope: SyncEnvelope
): Promise<{ ok: boolean; updatedAt: string; revision: number }> {
  const res = await fetch('/api/sync', {
    method: 'PUT',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'x-shelfie-sync-code': normalizeSyncCode(syncCode),
    },
    body: JSON.stringify({ envelope }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    updatedAt?: string;
    revision?: number;
  };

  if (!res.ok) {
    throw new Error(data.error || `Sync push failed (${res.status})`);
  }

  return {
    ok: Boolean(data.ok),
    updatedAt: data.updatedAt ?? envelope.updatedAt,
    revision: data.revision ?? envelope.revision,
  };
}
