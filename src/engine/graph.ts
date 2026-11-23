import {
  ActiveBoardEntry,
  AtomKind,
  AtomNode,
  ContainerNode,
  ProgressEntry,
  RippleAdvancedContainer,
  RippleCompletedContainer,
  RippleEvent,
  RippleOneLeftContainer,
  ShelfStatus,
} from './types';

export interface EditionUnitInput {
  title: string;
  subtitle?: string;
  unitNumber: number;
  canonicalKey?: string;
}

export function reconcileEditionAtoms(params: {
  container: ContainerNode;
  existingAtomsById: Record<string, AtomNode>;
  progressMap: Record<string, ProgressEntry>;
  targetUnits?: EditionUnitInput[];
  targetUnitCount?: number;
  unitPrefix: string;
  atomKind: AtomKind;
}): {
  nextAtomIds: string[];
  newAtoms: Record<string, AtomNode>;
  migratedProgress: Record<string, ProgressEntry>;
  migratedFromIds: string[];
} {
  const {
    container,
    existingAtomsById,
    progressMap,
    targetUnits,
    targetUnitCount,
    unitPrefix,
    atomKind,
  } = params;

  const newAtoms: Record<string, AtomNode> = {};
  const migratedProgress: Record<string, ProgressEntry> = {};
  const migratedFromIds: string[] = [];

  if (targetUnits && targetUnits.length > 0) {
    const nextAtomIds: string[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < targetUnits.length; i += 1) {
      const unit = targetUnits[i];
      const atomId = unit.canonicalKey
        ? `ol:comic:${unit.canonicalKey}`
        : `${container.id}-ed-${unit.unitNumber}-${i + 1}`;
      if (seen.has(atomId)) continue;
      seen.add(atomId);

      if (!existingAtomsById[atomId] && !newAtoms[atomId]) {
        newAtoms[atomId] = {
          id: atomId,
          title: unit.title,
          subtitle: unit.subtitle,
          kind: atomKind,
          medium: container.medium,
        };
      }
      nextAtomIds.push(atomId);
    }

    const nextSet = new Set(nextAtomIds);
    for (let i = 0; i < container.atomIds.length; i += 1) {
      const oldId = container.atomIds[i];
      const existingProgress = progressMap[oldId];
      if (!existingProgress || nextSet.has(oldId)) continue;

      if (i < nextAtomIds.length && !progressMap[nextAtomIds[i]] && !migratedProgress[nextAtomIds[i]]) {
        migratedProgress[nextAtomIds[i]] = {
          ...existingProgress,
          atomId: nextAtomIds[i],
        };
        migratedFromIds.push(oldId);
      } else {
        // Never silently drop a completed unit outside the target list
        nextAtomIds.push(oldId);
        nextSet.add(oldId);
      }
    }

    return { nextAtomIds, newAtoms, migratedProgress, migratedFromIds };
  }

  if (typeof targetUnitCount === 'number' && targetUnitCount > 0) {
    const existingIds = container.atomIds;
    if (targetUnitCount === existingIds.length) {
      return { nextAtomIds: existingIds, newAtoms, migratedProgress, migratedFromIds };
    }

    if (targetUnitCount > existingIds.length) {
      const nextAtomIds = [...existingIds];
      const lastId = existingIds[existingIds.length - 1] ?? '';
      const numberedMatch = lastId.match(/^(.*?)(\d+)$/);
      const prefix = numberedMatch ? numberedMatch[1] : `${container.id}-u`;
      const startNum = numberedMatch
        ? Number(numberedMatch[2]) + 1
        : existingIds.length + 1;

      const extraNeeded = targetUnitCount - existingIds.length;
      for (let i = 0; i < extraNeeded; i += 1) {
        const unitNum = existingIds.length + i + 1;
        let candidateId = `${prefix}${startNum + i}`;
        if (nextAtomIds.includes(candidateId)) {
          candidateId = `${container.id}-extra-${unitNum}-${Date.now()}`;
        }
        if (!existingAtomsById[candidateId] && !newAtoms[candidateId]) {
          newAtoms[candidateId] = {
            id: candidateId,
            title: `${unitPrefix}${unitNum}`,
            kind: atomKind,
            medium: container.medium,
          };
        }
        nextAtomIds.push(candidateId);
      }

      return { nextAtomIds, newAtoms, migratedProgress, migratedFromIds };
    }

    // Shrinking: keep first targetUnitCount slots + any completed units beyond that
    const kept = existingIds.filter(
      (id, idx) => idx < targetUnitCount || Boolean(progressMap[id])
    );
    return { nextAtomIds: kept, newAtoms, migratedProgress, migratedFromIds };
  }

  return { nextAtomIds: container.atomIds, newAtoms, migratedProgress, migratedFromIds };
}

export interface ContainerProgress {
  completed: number;
  total: number;
  percent: number;
  isComplete: boolean;
  remaining: number;
  nextAtom: AtomNode | null;
}

export interface OverlappingContainerInfo {
  container: ContainerNode;
  sharedAtomCount: number;
}

export interface UnlockedCollectionInfo {
  container: ContainerNode;
  progress: ContainerProgress;
  isImplicit: boolean;
}

export function getContainerProgress(
  container: ContainerNode,
  completedAtomIds: Set<string>,
  atomsById: Record<string, AtomNode>
): ContainerProgress {
  const total = container.atomIds.length;
  let completed = 0;
  let nextAtom: AtomNode | null = null;

  for (const atomId of container.atomIds) {
    if (completedAtomIds.has(atomId)) {
      completed += 1;
    } else if (!nextAtom && atomsById[atomId]) {
      nextAtom = atomsById[atomId];
    }
  }

  const remaining = Math.max(0, total - completed);
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  const isComplete = total > 0 && completed === total;

  return {
    completed,
    total,
    percent,
    isComplete,
    remaining,
    nextAtom,
  };
}

export function getOverlappingContainers(
  containerId: string,
  containers: ContainerNode[]
): OverlappingContainerInfo[] {
  const target = containers.find((c) => c.id === containerId);
  if (!target) return [];

  const targetAtoms = new Set(target.atomIds);
  const results: OverlappingContainerInfo[] = [];

  for (const candidate of containers) {
    if (candidate.id === containerId) continue;
    let sharedAtomCount = 0;
    for (const atomId of candidate.atomIds) {
      if (targetAtoms.has(atomId)) {
        sharedAtomCount += 1;
      }
    }
    if (sharedAtomCount > 0) {
      results.push({ container: candidate, sharedAtomCount });
    }
  }

  return results.sort((a, b) => b.sharedAtomCount - a.sharedAtomCount);
}

export function getContainersForAtom(
  atomId: string,
  containers: ContainerNode[]
): ContainerNode[] {
  return containers.filter((c) => c.atomIds.includes(atomId));
}

function shouldFlagOneLeft(
  container: ContainerNode,
  sourceContainerId: string,
  nextProg: ContainerProgress
): boolean {
  if (nextProg.remaining !== 1 || !nextProg.nextAtom) return false;
  return (
    container.id !== sourceContainerId ||
    container.kind === 'trilogy' ||
    container.kind === 'saga' ||
    container.kind === 'book_series' ||
    container.kind === 'omnibus' ||
    container.kind === 'hardcover' ||
    container.kind === 'event'
  );
}

export function computeRippleOnComplete(
  atomId: string,
  sourceContainerId: string,
  prevCompletedIds: Set<string>,
  containers: ContainerNode[],
  atomsById: Record<string, AtomNode>
): RippleEvent {
  const atom = atomsById[atomId];
  const sourceContainer = containers.find((c) => c.id === sourceContainerId);
  const nextCompletedIds = new Set(prevCompletedIds);
  nextCompletedIds.add(atomId);

  const completedContainers: RippleCompletedContainer[] = [];
  const oneLeftContainers: RippleOneLeftContainer[] = [];
  const advancedContainers: RippleAdvancedContainer[] = [];

  const impacted = getContainersForAtom(atomId, containers);

  for (const container of impacted) {
    const prevProg = getContainerProgress(container, prevCompletedIds, atomsById);
    const nextProg = getContainerProgress(container, nextCompletedIds, atomsById);

    if (!prevProg.isComplete && nextProg.isComplete) {
      completedContainers.push({
        id: container.id,
        title: container.title,
        kindLabel: container.kindLabel,
        isImplicit: container.id !== sourceContainerId,
      });
    } else if (shouldFlagOneLeft(container, sourceContainerId, nextProg) && nextProg.nextAtom) {
      oneLeftContainers.push({
        id: container.id,
        title: container.title,
        kindLabel: container.kindLabel,
        nextAtomTitle: nextProg.nextAtom.title,
      });
    } else if (container.id !== sourceContainerId) {
      advancedContainers.push({
        id: container.id,
        title: container.title,
        kindLabel: container.kindLabel,
        completed: nextProg.completed,
        total: nextProg.total,
      });
    }
  }

  return {
    id: `${atomId}-${Date.now()}`,
    atomId,
    atomIds: [atomId],
    atomTitle: atom ? atom.title : atomId,
    sourceContainerId,
    sourceContainerTitle: sourceContainer ? sourceContainer.title : '',
    completedContainers,
    oneLeftContainers,
    advancedContainers,
    createdAt: new Date().toISOString(),
  };
}

export function computeRippleOnBulkComplete(
  atomIds: string[],
  sourceContainerId: string,
  prevCompletedIds: Set<string>,
  containers: ContainerNode[],
  atomsById: Record<string, AtomNode>
): RippleEvent {
  const uniqueIds = Array.from(new Set(atomIds));
  const sourceContainer = containers.find((c) => c.id === sourceContainerId);
  const nextCompletedIds = new Set(prevCompletedIds);
  for (const id of uniqueIds) {
    nextCompletedIds.add(id);
  }

  const impactedMap = new Map<string, ContainerNode>();
  for (const id of uniqueIds) {
    for (const c of getContainersForAtom(id, containers)) {
      impactedMap.set(c.id, c);
    }
  }

  const completedContainers: RippleCompletedContainer[] = [];
  const oneLeftContainers: RippleOneLeftContainer[] = [];
  const advancedContainers: RippleAdvancedContainer[] = [];

  for (const container of impactedMap.values()) {
    const prevProg = getContainerProgress(container, prevCompletedIds, atomsById);
    const nextProg = getContainerProgress(container, nextCompletedIds, atomsById);

    if (!prevProg.isComplete && nextProg.isComplete) {
      completedContainers.push({
        id: container.id,
        title: container.title,
        kindLabel: container.kindLabel,
        isImplicit: container.id !== sourceContainerId,
      });
    } else if (shouldFlagOneLeft(container, sourceContainerId, nextProg) && nextProg.nextAtom) {
      oneLeftContainers.push({
        id: container.id,
        title: container.title,
        kindLabel: container.kindLabel,
        nextAtomTitle: nextProg.nextAtom.title,
      });
    } else if (
      container.id !== sourceContainerId &&
      nextProg.completed > prevProg.completed
    ) {
      advancedContainers.push({
        id: container.id,
        title: container.title,
        kindLabel: container.kindLabel,
        completed: nextProg.completed,
        total: nextProg.total,
      });
    }
  }

  const lastAtomId = uniqueIds[uniqueIds.length - 1] ?? '';
  const atomTitle =
    uniqueIds.length === 1
      ? atomsById[uniqueIds[0]]?.title ?? uniqueIds[0]
      : sourceContainer
        ? `${sourceContainer.title} (${uniqueIds.length} ${sourceContainer.unitPlural})`
        : `${uniqueIds.length} units`;

  return {
    id: `${sourceContainerId}-bulk-${Date.now()}`,
    atomId: lastAtomId,
    atomIds: uniqueIds,
    atomTitle,
    sourceContainerId,
    sourceContainerTitle: sourceContainer ? sourceContainer.title : '',
    completedContainers,
    oneLeftContainers,
    advancedContainers,
    createdAt: new Date().toISOString(),
  };
}

export function getUnlockedCollections(
  containers: ContainerNode[],
  completedAtomIds: Set<string>,
  atomsById: Record<string, AtomNode>,
  activeBoardIds: Set<string>
): UnlockedCollectionInfo[] {
  const unlocked: UnlockedCollectionInfo[] = [];

  for (const container of containers) {
    const progress = getContainerProgress(container, completedAtomIds, atomsById);
    if (progress.isComplete) {
      unlocked.push({
        container,
        progress,
        isImplicit: !activeBoardIds.has(container.id),
      });
    }
  }

  return unlocked;
}

export function getLatestCompletedAt(
  container: ContainerNode,
  progressMap: Record<string, ProgressEntry>
): string | null {
  let latestIso: string | null = null;
  let latestTime = -Infinity;

  for (const atomId of container.atomIds) {
    const entry = progressMap[atomId];
    if (!entry) continue;
    const t = new Date(entry.completedAt).getTime();
    if (!Number.isNaN(t) && t >= latestTime) {
      latestTime = t;
      latestIso = entry.completedAt;
    }
  }

  return latestIso;
}

export const DUST_THRESHOLD_DAYS = 14;

export function isItemCollectingDust(
  container: ContainerNode,
  entry: ActiveBoardEntry | undefined,
  shelfStatus: ShelfStatus | undefined,
  progressMap: Record<string, ProgressEntry>,
  nowMs: number = Date.now()
): boolean {
  if (!entry) {
    return shelfStatus === 'backlog';
  }
  if (entry.paused === true) {
    return true;
  }

  const latestIso = getLatestCompletedAt(container, progressMap);
  const latestMs = latestIso ? new Date(latestIso).getTime() : NaN;
  const addedMs = new Date(entry.addedAt).getTime();

  let lastActivityMs = NaN;
  if (!Number.isNaN(latestMs) && !Number.isNaN(addedMs)) {
    lastActivityMs = Math.max(latestMs, addedMs);
  } else if (!Number.isNaN(latestMs)) {
    lastActivityMs = latestMs;
  } else if (!Number.isNaN(addedMs)) {
    lastActivityMs = addedMs;
  }

  if (Number.isNaN(lastActivityMs)) return false;
  return nowMs - lastActivityMs >= DUST_THRESHOLD_DAYS * 86_400_000;
}

export function formatDateGroupLabel(
  isoString: string,
  nowMs: number = Date.now()
): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  const now = new Date(nowMs);
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfDate.getTime()) / 86_400_000
  );

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatBingersCode(
  subtitle: string | undefined,
  fallback: string
): string {
  const raw = subtitle?.trim();
  if (!raw) return fallback;

  const epMatch = raw.match(/^S(\d+)\s*[·•\-]?\s*E(\d+)$/i);
  if (epMatch) {
    const season = epMatch[1].padStart(2, '0');
    const episode = epMatch[2].padStart(2, '0');
    return `S${season} E${episode}`;
  }

  return raw;
}

export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return 'Just now';

  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 45) return 'Just now';

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
