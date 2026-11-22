import { Check, Link2, Plus, Sparkles } from 'lucide-react';
import { getContainerProgress, getOverlappingContainers } from '../engine/graph';
import { ActiveBoardEntry, AtomNode, ContainerNode, Pillar } from '../engine/types';
import { formatNextAtomLine, MEDIUM_COLORS, PILLAR_LABELS } from './mediaMeta';
import { PosterArt } from './PosterArt';

export type PillarFilter = 'all' | Pillar;

interface CurrentlyViewProps {
  activeBoard: ActiveBoardEntry[];
  containersById: Record<string, ContainerNode>;
  allContainers: ContainerNode[];
  atomsById: Record<string, AtomNode>;
  completedAtomIds: Set<string>;
  pillarFilter: PillarFilter;
  onChangePillarFilter: (filter: PillarFilter) => void;
  onLogNextAtom: (containerId: string) => void;
  onCompleteWholeContainer: (containerId: string) => void;
  onOpenDetail: (containerId: string) => void;
  onGoDiscover: () => void;
}

export function CurrentlyView({
  activeBoard,
  containersById,
  allContainers,
  atomsById,
  completedAtomIds,
  pillarFilter,
  onChangePillarFilter,
  onLogNextAtom,
  onCompleteWholeContainer,
  onOpenDetail,
  onGoDiscover,
}: CurrentlyViewProps) {
  const boardItems = activeBoard
    .map((entry) => ({
      entry,
      container: containersById[entry.containerId],
    }))
    .filter((item): item is { entry: ActiveBoardEntry; container: ContainerNode } =>
      Boolean(item.container)
    );

  const counts: Record<PillarFilter, number> = {
    all: boardItems.length,
    watch: boardItems.filter((i) => i.container.pillar === 'watch').length,
    read: boardItems.filter((i) => i.container.pillar === 'read').length,
    play: boardItems.filter((i) => i.container.pillar === 'play').length,
  };

  const filteredItems =
    pillarFilter === 'all'
      ? boardItems
      : boardItems.filter((i) => i.container.pillar === pillarFilter);

  const pills: { id: PillarFilter; label: string }[] = [
    { id: 'all', label: 'Currently' },
    { id: 'watch', label: PILLAR_LABELS.watch },
    { id: 'read', label: PILLAR_LABELS.read },
    { id: 'play', label: PILLAR_LABELS.play },
  ];

  return (
    <div className="space-y-6">
      {/* Header + 4 clean flat filter pills */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F1F2F6]">
            Up Next
          </h1>
          <p className="mt-1 text-sm text-[#9397A5]">
            Log one unit at a time—linked volumes, omnibuses, and trilogies update automatically.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 self-start rounded-2xl border border-[#23252F] bg-[#15161B] p-1">
          {pills.map((pill) => {
            const isActive = pillarFilter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => onChangePillarFilter(pill.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-medium transition cursor-pointer ${
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
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#303340] bg-[#252731] text-[#9397A5]">
            <Sparkles className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-[#F1F2F6]">
            Nothing active in {pillarFilter === 'all' ? 'Currently' : PILLAR_LABELS[pillarFilter]}
          </h2>
          <p className="mt-1 text-sm text-[#9397A5]">
            Search above to add any movie, show, comic, manga, book, or game—or browse Discover.
          </p>
          <button
            type="button"
            onClick={onGoDiscover}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#E87151] px-4 py-2 text-sm font-semibold text-white hover:bg-[#DC6242] transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Browse Discover
          </button>
        </div>
      ) : (
        /* Universal Flat Matte Card Grid */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map(({ entry, container }) => {
            const progress = getContainerProgress(container, completedAtomIds, atomsById);
            const overlapping = getOverlappingContainers(container.id, allContainers);
            const primaryOverlap = overlapping[0];
            const dotColor = MEDIUM_COLORS[container.medium] ?? container.accentFrom;

            return (
              <div
                key={container.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenDetail(container.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenDetail(container.id);
                  }
                }}
                className="group flex flex-col justify-between rounded-2xl border border-[#2A2D37] bg-[#1B1D24] p-4 text-left transition-colors duration-150 hover:border-[#3A3E4C] hover:bg-[#21242D] focus:outline-none focus:ring-2 focus:ring-[#E87151]/50 cursor-pointer"
              >
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
                          <span className="text-[#9397A5]">{primaryOverlap.container.title}</span>
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
                    <span className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#30B884]/30 bg-[#30B884]/15 px-3 text-xs font-semibold text-[#30B884] shrink-0">
                      <Check className="h-3.5 w-3.5" />
                      Done
                    </span>
                  ) : entry.trackSingleItem ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCompleteWholeContainer(container.id);
                      }}
                      className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#303340] bg-[#252731] px-3.5 text-xs font-semibold text-[#F1F2F6] hover:border-[#E87151] hover:bg-[#E87151] hover:text-white active:scale-95 transition shrink-0 cursor-pointer"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Finish
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onLogNextAtom(container.id);
                      }}
                      aria-label={`Log next unit in ${container.title}`}
                      className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#303340] bg-[#252731] px-3.5 text-xs font-bold text-[#F1F2F6] hover:border-[#E87151] hover:bg-[#E87151] hover:text-white active:scale-95 transition shrink-0 cursor-pointer"
                    >
                      +1
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
