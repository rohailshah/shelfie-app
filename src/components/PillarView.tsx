import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  Gamepad2,
  History,
  Link2,
  ListFilter,
  Plus,
  Search,
  Sparkles,
  Tv,
  Undo2,
  X,
} from 'lucide-react';
import {
  ContainerProgress,
  formatBingersCode,
  getContainerProgress,
  getLatestCompletedAt,
  getOverlappingContainers,
  isItemCollectingDust,
} from '../engine/graph';
import {
  ActiveBoardEntry,
  AtomNode,
  ContainerNode,
  Medium,
  Pillar,
  ProgressEntry,
  ShelfStatus,
} from '../engine/types';
import {
  getMediumPreset,
  MEDIUM_COLORS,
  MEDIUM_LABELS,
  PILLAR_LABELS,
} from './mediaMeta';
import { PosterArt } from './PosterArt';

type SortMode = 'recent' | 'title' | 'progress';
type PlaySubFilter = 'all' | 'active' | 'dust' | 'owned';
type CelebrationPhase = 'enter' | 'exit' | 'collapsing';

interface PillarViewProps {
  pillar: Pillar;
  activeBoard: ActiveBoardEntry[];
  allContainers: ContainerNode[];
  containersById: Record<string, ContainerNode>;
  atomsById: Record<string, AtomNode>;
  completedAtomIds: Set<string>;
  progressMap: Record<string, ProgressEntry>;
  shelfById: Record<string, ShelfStatus>;
  finishingIds: Set<string>;
  onLogNextAtom: (containerId: string) => void;
  onCompleteWholeContainer: (containerId: string) => void;
  onUndoAtoms: (atomIds: string[]) => void;
  onOpenDetail: (containerId: string) => void;
  onOpenSearchForPillar: (pillar: Pillar) => void;
  onOpenCustomModal: (prefillTitle?: string) => void;
  onGoJournal: () => void;
}

interface PillarContainerItem {
  container: ContainerNode;
  entry?: ActiveBoardEntry;
  shelfStatus: ShelfStatus;
  progress: ContainerProgress;
  isDust: boolean;
  lastActivityMs: number;
}

interface FinishedFeedRow {
  key: string;
  kind: 'container' | 'unit';
  container: ContainerNode;
  title: string;
  codeLine?: string;
  detailLine: string;
  timestampMs: number;
  undoAtomIds: string[];
}

function getNextUnitDisplay(
  container: ContainerNode,
  entry: ActiveBoardEntry | undefined,
  progress: ContainerProgress
): { code: string; detail: string } {
  const mediumLabel = MEDIUM_LABELS[container.medium];
  if (progress.isComplete) {
    return {
      code: container.kindLabel,
      detail: 'Completed',
    };
  }
  if (entry?.trackSingleItem) {
    return {
      code: `${progress.remaining} left`,
      detail: container.creator || container.kindLabel,
    };
  }
  const atom = progress.nextAtom;
  if (!atom) {
    return {
      code: container.kindLabel,
      detail: container.creator || container.subtitle,
    };
  }

  const code = formatBingersCode(atom.subtitle, mediumLabel);
  const rawSubLower = atom.subtitle?.trim().toLowerCase() ?? '';
  const titleLower = atom.title.trim().toLowerCase();
  const sameAsCode =
    titleLower === code.toLowerCase() || (rawSubLower !== '' && titleLower === rawSubLower);
  const detail = sameAsCode
    ? [container.creator, container.year].filter(Boolean).join(' · ') || container.kindLabel
    : atom.title;

  return { code, detail };
}

export function PillarView({
  pillar,
  activeBoard,
  allContainers,
  containersById,
  atomsById,
  completedAtomIds,
  progressMap,
  shelfById,
  finishingIds,
  onLogNextAtom,
  onCompleteWholeContainer,
  onUndoAtoms,
  onOpenDetail,
  onOpenSearchForPillar,
  onOpenCustomModal,
  onGoJournal,
}: PillarViewProps) {
  const [subMedium, setSubMedium] = useState<'all' | Medium>('all');
  const [playFilter, setPlayFilter] = useState<PlaySubFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [controlsOpen, setControlsOpen] = useState(false);
  const [isViewingHistory, setIsViewingHistory] = useState(false);

  const [celebratingMap, setCelebratingMap] = useState<
    Record<string, CelebrationPhase>
  >({});
  const celebTimersRef = useRef<number[]>([]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);
  const prevHistoryHeightRef = useRef<number>(0);
  const prevScopeKeyRef = useRef<string>('');
  const didMountAnchorRef = useRef<boolean>(false);

  useEffect(() => {
    setSubMedium('all');
    setPlayFilter('all');
    setControlsOpen(false);
  }, [pillar]);

  useEffect(() => {
    return () => {
      for (const id of celebTimersRef.current) {
        window.clearTimeout(id);
      }
      celebTimersRef.current = [];
    };
  }, []);

  const activeEntryMap = useMemo(() => {
    const map = new Map<string, ActiveBoardEntry>();
    for (const entry of activeBoard) {
      map.set(entry.containerId, entry);
    }
    return map;
  }, [activeBoard]);

  const pillarItems = useMemo<PillarContainerItem[]>(() => {
    const items: PillarContainerItem[] = [];
    const nowMs = Date.now();

    for (const container of allContainers) {
      if (container.pillar !== pillar) continue;
      const entry = activeEntryMap.get(container.id);
      const shelfStatus = shelfById[container.id] ?? 'none';
      const progress = getContainerProgress(container, completedAtomIds, atomsById);

      const isInFeed =
        Boolean(entry) ||
        shelfStatus === 'backlog' ||
        shelfStatus === 'owned_physical' ||
        shelfStatus === 'owned_digital' ||
        progress.isComplete;

      if (!isInFeed) continue;

      const isDust =
        !progress.isComplete &&
        isItemCollectingDust(container, entry, shelfStatus, progressMap, nowMs);

      const latestIso = getLatestCompletedAt(container, progressMap);
      const latestMs = latestIso ? new Date(latestIso).getTime() : 0;
      const addedMs = entry ? new Date(entry.addedAt).getTime() : 0;
      const lastActivityMs = Math.max(
        Number.isNaN(latestMs) ? 0 : latestMs,
        Number.isNaN(addedMs) ? 0 : addedMs
      );

      items.push({
        container,
        entry,
        shelfStatus,
        progress,
        isDust,
        lastActivityMs,
      });
    }

    return items;
  }, [
    allContainers,
    pillar,
    activeEntryMap,
    shelfById,
    completedAtomIds,
    atomsById,
    progressMap,
  ]);

  const filteredBySub = useMemo(() => {
    return pillarItems.filter((item) => {
      if (pillar === 'play') {
        if (playFilter === 'owned') {
          return (
            item.shelfStatus === 'owned_physical' ||
            item.shelfStatus === 'owned_digital'
          );
        }
        return true;
      }
      if (subMedium !== 'all' && item.container.medium !== subMedium) {
        return false;
      }
      return true;
    });
  }, [pillarItems, pillar, playFilter, subMedium]);

  const sortItems = (list: PillarContainerItem[]): PillarContainerItem[] => {
    const copy = [...list];
    copy.sort((a, b) => {
      if (sortMode === 'title') {
        return a.container.title.localeCompare(b.container.title);
      }
      if (sortMode === 'progress') {
        if (b.progress.percent !== a.progress.percent) {
          return b.progress.percent - a.progress.percent;
        }
        return b.lastActivityMs - a.lastActivityMs;
      }
      return b.lastActivityMs - a.lastActivityMs;
    });
    return copy;
  };

  const activeQueue = useMemo(() => {
    if (pillar === 'play' && playFilter === 'dust') return [];
    const list = filteredBySub.filter((item) => {
      const isFinishing = finishingIds.has(item.container.id);
      if (item.progress.isComplete && !isFinishing) return false;
      if (isFinishing) return true;
      if (!item.entry) return false;
      return !item.isDust;
    });
    return sortItems(list);
  }, [filteredBySub, pillar, playFilter, finishingIds, sortMode]);

  const dustQueue = useMemo(() => {
    if (pillar === 'play' && playFilter === 'active') return [];
    const list = filteredBySub.filter((item) => {
      if (finishingIds.has(item.container.id)) return false;
      if (item.progress.isComplete) return false;
      return item.isDust;
    });
    return sortItems(list);
  }, [filteredBySub, pillar, playFilter, finishingIds, sortMode]);

  const completedItems = useMemo(
    () =>
      filteredBySub.filter(
        (item) => item.progress.isComplete && !finishingIds.has(item.container.id)
      ),
    [filteredBySub, finishingIds]
  );

  const finishedRows = useMemo<FinishedFeedRow[]>(() => {
    const rows: FinishedFeedRow[] = [];
    const completedSet = new Set(completedItems.map((i) => i.container.id));

    for (const { container, progress } of completedItems) {
      const latestIso =
        getLatestCompletedAt(container, progressMap) ?? new Date().toISOString();
      const timestampMs = new Date(latestIso).getTime() || 0;

      let undoAtomIds: string[];
      if (container.atomIds.length <= 1) {
        undoAtomIds = [...container.atomIds];
      } else {
        let latestAtomId = container.atomIds[container.atomIds.length - 1];
        let latestAtomTime = -Infinity;
        for (const id of container.atomIds) {
          const entry = progressMap[id];
          if (!entry) continue;
          const t = new Date(entry.completedAt).getTime();
          if (!Number.isNaN(t) && t >= latestAtomTime) {
            latestAtomTime = t;
            latestAtomId = id;
          }
        }
        undoAtomIds = latestAtomId ? [latestAtomId] : [];
      }

      rows.push({
        key: `container-${container.id}`,
        kind: 'container',
        container,
        title: container.title,
        codeLine: `Completed · ${progress.total}/${progress.total} ${container.unitPlural}`,
        detailLine: container.creator || container.kindLabel,
        timestampMs,
        undoAtomIds,
      });
    }

    const unitCandidates = Object.values(progressMap).sort(
      (a, b) =>
        new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );

    let unitCount = 0;
    for (const entry of unitCandidates) {
      if (unitCount >= 20) break;
      const atom = atomsById[entry.atomId];
      if (!atom) continue;

      const atomPillar = getMediumPreset(atom.medium).pillar;
      if (atomPillar !== pillar) continue;
      if (pillar !== 'play' && subMedium !== 'all' && atom.medium !== subMedium) {
        continue;
      }

      const parentContainer =
        (entry.sourceContainerId && containersById[entry.sourceContainerId]) ||
        allContainers.find((c) => c.atomIds.includes(atom.id));

      if (!parentContainer) continue;
      if (finishingIds.has(parentContainer.id)) continue;
      if (completedSet.has(parentContainer.id)) continue;

      const parentProgress = getContainerProgress(
        parentContainer,
        completedAtomIds,
        atomsById
      );
      if (parentProgress.isComplete) continue;

      unitCount += 1;
      const timestampMs = new Date(entry.completedAt).getTime() || 0;

      rows.push({
        key: `unit-${entry.atomId}`,
        kind: 'unit',
        container: parentContainer,
        title: parentContainer.title,
        codeLine: formatBingersCode(atom.subtitle, MEDIUM_LABELS[atom.medium]),
        detailLine: atom.title,
        timestampMs,
        undoAtomIds: [entry.atomId],
      });
    }

    // Oldest at top -> most recently finished at bottom (right above Watch next)
    rows.sort((a, b) => a.timestampMs - b.timestampMs);
    return rows;
  }, [
    completedItems,
    progressMap,
    atomsById,
    pillar,
    subMedium,
    containersById,
    allContainers,
    finishingIds,
    completedAtomIds,
  ]);

  const scopeKey = `${pillar}::${subMedium}::${playFilter}`;

  useLayoutEffect(() => {
    const scrollEl = scrollRef.current;
    const histEl = historyRef.current;
    if (!scrollEl || !histEl) return;

    const nextH = histEl.offsetHeight;
    const scopeChanged = prevScopeKeyRef.current !== scopeKey;
    const prevH = prevHistoryHeightRef.current;

    if (scopeChanged || !didMountAnchorRef.current) {
      scrollEl.scrollTop = nextH;
      didMountAnchorRef.current = true;
      prevScopeKeyRef.current = scopeKey;
      prevHistoryHeightRef.current = nextH;
      setIsViewingHistory(false);
      return;
    }

    if (nextH !== prevH) {
      const delta = nextH - prevH;
      if (prevH === 0 || scrollEl.scrollTop >= prevH - 32) {
        scrollEl.scrollTop = Math.max(0, scrollEl.scrollTop + delta);
      }
      prevHistoryHeightRef.current = nextH;
    }

    setIsViewingHistory(nextH > 0 && scrollEl.scrollTop < nextH - 28);
  }, [scopeKey, finishedRows.length]);

  const handleScroll = () => {
    const scrollEl = scrollRef.current;
    const histEl = historyRef.current;
    if (!scrollEl || !histEl) return;
    const histH = histEl.offsetHeight;
    setIsViewingHistory(histH > 0 && scrollEl.scrollTop < histH - 28);
  };

  const handleToggleHistoryScroll = () => {
    const scrollEl = scrollRef.current;
    const histEl = historyRef.current;
    if (!scrollEl || !histEl) return;

    const histH = histEl.offsetHeight;
    if (finishedRows.length === 0 || histH === 0) {
      onGoJournal();
      return;
    }

    if (isViewingHistory) {
      scrollEl.scrollTo({ top: histH, behavior: 'smooth' });
    } else {
      scrollEl.scrollTo({
        top: Math.max(0, histH - 280),
        behavior: 'smooth',
      });
    }
  };

  const actionVerb =
    pillar === 'watch' ? 'Watched' : pillar === 'read' ? 'Read' : 'Played';

  const handleQuickCheck = (item: PillarContainerItem) => {
    const id = item.container.id;
    if (celebratingMap[id]) return;

    const willComplete =
      Boolean(item.entry?.trackSingleItem) || item.progress.remaining <= 1;

    setCelebratingMap((prev) => ({ ...prev, [id]: 'enter' }));

    const logTimer = window.setTimeout(() => {
      if (item.entry?.trackSingleItem) {
        onCompleteWholeContainer(id);
      } else {
        onLogNextAtom(id);
      }
    }, 340);
    celebTimersRef.current.push(logTimer);

    if (willComplete) {
      const collapseTimer = window.setTimeout(() => {
        setCelebratingMap((prev) => ({ ...prev, [id]: 'collapsing' }));
      }, 520);
      const clearTimer = window.setTimeout(() => {
        setCelebratingMap((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 760);
      celebTimersRef.current.push(collapseTimer, clearTimer);
    } else {
      const exitTimer = window.setTimeout(() => {
        setCelebratingMap((prev) => ({ ...prev, [id]: 'exit' }));
      }, 620);
      const clearTimer = window.setTimeout(() => {
        setCelebratingMap((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 840);
      celebTimersRef.current.push(exitTimer, clearTimer);
    }
  };

  const headingCopy = {
    watch: {
      title: 'Watch',
      nextHeading: 'Watch next',
      icon: Tv,
      emptyLabel: 'Nothing in Watch yet',
      emptyHint: 'Add TV shows, movies, or anime to track episode by episode.',
    },
    read: {
      title: 'Read',
      nextHeading: 'Read next',
      icon: BookOpen,
      emptyLabel: 'Nothing in Read yet',
      emptyHint: 'Add comics, manga, or books—overlapping volumes sync automatically.',
    },
    play: {
      title: 'Play',
      nextHeading: 'Play next',
      icon: Gamepad2,
      emptyLabel: 'Nothing in Play yet',
      emptyHint: 'Add video games broken into chapters, acts, or region milestones.',
    },
  }[pillar];

  const subMediumOptions: { id: 'all' | Medium; label: string }[] =
    pillar === 'watch'
      ? [
          { id: 'all', label: 'All' },
          { id: 'tv', label: 'TV' },
          { id: 'movie', label: 'Movies' },
          { id: 'anime', label: 'Anime' },
        ]
      : pillar === 'read'
        ? [
            { id: 'all', label: 'All' },
            { id: 'comic', label: 'Comics' },
            { id: 'manga', label: 'Manga' },
            { id: 'book', label: 'Books' },
          ]
        : [];

  const playFilterOptions: { id: PlaySubFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'dust', label: 'Collecting dust' },
    { id: 'owned', label: 'Owned' },
  ];

  const hasActiveFilter =
    (pillar === 'play' ? playFilter !== 'all' : subMedium !== 'all') ||
    sortMode !== 'recent';

  const activeFilterLabel =
    pillar === 'play'
      ? playFilterOptions.find((o) => o.id === playFilter)?.label
      : subMedium !== 'all'
        ? subMediumOptions.find((o) => o.id === subMedium)?.label
        : undefined;

  const showMixedDot = pillar !== 'play' && subMedium === 'all';

  const renderHorizontalCard = (item: PillarContainerItem) => {
    const { container, progress } = item;
    const celebPhase = celebratingMap[container.id];
    const dotColor = MEDIUM_COLORS[container.medium] ?? container.accentFrom;
    const overlapping = getOverlappingContainers(container.id, allContainers);
    const { code, detail } = getNextUnitDisplay(container, item.entry, progress);

    return (
      <article
        key={container.id}
        className={`group relative flex items-stretch overflow-hidden rounded-[18px] border border-[#1E1E24] bg-[#141417] h-[98px] transition-colors hover:border-[#2A2A32] hover:bg-[#1A1A1F] ${
          celebPhase === 'collapsing' ? 'animate-card-exit' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => onOpenDetail(container.id)}
          aria-label={`Open details for ${container.title}`}
          className="absolute inset-0 rounded-[18px] focus:outline-none focus:ring-2 focus:ring-[#E87151]/60 cursor-pointer"
        />

        <PosterArt
          container={container}
          variant="flush"
          className="w-[68px] sm:w-[74px]"
        />

        <div className="min-w-0 flex-1 py-2.5 pl-3.5 pr-2 flex flex-col justify-center gap-1">
          <h3 className="truncate text-[15px] font-semibold text-[#F4F4F6] leading-snug">
            {container.title}
          </h3>

          <div className="flex items-center gap-1.5 text-[13px] font-medium text-[#7C7C86] tabular-nums leading-tight">
            {showMixedDot && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: dotColor }}
              />
            )}
            <span className="truncate">{code}</span>
            <span className="text-[#4A4A52]">·</span>
            <span className="shrink-0">
              {progress.completed}/{progress.total}
            </span>
            {overlapping.length > 0 && (
              <Link2
                className="h-3 w-3 shrink-0 text-[#56565F]"
                aria-label="Linked editions"
              />
            )}
          </div>

          <p className="truncate text-[13px] text-[#56565F] leading-tight">
            {detail}
          </p>
        </div>

        <div className="relative z-10 flex items-center pr-3.5 shrink-0">
          {progress.isComplete && !celebPhase ? (
            <span
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[#22C55E]/50 bg-[#22C55E]/15 text-[#22C55E]"
              aria-label={`${container.title} completed`}
            >
              <Check className="h-4 w-4 stroke-[2.5]" />
            </span>
          ) : (
            <button
              type="button"
              onClick={() => handleQuickCheck(item)}
              aria-label={
                item.entry?.trackSingleItem
                  ? `Finish ${container.title}`
                  : `Log next unit in ${container.title}`
              }
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[#34343C] bg-transparent text-[#6E6E78] hover:border-[#22E55B] hover:text-[#22E55B] active:scale-90 transition cursor-pointer"
            >
              <Check className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Full-Card Green Celebration Overlay */}
        {celebPhase && (
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 rounded-[18px] bg-[#22E55B] text-[#09090B] ${
              celebPhase === 'exit' ? 'animate-watched-out' : 'animate-watched-in'
            }`}
          >
            <Check className="h-5 w-5 stroke-[2.75]" />
            <span className="text-[13px] font-bold tracking-tight">
              {actionVerb}
            </span>
          </div>
        )}
      </article>
    );
  };

  const hasAnyContent =
    activeQueue.length > 0 || dustQueue.length > 0 || finishedRows.length > 0;

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="h-[100dvh] overflow-y-auto bg-black [overflow-anchor:none]"
    >
      <div className="mx-auto max-w-2xl px-4">
        {/* Minimal Sticky Top Bar */}
        <header className="sticky top-0 z-20 -mx-4 px-4 h-14 flex items-center justify-between bg-black/85 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[#E87151]" />
            <span className="text-sm font-semibold tracking-tight text-[#7A7A86]">
              {headingCopy.title}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setControlsOpen((prev) => !prev)}
              aria-label="Filter and sort"
              aria-expanded={controlsOpen}
              className={`relative flex h-9 w-9 items-center justify-center rounded-full transition cursor-pointer ${
                controlsOpen
                  ? 'bg-white/[0.1] text-white'
                  : 'text-[#C8C8D0] hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <ListFilter className="h-[18px] w-[18px]" />
              {hasActiveFilter && (
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#E87151]" />
              )}
            </button>

            <button
              type="button"
              onClick={handleToggleHistoryScroll}
              aria-label={
                isViewingHistory
                  ? `Back to ${headingCopy.nextHeading}`
                  : 'Scroll up to finished history'
              }
              title={
                finishedRows.length > 0
                  ? isViewingHistory
                    ? `Back to ${headingCopy.nextHeading}`
                    : 'View finished history above'
                  : 'Open Journal'
              }
              className={`flex h-9 w-9 items-center justify-center rounded-full transition cursor-pointer ${
                isViewingHistory
                  ? 'bg-[#22C55E]/15 text-[#22C55E]'
                  : 'text-[#C8C8D0] hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <History className="h-[18px] w-[18px]" />
            </button>

            <button
              type="button"
              onClick={() => onOpenSearchForPillar(pillar)}
              aria-label={`Add to ${headingCopy.title}`}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#C8C8D0] hover:bg-white/[0.06] hover:text-white transition cursor-pointer"
            >
              <Plus className="h-[19px] w-[19px]" />
            </button>
          </div>
        </header>

        {/* Scroll-Up History Region (directly above Watch next) */}
        <div
          ref={historyRef}
          aria-label="Finished history"
          className={finishedRows.length > 0 ? 'pt-2 pb-6 space-y-2.5' : ''}
        >
          {finishedRows.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-2 px-1 pb-0.5 whitespace-nowrap">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#52525A]">
                  Finished · {finishedRows.length}
                </span>
                <button
                  type="button"
                  onClick={onGoJournal}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#7A7A82] hover:text-white transition cursor-pointer"
                >
                  <span>Full history in Journal</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              {finishedRows.map((row) => (
                <article
                  key={row.key}
                  className="group relative flex items-stretch overflow-hidden rounded-[18px] border border-[#18181D] bg-[#101013] h-[90px] transition hover:border-[#24242C] hover:bg-[#141418]"
                >
                  <button
                    type="button"
                    onClick={() => onOpenDetail(row.container.id)}
                    aria-label={`Open details for ${row.title}`}
                    className="absolute inset-0 rounded-[18px] focus:outline-none focus:ring-2 focus:ring-[#E87151]/50 cursor-pointer"
                  />

                  <PosterArt
                    container={row.container}
                    variant="flush"
                    className="w-[68px] sm:w-[74px] opacity-45 brightness-75"
                  />

                  <div className="min-w-0 flex-1 py-2.5 pl-3.5 pr-2 flex flex-col justify-center gap-0.5">
                    <p className="truncate text-[15px] font-medium text-[#7A7A82] leading-snug">
                      {row.title}
                    </p>
                    {row.codeLine && (
                      <p className="truncate text-[13px] font-medium text-[#52525A] leading-tight">
                        {row.codeLine}
                      </p>
                    )}
                    <p className="truncate text-[13px] text-[#3E3E45] leading-tight">
                      {row.detailLine}
                    </p>
                  </div>

                  <div className="relative z-10 flex items-center gap-2 pr-3.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onUndoAtoms(row.undoAtomIds)}
                      aria-label={`Undo ${
                        row.kind === 'container' ? row.title : row.detailLine
                      }`}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#24242C] bg-[#141417] px-2 py-1 text-[11px] font-medium text-[#7A7A82] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-white transition cursor-pointer"
                    >
                      <Undo2 className="h-3 w-3" />
                      <span className="hidden sm:inline">Undo</span>
                    </button>
                    <span
                      className="flex h-6 w-6 items-center justify-center text-[#22C55E]"
                      aria-hidden="true"
                    >
                      <Check className="h-4 w-4 stroke-[2.5]" />
                    </span>
                  </div>
                </article>
              ))}
            </>
          )}
        </div>

        {/* Default Viewport Anchor Region */}
        <div className="min-h-[calc(100dvh-3.5rem)] pt-1 pb-28 space-y-7">
          {/* Collapsible Filter & Sort Panel */}
          {controlsOpen ? (
            <div className="rounded-2xl border border-[#1E1E24] bg-[#101013] p-3 space-y-2.5">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                {pillar === 'play'
                  ? playFilterOptions.map((opt) => {
                      const active = playFilter === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setPlayFilter(opt.id)}
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer ${
                            active
                              ? 'bg-[#E87151] text-white'
                              : 'border border-[#222229] bg-[#141417] text-[#8E8E98] hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })
                  : subMediumOptions.map((opt) => {
                      const active = subMedium === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setSubMedium(opt.id)}
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer ${
                            active
                              ? 'bg-[#E87151] text-white'
                              : 'border border-[#222229] bg-[#141417] text-[#8E8E98] hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
              </div>

              <div className="flex items-center gap-1.5 border-t border-[#18181D] pt-2">
                <span className="text-[11px] font-medium text-[#56565F] mr-1">
                  Sort:
                </span>
                {(
                  [
                    { id: 'recent', label: 'Recent' },
                    { id: 'title', label: 'A–Z' },
                    { id: 'progress', label: 'Progress' },
                  ] as { id: SortMode; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSortMode(opt.id)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition cursor-pointer ${
                      sortMode === opt.id
                        ? 'bg-white/[0.1] text-white'
                        : 'text-[#7C7C86] hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            hasActiveFilter && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSubMedium('all');
                    setPlayFilter('all');
                    setSortMode('recent');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#222229] bg-[#141417] px-3 py-1 text-xs font-medium text-[#C8C8D0] hover:text-white transition cursor-pointer"
                >
                  <span>
                    {activeFilterLabel ? `Filter: ${activeFilterLabel}` : `Sort: ${sortMode}`}
                  </span>
                  <X className="h-3 w-3 text-[#7C7C86]" />
                </button>
              </div>
            )
          )}

          {/* Empty State vs Primary & Collecting Dust Sections */}
          {!hasAnyContent ? (
            <div className="rounded-[18px] border border-dashed border-[#1E1E24] bg-[#101013] px-6 py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#24242C] bg-[#141417] text-[#E87151]">
                <headingCopy.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-base font-semibold text-white">
                {headingCopy.emptyLabel}
              </h2>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-[#7C7C86]">
                {headingCopy.emptyHint}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onOpenSearchForPillar(pillar)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#E87151] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#DC6242] transition cursor-pointer"
                >
                  <Search className="h-4 w-4" />
                  Search & Add
                </button>
                <button
                  type="button"
                  onClick={() => onOpenCustomModal('')}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#24242C] bg-[#141417] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1A1A1F] transition cursor-pointer"
                >
                  <Plus className="h-4 w-4 text-[#E87151]" />
                  Custom Tracker
                </button>
              </div>
            </div>
          ) : (
            <>
              {(activeQueue.length > 0 ||
                (dustQueue.length === 0 &&
                  !(pillar === 'play' && playFilter === 'dust'))) && (
                <section className="space-y-3">
                  <h1 className="text-[22px] font-bold tracking-tight text-white">
                    {headingCopy.nextHeading}
                  </h1>

                  {activeQueue.length === 0 ? (
                    <div className="rounded-[18px] border border-dashed border-[#1E1E24] bg-[#101013] px-5 py-8 text-center">
                      <p className="text-sm font-medium text-[#7C7C86]">
                        {finishedRows.length > 0
                          ? `Everything in ${headingCopy.nextHeading} is finished`
                          : `No active items in ${PILLAR_LABELS[pillar]}`}
                      </p>
                      <button
                        type="button"
                        onClick={() => onOpenSearchForPillar(pillar)}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#E87151] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#DC6242] transition cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add to {headingCopy.title}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {activeQueue.map(renderHorizontalCard)}
                    </div>
                  )}
                </section>
              )}

              {dustQueue.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-[22px] font-bold tracking-tight text-white">
                    Collecting dust
                  </h2>

                  <div className="space-y-2.5">
                    {dustQueue.map(renderHorizontalCard)}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
