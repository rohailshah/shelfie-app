import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Link2,
  Plus,
  Search,
  Sparkles,
  Undo2,
} from 'lucide-react';
import {
  formatRelativeTime,
  getContainerProgress,
  getLatestCompletedAt,
  getOverlappingContainers,
} from '../engine/graph';
import {
  ActiveBoardEntry,
  AtomNode,
  ContainerNode,
  Pillar,
  ProgressEntry,
} from '../engine/types';
import {
  formatNextAtomLine,
  getMediumPreset,
  MEDIUM_COLORS,
  PILLAR_LABELS,
} from './mediaMeta';
import { PosterArt } from './PosterArt';

export type PillarFilter = 'all' | Pillar;

interface CurrentlyViewProps {
  activeBoard: ActiveBoardEntry[];
  containersById: Record<string, ContainerNode>;
  allContainers: ContainerNode[];
  atomsById: Record<string, AtomNode>;
  completedAtomIds: Set<string>;
  progressMap: Record<string, ProgressEntry>;
  finishingIds: Set<string>;
  lastFinishedPulse: number;
  pillarFilter: PillarFilter;
  onChangePillarFilter: (filter: PillarFilter) => void;
  onLogNextAtom: (containerId: string) => void;
  onCompleteWholeContainer: (containerId: string) => void;
  onUndoAtoms: (atomIds: string[]) => void;
  onOpenDetail: (containerId: string) => void;
  onGoDiscover: () => void;
  onGoJournal: () => void;
  onOpenCustomModal: (prefillTitle?: string) => void;
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

export function CurrentlyView({
  activeBoard,
  containersById,
  allContainers,
  atomsById,
  completedAtomIds,
  progressMap,
  finishingIds,
  lastFinishedPulse,
  pillarFilter,
  onChangePillarFilter,
  onLogNextAtom,
  onCompleteWholeContainer,
  onUndoAtoms,
  onOpenDetail,
  onGoDiscover,
  onGoJournal,
  onOpenCustomModal,
}: CurrentlyViewProps) {
  const [finishedOpen, setFinishedOpen] = useState(false);
  const [pulseActive, setPulseActive] = useState(false);

  useEffect(() => {
    if (lastFinishedPulse === 0) return;
    setPulseActive(true);
    const timer = window.setTimeout(() => setPulseActive(false), 950);
    return () => window.clearTimeout(timer);
  }, [lastFinishedPulse]);

  const boardItems = useMemo(
    () =>
      activeBoard
        .map((entry) => {
          const container = containersById[entry.containerId];
          if (!container) return null;
          const progress = getContainerProgress(container, completedAtomIds, atomsById);
          return { entry, container, progress };
        })
        .filter(
          (
            item
          ): item is {
            entry: ActiveBoardEntry;
            container: ContainerNode;
            progress: ReturnType<typeof getContainerProgress>;
          } => Boolean(item)
        ),
    [activeBoard, containersById, completedAtomIds, atomsById]
  );

  const activeItems = useMemo(
    () =>
      boardItems.filter(
        ({ container, progress }) => !progress.isComplete || finishingIds.has(container.id)
      ),
    [boardItems, finishingIds]
  );

  const completedBoardItems = useMemo(
    () =>
      boardItems.filter(
        ({ container, progress }) => progress.isComplete && !finishingIds.has(container.id)
      ),
    [boardItems, finishingIds]
  );

  const counts: Record<PillarFilter, number> = {
    all: activeItems.length,
    watch: activeItems.filter((i) => i.container.pillar === 'watch').length,
    read: activeItems.filter((i) => i.container.pillar === 'read').length,
    play: activeItems.filter((i) => i.container.pillar === 'play').length,
  };

  const filteredItems =
    pillarFilter === 'all'
      ? activeItems
      : activeItems.filter((i) => i.container.pillar === pillarFilter);

  const finishedRows = useMemo<FinishedFeedRow[]>(() => {
    const rows: FinishedFeedRow[] = [];
    const completedBoardSet = new Set(completedBoardItems.map((i) => i.container.id));

    // 1. Completed active containers that moved out of Up Next
    for (const { container, progress } of completedBoardItems) {
      if (pillarFilter !== 'all' && container.pillar !== pillarFilter) continue;

      const latestIso = getLatestCompletedAt(container, progressMap) ?? new Date().toISOString();
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

    // 2. Recently logged individual units from still-in-progress containers
    const unitCandidates = Object.values(progressMap)
      .sort(
        (a, b) =>
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
      );

    let unitCount = 0;
    for (const entry of unitCandidates) {
      if (unitCount >= 20) break;
      const atom = atomsById[entry.atomId];
      if (!atom) continue;

      const atomPillar = getMediumPreset(atom.medium).pillar;
      if (pillarFilter !== 'all' && atomPillar !== pillarFilter) continue;

      const parentContainer =
        (entry.sourceContainerId && containersById[entry.sourceContainerId]) ||
        allContainers.find((c) => c.atomIds.includes(atom.id));

      if (!parentContainer) continue;
      if (finishingIds.has(parentContainer.id)) continue;
      if (completedBoardSet.has(parentContainer.id)) continue;

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

    // Chronological order: oldest at top -> most recently finished at bottom (right above Up Next)
    rows.sort((a, b) => a.timestampMs - b.timestampMs);
    return rows;
  }, [
    completedBoardItems,
    pillarFilter,
    progressMap,
    atomsById,
    containersById,
    allContainers,
    finishingIds,
    completedAtomIds,
  ]);

  const latestFinished =
    finishedRows.length > 0 ? finishedRows[finishedRows.length - 1] : null;

  const pills: { id: PillarFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'watch', label: PILLAR_LABELS.watch },
    { id: 'read', label: PILLAR_LABELS.read },
    { id: 'play', label: PILLAR_LABELS.play },
  ];

  return (
    <div className="space-y-6">
      {/* Bingers-style Finished Section ABOVE Up Next (collapsed by default) */}
      {finishedRows.length > 0 && (
        <section aria-label="Finished items" className="space-y-2.5">
          {finishedOpen && (
            <div className="space-y-2">
              {finishedRows.map((row) => (
                <article
                  key={row.key}
                  className="group relative flex items-center gap-3.5 rounded-2xl border border-[#23252F] bg-[#15161B] px-3.5 py-2.5 opacity-75 hover:opacity-100 hover:border-[#2F3240] transition"
                >
                  <button
                    type="button"
                    onClick={() => onOpenDetail(row.container.id)}
                    aria-label={`Open details for ${row.title}`}
                    className="absolute inset-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#E87151]/50 cursor-pointer"
                  />

                  <PosterArt
                    container={row.container}
                    size="xs"
                    className="opacity-65 saturate-75"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-[#B0B4C2]">
                        {row.title}
                      </p>
                      <span className="hidden sm:inline shrink-0 text-[11px] text-[#646876]">
                        {formatRelativeTime(row.timestampIso)}
                      </span>
                    </div>
                    {row.codeLine && (
                      <p className="truncate text-[11px] font-medium text-[#767A89]">
                        {row.codeLine}
                      </p>
                    )}
                    <p className="truncate text-xs text-[#646876]">{row.detailLine}</p>
                  </div>

                  <div className="relative z-10 flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onUndoAtoms(row.undoAtomIds)}
                      aria-label={`Undo ${row.kind === 'container' ? row.title : row.detailLine}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#303340] bg-[#1B1D24] px-2 py-1 text-[11px] font-medium text-[#9397A5] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-[#F1F2F6] transition cursor-pointer"
                    >
                      <Undo2 className="h-3 w-3" />
                      <span className="hidden sm:inline">Undo</span>
                    </button>
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[#30B884]"
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
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#9397A5] hover:text-[#F1F2F6] transition cursor-pointer"
                >
                  <span>Full history in Journal</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {/* Sleek low-profile Finished drawer bar */}
          <button
            type="button"
            onClick={() => setFinishedOpen((prev) => !prev)}
            aria-expanded={finishedOpen}
            className={`flex w-full items-center justify-between gap-3 rounded-2xl border border-[#23252F] bg-[#15161B] px-4 py-2.5 text-left hover:border-[#303340] hover:bg-[#181A20] transition cursor-pointer ${
              pulseActive ? 'animate-finished-pulse' : ''
            }`}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[#30B884]/30 bg-[#30B884]/12 text-[#30B884]">
                <Check className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#9397A5]">
                Finished
              </span>
              <span className="tabular-nums rounded-md bg-[#252731] px-2 py-0.5 text-[11px] font-semibold text-[#9397A5]">
                {finishedRows.length}
              </span>
              {!finishedOpen && latestFinished && (
                <span className="hidden sm:inline truncate text-xs text-[#646876]">
                  · Latest: {latestFinished.title}
                  {latestFinished.kind === 'unit' && latestFinished.codeLine
                    ? ` (${latestFinished.codeLine})`
                    : ''}
                </span>
              )}
            </div>

            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#9397A5]">
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

      {/* Header + 4 clean flat filter pills */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F1F2F6]">
            Up Next
          </h1>
          <p className="mt-1 text-sm text-[#9397A5]">
            Log one unit at a time—finished items dim and tuck into Finished above.
          </p>
        </div>

        <div className="inline-flex max-w-full items-center gap-1 self-start overflow-x-auto rounded-2xl border border-[#23252F] bg-[#15161B] p-1">
          {pills.map((pill) => {
            const isActive = pillarFilter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => onChangePillarFilter(pill.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-medium transition cursor-pointer ${
                  isActive
                    ? 'bg-[#E87151] text-white'
                    : 'text-[#9397A5] hover:text-[#F1F2F6] hover:bg-[#1B1D24]'
                }`}
              >
                <span>{pill.label}</span>
                <span
                  className={`tabular-nums text-[11px] ${
                    isActive ? 'text-white/80' : 'text-[#646876]'
                  }`}
                >
                  {counts[pill.id]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty state */}
      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#2A2D37] bg-[#15161B] px-6 py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#303340] bg-[#252731] text-[#E87151]">
            <Sparkles className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-[#F1F2F6]">
            {pillarFilter === 'all'
              ? finishedRows.length > 0
                ? 'Everything in Up Next is finished'
                : 'Your board is fresh and empty'
              : `Nothing active in ${PILLAR_LABELS[pillarFilter]}`}
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-[#9397A5]">
            Search live catalogs to add movies, TV shows, anime, manga, comics, books, or games—or build your own custom tracker.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={onGoDiscover}
              className="inline-flex items-center gap-2 rounded-xl bg-[#E87151] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#DC6242] transition cursor-pointer"
            >
              <Search className="h-4 w-4" />
              Search & Add Media
            </button>
            <button
              type="button"
              onClick={() => onOpenCustomModal('')}
              className="inline-flex items-center gap-2 rounded-xl border border-[#303340] bg-[#252731] px-4 py-2.5 text-sm font-semibold text-[#F1F2F6] hover:bg-[#2E313D] transition cursor-pointer"
            >
              <Plus className="h-4 w-4 text-[#E87151]" />
              Create Custom Tracker
            </button>
          </div>
        </div>
      ) : (
        /* Universal Flat Matte Card Grid */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map(({ entry, container, progress }) => {
            const overlapping = getOverlappingContainers(container.id, allContainers);
            const primaryOverlap = overlapping[0];
            const dotColor = MEDIUM_COLORS[container.medium] ?? container.accentFrom;
            const isFinishing = finishingIds.has(container.id);

            return (
              <article
                key={container.id}
                className={`group relative flex flex-col justify-between rounded-2xl border border-[#2A2D37] bg-[#1B1D24] p-4 text-left transition-all duration-300 hover:border-[#3A3E4C] hover:bg-[#21242D] ${
                  isFinishing ? 'opacity-45 scale-[0.98]' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => onOpenDetail(container.id)}
                  aria-label={`Open details for ${container.title}`}
                  className="absolute inset-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#E87151]/60 cursor-pointer"
                />

                <div className="flex gap-4">
                  <PosterArt container={container} size="md" />

                  <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: dotColor }}
                        />
                        <span className="truncate text-[11px] font-medium text-[#9397A5]">
                          {container.creator || container.kindLabel}
                        </span>
                      </div>

                      <h3 className="line-clamp-2 text-base font-semibold leading-snug text-[#F1F2F6]">
                        {container.title}
                      </h3>

                      {/* Next Up line */}
                      <div className="mt-2.5">
                        {progress.isComplete ? (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-[#30B884]/30 bg-[#30B884]/12 px-2 py-0.5 text-xs font-medium text-[#30B884]">
                            <Check className="h-3 w-3" />
                            Completed
                          </span>
                        ) : entry.trackSingleItem ? (
                          <p className="text-xs font-medium text-[#9397A5]">
                            Single-item mode · {progress.remaining} {container.unitPlural}
                          </p>
                        ) : progress.nextAtom ? (
                          <p className="line-clamp-2 text-xs font-medium text-[#F1F2F6]/90">
                            <span className="text-[#646876] uppercase tracking-wider text-[10px] font-semibold mr-1.5">
                              Next
                            </span>
                            {formatNextAtomLine(
                              progress.nextAtom.subtitle,
                              progress.nextAtom.title
                            )}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {/* Subtle overlap indicator */}
                    {primaryOverlap && (
                      <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-[#646876]">
                        <Link2 className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          Links to{' '}
                          <span className="text-[#9397A5]">
                            {primaryOverlap.container.title}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Flat Progress bar + One-Tap +1 Action */}
                <div className="mt-4 flex items-center gap-3 pt-3 border-t border-[#23252F]">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="tabular-nums font-medium text-[#F1F2F6]">
                        {progress.completed} / {progress.total}{' '}
                        <span className="text-[#646876]">{container.unitPlural}</span>
                      </span>
                      <span className="tabular-nums text-[11px] text-[#646876]">
                        {progress.percent}%
                      </span>
                    </div>

                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#252731]">
                      <div
                        className="h-full rounded-full transition-all duration-200"
                        style={{
                          width: `${progress.percent}%`,
                          backgroundColor: progress.isComplete ? '#30B884' : dotColor,
                        }}
                      />
                    </div>
                  </div>

                  {progress.isComplete ? (
                    <span className="relative z-10 inline-flex h-9 items-center gap-1 rounded-xl border border-[#30B884]/30 bg-[#30B884]/15 px-3 text-xs font-semibold text-[#30B884] shrink-0">
                      <Check className="h-3.5 w-3.5" />
                      Done
                    </span>
                  ) : entry.trackSingleItem ? (
                    <button
                      type="button"
                      onClick={() => onCompleteWholeContainer(container.id)}
                      className="relative z-10 inline-flex h-9 items-center gap-1 rounded-xl border border-[#303340] bg-[#252731] px-3.5 text-xs font-semibold text-[#F1F2F6] hover:border-[#E87151] hover:bg-[#E87151] hover:text-white active:scale-95 transition shrink-0 cursor-pointer"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Finish
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onLogNextAtom(container.id)}
                      aria-label={`Log next unit in ${container.title}`}
                      className="relative z-10 inline-flex h-9 items-center gap-1 rounded-xl border border-[#303340] bg-[#252731] px-3.5 text-xs font-bold text-[#F1F2F6] hover:border-[#E87151] hover:bg-[#E87151] hover:text-white active:scale-95 transition shrink-0 cursor-pointer"
                    >
                      +1
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
