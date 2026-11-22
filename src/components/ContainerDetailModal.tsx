import { useEffect } from 'react';
import {
  ArrowRight,
  Bookmark,
  Check,
  Layers,
  Link2,
  Pin,
  PinOff,
  X,
} from 'lucide-react';
import { getContainerProgress, getOverlappingContainers } from '../engine/graph';
import {
  ActiveBoardEntry,
  AtomNode,
  ContainerNode,
  ShelfStatus,
} from '../engine/types';
import {
  formatNextAtomLine,
  MEDIUM_LABELS,
  SHELF_STATUS_OPTIONS,
} from './mediaMeta';
import { PosterArt } from './PosterArt';

interface ContainerDetailModalProps {
  container: ContainerNode | null;
  allContainers: ContainerNode[];
  atomsById: Record<string, AtomNode>;
  completedAtomIds: Set<string>;
  activeBoardEntry: ActiveBoardEntry | undefined;
  shelfStatus: ShelfStatus;
  onClose: () => void;
  onSelectContainer: (containerId: string) => void;
  onToggleAtom: (atomId: string, sourceContainerId: string) => void;
  onToggleTrackMode: (containerId: string) => void;
  onTogglePinCurrently: (containerId: string) => void;
  onSetShelfStatus: (containerId: string, status: ShelfStatus) => void;
  onCompleteAll: (containerId: string) => void;
}

export function ContainerDetailModal({
  container,
  allContainers,
  atomsById,
  completedAtomIds,
  activeBoardEntry,
  shelfStatus,
  onClose,
  onSelectContainer,
  onToggleAtom,
  onToggleTrackMode,
  onTogglePinCurrently,
  onSetShelfStatus,
  onCompleteAll,
}: ContainerDetailModalProps) {
  useEffect(() => {
    if (!container) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [container, onClose]);

  if (!container) return null;

  const progress = getContainerProgress(container, completedAtomIds, atomsById);
  const overlapping = getOverlappingContainers(container.id, allContainers);
  const isPinned = Boolean(activeBoardEntry);
  const isSingleMode = activeBoardEntry?.trackSingleItem ?? false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border border-white/15 bg-zinc-950/95 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Header Glow */}
        <div
          className="pointer-events-none absolute -top-24 left-1/4 h-56 w-72 rounded-full opacity-25 blur-3xl"
          style={{ backgroundColor: container.accentFrom }}
        />

        {/* Top Bar */}
        <div className="relative z-10 flex items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
          <div className="flex gap-4 min-w-0">
            <PosterArt container={container} size="md" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 font-medium text-zinc-200">
                  {MEDIUM_LABELS[container.medium]}
                </span>
                <span>{container.kindLabel}</span>
                {container.year && <span>· {container.year}</span>}
              </div>

              <h2 className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-white">
                {container.title}
              </h2>

              {container.creator && (
                <p className="mt-0.5 text-sm text-zinc-400">{container.creator}</p>
              )}

              {container.description && (
                <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                  {container.description}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close detail view"
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="relative z-10 flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Progress Bar + Pin / Granularity Controls */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-zinc-200 tabular-nums">
                {progress.completed} of {progress.total} {container.unitPlural} logged
              </span>
              <span className="tabular-nums font-semibold text-white">
                {progress.percent}%
              </span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progress.percent}%`,
                  background: `linear-gradient(90deg, ${container.accentFrom}, #ffffff)`,
                }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => onTogglePinCurrently(container.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
                  isPinned
                    ? 'border border-white/15 bg-white/10 text-white hover:bg-white/15'
                    : 'bg-white text-zinc-950 hover:bg-zinc-200'
                }`}
              >
                {isPinned ? (
                  <>
                    <PinOff className="h-3.5 w-3.5" />
                    Remove from Currently
                  </>
                ) : (
                  <>
                    <Pin className="h-3.5 w-3.5" />
                    Pin to Currently
                  </>
                )}
              </button>

              {isPinned && (
                <button
                  type="button"
                  onClick={() => onToggleTrackMode(container.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-medium text-zinc-200 hover:bg-white/10 transition cursor-pointer"
                >
                  <Layers className="h-3.5 w-3.5 text-zinc-400" />
                  {isSingleMode ? 'Mode: Single item (Switch to Sub-units)' : 'Mode: Sub-units'}
                </button>
              )}

              {!progress.isComplete && (
                <button
                  type="button"
                  onClick={() => onCompleteAll(container.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3.5 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  Mark all complete
                </button>
              )}
            </div>
          </div>

          {/* Shelf / Ownership Layer (separated cleanly from progress!) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                <Bookmark className="h-3.5 w-3.5" />
                Shelf & Ownership
              </div>
              <span className="text-[11px] text-zinc-500">
                Separate from read/watch progress
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {SHELF_STATUS_OPTIONS.map((opt) => {
                const selected = shelfStatus === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onSetShelfStatus(container.id, opt.value)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                      selected
                        ? 'border border-white/25 bg-white text-zinc-950'
                        : 'border border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Connected / Overlapping Collections */}
          {overlapping.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                <Link2 className="h-3.5 w-3.5" />
                Connected Editions & Collections
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {overlapping.map(({ container: linked, sharedAtomCount }) => {
                  const linkedProgress = getContainerProgress(
                    linked,
                    completedAtomIds,
                    atomsById
                  );
                  return (
                    <button
                      key={linked.id}
                      type="button"
                      onClick={() => onSelectContainer(linked.id)}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left hover:border-white/20 hover:bg-white/[0.06] transition cursor-pointer"
                    >
                      <PosterArt container={linked} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-white">
                            {linked.title}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                        </div>
                        <p className="text-[11px] text-zinc-400">
                          {linked.kindLabel} · Shares {sharedAtomCount} {linked.unitPlural}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${linkedProgress.percent}%`,
                                backgroundColor: linked.accentFrom,
                              }}
                            />
                          </div>
                          <span className="tabular-nums text-[11px] font-medium text-zinc-300">
                            {linkedProgress.completed}/{linkedProgress.total}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Interactive Atom Checklist */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Inside this {container.kindLabel} ({container.atomIds.length})
              </h3>
              <span className="text-[11px] text-zinc-500">
                Tap any unit to check or uncheck
              </span>
            </div>

            <div className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
              {container.atomIds.map((atomId, idx) => {
                const atom = atomsById[atomId];
                if (!atom) return null;
                const done = completedAtomIds.has(atom.id);

                return (
                  <button
                    key={atom.id}
                    type="button"
                    onClick={() => onToggleAtom(atom.id, container.id)}
                    className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-white/[0.04] transition cursor-pointer"
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] transition ${
                        done
                          ? 'border-emerald-400 bg-emerald-500 text-zinc-950'
                          : 'border-white/20 bg-white/5 text-transparent'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm font-medium ${
                          done ? 'text-zinc-400 line-through' : 'text-zinc-100'
                        }`}
                      >
                        {formatNextAtomLine(atom.subtitle, atom.title)}
                      </p>
                    </div>

                    {atom.meta ? (
                      <span className="shrink-0 text-[11px] tabular-nums text-zinc-500">
                        {atom.meta}
                      </span>
                    ) : (
                      <span className="shrink-0 text-[11px] tabular-nums text-zinc-600">
                        #{idx + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
