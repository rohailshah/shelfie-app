import { useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, Clock, Compass, Layers, Sparkles } from 'lucide-react';
import { AddOnlineConfirmPayload, AddOnlineModal } from './components/AddOnlineModal';
import { ContainerDetailModal } from './components/ContainerDetailModal';
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
  createInitialDemoState,
} from './data/catalog';
import {
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

export function App() {
  const [state, setState] = useState<AppState>(() =>
    loadAppState(createInitialDemoState)
  );
  const [activeTab, setActiveTab] = useState<Tab>('currently');
  const [pillarFilter, setPillarFilter] = useState<PillarFilter>('all');
  const [detailContainerId, setDetailContainerId] = useState<string | null>(null);
  const [onlineResultToAdd, setOnlineResultToAdd] =
    useState<OnlineSearchResult | null>(null);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customModalPrefill, setCustomModalPrefill] = useState('');
  const [ripple, setRipple] = useState<RippleEvent | null>(null);
  const rippleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  useEffect(() => {
    return () => {
      if (rippleTimerRef.current) {
        window.clearTimeout(rippleTimerRef.current);
      }
    };
  }, []);

  const atomsById = useMemo<Record<string, AtomNode>>(
    () => ({ ...CATALOG_ATOMS, ...state.customAtoms }),
    [state.customAtoms]
  );

  const allContainers = useMemo<ContainerNode[]>(
    () => [...state.customContainers, ...CATALOG_CONTAINERS],
    [state.customContainers]
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

  const showRipple = (event: RippleEvent) => {
    if (rippleTimerRef.current) {
      window.clearTimeout(rippleTimerRef.current);
    }
    setRipple(event);
    rippleTimerRef.current = window.setTimeout(() => {
      setRipple(null);
    }, 7500);
  };

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

    showRipple(event);
  };

  const uncompleteAtom = (atomId: string) => {
    setState((prev) => {
      const nextProgress = { ...prev.progress };
      delete nextProgress[atomId];
      return { ...prev, progress: nextProgress };
    });
    setRipple((prev) => (prev?.atomId === atomId ? null : prev));
  };

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

    const simulatedSet = new Set(completedAtomIds);
    const unlockedMap = new Map<
      string,
      { id: string; title: string; kindLabel: string; isImplicit: boolean }
    >();

    for (const id of remainingIds) {
      const ev = computeRippleOnComplete(
        id,
        containerId,
        simulatedSet,
        allContainers,
        atomsById
      );
      simulatedSet.add(id);
      for (const comp of ev.completedContainers) {
        unlockedMap.set(comp.id, comp);
      }
    }

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

    const lastAtomId = remainingIds[remainingIds.length - 1];
    showRipple({
      id: `${containerId}-all-${Date.now()}`,
      atomId: lastAtomId,
      atomTitle: `${container.title} (${remainingIds.length} ${container.unitPlural})`,
      sourceContainerId: containerId,
      sourceContainerTitle: container.title,
      completedContainers: Array.from(unlockedMap.values()),
      oneLeftContainers: [],
      advancedContainers: [],
      createdAt: now,
    });
  };

  const handleToggleAtom = (atomId: string, sourceContainerId: string) => {
    if (completedAtomIds.has(atomId)) {
      uncompleteAtom(atomId);
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
    const atomIds: string[] = [];

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

    const newContainer: ContainerNode = {
      id: idBase,
      title: payload.title,
      subtitle: `${payload.kindLabel} · ${payload.unitCount} ${payload.unitPlural}`,
      kind: preset.containerKind,
      kindLabel: payload.kindLabel,
      pillar: preset.pillar,
      medium: payload.medium,
      atomIds,
      accentFrom: preset.accentColor,
      accentTo: '#1B1D24',
      monogram: buildMonogram(payload.title),
      creator: payload.creator || undefined,
      unitPlural: payload.unitPlural,
      description: 'Custom sub-unit tracker.',
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
    const idBase = `online-${Date.now()}`;
    const newAtoms: Record<string, AtomNode> = {};
    const atomIds: string[] = [];

    for (let i = 0; i < payload.unitCount; i += 1) {
      const atomId = `${idBase}-u${i + 1}`;
      const provided = payload.units?.[i];
      newAtoms[atomId] = {
        id: atomId,
        title: provided ? provided.title : `${payload.unitPrefix}${i + 1}`,
        subtitle: provided?.subtitle,
        meta: provided?.meta,
        kind: preset.atomKind,
        medium: result.medium,
      };
      atomIds.push(atomId);
    }

    const newContainer: ContainerNode = {
      id: idBase,
      title: payload.title,
      subtitle: `${payload.kindLabel} · ${payload.unitCount} ${payload.unitPlural}`,
      kind: preset.containerKind,
      kindLabel: payload.kindLabel,
      pillar: result.pillar,
      medium: result.medium,
      atomIds,
      accentFrom: preset.accentColor,
      accentTo: '#1B1D24',
      monogram: buildMonogram(payload.title),
      coverUrl: result.coverUrl,
      fallbackCoverUrl: result.fallbackCoverUrl,
      year: result.year,
      creator: result.creator,
      unitPlural: payload.unitPlural,
      description: result.description,
      isCustom: true,
    };

    setState((prev) => ({
      ...prev,
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
    }));

    setOnlineResultToAdd(null);

    if (payload.destination === 'currently') {
      setActiveTab('currently');
      setPillarFilter('all');
    } else {
      setActiveTab('shelf');
    }
  };

  const handleResetDemo = () => {
    clearAppState();
    setState(createInitialDemoState());
    setRipple(null);
    setDetailContainerId(null);
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
    { id: 'currently', label: 'Currently', icon: Layers, badge: state.activeBoard.length },
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
            <div className="hidden xs:block sm:block">
              <span className="text-base font-bold tracking-tight text-[#F1F2F6]">
                Shelfie
              </span>
              <span className="hidden lg:inline-block ml-2 rounded-md border border-[#303340] bg-[#252731] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#9397A5]">
                Alpha
              </span>
            </div>
          </button>

          {/* Global Online Search Autocomplete */}
          <QuickSearchBar
            onSelectOnlineResult={setOnlineResultToAdd}
            onOpenCustomModal={handleOpenCustomModal}
          />

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 rounded-2xl border border-[#23252F] bg-[#111216] p-1 shrink-0">
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
                      className={`tabular-nums rounded-md px-1.5 py-0.2 text-[10px] font-semibold ${
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
            pillarFilter={pillarFilter}
            onChangePillarFilter={setPillarFilter}
            onLogNextAtom={handleLogNextAtom}
            onCompleteWholeContainer={handleCompleteWholeContainer}
            onOpenDetail={setDetailContainerId}
            onGoDiscover={() => setActiveTab('discover')}
          />
        )}

        {activeTab === 'discover' && (
          <DiscoverView
            allContainers={allContainers}
            atomsById={atomsById}
            completedAtomIds={completedAtomIds}
            activeBoardIds={activeBoardIds}
            shelfById={state.shelf}
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
            progressMap={state.progress}
            atomsById={atomsById}
            containersById={containersById}
            allContainers={allContainers}
            completedAtomIds={completedAtomIds}
            activeBoardIds={activeBoardIds}
            onUndoAtom={uncompleteAtom}
            onOpenDetail={setDetailContainerId}
            onResetDemo={handleResetDemo}
          />
        )}
      </main>

      {/* Mobile / Tablet Bottom Pill Bar */}
      <nav className="md:hidden fixed bottom-3 inset-x-4 z-40 flex items-center justify-around rounded-2xl border border-[#2A2D37] bg-[#15161B] p-1.5 shadow-2xl">
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
        onUndo={uncompleteAtom}
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
        onClose={() => setCustomModalOpen(false)}
        onCreate={handleCreateCustom}
      />
    </div>
  );
}

export default App;
