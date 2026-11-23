import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Gamepad2, Search, Tv, User } from 'lucide-react';
import { AddOnlineConfirmPayload, AddOnlineModal } from './components/AddOnlineModal';
import {
  ContainerDetailModal,
  SwitchEditionPayload,
  UpdateContainerPayload,
} from './components/ContainerDetailModal';
import { CreateCustomPayload, CustomTrackerModal } from './components/CustomTrackerModal';
import { JournalView } from './components/JournalView';
import { getMediumPreset } from './components/mediaMeta';
import { PillarView } from './components/PillarView';
import { RippleToast } from './components/RippleToast';
import { SearchFilter, SearchView } from './components/SearchView';
import {
  CATALOG_ATOMS,
  CATALOG_CONTAINERS,
  createInitialState,
} from './data/catalog';
import {
  computeRippleOnBulkComplete,
  computeRippleOnComplete,
  getContainerProgress,
  isItemCollectingDust,
} from './engine/graph';
import { clearAppState, loadAppState, saveAppState } from './engine/storage';
import {
  AppState,
  AtomNode,
  ContainerNode,
  Pillar,
  RippleEvent,
  ShelfStatus,
  UserProfile,
} from './engine/types';
import {
  loadCoverCache,
  resolveCoverForContainer,
  ResolvedCover,
  saveCoverCache,
} from './services/coverResolver';
import { OnlineSearchResult } from './services/onlineSearch';

type Tab = 'watch' | 'read' | 'play' | 'search' | 'journal';

function buildMonogram(title: string): string {
  const words = title
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'SHF';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function buildCanonicalAtomId(
  result: OnlineSearchResult,
  unitNumber: number,
  seasonNumber?: number,
  canonicalWorkKey?: string
): string {
  switch (result.externalSource) {
    case 'tvmaze':
      return `tvmaze:${result.externalId}:s${seasonNumber ?? 1}:e${unitNumber}`;
    case 'anilist':
      return `anilist:${result.externalId}:${
        result.medium === 'anime' ? 'ep' : 'ch'
      }:${unitNumber}`;
    case 'imdb':
    case 'itunes':
      return `movie:${result.externalId}:u${unitNumber}`;
    case 'openlibrary': {
      const workId =
        canonicalWorkKey ?? result.canonicalWorkKey ?? String(result.externalId);
      return `ol:${workId.replace(/[^a-zA-Z0-9_-]/g, '_')}:u${unitNumber}`;
    }
    case 'steam':
    case 'wikipedia':
    default:
      return `game:${result.externalId}:u${unitNumber}`;
  }
}

export function App() {
  const [state, setState] = useState<AppState>(() => loadAppState(createInitialState));
  const [activeTab, setActiveTab] = useState<Tab>('watch');
  const [searchFilter, setSearchFilter] = useState<SearchFilter>('all');
  const [searchFocusTrigger, setSearchFocusTrigger] = useState(0);

  const [detailContainerId, setDetailContainerId] = useState<string | null>(null);
  const [onlineResultToAdd, setOnlineResultToAdd] =
    useState<OnlineSearchResult | null>(null);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customModalPrefill, setCustomModalPrefill] = useState('');
  const [ripple, setRipple] = useState<RippleEvent | null>(null);
  const rippleTimerRef = useRef<number | null>(null);

  const [finishingIds, setFinishingIds] = useState<Set<string>>(() => new Set());
  const finishingTimersRef = useRef<Map<string, number>>(new Map());
  const secondaryScrollRef = useRef<HTMLDivElement | null>(null);

  const [coverMap, setCoverMap] = useState<Record<string, ResolvedCover>>(() =>
    loadCoverCache()
  );
  const coverMapRef = useRef(coverMap);
  coverMapRef.current = coverMap;
  const activeBoardRef = useRef(state.activeBoard);
  activeBoardRef.current = state.activeBoard;
  const attemptedCoverIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  useEffect(() => {
    if (secondaryScrollRef.current) {
      secondaryScrollRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  useEffect(() => {
    return () => {
      if (rippleTimerRef.current) {
        window.clearTimeout(rippleTimerRef.current);
      }
      for (const timerId of finishingTimersRef.current.values()) {
        window.clearTimeout(timerId);
      }
      finishingTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const activeSet = new Set(activeBoardRef.current.map((e) => e.containerId));
    const baseContainers = [...state.customContainers, ...CATALOG_CONTAINERS];

    const prioritized = [...baseContainers].sort((a, b) => {
      const aActive = activeSet.has(a.id) ? 0 : 1;
      const bActive = activeSet.has(b.id) ? 0 : 1;
      return aActive - bActive;
    });

    const missing = prioritized.filter(
      (c) =>
        !c.coverUrl &&
        !coverMapRef.current[c.id] &&
        !attemptedCoverIdsRef.current.has(c.id)
    );

    if (missing.length === 0) return;

    (async () => {
      const batchSize = 4;
      for (let i = 0; i < missing.length; i += batchSize) {
        if (controller.signal.aborted) break;
        const slice = missing.slice(i, i + batchSize);
        const resolvedList = await Promise.all(
          slice.map(async (container) => {
            const cover = await resolveCoverForContainer(container, controller.signal);
            return { id: container.id, cover };
          })
        );

        if (controller.signal.aborted) break;

        let changed = false;
        const nextUpdates: Record<string, ResolvedCover> = {};
        for (const { id, cover } of resolvedList) {
          attemptedCoverIdsRef.current.add(id);
          if (cover) {
            nextUpdates[id] = cover;
            changed = true;
          }
        }

        if (changed) {
          setCoverMap((prev) => {
            const merged = { ...prev, ...nextUpdates };
            saveCoverCache(merged);
            return merged;
          });
        }
      }
    })();

    return () => controller.abort();
  }, [state.customContainers]);

  const atomsById = useMemo<Record<string, AtomNode>>(
    () => ({ ...CATALOG_ATOMS, ...state.customAtoms }),
    [state.customAtoms]
  );

  const allContainers = useMemo<ContainerNode[]>(
    () =>
      [...state.customContainers, ...CATALOG_CONTAINERS].map((c) => {
        const cached = coverMap[c.id];
        if (!cached) return c;
        return {
          ...c,
          coverUrl: c.coverUrl ?? cached.coverUrl,
          hqCoverUrl: c.hqCoverUrl ?? cached.hqCoverUrl,
          fallbackCoverUrl: c.fallbackCoverUrl ?? cached.fallbackCoverUrl,
        };
      }),
    [state.customContainers, coverMap]
  );

  const containersById = useMemo<Record<string, ContainerNode>>(() => {
    const map: Record<string, ContainerNode> = {};
    for (const c of allContainers) {
      map[c.id] = c;
    }
    return map;
  }, [allContainers]);

  const completedAtomIds = useMemo(
    () => new Set(Object.keys(state.progress)),
    [state.progress]
  );

  const activeBoardIds = useMemo(
    () => new Set(state.activeBoard.map((e) => e.containerId)),
    [state.activeBoard]
  );

  const activeProfile = useMemo<UserProfile>(
    () =>
      state.profile ?? {
        displayName: 'My Shelfie',
        tagline: 'Personal Watch, Read & Play log',
        avatarColor: '#E87151',
        joinedAt: new Date().toISOString(),
      },
    [state.profile]
  );

  const showRipple = useCallback((event: RippleEvent) => {
    if (rippleTimerRef.current) {
      window.clearTimeout(rippleTimerRef.current);
    }
    setRipple(event);
    rippleTimerRef.current = window.setTimeout(() => {
      setRipple(null);
    }, 7500);
  }, []);

  const scheduleFinishingContainer = useCallback((containerId: string) => {
    const existing = finishingTimersRef.current.get(containerId);
    if (existing) {
      window.clearTimeout(existing);
    }

    setFinishingIds((prev) => {
      const next = new Set(prev);
      next.add(containerId);
      return next;
    });

    const timer = window.setTimeout(() => {
      finishingTimersRef.current.delete(containerId);
      setFinishingIds((prev) => {
        if (!prev.has(containerId)) return prev;
        const next = new Set(prev);
        next.delete(containerId);
        return next;
      });
    }, 400);

    finishingTimersRef.current.set(containerId, timer);
  }, []);

  const cancelFinishingForAtoms = useCallback(
    (atomIds: string[]) => {
      const atomSet = new Set(atomIds);
      const affectedIds: string[] = [];
      for (const container of allContainers) {
        if (container.atomIds.some((id) => atomSet.has(id))) {
          affectedIds.push(container.id);
        }
      }
      if (affectedIds.length === 0) return;

      for (const id of affectedIds) {
        const timer = finishingTimersRef.current.get(id);
        if (timer) {
          window.clearTimeout(timer);
          finishingTimersRef.current.delete(id);
        }
      }

      setFinishingIds((prev) => {
        let changed = false;
        const next = new Set(prev);
        for (const id of affectedIds) {
          if (next.delete(id)) changed = true;
        }
        return changed ? next : prev;
      });
    },
    [allContainers]
  );

  const completeAtom = (atomId: string, sourceContainerId: string) => {
    if (completedAtomIds.has(atomId)) return;

    const event = computeRippleOnComplete(
      atomId,
      sourceContainerId,
      completedAtomIds,
      allContainers,
      atomsById
    );

    const now = new Date().toISOString();
    setState((prev) => {
      const hasEntry = prev.activeBoard.some(
        (e) => e.containerId === sourceContainerId
      );
      const nextActiveBoard = hasEntry
        ? prev.activeBoard.map((e) =>
            e.containerId === sourceContainerId ? { ...e, paused: false } : e
          )
        : [
            {
              containerId: sourceContainerId,
              trackSingleItem: false,
              addedAt: now,
              paused: false,
            },
            ...prev.activeBoard,
          ];

      return {
        ...prev,
        activeBoard: nextActiveBoard,
        progress: {
          ...prev.progress,
          [atomId]: {
            atomId,
            completedAt: now,
            sourceContainerId,
          },
        },
      };
    });

    for (const comp of event.completedContainers) {
      if (comp.id === sourceContainerId || activeBoardIds.has(comp.id)) {
        scheduleFinishingContainer(comp.id);
      }
    }

    const hasCrossEditionRipple =
      event.completedContainers.some((c) => c.isImplicit) ||
      event.oneLeftContainers.length > 0 ||
      event.advancedContainers.length > 0;

    if (hasCrossEditionRipple || detailContainerId !== null) {
      showRipple(event);
    }
  };

  const uncompleteAtoms = useCallback(
    (atomIds: string[]) => {
      if (atomIds.length === 0) return;
      const removeSet = new Set(atomIds);
      cancelFinishingForAtoms(atomIds);

      setState((prev) => {
        const nextProgress = { ...prev.progress };
        for (const id of atomIds) {
          delete nextProgress[id];
        }
        return { ...prev, progress: nextProgress };
      });

      setRipple((prev) => {
        if (!prev) return null;
        const rippleIds = prev.atomIds ?? [prev.atomId];
        return rippleIds.some((id) => removeSet.has(id)) ? null : prev;
      });
    },
    [cancelFinishingForAtoms]
  );

  const handleLogNextAtom = (containerId: string) => {
    const container = containersById[containerId];
    if (!container) return;
    const progress = getContainerProgress(container, completedAtomIds, atomsById);
    if (!progress.nextAtom) return;
    completeAtom(progress.nextAtom.id, containerId);
  };

  const handleCompleteWholeContainer = (containerId: string) => {
    const container = containersById[containerId];
    if (!container) return;
    const remainingIds = container.atomIds.filter((id) => !completedAtomIds.has(id));
    if (remainingIds.length === 0) return;

    const event = computeRippleOnBulkComplete(
      remainingIds,
      containerId,
      completedAtomIds,
      allContainers,
      atomsById
    );

    const now = new Date().toISOString();
    setState((prev) => {
      const hasEntry = prev.activeBoard.some((e) => e.containerId === containerId);
      const nextActiveBoard = hasEntry
        ? prev.activeBoard.map((e) =>
            e.containerId === containerId ? { ...e, paused: false } : e
          )
        : [
            {
              containerId,
              trackSingleItem: false,
              addedAt: now,
              paused: false,
            },
            ...prev.activeBoard,
          ];

      const nextProgress = { ...prev.progress };
      for (const id of remainingIds) {
        nextProgress[id] = {
          atomId: id,
          completedAt: now,
          sourceContainerId: containerId,
        };
      }
      return {
        ...prev,
        activeBoard: nextActiveBoard,
        progress: nextProgress,
      };
    });

    for (const comp of event.completedContainers) {
      if (comp.id === containerId || activeBoardIds.has(comp.id)) {
        scheduleFinishingContainer(comp.id);
      }
    }

    showRipple(event);
  };

  const handleToggleAtom = (atomId: string, sourceContainerId: string) => {
    if (completedAtomIds.has(atomId)) {
      uncompleteAtoms([atomId]);
    } else {
      completeAtom(atomId, sourceContainerId);
    }
  };

  const handleToggleTrackMode = (containerId: string) => {
    setState((prev) => ({
      ...prev,
      activeBoard: prev.activeBoard.map((entry) =>
        entry.containerId === containerId
          ? { ...entry, trackSingleItem: !entry.trackSingleItem }
          : entry
      ),
    }));
  };

  const handleTogglePinCurrently = (containerId: string) => {
    setState((prev) => {
      const exists = prev.activeBoard.some((e) => e.containerId === containerId);
      if (exists) {
        return {
          ...prev,
          activeBoard: prev.activeBoard.filter((e) => e.containerId !== containerId),
        };
      }
      return {
        ...prev,
        activeBoard: [
          {
            containerId,
            trackSingleItem: false,
            addedAt: new Date().toISOString(),
            paused: false,
          },
          ...prev.activeBoard,
        ],
      };
    });
  };

  const handleToggleCollectingDust = (containerId: string) => {
    const container = containersById[containerId];
    if (!container) return;
    const entry = state.activeBoard.find((e) => e.containerId === containerId);
    const shelfStatus = state.shelf[containerId];
    const currentlyDust = isItemCollectingDust(
      container,
      entry,
      shelfStatus,
      state.progress
    );
    const now = new Date().toISOString();

    setState((prev) => {
      const hasEntry = prev.activeBoard.some((e) => e.containerId === containerId);
      if (currentlyDust) {
        // Wake up into active queue
        const nextBoard = hasEntry
          ? prev.activeBoard.map((e) =>
              e.containerId === containerId ? { ...e, paused: false, addedAt: now } : e
            )
          : [
              {
                containerId,
                trackSingleItem: false,
                addedAt: now,
                paused: false,
              },
              ...prev.activeBoard,
            ];
        return { ...prev, activeBoard: nextBoard };
      }

      // Move to Collecting dust
      const nextBoard = hasEntry
        ? prev.activeBoard.map((e) =>
            e.containerId === containerId ? { ...e, paused: true } : e
          )
        : [
            {
              containerId,
              trackSingleItem: false,
              addedAt: now,
              paused: true,
            },
            ...prev.activeBoard,
          ];
      return { ...prev, activeBoard: nextBoard };
    });
  };

  const handleSetShelfStatus = (containerId: string, status: ShelfStatus) => {
    setState((prev) => ({
      ...prev,
      shelf: {
        ...prev.shelf,
        [containerId]: status,
      },
    }));
  };

  const handleOpenCustomModal = (prefillTitle = '') => {
    setCustomModalPrefill(prefillTitle);
    setCustomModalOpen(true);
  };

  const handleOpenSearchForPillar = (pillar: Pillar) => {
    setSearchFilter(pillar);
    setSearchFocusTrigger((c) => c + 1);
    setActiveTab('search');
  };

  const handleCreateCustom = (payload: CreateCustomPayload) => {
    const preset = getMediumPreset(payload.medium);
    const idBase = `custom-${Date.now()}`;
    const newAtoms: Record<string, AtomNode> = {};
    let atomIds: string[] = [];

    if (payload.linkedAtomIds && payload.linkedAtomIds.length > 0) {
      atomIds = payload.linkedAtomIds;
    } else {
      for (let i = 0; i < payload.unitCount; i += 1) {
        const atomId = `${idBase}-u${i + 1}`;
        const unitTitle =
          payload.customUnitTitles && payload.customUnitTitles[i]
            ? payload.customUnitTitles[i]
            : `${payload.unitPrefix}${i + 1}`;
        newAtoms[atomId] = {
          id: atomId,
          title: unitTitle,
          subtitle:
            payload.customUnitTitles && payload.customUnitTitles[i]
              ? `${payload.unitPrefix}${i + 1}`
              : undefined,
          kind: preset.atomKind,
          medium: payload.medium,
        };
        atomIds.push(atomId);
      }
    }

    const newContainer: ContainerNode = {
      id: idBase,
      title: payload.title,
      subtitle: `${payload.kindLabel} · ${atomIds.length} ${payload.unitPlural}`,
      kind: preset.containerKind,
      kindLabel: payload.kindLabel,
      pillar: preset.pillar,
      medium: payload.medium,
      atomIds,
      accentFrom: preset.accentColor,
      accentTo: '#16161A',
      monogram: buildMonogram(payload.title),
      coverUrl: payload.coverUrl,
      hqCoverUrl: payload.coverUrl,
      fallbackCoverUrl: payload.coverUrl,
      creator: payload.creator || undefined,
      unitPlural: payload.unitPlural,
      description: payload.linkedAtomIds?.length
        ? 'Linked edition bundling shared sub-units.'
        : 'Custom sub-unit tracker.',
      isCustom: true,
    };

    setState((prev) => ({
      ...prev,
      customAtoms: { ...prev.customAtoms, ...newAtoms },
      customContainers: [newContainer, ...prev.customContainers],
      activeBoard: [
        {
          containerId: newContainer.id,
          trackSingleItem: false,
          addedAt: new Date().toISOString(),
          paused: false,
        },
        ...prev.activeBoard,
      ],
    }));

    setActiveTab(preset.pillar);
  };

  const handleConfirmAddOnline = (payload: AddOnlineConfirmPayload) => {
    const { result } = payload;
    const preset = getMediumPreset(result.medium);
    const containerId = `online-${Date.now()}`;
    const newAtoms: Record<string, AtomNode> = {};
    const atomIds: string[] = [];
    const seenAtoms = new Set<string>();

    for (let i = 0; i < payload.unitCount; i += 1) {
      const provided = payload.units?.[i];
      const unitNumber = provided?.unitNumber ?? payload.startUnit + i;
      const atomId = buildCanonicalAtomId(
        result,
        unitNumber,
        provided?.seasonNumber ?? payload.seasonNumber,
        payload.canonicalWorkKey
      );
      if (seenAtoms.has(atomId)) continue;
      seenAtoms.add(atomId);

      if (!atomsById[atomId] && !newAtoms[atomId]) {
        newAtoms[atomId] = {
          id: atomId,
          title: provided ? provided.title : `${payload.unitPrefix}${unitNumber}`,
          subtitle: provided?.subtitle,
          meta: provided?.meta,
          kind: preset.atomKind,
          medium: result.medium,
        };
      }
      atomIds.push(atomId);
    }

    const newContainer: ContainerNode = {
      id: containerId,
      title: payload.title,
      subtitle: `${payload.kindLabel} · ${atomIds.length} ${payload.unitPlural}`,
      kind: payload.isFullSeries ? 'saga' : preset.containerKind,
      kindLabel: payload.kindLabel,
      pillar: result.pillar,
      medium: result.medium,
      atomIds,
      accentFrom: preset.accentColor,
      accentTo: '#16161A',
      monogram: buildMonogram(payload.title),
      coverUrl: payload.coverUrlOverride ?? result.coverUrl,
      hqCoverUrl: payload.hqCoverUrlOverride ?? result.hqCoverUrl,
      fallbackCoverUrl: payload.fallbackCoverUrlOverride ?? result.fallbackCoverUrl,
      year: payload.yearOverride ?? result.year,
      creator: result.creator,
      unitPlural: payload.unitPlural,
      description: result.description,
      isCustom: true,
      externalSource: result.externalSource,
      externalId: result.externalId,
      relatedWorkKeys: result.relatedWorkKeys,
      publisher: result.publisher,
    };

    const preCompletedCount = Math.min(
      atomIds.length,
      Math.max(0, payload.preCompletedCount)
    );
    const nowMs = Date.now();

    setState((prev) => {
      const nextProgress = { ...prev.progress };
      for (let i = 0; i < preCompletedCount; i += 1) {
        const id = atomIds[i];
        if (!nextProgress[id]) {
          nextProgress[id] = {
            atomId: id,
            completedAt: new Date(nowMs - (preCompletedCount - i) * 1000).toISOString(),
            sourceContainerId: containerId,
          };
        }
      }

      return {
        ...prev,
        progress: nextProgress,
        customAtoms: { ...prev.customAtoms, ...newAtoms },
        customContainers: [newContainer, ...prev.customContainers],
        activeBoard:
          payload.destination === 'currently'
            ? [
                {
                  containerId: newContainer.id,
                  trackSingleItem: false,
                  addedAt: new Date().toISOString(),
                  paused: false,
                },
                ...prev.activeBoard,
              ]
            : prev.activeBoard,
        shelf:
          payload.destination === 'backlog'
            ? { ...prev.shelf, [newContainer.id]: 'backlog' }
            : payload.suggestedShelfStatus
              ? { ...prev.shelf, [newContainer.id]: payload.suggestedShelfStatus }
              : prev.shelf,
      };
    });

    setOnlineResultToAdd(null);
    setActiveTab(result.pillar);
  };

  const handleSwitchEdition = (payload: SwitchEditionPayload) => {
    setState((prev) => {
      const nextShelf =
        payload.suggestedShelfStatus && prev.shelf[payload.containerId] !== 'backlog'
          ? { ...prev.shelf, [payload.containerId]: payload.suggestedShelfStatus }
          : prev.shelf;

      return {
        ...prev,
        shelf: nextShelf,
        customContainers: prev.customContainers.map((c) => {
          if (c.id !== payload.containerId) return c;
          return {
            ...c,
            kindLabel: payload.kindLabel,
            subtitle: `${payload.kindLabel} · ${c.atomIds.length} ${c.unitPlural}`,
            coverUrl: payload.coverUrl ?? c.coverUrl,
            hqCoverUrl: payload.hqCoverUrl ?? c.hqCoverUrl,
            fallbackCoverUrl: payload.fallbackCoverUrl ?? c.fallbackCoverUrl,
            year: payload.year ?? c.year,
          };
        }),
      };
    });
  };

  const handleUpdateContainer = (payload: UpdateContainerPayload) => {
    const existing = containersById[payload.containerId];
    if (!existing) return;
    const preset = getMediumPreset(existing.medium);

    const addedAtoms: Record<string, AtomNode> = {};
    const addedAtomIds: string[] = [];
    const baseLen = existing.atomIds.length;

    for (let i = 0; i < payload.appendUnitsCount; i += 1) {
      const unitNumber = baseLen + i + 1;
      const atomId = `${existing.id}-extra-${Date.now()}-${i + 1}`;
      addedAtoms[atomId] = {
        id: atomId,
        title: `${preset.defaultUnitPrefix}${unitNumber}`,
        kind: preset.atomKind,
        medium: existing.medium,
      };
      addedAtomIds.push(atomId);
    }

    const nextAtomIds = [...existing.atomIds, ...addedAtomIds];
    const coverChanged = payload.coverUrl !== (existing.coverUrl ?? '');

    setState((prev) => ({
      ...prev,
      customAtoms: { ...prev.customAtoms, ...addedAtoms },
      customContainers: prev.customContainers.map((c) => {
        if (c.id !== payload.containerId) return c;
        return {
          ...c,
          title: payload.title,
          kindLabel: payload.kindLabel,
          creator: payload.creator || undefined,
          subtitle: `${payload.kindLabel} · ${nextAtomIds.length} ${c.unitPlural}`,
          monogram: buildMonogram(payload.title),
          atomIds: nextAtomIds,
          ...(coverChanged
            ? {
                coverUrl: payload.coverUrl || undefined,
                hqCoverUrl: payload.coverUrl || undefined,
                fallbackCoverUrl: payload.coverUrl || undefined,
              }
            : {}),
        };
      }),
    }));
  };

  const handleDeleteContainer = (containerId: string) => {
    const target = containersById[containerId];
    if (!target) return;

    const timer = finishingTimersRef.current.get(containerId);
    if (timer) {
      window.clearTimeout(timer);
      finishingTimersRef.current.delete(containerId);
    }
    setFinishingIds((prev) => {
      if (!prev.has(containerId)) return prev;
      const next = new Set(prev);
      next.delete(containerId);
      return next;
    });

    setDetailContainerId(null);

    setState((prev) => {
      const remainingContainers = prev.customContainers.filter(
        (c) => c.id !== containerId
      );
      const referencedAtoms = new Set<string>();
      for (const c of remainingContainers) {
        for (const id of c.atomIds) {
          referencedAtoms.add(id);
        }
      }

      const nextCustomAtoms = { ...prev.customAtoms };
      const nextProgress = { ...prev.progress };
      for (const atomId of target.atomIds) {
        if (!referencedAtoms.has(atomId)) {
          delete nextCustomAtoms[atomId];
          delete nextProgress[atomId];
        }
      }

      const nextShelf = { ...prev.shelf };
      delete nextShelf[containerId];

      return {
        ...prev,
        customContainers: remainingContainers,
        customAtoms: nextCustomAtoms,
        progress: nextProgress,
        activeBoard: prev.activeBoard.filter((e) => e.containerId !== containerId),
        shelf: nextShelf,
      };
    });
  };

  const handleUpdateProfile = (profile: UserProfile) => {
    setState((prev) => ({
      ...prev,
      profile,
    }));
  };

  const handleClearAllData = () => {
    for (const timerId of finishingTimersRef.current.values()) {
      window.clearTimeout(timerId);
    }
    finishingTimersRef.current.clear();
    setFinishingIds(new Set());
    clearAppState();
    setState(createInitialState());
    setRipple(null);
    setDetailContainerId(null);
  };

  const handleImportState = (imported: AppState) => {
    for (const timerId of finishingTimersRef.current.values()) {
      window.clearTimeout(timerId);
    }
    finishingTimersRef.current.clear();
    setFinishingIds(new Set());
    setRipple(null);
    setDetailContainerId(null);
    setState(imported);
  };

  const detailContainer = detailContainerId
    ? containersById[detailContainerId] ?? null
    : null;
  const detailActiveEntry = detailContainerId
    ? state.activeBoard.find((e) => e.containerId === detailContainerId)
    : undefined;
  const detailIsDust = detailContainer
    ? isItemCollectingDust(
        detailContainer,
        detailActiveEntry,
        state.shelf[detailContainer.id],
        state.progress
      )
    : false;

  const navItems: {
    id: Tab;
    label: string;
    icon: typeof Tv;
  }[] = [
    { id: 'watch', label: 'Watch', icon: Tv },
    { id: 'read', label: 'Read', icon: BookOpen },
    { id: 'play', label: 'Play', icon: Gamepad2 },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'journal', label: 'Journal', icon: User },
  ];

  return (
    <div className="h-[100dvh] bg-black text-[#F4F4F6] overflow-hidden relative">
      {/* Watch / Read / Play Pillar Views own their full-height scroll container */}
      {(activeTab === 'watch' || activeTab === 'read' || activeTab === 'play') && (
        <PillarView
          pillar={activeTab}
          activeBoard={state.activeBoard}
          allContainers={allContainers}
          containersById={containersById}
          atomsById={atomsById}
          completedAtomIds={completedAtomIds}
          progressMap={state.progress}
          shelfById={state.shelf}
          finishingIds={finishingIds}
          onLogNextAtom={handleLogNextAtom}
          onCompleteWholeContainer={handleCompleteWholeContainer}
          onUndoAtoms={uncompleteAtoms}
          onOpenDetail={setDetailContainerId}
          onOpenSearchForPillar={handleOpenSearchForPillar}
          onOpenCustomModal={handleOpenCustomModal}
          onGoJournal={() => setActiveTab('journal')}
        />
      )}

      {/* Search & Journal Views */}
      {(activeTab === 'search' || activeTab === 'journal') && (
        <div ref={secondaryScrollRef} className="h-[100dvh] overflow-y-auto bg-black">
          <main className="mx-auto max-w-2xl px-4 pt-4 pb-28">
            {activeTab === 'search' && (
              <SearchView
                allContainers={allContainers}
                atomsById={atomsById}
                completedAtomIds={completedAtomIds}
                activeBoardIds={activeBoardIds}
                shelfById={state.shelf}
                initialFilter={searchFilter}
                autoFocusTrigger={searchFocusTrigger}
                onTogglePinCurrently={handleTogglePinCurrently}
                onOpenDetail={setDetailContainerId}
                onSelectOnlineResult={setOnlineResultToAdd}
                onOpenCustomModal={handleOpenCustomModal}
              />
            )}

            {activeTab === 'journal' && (
              <JournalView
                appState={state}
                profile={activeProfile}
                progressMap={state.progress}
                atomsById={atomsById}
                containersById={containersById}
                allContainers={allContainers}
                completedAtomIds={completedAtomIds}
                activeBoardIds={activeBoardIds}
                shelfById={state.shelf}
                onUpdateProfile={handleUpdateProfile}
                onUndoAtom={(atomId) => uncompleteAtoms([atomId])}
                onOpenDetail={setDetailContainerId}
                onTogglePinCurrently={handleTogglePinCurrently}
                onClearAllData={handleClearAllData}
                onImportState={handleImportState}
              />
            )}
          </main>
        </div>
      )}

      {/* Subtle Bottom Fade Behind Floating Pill */}
      <div
        aria-hidden="true"
        className="fixed bottom-0 inset-x-0 h-24 bg-gradient-to-t from-black via-black/65 to-transparent pointer-events-none z-30"
      />

      {/* Bingers-Style Floating Glass Pill Nav (all viewports) */}
      <div className="fixed bottom-3.5 inset-x-4 z-40 flex justify-center pointer-events-none">
        <nav
          aria-label="Primary navigation"
          className="pointer-events-auto flex w-full max-w-md items-center justify-around gap-1 rounded-full border border-white/[0.08] bg-[#1C1C21]/85 backdrop-blur-xl p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.65)]"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'search') {
                    setSearchFilter('all');
                    setSearchFocusTrigger((c) => c + 1);
                  }
                  setActiveTab(item.id);
                }}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-1.5 text-[11px] font-medium transition cursor-pointer ${
                  isActive
                    ? 'bg-white/[0.11] text-[#E87151]'
                    : 'text-[#C0C0CA] hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Celebratory Ripple Toast */}
      <RippleToast
        ripple={ripple}
        onUndo={uncompleteAtoms}
        onDismiss={() => setRipple(null)}
        onInspectContainer={(id) => {
          setRipple(null);
          setDetailContainerId(id);
        }}
      />

      {/* Tap-In Container Detail Sheet */}
      <ContainerDetailModal
        container={detailContainer}
        allContainers={allContainers}
        atomsById={atomsById}
        completedAtomIds={completedAtomIds}
        activeBoardEntry={detailActiveEntry}
        shelfStatus={
          detailContainer ? state.shelf[detailContainer.id] ?? 'none' : 'none'
        }
        isCollectingDust={detailIsDust}
        onClose={() => setDetailContainerId(null)}
        onSelectContainer={setDetailContainerId}
        onToggleAtom={handleToggleAtom}
        onToggleTrackMode={handleToggleTrackMode}
        onTogglePinCurrently={handleTogglePinCurrently}
        onToggleCollectingDust={handleToggleCollectingDust}
        onSetShelfStatus={handleSetShelfStatus}
        onCompleteAll={handleCompleteWholeContainer}
        onUpdateContainer={handleUpdateContainer}
        onDeleteContainer={handleDeleteContainer}
        onSwitchEdition={handleSwitchEdition}
      />

      {/* Add Online Search Result Modal */}
      <AddOnlineModal
        result={onlineResultToAdd}
        onClose={() => setOnlineResultToAdd(null)}
        onConfirm={handleConfirmAddOnline}
      />

      {/* Custom Tracker Modal */}
      <CustomTrackerModal
        isOpen={customModalOpen}
        initialTitle={customModalPrefill}
        existingContainers={allContainers}
        onClose={() => setCustomModalOpen(false)}
        onCreate={handleCreateCustom}
      />
    </div>
  );
}

export default App;
