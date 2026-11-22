import { useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, Clock, Compass, Layers, Sparkles } from 'lucide-react';
import { ContainerDetailModal } from './components/ContainerDetailModal';
import { CurrentlyView, PillarFilter } from './components/CurrentlyView';
import { DiscoverView, getMediumPreset } from './components/DiscoverView';
import { JournalView } from './components/JournalView';
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
  Medium,
  RippleEvent,
  ShelfStatus,
} from './engine/types';

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

    // Simulate incremental ripple across remaining atoms to collect all newly unlocked containers
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

  const handleCreateCustom = (payload: {
    title: string;
    creator: string;
    medium: Medium;
    kindLabel: string;
    unitCount: number;
    unitPrefix: string;
    unitPlural: string;
    customUnitTitles?: string[];
  }) => {
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
      accentFrom: preset.accentFrom,
      accentTo: preset.accentTo,
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
    <div className="relative min-h-screen bg-[#09090B] text-zinc-100 pb-24 sm:pb-12">
      {/* Subtle Ambient Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-violet-600/10 blur-[130px]" />
        <div className="absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-emerald-500/8 blur-[130px]" />
      </div>

      {/* Top Glass Header */}
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#09090B]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 h-16">
          {/* Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('currently')}
            className="flex items-center gap-2.5 text-left cursor-pointer group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-white via-zinc-200 to-zinc-400 text-zinc-950 shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white">
                Shelfie
              </span>
              <span className="ml-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                Alpha
              </span>
            </div>
          </button>

          {/* Desktop Centered Nav */}
          <nav className="hidden sm:flex items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-sm font-medium transition cursor-pointer ${
                    isActive
                      ? 'bg-white text-zinc-950 shadow-sm'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`tabular-nums rounded-full px-1.5 py-0.2 text-[11px] font-semibold ${
                        isActive
                          ? 'bg-zinc-950/10 text-zinc-800'
                          : 'bg-white/10 text-zinc-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Quick Status Pill */}
          <div className="hidden md:flex items-center gap-2 text-xs text-zinc-400">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-soft" />
              <span className="tabular-nums text-zinc-300 font-medium">
                {completedAtomIds.size}
              </span>
              <span>units logged</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 pt-6 sm:pt-8">
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
            onCreateCustom={handleCreateCustom}
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

      {/* Mobile Floating Bottom Pill Bar */}
      <nav className="sm:hidden fixed bottom-3 inset-x-4 z-40 flex items-center justify-around rounded-2xl border border-white/15 bg-zinc-900/90 p-1.5 backdrop-blur-xl shadow-2xl">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition cursor-pointer ${
                isActive ? 'bg-white text-zinc-950' : 'text-zinc-400'
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
    </div>
  );
}

export default App;
