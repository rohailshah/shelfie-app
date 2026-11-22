import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  Check,
  Layers,
  Link2,
  Maximize2,
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
  MEDIUM_COLORS,
  MEDIUM_LABELS,
  SHELF_STATUS_OPTIONS,
} from './mediaMeta';
import { PosterArt } from './PosterArt';
import { PosterLightbox } from './PosterLightbox';

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
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    setLightboxOpen(false);
  }, [container?.id]);

  useEffect(() => {
    if (!container) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !lightboxOpen) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [container, lightboxOpen, onClose]);

  if (!container) return null;

  const progress = getContainerProgress(container, completedAtomIds, atomsById);
  const overlapping = getOverlappingContainers(container.id, allContainers);
  const isPinned = Boolean(activeBoardEntry);
  const isSingleMode = activeBoardEntry?.trackSingleItem ?? false;
  const dotColor = MEDIUM_COLORS[container.medium] ?? container.accentFrom;
  const hasCover = Boolean(
    container.hqCoverUrl || container.coverUrl || container.fallbackCoverUrl
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border border-[#2A2D37] bg-[#1B1D24] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#23252F] bg-[#15161B] p-5 sm:p-6">
          <div className="flex gap-4 min-w-0">
            {hasCover ? (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                title="View fullscreen HQ poster"
                aria-label={`View fullscreen HQ poster for ${container.title}`}
                className="group relative shrink-0 cursor-zoom-in rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#E87151]"
              >
                <PosterArt container={container} size="md" />
                <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-lg border border-[#303340] bg-[#111216]/85 text-[#F1F2F6] opacity-85 group-hover:border-[#E87151] group-hover:bg-[#E87151] group-hover:opacity-100 transition">
                  <Maximize2 className="h-3 w-3" />
                </span>
              </button>
            ) : (
              <PosterArt container={container} size="md" />
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#9397A5]">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-[#303340] bg-[#252731] px-2 py-0.5 font-medium text-[#F1F2F6]">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: dotColor }}
                  />
                  {MEDIUM_LABELS[container.medium]}
                </span>
                <span>{container.kindLabel}</span>
                {container.year && <span>· {container.year}</span>}
              </div>

              <h2 className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-[#F1F2F6]">
                {container.title}
              </h2>

              {container.creator && (
                <p className="mt-0.5 text-sm text-[#9397A5]">{container.creator}</p>
              )}

              {container.description && (
                <p className="mt-2 text-xs leading-relaxed text-[#646876]">
                  {container.description}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close detail view"
            className="rounded-xl border border-[#303340] bg-[#252731] p-2 text-[#9397A5] hover:text-[#F1F2F6] transition cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Progress Bar + Controls */}
          <div className="rounded-2xl border border-[#2A2D37] bg-[#15161B] p-4 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-[#F1F2F6] tabular-nums">
                {progress.completed} of {progress.total} {container.unitPlural} logged
              </span>
              <span className="tabular-nums font-semibold text-[#F1F2F6]">
                {progress.percent}%
              </span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-[#252731]">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{
                  width: `${progress.percent}%`,
                  backgroundColor: progress.isComplete ? '#30B884' : dotColor,
                }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => onTogglePinCurrently(container.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
                  isPinned
                    ? 'border border-[#303340] bg-[#252731] text-[#F1F2F6] hover:bg-[#2E313D]'
                    : 'bg-[#E87151] text-white hover:bg-[#DC6242]'
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
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#303340] bg-[#252731] px-3.5 py-2 text-xs font-medium text-[#F1F2F6] hover:bg-[#2E313D] transition cursor-pointer"
                >
                  <Layers className="h-3.5 w-3.5 text-[#9397A5]" />
                  {isSingleMode ? 'Mode: Single item (Switch to Sub-units)' : 'Mode: Sub-units'}
                </button>
              )}

              {!progress.isComplete && (
                <button
                  type="button"
                  onClick={() => onCompleteAll(container.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#30B884]/30 bg-[#30B884]/15 px-3.5 py-2 text-xs font-medium text-[#30B884] hover:bg-[#30B884]/25 transition cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  Mark all complete
                </button>
              )}
            </div>
          </div>

          {/* Shelf / Ownership Layer */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#9397A5]">
                <Bookmark className="h-3.5 w-3.5" />
                Shelf & Ownership
              </div>
              <span className="text-[11px] text-[#646876]">
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
                        ? 'bg-[#E87151] text-white'
                        : 'border border-[#2A2D37] bg-[#15161B] text-[#9397A5] hover:bg-[#252731] hover:text-[#F1F2F6]'
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
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#9397A5]">
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
                  const linkedColor = MEDIUM_COLORS[linked.medium] ?? linked.accentFrom;
                  return (
                    <button
                      key={linked.id}
                      type="button"
                      onClick={() => onSelectContainer(linked.id)}
                      className="flex items-center gap-3 rounded-2xl border border-[#2A2D37] bg-[#15161B] p-3 text-left hover:border-[#3A3E4C] hover:bg-[#21242D] transition cursor-pointer"
                    >
                      <PosterArt container={linked} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-[#F1F2F6]">
                            {linked.title}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#646876]" />
                        </div>
                        <p className="text-[11px] text-[#9397A5]">
                          {linked.kindLabel} · Shares {sharedAtomCount} {linked.unitPlural}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#252731]">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${linkedProgress.percent}%`,
                                backgroundColor: linkedProgress.isComplete
                                  ? '#30B884'
                                  : linkedColor,
                              }}
                            />
                          </div>
                          <span className="tabular-nums text-[11px] font-medium text-[#9397A5]">
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
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#9397A5]">
                Inside this {container.kindLabel} ({container.atomIds.length})
              </h3>
              <span className="text-[11px] text-[#646876]">
                Tap any unit to check or uncheck
              </span>
            </div>

            <div className="divide-y divide-[#23252F] overflow-hidden rounded-2xl border border-[#2A2D37] bg-[#15161B]">
              {container.atomIds.map((atomId, idx) => {
                const atom = atomsById[atomId];
                if (!atom) return null;
                const done = completedAtomIds.has(atom.id);

                return (
                  <button
                    key={atom.id}
                    type="button"
                    onClick={() => onToggleAtom(atom.id, container.id)}
                    className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-[#21242D] transition cursor-pointer"
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] transition ${
                        done
                          ? 'border-[#30B884] bg-[#30B884] text-[#111216]'
                          : 'border-[#303340] bg-[#252731] text-transparent'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm font-medium ${
                          done ? 'text-[#646876] line-through' : 'text-[#F1F2F6]'
                        }`}
                      >
                        {formatNextAtomLine(atom.subtitle, atom.title)}
                      </p>
                    </div>

                    {atom.meta ? (
                      <span className="shrink-0 text-[11px] tabular-nums text-[#646876]">
                        {atom.meta}
                      </span>
                    ) : (
                      <span className="shrink-0 text-[11px] tabular-nums text-[#646876]">
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

      <PosterLightbox
        isOpen={lightboxOpen}
        title={container.title}
        subtitle={container.creator || container.kindLabel}
        hqUrl={container.hqCoverUrl}
        coverUrl={container.coverUrl}
        fallbackUrl={container.fallbackCoverUrl}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}
