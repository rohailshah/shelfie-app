import { useState } from 'react';
import {
  Bookmark,
  Check,
  Link2,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { getContainerProgress, getOverlappingContainers } from '../engine/graph';
import {
  AtomKind,
  AtomNode,
  ContainerKind,
  ContainerNode,
  Medium,
  Pillar,
  ShelfStatus,
} from '../engine/types';
import { MEDIUM_LABELS } from './mediaMeta';
import { PosterArt } from './PosterArt';

interface DiscoverViewProps {
  allContainers: ContainerNode[];
  atomsById: Record<string, AtomNode>;
  completedAtomIds: Set<string>;
  activeBoardIds: Set<string>;
  shelfById: Record<string, ShelfStatus>;
  onTogglePinCurrently: (containerId: string) => void;
  onToggleBacklog: (containerId: string) => void;
  onOpenDetail: (containerId: string) => void;
  onCreateCustom: (payload: {
    title: string;
    creator: string;
    medium: Medium;
    kindLabel: string;
    unitCount: number;
    unitPrefix: string;
    unitPlural: string;
    customUnitTitles?: string[];
  }) => void;
}

const MEDIUM_OPTIONS: {
  medium: Medium;
  pillar: Pillar;
  atomKind: AtomKind;
  containerKind: ContainerKind;
  defaultKindLabel: string;
  defaultUnitPrefix: string;
  defaultUnitPlural: string;
  accentFrom: string;
  accentTo: string;
}[] = [
  {
    medium: 'comic',
    pillar: 'read',
    atomKind: 'issue',
    containerKind: 'tpb',
    defaultKindLabel: 'TPB',
    defaultUnitPrefix: 'Issue #',
    defaultUnitPlural: 'issues',
    accentFrom: '#F59E0B',
    accentTo: '#451A03',
  },
  {
    medium: 'manga',
    pillar: 'read',
    atomKind: 'chapter',
    containerKind: 'manga_series',
    defaultKindLabel: 'Manga',
    defaultUnitPrefix: 'Ch. ',
    defaultUnitPlural: 'ch',
    accentFrom: '#FB7185',
    accentTo: '#4C0519',
  },
  {
    medium: 'movie',
    pillar: 'watch',
    atomKind: 'movie',
    containerKind: 'trilogy',
    defaultKindLabel: 'Trilogy',
    defaultUnitPrefix: 'Part ',
    defaultUnitPlural: 'films',
    accentFrom: '#10B981',
    accentTo: '#064E3B',
  },
  {
    medium: 'tv',
    pillar: 'watch',
    atomKind: 'episode',
    containerKind: 'season',
    defaultKindLabel: 'Season',
    defaultUnitPrefix: 'Ep. ',
    defaultUnitPlural: 'eps',
    accentFrom: '#38BDF8',
    accentTo: '#0F172A',
  },
  {
    medium: 'anime',
    pillar: 'watch',
    atomKind: 'episode',
    containerKind: 'cour',
    defaultKindLabel: 'Cour',
    defaultUnitPrefix: 'Ep. ',
    defaultUnitPlural: 'eps',
    accentFrom: '#F43F5E',
    accentTo: '#1C1917',
  },
  {
    medium: 'game',
    pillar: 'play',
    atomKind: 'game_chapter',
    containerKind: 'game',
    defaultKindLabel: 'Game',
    defaultUnitPrefix: 'Chapter ',
    defaultUnitPlural: 'chapters',
    accentFrom: '#8B5CF6',
    accentTo: '#1E1B4B',
  },
  {
    medium: 'book',
    pillar: 'read',
    atomKind: 'part',
    containerKind: 'book',
    defaultKindLabel: 'Book',
    defaultUnitPrefix: 'Part ',
    defaultUnitPlural: 'parts',
    accentFrom: '#D97706',
    accentTo: '#27272A',
  },
];

export function getMediumPreset(medium: Medium) {
  return MEDIUM_OPTIONS.find((m) => m.medium === medium) ?? MEDIUM_OPTIONS[0];
}

export function DiscoverView({
  allContainers,
  atomsById,
  completedAtomIds,
  activeBoardIds,
  shelfById,
  onTogglePinCurrently,
  onToggleBacklog,
  onOpenDetail,
  onCreateCustom,
}: DiscoverViewProps) {
  const [query, setQuery] = useState('');
  const [mediumFilter, setMediumFilter] = useState<'all' | Pillar | Medium>('all');
  const [showCustomModal, setShowCustomModal] = useState(false);

  // Custom creator form state
  const [customTitle, setCustomTitle] = useState('');
  const [customCreator, setCustomCreator] = useState('');
  const [customMedium, setCustomMedium] = useState<Medium>('game');
  const [customKindLabel, setCustomKindLabel] = useState('Game');
  const [customUnitCount, setCustomUnitCount] = useState(8);
  const [customUnitNamesText, setCustomUnitNamesText] = useState('');

  const handleMediumSelect = (m: Medium) => {
    setCustomMedium(m);
    const preset = getMediumPreset(m);
    setCustomKindLabel(preset.defaultKindLabel);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = customTitle.trim();
    if (!trimmedTitle) return;

    const preset = getMediumPreset(customMedium);
    const lines = customUnitNamesText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const count =
      lines.length > 0 ? lines.length : Math.min(100, Math.max(1, customUnitCount));

    onCreateCustom({
      title: trimmedTitle,
      creator: customCreator.trim(),
      medium: customMedium,
      kindLabel: customKindLabel.trim() || preset.defaultKindLabel,
      unitCount: count,
      unitPrefix: preset.defaultUnitPrefix,
      unitPlural: preset.defaultUnitPlural,
      customUnitTitles: lines.length > 0 ? lines : undefined,
    });

    setCustomTitle('');
    setCustomCreator('');
    setCustomUnitNamesText('');
    setCustomUnitCount(8);
    setShowCustomModal(false);
  };

  const filtered = allContainers.filter((container) => {
    if (mediumFilter === 'watch' || mediumFilter === 'read' || mediumFilter === 'play') {
      if (container.pillar !== mediumFilter) return false;
    } else if (mediumFilter !== 'all') {
      if (container.medium !== mediumFilter) return false;
    }

    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      container.title.toLowerCase().includes(q) ||
      container.subtitle.toLowerCase().includes(q) ||
      (container.creator ?? '').toLowerCase().includes(q) ||
      container.kindLabel.toLowerCase().includes(q)
    );
  });

  const filterChips: { id: 'all' | Pillar | Medium; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'watch', label: 'Watch' },
    { id: 'read', label: 'Read' },
    { id: 'play', label: 'Play' },
    { id: 'comic', label: 'Comics' },
    { id: 'manga', label: 'Manga' },
    { id: 'movie', label: 'Movies' },
    { id: 'tv', label: 'TV' },
    { id: 'anime', label: 'Anime' },
    { id: 'game', label: 'Games' },
    { id: 'book', label: 'Books' },
  ];

  return (
    <div className="space-y-6">
      {/* Header + Create Custom CTA */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Discover & Add
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Search collections across every medium, or spin up a custom tracker with your own chapters or chunks.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCustomModal(true)}
          className="inline-flex items-center justify-center gap-2 self-start rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-sm hover:bg-zinc-200 transition cursor-pointer"
        >
          <Sparkles className="h-4 w-4" />
          Create Custom Tracker
        </button>
      </div>

      {/* Search + Filter Bar */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Batman Omnibus, Chainsaw Man, Alan Wake, Dune..."
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-10 text-sm text-white placeholder:text-zinc-500 focus:border-white/25 focus:bg-white/[0.06] focus:outline-none transition"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-zinc-400 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {filterChips.map((chip) => {
            const active = mediumFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setMediumFilter(chip.id)}
                className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                  active
                    ? 'bg-white text-zinc-950'
                    : 'border border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white hover:bg-white/[0.07]'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-14 text-center">
          <p className="text-sm font-medium text-zinc-300">
            No matching collections found for &ldquo;{query}&rdquo;.
          </p>
          <button
            type="button"
            onClick={() => {
              setCustomTitle(query);
              setShowCustomModal(true);
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15 transition cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Create &ldquo;{query || 'Custom'}&rdquo; Tracker
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((container) => {
            const progress = getContainerProgress(container, completedAtomIds, atomsById);
            const overlapping = getOverlappingContainers(container.id, allContainers);
            const isPinned = activeBoardIds.has(container.id);
            const isBacklog = shelfById[container.id] === 'backlog';

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
                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/60 p-4 backdrop-blur-xl transition hover:border-white/20 hover:bg-zinc-900/80 cursor-pointer"
              >
                <div className="flex gap-4">
                  <PosterArt container={container} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                      <span className="font-medium text-zinc-300">
                        {MEDIUM_LABELS[container.medium]}
                      </span>
                      <span>·</span>
                      <span>{container.kindLabel}</span>
                      {container.isCustom && (
                        <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-medium text-violet-200">
                          Custom
                        </span>
                      )}
                    </div>

                    <h3 className="mt-1 line-clamp-1 text-base font-semibold text-white">
                      {container.title}
                    </h3>
                    <p className="text-xs text-zinc-400 line-clamp-1">
                      {container.subtitle}
                    </p>

                    {container.description && (
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-500">
                        {container.description}
                      </p>
                    )}

                    {overlapping.length > 0 && (
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-400">
                        <Link2 className="h-3 w-3 text-zinc-500 shrink-0" />
                        <span className="truncate">
                          Syncs with {overlapping.length}{' '}
                          {overlapping.length === 1 ? 'edition' : 'editions'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Live synced progress + Action buttons */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
                  <div className="flex items-center gap-2.5 min-w-[120px] flex-1">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${progress.percent}%`,
                          backgroundColor: container.accentFrom,
                        }}
                      />
                    </div>
                    <span className="tabular-nums text-xs font-medium text-zinc-300">
                      {progress.completed}/{progress.total}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleBacklog(container.id);
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                        isBacklog
                          ? 'border-amber-400/30 bg-amber-500/15 text-amber-200'
                          : 'border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/10'
                      }`}
                    >
                      <Bookmark className="h-3.5 w-3.5" />
                      {isBacklog ? 'In Backlog' : 'Backlog'}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePinCurrently(container.id);
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                        isPinned
                          ? 'border border-emerald-400/30 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20'
                          : 'bg-white text-zinc-950 hover:bg-zinc-200'
                      }`}
                    >
                      {isPinned ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          On Currently
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" />
                          Currently
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Custom Tracker Modal */}
      {showCustomModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md p-0 sm:p-4"
          onClick={() => setShowCustomModal(false)}
        >
          <form
            onSubmit={handleCreateSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-white/15 bg-zinc-950 p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Create Custom Tracker</h2>
                <p className="text-xs text-zinc-400">
                  Break any game, comic run, trilogy, book, or show into trackable chunks.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Medium
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {MEDIUM_OPTIONS.map((opt) => (
                    <button
                      key={opt.medium}
                      type="button"
                      onClick={() => handleMediumSelect(opt.medium)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                        customMedium === opt.medium
                          ? 'bg-white text-zinc-950'
                          : 'border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                      }`}
                    >
                      {MEDIUM_LABELS[opt.medium]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g., Resident Evil 4 Remake, Invincible Compendium 1..."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-white/25 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Edition / Format Label
                  </label>
                  <input
                    type="text"
                    value={customKindLabel}
                    onChange={(e) => setCustomKindLabel(e.target.value)}
                    placeholder="TPB, Trilogy, Game..."
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm text-white focus:border-white/25 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Creator / Studio (optional)
                  </label>
                  <input
                    type="text"
                    value={customCreator}
                    onChange={(e) => setCustomCreator(e.target.value)}
                    placeholder="Capcom, Kirkman..."
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-white/25 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Number of chunks
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={customUnitCount}
                    onChange={(e) => setCustomUnitCount(Number(e.target.value) || 1)}
                    disabled={customUnitNamesText.trim().length > 0}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm text-white tabular-nums disabled:opacity-50 focus:border-white/25 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Custom unit names (optional, one per line)
                  </label>
                  <textarea
                    rows={3}
                    value={customUnitNamesText}
                    onChange={(e) => setCustomUnitNamesText(e.target.value)}
                    placeholder={'Leave blank for auto-numbered chunks, or type:\nAct 1 · Village\nAct 2 · Castle'}
                    className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-white/25 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCustomModal(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-white/10 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-zinc-200 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Add & Pin to Currently
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
