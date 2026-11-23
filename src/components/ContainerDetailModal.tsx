import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  Check,
  Clock,
  Layers,
  Link2,
  Maximize2,
  Pencil,
  Pin,
  PinOff,
  Search,
  Trash2,
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
  PILLAR_LABELS,
  SHELF_STATUS_OPTIONS,
} from './mediaMeta';
import {
  ComicEditionOption,
  fetchOpenLibraryEditions,
  getDefaultReadingEditions,
} from '../services/onlineSearch';
import { PosterArt } from './PosterArt';
import { PosterLightbox } from './PosterLightbox';

export interface UpdateContainerPayload {
  containerId: string;
  title: string;
  kindLabel: string;
  creator: string;
  coverUrl: string;
  appendUnitsCount: number;
}

export interface SwitchEditionPayload {
  containerId: string;
  kindLabel: string;
  coverUrl?: string;
  hqCoverUrl?: string;
  fallbackCoverUrl?: string;
  year?: string;
  suggestedShelfStatus?: ShelfStatus;
}

interface ContainerDetailModalProps {
  container: ContainerNode | null;
  allContainers: ContainerNode[];
  atomsById: Record<string, AtomNode>;
  completedAtomIds: Set<string>;
  activeBoardEntry: ActiveBoardEntry | undefined;
  shelfStatus: ShelfStatus;
  isCollectingDust: boolean;
  onClose: () => void;
  onSelectContainer: (containerId: string) => void;
  onToggleAtom: (atomId: string, sourceContainerId: string) => void;
  onToggleTrackMode: (containerId: string) => void;
  onTogglePinCurrently: (containerId: string) => void;
  onToggleCollectingDust: (containerId: string) => void;
  onSetShelfStatus: (containerId: string, status: ShelfStatus) => void;
  onCompleteAll: (containerId: string) => void;
  onUpdateContainer: (payload: UpdateContainerPayload) => void;
  onDeleteContainer: (containerId: string) => void;
  onSwitchEdition?: (payload: SwitchEditionPayload) => void;
}

type UnitFilterMode = 'all' | 'remaining' | 'completed';

export function ContainerDetailModal({
  container,
  allContainers,
  atomsById,
  completedAtomIds,
  activeBoardEntry,
  shelfStatus,
  isCollectingDust,
  onClose,
  onSelectContainer,
  onToggleAtom,
  onToggleTrackMode,
  onTogglePinCurrently,
  onToggleCollectingDust,
  onSetShelfStatus,
  onCompleteAll,
  onUpdateContainer,
  onDeleteContainer,
  onSwitchEdition,
}: ContainerDetailModalProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [editTitle, setEditTitle] = useState('');
  const [editKindLabel, setEditKindLabel] = useState('');
  const [editCreator, setEditCreator] = useState('');
  const [editCoverUrl, setEditCoverUrl] = useState('');
  const [appendUnitsCount, setAppendUnitsCount] = useState(0);

  const [unitFilter, setUnitFilter] = useState<UnitFilterMode>('all');
  const [unitQuery, setUnitQuery] = useState('');
  const [editionOptions, setEditionOptions] = useState<ComicEditionOption[]>([]);
  const [loadingEditions, setLoadingEditions] = useState(false);

  useEffect(() => {
    setLightboxOpen(false);
    setIsEditing(false);
    setConfirmDelete(false);
    setUnitFilter('all');
    setUnitQuery('');
    if (container) {
      setEditTitle(container.title);
      setEditKindLabel(container.kindLabel);
      setEditCreator(container.creator ?? '');
      setEditCoverUrl(container.coverUrl ?? '');
      setAppendUnitsCount(0);
    }
  }, [container?.id]);

  useEffect(() => {
    if (
      !container ||
      !onSwitchEdition ||
      (container.medium !== 'comic' && container.medium !== 'book')
    ) {
      setEditionOptions([]);
      setLoadingEditions(false);
      return;
    }

    const mediumType = container.medium as 'comic' | 'book';
    const base = getDefaultReadingEditions(
      mediumType,
      container.publisher,
      container.coverUrl,
      container.hqCoverUrl
    );
    setEditionOptions(base);

    if (container.externalSource !== 'openlibrary') {
      setLoadingEditions(false);
      return;
    }

    const workKeys =
      container.relatedWorkKeys && container.relatedWorkKeys.length > 0
        ? container.relatedWorkKeys
        : container.externalId
          ? [String(container.externalId)]
          : [];

    if (workKeys.length === 0) {
      setLoadingEditions(false);
      return;
    }

    const controller = new AbortController();
    setLoadingEditions(true);

    fetchOpenLibraryEditions(
      {
        workKeys,
        medium: mediumType,
        publisher: container.publisher,
        baseTitle: container.title,
        defaultCoverUrl: container.coverUrl,
        defaultHqCoverUrl: container.hqCoverUrl,
      },
      controller.signal
    )
      .then((resolved) => {
        if (controller.signal.aborted) return;
        setEditionOptions(resolved);
        setLoadingEditions(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoadingEditions(false);
        }
      });

    return () => controller.abort();
  }, [container?.id]);

  useEffect(() => {
    if (!container) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !lightboxOpen) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [container, lightboxOpen, onClose]);

  const filteredAtoms = useMemo(() => {
    if (!container) return [];
    const q = unitQuery.trim().toLowerCase();
    return container.atomIds
      .map((atomId, idx) => ({ atomId, idx, atom: atomsById[atomId] }))
      .filter((item): item is { atomId: string; idx: number; atom: AtomNode } =>
        Boolean(item.atom)
      )
      .filter(({ atom }) => {
        const done = completedAtomIds.has(atom.id);
        if (unitFilter === 'remaining' && done) return false;
        if (unitFilter === 'completed' && !done) return false;
        if (!q) return true;
        return (
          atom.title.toLowerCase().includes(q) ||
          (atom.subtitle ?? '').toLowerCase().includes(q) ||
          (atom.meta ?? '').toLowerCase().includes(q)
        );
      });
  }, [container, atomsById, completedAtomIds, unitFilter, unitQuery]);

  if (!container) return null;

  const progress = getContainerProgress(container, completedAtomIds, atomsById);
  const overlapping = getOverlappingContainers(container.id, allContainers);
  const isPinned = Boolean(activeBoardEntry);
  const isSingleMode = activeBoardEntry?.trackSingleItem ?? false;
  const dotColor = MEDIUM_COLORS[container.medium] ?? container.accentFrom;
  const hasCover = Boolean(
    container.hqCoverUrl || container.coverUrl || container.fallbackCoverUrl
  );

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = editTitle.trim();
    if (!trimmed) return;
    onUpdateContainer({
      containerId: container.id,
      title: trimmed,
      kindLabel: editKindLabel.trim() || container.kindLabel,
      creator: editCreator.trim(),
      coverUrl: editCoverUrl.trim(),
      appendUnitsCount: Math.min(500, Math.max(0, appendUnitsCount)),
    });
    setAppendUnitsCount(0);
    setIsEditing(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border border-[#222229] bg-[#16161A] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#222229] bg-[#111114] p-5 sm:p-6">
          <div className="flex flex-col min-[380px]:flex-row gap-4 min-w-0">
            {hasCover ? (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                title="View fullscreen HQ poster"
                aria-label={`View fullscreen HQ poster for ${container.title}`}
                className="group relative self-start shrink-0 cursor-zoom-in rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#E87151]"
              >
                <PosterArt container={container} size="md" />
                <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-lg border border-[#303340] bg-[#111216]/85 text-[#F1F2F6] opacity-85 group-hover:border-[#E87151] group-hover:bg-[#E87151] group-hover:opacity-100 transition">
                  <Maximize2 className="h-3 w-3" />
                </span>
              </button>
            ) : (
              <PosterArt container={container} size="md" className="self-start" />
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

              <h2
                id="detail-modal-title"
                className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-[#F1F2F6]"
              >
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

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setEditTitle(container.title);
                setEditKindLabel(container.kindLabel);
                setEditCreator(container.creator ?? '');
                setEditCoverUrl(container.coverUrl ?? '');
                setAppendUnitsCount(0);
                setIsEditing((prev) => !prev);
                setConfirmDelete(false);
              }}
              aria-label="Edit tracker"
              title="Edit tracker"
              className={`rounded-xl border p-2 transition cursor-pointer ${
                isEditing
                  ? 'border-[#E87151] bg-[#E87151]/15 text-[#E87151]'
                  : 'border-[#303340] bg-[#252731] text-[#9397A5] hover:text-[#F1F2F6]'
              }`}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close detail view"
              className="rounded-xl border border-[#303340] bg-[#252731] p-2 text-[#9397A5] hover:text-[#F1F2F6] transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Inline Edit / Delete Panel */}
          {isEditing && (
            <form
              onSubmit={handleSaveEdit}
              className="rounded-2xl border border-[#E87151]/35 bg-[#15161B] p-4 space-y-3.5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[#E87151]">
                  Edit Tracker
                </h3>
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#C95252] hover:bg-[#C95252]/12 transition cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-[#9397A5]">Delete permanently?</span>
                    <button
                      type="button"
                      onClick={() => onDeleteContainer(container.id)}
                      className="rounded-lg bg-[#C95252] px-2.5 py-1 font-semibold text-white hover:opacity-90 cursor-pointer"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="rounded-lg px-2 py-1 text-[#9397A5] hover:text-[#F1F2F6] cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="edit-container-title"
                    className="block text-[11px] font-medium text-[#9397A5] mb-1"
                  >
                    Title
                  </label>
                  <input
                    id="edit-container-title"
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded-xl border border-[#2A2D37] bg-[#252731] px-3 py-1.5 text-sm text-[#F1F2F6] focus:border-[#E87151] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-container-format"
                    className="block text-[11px] font-medium text-[#9397A5] mb-1"
                  >
                    Format Badge
                  </label>
                  <input
                    id="edit-container-format"
                    type="text"
                    value={editKindLabel}
                    onChange={(e) => setEditKindLabel(e.target.value)}
                    className="w-full rounded-xl border border-[#2A2D37] bg-[#252731] px-3 py-1.5 text-sm text-[#F1F2F6] focus:border-[#E87151] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-container-creator"
                    className="block text-[11px] font-medium text-[#9397A5] mb-1"
                  >
                    Creator / Studio
                  </label>
                  <input
                    id="edit-container-creator"
                    type="text"
                    value={editCreator}
                    onChange={(e) => setEditCreator(e.target.value)}
                    className="w-full rounded-xl border border-[#2A2D37] bg-[#252731] px-3 py-1.5 text-sm text-[#F1F2F6] focus:border-[#E87151] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-container-append"
                    className="block text-[11px] font-medium text-[#9397A5] mb-1"
                  >
                    Append more {container.unitPlural}
                  </label>
                  <input
                    id="edit-container-append"
                    type="number"
                    min={0}
                    max={500}
                    value={appendUnitsCount}
                    onChange={(e) =>
                      setAppendUnitsCount(Math.max(0, Number(e.target.value) || 0))
                    }
                    className="w-full rounded-xl border border-[#2A2D37] bg-[#252731] px-3 py-1.5 text-sm text-[#F1F2F6] tabular-nums focus:border-[#E87151] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="edit-container-cover"
                  className="block text-[11px] font-medium text-[#9397A5] mb-1"
                >
                  Cover Image URL
                </label>
                <input
                  id="edit-container-cover"
                  type="url"
                  value={editCoverUrl}
                  onChange={(e) => setEditCoverUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-[#2A2D37] bg-[#252731] px-3 py-1.5 text-sm text-[#F1F2F6] placeholder:text-[#646876] focus:border-[#E87151] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-xl border border-[#303340] bg-[#252731] px-3 py-1.5 text-xs font-medium text-[#9397A5] hover:text-[#F1F2F6] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#E87151] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#DC6242] cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          )}

          {/* Progress Bar + Controls */}
          <div className="rounded-2xl border border-[#222229] bg-[#111114] p-4 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-[#F4F4F6] tabular-nums">
                {progress.completed} of {progress.total} {container.unitPlural} logged
              </span>
              <span className="tabular-nums font-semibold text-[#F4F4F6]">
                {progress.percent}%
              </span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-[#1D1D23]">
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{
                  width: `${progress.percent}%`,
                  backgroundColor: progress.isComplete ? '#34D399' : dotColor,
                }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => onTogglePinCurrently(container.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
                  isPinned
                    ? 'border border-[#2A2A32] bg-[#1D1D23] text-[#F4F4F6] hover:bg-[#25252D]'
                    : 'bg-[#E87151] text-white hover:bg-[#DC6242]'
                }`}
              >
                {isPinned ? (
                  <>
                    <PinOff className="h-3.5 w-3.5" />
                    Remove from {PILLAR_LABELS[container.pillar]}
                  </>
                ) : (
                  <>
                    <Pin className="h-3.5 w-3.5" />
                    Add to {PILLAR_LABELS[container.pillar]} next
                  </>
                )}
              </button>

              {!progress.isComplete && (isPinned || isCollectingDust) && (
                <button
                  type="button"
                  onClick={() => onToggleCollectingDust(container.id)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-medium transition cursor-pointer ${
                    isCollectingDust
                      ? 'border-[#D99B43]/40 bg-[#D99B43]/15 text-[#D99B43] hover:bg-[#D99B43]/25'
                      : 'border-[#2A2A32] bg-[#1D1D23] text-[#8E8E98] hover:text-[#F4F4F6]'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  {isCollectingDust
                    ? `Wake to ${PILLAR_LABELS[container.pillar]} next`
                    : 'Move to Collecting dust'}
                </button>
              )}

              {isPinned && (
                <button
                  type="button"
                  onClick={() => onToggleTrackMode(container.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#2A2A32] bg-[#1D1D23] px-3.5 py-2 text-xs font-medium text-[#F4F4F6] hover:bg-[#25252D] transition cursor-pointer"
                >
                  <Layers className="h-3.5 w-3.5 text-[#8E8E98]" />
                  {isSingleMode ? 'Mode: Single item (Switch to Sub-units)' : 'Mode: Sub-units'}
                </button>
              )}

              {!progress.isComplete && (
                <button
                  type="button"
                  onClick={() => onCompleteAll(container.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#34D399]/30 bg-[#34D399]/15 px-3.5 py-2 text-xs font-medium text-[#34D399] hover:bg-[#34D399]/25 transition cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  Mark all complete
                </button>
              )}
            </div>
          </div>

          {/* Reading Version Switcher (Comics & Books) */}
          {onSwitchEdition && editionOptions.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#9397A5]">
                  <Layers className="h-3.5 w-3.5" />
                  Reading Version
                </div>
                {loadingEditions ? (
                  <span className="text-[11px] text-[#646876]">Checking covers...</span>
                ) : (
                  <span className="text-[11px] text-[#646876]">
                    Switch edition & cover
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {editionOptions
                  .filter((e) => !e.id.startsWith('vol-'))
                  .map((edition) => {
                    const selected =
                      edition.shortBadge.toLowerCase() ===
                      container.kindLabel.toLowerCase();
                    return (
                      <button
                        key={edition.id}
                        type="button"
                        onClick={() =>
                          onSwitchEdition({
                            containerId: container.id,
                            kindLabel: edition.shortBadge,
                            coverUrl: edition.coverUrl,
                            hqCoverUrl: edition.hqCoverUrl,
                            fallbackCoverUrl: edition.fallbackCoverUrl,
                            year: edition.year,
                            suggestedShelfStatus: edition.suggestedShelf,
                          })
                        }
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                          selected
                            ? 'bg-[#E87151] text-white'
                            : 'border border-[#2A2D37] bg-[#15161B] text-[#9397A5] hover:bg-[#252731] hover:text-[#F1F2F6]'
                        }`}
                      >
                        {edition.isVerified && (
                          <span
                            className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                              selected ? 'bg-white' : 'bg-[#34D399]'
                            }`}
                          />
                        )}
                        <span>{edition.label}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

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

            {container.atomIds.length > 30 && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1 rounded-xl border border-[#2A2D37] bg-[#15161B] p-1">
                  {(['all', 'remaining', 'completed'] as UnitFilterMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setUnitFilter(mode)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-medium capitalize transition cursor-pointer ${
                        unitFilter === mode
                          ? 'bg-[#E87151] text-white'
                          : 'text-[#9397A5] hover:text-[#F1F2F6]'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <div className="relative flex-1 min-w-[140px]">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#646876]" />
                  <input
                    type="text"
                    value={unitQuery}
                    onChange={(e) => setUnitQuery(e.target.value)}
                    placeholder="Filter units..."
                    aria-label="Filter units"
                    className="w-full rounded-xl border border-[#2A2D37] bg-[#15161B] py-1.5 pl-8 pr-3 text-xs text-[#F1F2F6] placeholder:text-[#646876] focus:border-[#E87151] focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="divide-y divide-[#23252F] overflow-hidden rounded-2xl border border-[#2A2D37] bg-[#15161B]">
              {filteredAtoms.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-[#646876]">
                  No units match this filter.
                </div>
              ) : (
                filteredAtoms.map(({ idx, atom }) => {
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
                })
              )}
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
