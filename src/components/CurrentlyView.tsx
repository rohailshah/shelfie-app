import { Check, Link2, Plus, Sparkles } from 'lucide-react';
import { getContainerProgress, getOverlappingContainers } from '../engine/graph';
import { ActiveBoardEntry, AtomNode, ContainerNode, Pillar } from '../engine/types';
import { formatNextAtomLine, PILLAR_LABELS } from './mediaMeta';
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
      {/* Header + 4 clean filter pills */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Up Next
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Log one unit at a time—linked volumes, omnibuses, and trilogies update automatically.
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 self-start rounded-2xl border border-white/10 bg-white/[0.04] p-1 backdrop-blur-xl">
          {pills.map((pill) => {
            const isActive = pillarFilter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => onChangePillarFilter(pill.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-medium transition cursor-pointer ${
                  isActive
                    ? 'bg-white text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05]'
                }`}
              >
                <span>{pill.label}</span>
                <span
                  className={`tabular-nums text-[11px] ${
                    isActive ? 'text-zinc-600' : 'text-zinc-500'
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
        <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-white">
            Nothing active in {pillarFilter === 'all' ? 'Currently' : PILLAR_LABELS[pillarFilter]}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Pin a comic trade, movie trilogy, show, manga, or game from Discover—or create your own.
          </p>
          <button
            type="button"
            onClick={onGoDiscover}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Browse Discover
          </button>
        </div>
      ) : (
        /* Universal Bingers-Style Card Grid */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map(({ entry, container }) => {
            const progress = getContainerProgress(container, completedAtomIds, atomsById);
            const overlapping = getOverlappingContainers(container.id, allContainers);
            const primaryOverlap = overlapping[0];

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
                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/65 p-4 text-left backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-zinc-900/85 focus:outline-none focus:ring-2 focus:ring-white/25 cursor-pointer"
              >
                {/* Ambient cover glow */}
                <div
                  className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full opacity-20 blur-3xl transition-opacity duration-300 group-hover:opacity-35"
                  style={{ backgroundColor: container.accentFrom }}
                />

                <div className="relative z-10 flex gap-4">
                  <PosterArt container={container} size="md" />

                  <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-white">
                          {container.title}
                        </h3>
                      </div>

                      {container.creator && (
                        <p className="mt-0.5 truncate text-xs text-zinc-400">
                          {container.creator}
                        </p>
                      )}

                      {/* Next Up line */}
                      <div className="mt-2.5">
                        {progress.isComplete ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 border border-emerald-400/25 px-2 py-0.5 text-xs font-medium text-emerald-300">
                            <Check className="h-3 w-3" />
                            Completed
                          </span>
                        ) : entry.trackSingleItem ? (
                          <p className="text-xs font-medium text-zinc-300">
                            Single-item mode · {progress.remaining} {container.unitPlural} bundled
                          </p>
                        ) : progress.nextAtom ? (
                          <p className="line-clamp-2 text-xs font-medium text-zinc-200">
                            <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-semibold mr-1.5">
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
                      <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-zinc-400">
                        <Link2 className="h-3 w-3 shrink-0 text-zinc-500" />
                        <span className="truncate">
                          Links to <span className="text-zinc-300">{primaryOverlap.container.title}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress bar + One-Tap +1 Action */}
                <div className="relative z-10 mt-4 flex items-center gap-3 pt-3 border-t border-white/[0.06]">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="tabular-nums font-medium text-zinc-300">
                        {progress.completed} / {progress.total}{' '}
                        <span className="text-zinc-500">{container.unitPlural}</span>
                      </span>
                      <span className="tabular-nums text-[11px] text-zinc-500">
                        {progress.percent}%
                      </span>
                    </div>

                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${progress.percent}%`,
                          background: `linear-gradient(90deg, ${container.accentFrom}, #ffffffcc)`,
                          boxShadow: `0 0 12px ${container.accentFrom}80`,
                        }}
                      />
                    </div>
                  </div>

                  {progress.isComplete ? (
                    <span className="inline-flex h-9 items-center gap-1 rounded-xl border border-emerald-400/25 bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-300 shrink-0">
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
                      className="inline-flex h-9 items-center gap-1 rounded-xl bg-white px-3.5 text-xs font-semibold text-zinc-950 shadow-sm hover:bg-zinc-200 active:scale-95 transition shrink-0 cursor-pointer"
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
                      className="inline-flex h-9 items-center gap-1 rounded-xl bg-white px-3.5 text-xs font-bold text-zinc-950 shadow-sm hover:bg-zinc-200 active:scale-95 transition shrink-0 cursor-pointer"
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
