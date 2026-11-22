import {
  AtomNode,
  ContainerNode,
  RippleAdvancedContainer,
  RippleCompletedContainer,
  RippleEvent,
  RippleOneLeftContainer,
} from './types';

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
    } else if (
      nextProg.remaining === 1 &&
      nextProg.nextAtom &&
      (container.id !== sourceContainerId ||
        container.kind === 'trilogy' ||
        container.kind === 'saga' ||
        container.kind === 'book_series' ||
        container.kind === 'omnibus' ||
        container.kind === 'hardcover' ||
        container.kind === 'event')
    ) {
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
    atomTitle: atom ? atom.title : atomId,
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
