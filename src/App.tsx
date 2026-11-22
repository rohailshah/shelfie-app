import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, Clock, Compass, Layers, Sparkles } from 'lucide-react';
import { AddOnlineConfirmPayload, AddOnlineModal } from './components/AddOnlineModal';
import {
  ContainerDetailModal,
  UpdateContainerPayload,
} from './components/ContainerDetailModal';
import { CurrentlyView, PillarFilter } from './components/CurrentlyView';
import { CreateCustomPayload, CustomTrackerModal } from './components/CustomTrackerModal';
import { DiscoverView } from './components/DiscoverView';
import { JournalView } from './components/JournalView';
import { getMediumPreset } from './components/mediaMeta';
import { QuickSearchBar } from './components/QuickSearchBar';
import { RippleToast } from './components/RippleToast';
import { ShelfView } from './components/ShelfView';
import {
  CATALOG_ATOMS,
  CATALOG_CONTAINERS,
  createInitialState,
} from './data/catalog';
import {
  computeRippleOnBulkComplete,
  computeRippleOnComplete,
  getContainerProgress,
  getUnlockedCollections,
} from './engine/graph';
import { clearAppState, loadAppState, saveAppState } from './engine/storage';
import {
  AppState,
  AtomNode,
  ContainerNode,
  RippleEvent,
  ShelfStatus,
} from './engine/types';
import {
  loadCoverCache,
  resolveCoverForContainer,
  ResolvedCover,
  saveCoverCache,
} from './services/coverResolver';
import { OnlineSearchResult } from './services/onlineSearch';

type Tab = 'currently' | 'discover' | 'shelf' | 'journal';

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
  seasonNumber?: number
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
    case 'openlibrary':
      return `ol:${String(result.externalId).replace(/[^a-zA-Z0-9_-]/g, '_')}:u${unitNumber}`;
    case 'steam':
    case 'wikipedia':
    default:
      return `game:${result.externalId}:u${unitNumber}`;
  }
}

export function App() {
  const [state, setState] = useState<AppState>(() => loadAppState(createInitialState));
  const [activeTab, setActiveTab] = useState<Tab>('currently');
  const [focusDiscoverSearch, setFocusDiscoverSearch] = useState(false);
  const [pillarFilter, setPillarFilter] = useState<PillarFilter>('all');
  const [detailContainerId, setDetailContainerId] = useState<string | null>(null);
  const [onlineResultToAdd, setOnlineResultToAdd] =
    useState<OnlineSearchResult | null>(null);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customModalPrefill, setCustomModalPrefill] = useState('');
  const [ripple, setRipple] = useState<RippleEvent | null>(null);
  const rippleTimerRef = useRef<number | null>(null);

  const [finishingIds, setFinishingIds] = useState<Set<string>>(() => new Set());
  const finishingTimersRef = useRef<Map<string, number>>(new Map());
  const [lastFinishedPulse, setLastFinishedPulse] = useState(0);

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
    window.scrollTo(0, 0);
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

  const unfinishedBoardCount = useMemo(
    () =>
      state.activeBoard.filter((entry) => {
        const container = containersById[entry.containerId];
        if (!container) return false;
        return !getContainerProgress(container, completedAtomIds, atomsById).isComplete;
      }).length,
    [state.activeBoard, containersById, completedAtomIds, atomsById]
  );

  const unlockedCount = useMemo(
    () =>
      getUnlockedCollections(
        allContainers,
        completedAtomIds,
        atomsById,
        activeBoardIds
      ).length,
    [allContainers, completedAtomIds, atomsById, activeBoardIds]
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
      setLastFinishedPulse((p) => p + 1);
    }, 420);

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

    setState((prev) => ({
      ...prev,
      progress: {
        ...prev.progress,
        [atomId]: {
          atomId,
          completedAt: new Date().toISOString(),
          sourceContainerId,
        },
      },
    }));

    let triggeredFinish = false;
    for (const comp of event.completedContainers) {
      if (activeBoardIds.has(comp.id)) {
        scheduleFinishingContainer(comp.id);
        triggeredFinish = true;
      }
    }
    if (!triggeredFinish) {
      setLastFinishedPulse((p) => p + 1);
    }

    showRipple(event);
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
      const nextProgress = { ...prev.progress };
      for (const id of remainingIds) {
        nextProgress[id] = {
          atomId: id,
          completedAt: now,
          sourceContainerId: containerId,
        };
      }
      return { ...prev, progress: nextProgress };
    });

    let triggeredFinish = false;
    for (const comp of event.completedContainers) {
      if (activeBoardIds.has(comp.id)) {
        scheduleFinishingContainer(comp.id);
        triggeredFinish = true;
      }
    }
    if (!triggeredFinish) {
      setLastFinishedPulse((p) => p + 1);
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
          },
          ...prev.activeBoard,
        ],
      };
    });
  };

  const handleToggleBacklog = (containerId: string) => {
    setState((prev) => {
      const current = prev.shelf[containerId];
      return {
        ...prev,
        shelf: {
          ...prev.shelf,
          [containerId]: current === 'backlog' ? 'none' : 'backlog',
        },
      };
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
      accentTo: '#1B1D24',
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
        },
        ...prev.activeBoard,
      ],
    }));

    setActiveTab('currently');
    setPillarFilter('all');
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
        provided?.seasonNumber ?? payload.seasonNumber
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
      accentTo: '#1B1D24',
      monogram: buildMonogram(payload.title),
      coverUrl: result.coverUrl,
      hqCoverUrl: result.hqCoverUrl,
      fallbackCoverUrl: result.fallbackCoverUrl,
      year: result.year,
      creator: result.creator,
      unitPlural: payload.unitPlural,
      description: result.description,
      isCustom: true,
      externalSource: result.externalSource,
      externalId: result.externalId,
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
                },
                ...prev.activeBoard,
              ]
            : prev.activeBoard,
        shelf:
          payload.destination === 'backlog'
            ? { ...prev.shelf, [newContainer.id]: 'backlog' }
            : prev.shelf,
      };
    });

    if (preCompletedCount > 0) {
      setLastFinishedPulse((p) => p + 1);
    }

    setOnlineResultToAdd(null);

    if (payload.destination === 'currently') {
      setActiveTab('currently');
      setPillarFilter('all');
    } else {
      setActiveTab('shelf');
    }
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

  const navItems: {
    id: Tab;
    label: string;
    icon: typeof Layers;
    badge?: number;
  }[] = [
    {
      id: 'currently',
      label: 'Currently',
      icon: Layers,
      badge: unfinishedBoardCount || undefined,
    },
    { id: 'discover', label: 'Discover', icon: Compass },
    { id: 'shelf', label: 'Shelf', icon: Bookmark, badge: unlockedCount || undefined },
    { id: 'journal', label: 'Journal', icon: Clock },
  ];

  return (
    <div className="min-h-screen bg-[#111216] text-[#F1F2F6] pb-24 sm:pb-12">
      {/* Top Flat Matte Header */}
      <header className="sticky top-0 z-30 border-b border-[#23252F] bg-[#15161B]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 h-16">
          {/* Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('currently')}
            className="flex items-center gap-2.5 text-left cursor-pointer shrink-0"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E87151] text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="hidden sm:block">
              <span className="text-base font-bold tracking-tight text-[#F1F2F6]">
                Shelfie
              </span>
              <span className="hidden lg:inline-block ml-2 rounded-md border border-[#303340] bg-[#252731] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#9397A5]">
                Alpha
              </span>
            </div>
          </button>

          {/* Global Online Search Autocomplete (hidden on Discover to avoid duplicate search) */}
          {activeTab !== 'discover' && (
            <QuickSearchBar
              onSelectOnlineResult={setOnlineResultToAdd}
              onOpenCustomModal={handleOpenCustomModal}
            />
          )}

          {/* Desktop Nav */}
          <nav
            aria-label="Main navigation"
            className="hidden md:flex items-center gap-1 rounded-2xl border border-[#23252F] bg-[#111216] p-1 shrink-0"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                    isActive
                      ? 'bg-[#E87151] text-white'
                      : 'text-[#9397A5] hover:text-[#F1F2F6] hover:bg-[#1B1D24]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`tabular-nums rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                        isActive
                          ? 'bg-black/20 text-white'
                          : 'bg-[#252731] text-[#9397A5]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-6 sm:pt-8">
        {activeTab === 'currently' && (
          <CurrentlyView
            activeBoard={state.activeBoard}
            containersById={containersById}
            allContainers={allContainers}
            atomsById={atomsById}
            completedAtomIds={completedAtomIds}
            progressMap={state.progress}
            finishingIds={finishingIds}
            lastFinishedPulse={lastFinishedPulse}
            pillarFilter={pillarFilter}
            onChangePillarFilter={setPillarFilter}
            onLogNextAtom={handleLogNextAtom}
            onCompleteWholeContainer={handleCompleteWholeContainer}
            onUndoAtoms={uncompleteAtoms}
            onOpenDetail={setDetailContainerId}
            onGoDiscover={() => {
              setFocusDiscoverSearch(true);
              setActiveTab('discover');
            }}
            onGoJournal={() => setActiveTab('journal')}
            onOpenCustomModal={handleOpenCustomModal}
          />
        )}

        {activeTab === 'discover' && (
          <DiscoverView
            allContainers={allContainers}
            atomsById={atomsById}
            completedAtomIds={completedAtomIds}
            activeBoardIds={activeBoardIds}
            shelfById={state.shelf}
            autoFocusSearch={focusDiscoverSearch}
            onAutoFocusHandled={() => setFocusDiscoverSearch(false)}
            onTogglePinCurrently={handleTogglePinCurrently}
            onToggleBacklog={handleToggleBacklog}
            onOpenDetail={setDetailContainerId}
            onSelectOnlineResult={setOnlineResultToAdd}
            onOpenCustomModal={handleOpenCustomModal}
          />
        )}

        {activeTab === 'shelf' && (
          <ShelfView
            allContainers={allContainers}
            atomsById={atomsById}
            completedAtomIds={completedAtomIds}
            activeBoardIds={activeBoardIds}
            shelfById={state.shelf}
            onOpenDetail={setDetailContainerId}
            onTogglePinCurrently={handleTogglePinCurrently}
          />
        )}

        {activeTab === 'journal' && (
          <JournalView
            appState={state}
            progressMap={state.progress}
            atomsById={atomsById}
            containersById={containersById}
            allContainers={allContainers}
            completedAtomIds={completedAtomIds}
            activeBoardIds={activeBoardIds}
            onUndoAtom={(atomId) => uncompleteAtoms([atomId])}
            onOpenDetail={setDetailContainerId}
            onClearAllData={handleClearAllData}
            onImportState={handleImportState}
          />
        )}
      </main>

      {/* Mobile / Tablet Bottom Pill Bar */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-3 inset-x-4 z-40 flex items-center justify-around rounded-2xl border border-[#2A2D37] bg-[#15161B] p-1.5 shadow-2xl"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition cursor-pointer ${
                isActive ? 'bg-[#E87151] text-white' : 'text-[#9397A5]'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

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
        onClose={() => setDetailContainerId(null)}
        onSelectContainer={setDetailContainerId}
        onToggleAtom={handleToggleAtom}
        onToggleTrackMode={handleToggleTrackMode}
        onTogglePinCurrently={handleTogglePinCurrently}
        onSetShelfStatus={handleSetShelfStatus}
        onCompleteAll={handleCompleteWholeContainer}
        onUpdateContainer={handleUpdateContainer}
        onDeleteContainer={handleDeleteContainer}
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
