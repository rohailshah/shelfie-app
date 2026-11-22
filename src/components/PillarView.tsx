import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Gamepad2,
  Link2,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Tv,
  Undo2,
} from 'lucide-react';
import {
  ContainerProgress,
  formatRelativeTime,
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
  lastFinishedPulse: number;
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
  timestampIso: string;
  timestampMs: number;
  undoAtomIds: string[];
}

function getNextUnitDisplay(
  container: ContainerNode,
  entry: ActiveBoardEntry | undefined,
  progress: ContainerProgress
): { code: string; detail: string } {
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

  const code = atom.subtitle || MEDIUM_LABELS[container.medium];
  const sameAsCode =
    atom.title.trim().toLowerCase() === code.trim().toLowerCase();
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
  lastFinishedPulse,
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
  const [finishedOpen, setFinishedOpen] = useState(false);
  const [pulseActive, setPulseActive] = useState(false);

  useEffect(() => {
    setSubMedium('all');
    setPlayFilter('all');
    setControlsOpen(false);
  }, [pillar]);

  useEffect(() => {
    if (lastFinishedPulse === 0) return;
    setPulseActive(true);
    const timer = window.setTimeout(() => setPulseActive(false), 950);
    return () => window.clearTimeout(timer);
  }, [lastFinishedPulse]);

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

      // Show containers that are on activeBoard, on backlog, or owned
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
        timestampIso: latestIso,
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
        codeLine: atom.subtitle,
        detailLine: atom.title,
        timestampIso: entry.completedAt,
        timestampMs,
        undoAtomIds: [entry.atomId],
      });
    }

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

  const latestFinished =
    finishedRows.length > 0 ? finishedRows[finishedRows.length - 1] : null;

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

  const renderHorizontalCard = (item: PillarContainerItem) => {
    const { container, entry, progress } = item;
    const isFinishing = finishingIds.has(container.id);
    const dotColor = MEDIUM_COLORS[container.medium] ?? container.accentFrom;
    const overlapping = getOverlappingContainers(container.id, allContainers);
    const { code, detail } = getNextUnitDisplay(container, entry, progress);

    return (
      <article
        key={container.id}
        className={`group relative flex items-stretch overflow-hidden rounded-2xl border border-[#222229] bg-[#16161A] min-h-[94px] transition-all duration-300 hover:border-[#2F2F38] hover:bg-[#1C1C22] ${
          isFinishing ? 'opacity-45 scale-[0.98]' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => onOpenDetail(container.id)}
          aria-label={`Open details for ${container.title}`}
          className="absolute inset-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#E87151]/60 cursor-pointer"
        />

        <PosterArt
          container={container}
          variant="flush"
          className="w-[68px] sm:w-[74px]"
        />

        <div className="min-w-0 flex-1 py-3 pl-3.5 pr-2 flex flex-col justify-center gap-0.5">
          <h3 className="truncate text-[15px] font-semibold text-[#F4F4F6] leading-snug">
            {container.title}
          </h3>

          <div className="flex items-center gap-1.5 text-xs font-medium text-[#8E8E98] tabular-nums">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: dotColor }}
            />
            <span className="truncate">{code}</span>
            <span className="text-[#55555E]">·</span>
            <span className="shrink-0">
              {progress.completed}/{progress.total}
            </span>
            {overlapping.length > 0 && (
              <Link2
                className="h-3 w-3 shrink-0 text-[#63636D]"
                aria-label="Linked editions"
              />
            )}
          </div>

          <p className="truncate text-xs text-[#63636D]">{detail}</p>
        </div>

        <div className="relative z-10 flex items-center pr-3.5 shrink-0">
          {progress.isComplete ? (
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#34D399]/50 bg-[#34D399]/15 text-[#34D399]"
              aria-label={`${container.title} completed`}
            >
              <Check className="h-4 w-4 stroke-[2.5]" />
            </span>
          ) : (
            <button
              type="button"
              onClick={() =>
                entry?.trackSingleItem
                  ? onCompleteWholeContainer(container.id)
                  : onLogNextAtom(container.id)
              }
              aria-label={
                entry?.trackSingleItem
                  ? `Finish ${container.title}`
                  : `Log next unit in ${container.title}`
              }
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#32323A] bg-[#16161A] text-[#8E8E98] hover:border-[#34D399] hover:bg-[#34D399]/12 hover:text-[#34D399] active:scale-90 transition cursor-pointer"
            >
              <Check className="h-4 w-4" />
            </button>
          )}
        </div>
      </article>
    );
  };

  const showTopSubPills =
    pillarItems.length > 0 || finishedRows.length > 0 || controlsOpen;
  const hasAnyContent =
    activeQueue.length > 0 || dustQueue.length > 0 || finishedRows.length > 0;

  return (
    <div className="space-y-5">
      {/* Minimal Bingers Top Bar */}
      <header className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E87151] text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#F4F4F6]">
            {headingCopy.title}
          </h1>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setControlsOpen((prev) => !prev)}
            aria-label="Filter and sort"
            aria-expanded={controlsOpen}
            className={`flex h-9 w-9 items-center justify-center rounded-full border transition cursor-pointer ${
              controlsOpen
                ? 'border-[#E87151] bg-[#E87151]/15 text-[#E87151]'
                : 'border-[#222229] bg-[#16161A] text-[#8E8E98] hover:text-[#F4F4F6]'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onOpenSearchForPillar(pillar)}
            aria-label={`Add to ${headingCopy.title}`}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#222229] bg-[#16161A] text-[#F4F4F6] hover:border-[#E87151] hover:bg-[#E87151] hover:text-white transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Sub-medium / Play filter pills */}
      {showTopSubPills && (
        <div className="space-y-2.5">
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
                          : 'border border-[#222229] bg-[#16161A] text-[#8E8E98] hover:text-[#F4F4F6]'
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
                          : 'border border-[#222229] bg-[#16161A] text-[#8E8E98] hover:text-[#F4F4F6]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
          </div>

          {controlsOpen && (
            <div className="flex items-center gap-1.5 rounded-2xl border border-[#222229] bg-[#111114] px-3 py-2">
              <span className="text-[11px] font-medium text-[#63636D] mr-1">Sort:</span>
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
                      ? 'bg-[#25252D] text-[#F4F4F6]'
                      : 'text-[#8E8E98] hover:text-[#F4F4F6]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bingers-style Finished Section ABOVE Primary Feed (collapsed by default) */}
      {finishedRows.length > 0 && (
        <section aria-label="Finished items" className="space-y-2">
          {finishedOpen && (
            <div className="space-y-2">
              {finishedRows.map((row) => (
                <article
                  key={row.key}
                  className="group relative flex items-stretch overflow-hidden rounded-2xl border border-[#1B1B21] bg-[#111114] min-h-[80px] transition hover:border-[#2A2A33] hover:bg-[#151519]"
                >
                  <button
                    type="button"
                    onClick={() => onOpenDetail(row.container.id)}
                    aria-label={`Open details for ${row.title}`}
                    className="absolute inset-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#E87151]/50 cursor-pointer"
                  />

                  <PosterArt
                    container={row.container}
                    variant="flush"
                    className="w-[56px] sm:w-[62px] opacity-45 saturate-75"
                  />

                  <div className="min-w-0 flex-1 py-2.5 pl-3.5 pr-2 flex flex-col justify-center gap-0.5">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-[#9A9AA4]">
                        {row.title}
                      </p>
                      <span className="hidden sm:inline shrink-0 text-[11px] text-[#55555E]">
                        {formatRelativeTime(row.timestampIso)}
                      </span>
                    </div>
                    {row.codeLine && (
                      <p className="truncate text-xs font-medium text-[#6C6C76]">
                        {row.codeLine}
                      </p>
                    )}
                    <p className="truncate text-xs text-[#55555E]">{row.detailLine}</p>
                  </div>

                  <div className="relative z-10 flex items-center gap-2 pr-3.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onUndoAtoms(row.undoAtomIds)}
                      aria-label={`Undo ${
                        row.kind === 'container' ? row.title : row.detailLine
                      }`}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#2A2A32] bg-[#16161A] px-2 py-1 text-[11px] font-medium text-[#8E8E98] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-[#F4F4F6] transition cursor-pointer"
                    >
                      <Undo2 className="h-3 w-3" />
                      <span className="hidden sm:inline">Undo</span>
                    </button>
                    <span
                      className="flex h-6 w-6 items-center justify-center text-[#34D399]"
                      aria-hidden="true"
                    >
                      <Check className="h-4 w-4 stroke-[2.5]" />
                    </span>
                  </div>
                </article>
              ))}

              <div className="flex justify-end pt-0.5">
                <button
                  type="button"
                  onClick={onGoJournal}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#8E8E98] hover:text-[#F4F4F6] transition cursor-pointer"
                >
                  <span>Full history in Journal</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {/* Collapsed Finished toggle bar */}
          <button
            type="button"
            onClick={() => setFinishedOpen((prev) => !prev)}
            aria-expanded={finishedOpen}
            className={`flex w-full items-center justify-between gap-3 rounded-2xl border border-[#1B1B21] bg-[#111114] px-3.5 py-2.5 text-left hover:border-[#2A2A33] hover:bg-[#151519] transition cursor-pointer ${
              pulseActive ? 'animate-finished-pulse' : ''
            }`}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <Check className="h-4 w-4 shrink-0 text-[#34D399]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8E8E98]">
                Finished
              </span>
              <span className="tabular-nums rounded-md bg-[#1D1D23] px-2 py-0.5 text-[11px] font-semibold text-[#8E8E98]">
                {finishedRows.length}
              </span>
              {!finishedOpen && latestFinished && (
                <span className="hidden sm:inline truncate text-xs text-[#55555E]">
                  · {latestFinished.title}
                  {latestFinished.kind === 'unit' && latestFinished.codeLine
                    ? ` (${latestFinished.codeLine})`
                    : ''}
                </span>
              )}
            </div>

            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#8E8E98]">
              <span>{finishedOpen ? 'Hide' : 'Show'}</span>
              {finishedOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </span>
          </button>
        </section>
      )}

      {/* Empty State vs Primary & Collecting Dust Sections */}
      {!hasAnyContent ? (
        <div className="rounded-2xl border border-dashed border-[#222229] bg-[#111114] px-6 py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#2A2A32] bg-[#16161A] text-[#E87151]">
            <headingCopy.icon className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-[#F4F4F6]">
            {headingCopy.emptyLabel}
          </h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-[#8E8E98]">
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
              className="inline-flex items-center gap-2 rounded-xl border border-[#2A2A32] bg-[#16161A] px-4 py-2.5 text-sm font-semibold text-[#F4F4F6] hover:bg-[#1D1D23] transition cursor-pointer"
            >
              <Plus className="h-4 w-4 text-[#E87151]" />
              Custom Tracker
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Primary Section: Watch next / Read next / Play next */}
          {(activeQueue.length > 0 ||
            (dustQueue.length === 0 &&
              !(pillar === 'play' && playFilter === 'dust'))) && (
            <section className="space-y-3">
              <h2 className="text-lg font-bold tracking-tight text-[#F4F4F6]">
                {headingCopy.nextHeading}
              </h2>

              {activeQueue.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#222229] bg-[#111114] px-5 py-8 text-center">
                  <p className="text-sm font-medium text-[#8E8E98]">
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

          {/* Collecting Dust Section */}
          {dustQueue.length > 0 && (
            <section className="space-y-3 pt-1">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold tracking-tight text-[#F4F4F6]">
                  Collecting dust
                </h2>
                <span className="text-xs text-[#63636D] tabular-nums">
                  {dustQueue.length}
                </span>
              </div>

              <div className="space-y-2.5">
                {dustQueue.map(renderHorizontalCard)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
