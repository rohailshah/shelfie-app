import { useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  Check,
  Globe,
  Link2,
  Loader2,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { getContainerProgress, getOverlappingContainers } from '../engine/graph';
import {
  AtomNode,
  ContainerNode,
  Medium,
  Pillar,
  ShelfStatus,
} from '../engine/types';
import {
  OnlineSearchCategory,
  OnlineSearchResult,
  searchOnlineMedia,
} from '../services/onlineSearch';
import { CoverThumb } from './CoverThumb';
import { MEDIUM_COLORS, MEDIUM_LABELS } from './mediaMeta';
import { PosterArt } from './PosterArt';

interface DiscoverViewProps {
  allContainers: ContainerNode[];
  atomsById: Record<string, AtomNode>;
  completedAtomIds: Set<string>;
  activeBoardIds: Set<string>;
  shelfById: Record<string, ShelfStatus>;
  autoFocusSearch?: boolean;
  onAutoFocusHandled?: () => void;
  onTogglePinCurrently: (containerId: string) => void;
  onToggleBacklog: (containerId: string) => void;
  onOpenDetail: (containerId: string) => void;
  onSelectOnlineResult: (result: OnlineSearchResult) => void;
  onOpenCustomModal: (prefillTitle?: string) => void;
}

type FilterOption = 'all' | Pillar | Medium;

const QUICK_SEARCH_EXAMPLES = [
  'Severance',
  'Dune',
  'Chainsaw Man',
  'Alan Wake 2',
  'Elden Ring',
];

function mapFilterToOnlineCategory(filter: FilterOption): OnlineSearchCategory {
  if (
    filter === 'movie' ||
    filter === 'tv' ||
    filter === 'anime' ||
    filter === 'manga' ||
    filter === 'comic' ||
    filter === 'book' ||
    filter === 'game'
  ) {
    return filter;
  }
  return 'all';
}

export function DiscoverView({
  allContainers,
  atomsById,
  completedAtomIds,
  activeBoardIds,
  shelfById,
  autoFocusSearch,
  onAutoFocusHandled,
  onTogglePinCurrently,
  onToggleBacklog,
  onOpenDetail,
  onSelectOnlineResult,
  onOpenCustomModal,
}: DiscoverViewProps) {
  const [query, setQuery] = useState('');
  const [mediumFilter, setMediumFilter] = useState<FilterOption>('all');
  const [onlineResults, setOnlineResults] = useState<OnlineSearchResult[]>([]);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (autoFocusSearch) {
      searchInputRef.current?.focus();
      onAutoFocusHandled?.();
    }
  }, [autoFocusSearch, onAutoFocusHandled]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setOnlineResults([]);
      setOnlineLoading(false);
      return;
    }

    const controller = new AbortController();
    setOnlineLoading(true);
    const category = mapFilterToOnlineCategory(mediumFilter);

    const timer = window.setTimeout(async () => {
      try {
        const items = await searchOnlineMedia(trimmed, category, controller.signal);
        if (!controller.signal.aborted) {
          const filteredByPillar =
            mediumFilter === 'watch' || mediumFilter === 'read' || mediumFilter === 'play'
              ? items.filter((i) => i.pillar === mediumFilter)
              : items;
          setOnlineResults(filteredByPillar);
          setOnlineLoading(false);
        }
      } catch {
        if (!controller.signal.aborted) {
          setOnlineResults([]);
          setOnlineLoading(false);
        }
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, mediumFilter]);

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

  const filterChips: { id: FilterOption; label: string }[] = [
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

  const hasSearchQuery = query.trim().length >= 2;

  return (
    <div className="space-y-6">
      {/* Header + Create Custom CTA */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F1F2F6]">
            Search & Add
          </h1>
          <p className="mt-1 text-sm text-[#9397A5]">
            Search live catalogs across TV, movies, anime, manga, books, and games—or create a custom tracker.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onOpenCustomModal('')}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-[#E87151] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#DC6242] transition cursor-pointer"
        >
          <Sparkles className="h-4 w-4" />
          Create Custom Tracker
        </button>
      </div>

      {/* Search + Filter Bar */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#646876]" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search live online (e.g., Severance, Dune, Chainsaw Man, Alan Wake 2)..."
            aria-label="Search live media catalogs"
            className="w-full rounded-2xl border border-[#2A2D37] bg-[#1B1D24] py-3 pl-11 pr-10 text-sm text-[#F1F2F6] placeholder:text-[#646876] focus:border-[#E87151] focus:outline-none transition"
          />
          {onlineLoading ? (
            <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#E87151]" />
          ) : (
            query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#646876] hover:text-[#F1F2F6] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )
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
                    ? 'bg-[#E87151] text-white'
                    : 'border border-[#2A2D37] bg-[#15161B] text-[#9397A5] hover:text-[#F1F2F6] hover:bg-[#1B1D24]'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {!hasSearchQuery && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-medium text-[#646876]">Try searching:</span>
            {QUICK_SEARCH_EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setQuery(example);
                  searchInputRef.current?.focus();
                }}
                className="rounded-lg border border-[#2A2D37] bg-[#15161B] px-2.5 py-1 text-xs text-[#9397A5] hover:border-[#3A3E4C] hover:text-[#F1F2F6] transition cursor-pointer"
              >
                {example}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Live Online Search Results */}
      {hasSearchQuery && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#9397A5]">
              <Globe className="h-3.5 w-3.5 text-[#E87151]" />
              Online Matches
            </div>
            {onlineLoading && (
              <span className="text-xs text-[#646876]">Fetching covers...</span>
            )}
          </div>

          {!onlineLoading && onlineResults.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#2A2D37] bg-[#15161B] px-5 py-6 text-center text-xs text-[#9397A5]">
              No live online matches found for &ldquo;{query.trim()}&rdquo;.{' '}
              <button
                type="button"
                onClick={() => onOpenCustomModal(query.trim())}
                className="font-semibold text-[#E87151] hover:underline cursor-pointer"
              >
                Create custom tracker instead
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {onlineResults.map((item) => {
                const dotColor = MEDIUM_COLORS[item.medium];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectOnlineResult(item)}
                    className="flex items-center gap-3.5 rounded-2xl border border-[#2A2D37] bg-[#1B1D24] p-3.5 text-left hover:border-[#E87151]/70 hover:bg-[#21242D] transition cursor-pointer"
                  >
                    <CoverThumb
                      title={item.title}
                      medium={item.medium}
                      coverUrl={item.coverUrl}
                      fallbackCoverUrl={item.fallbackCoverUrl}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-[#9397A5]">
                        <span
                          className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: dotColor }}
                        />
                        <span className="font-medium text-[#F1F2F6]/85">
                          {MEDIUM_LABELS[item.medium]}
                        </span>
                        {item.year && (
                          <>
                            <span>·</span>
                            <span>{item.year}</span>
                          </>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-sm font-semibold text-[#F1F2F6]">
                        {item.title}
                      </p>
                      <p className="truncate text-xs text-[#646876]">{item.subtitle}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#252731] border border-[#303340] px-3 py-1.5 text-xs font-semibold text-[#F1F2F6]">
                      <Plus className="h-3.5 w-3.5 text-[#E87151]" />
                      Add
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Your Library */}
      {allContainers.length === 0 ? (
        !hasSearchQuery && (
          <div className="rounded-2xl border border-dashed border-[#2A2D37] bg-[#15161B] px-6 py-12 text-center">
            <Globe className="mx-auto h-7 w-7 text-[#646876]" />
            <p className="mt-3 text-sm font-medium text-[#F1F2F6]">
              Start building your media library
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs text-[#9397A5]">
              Type any title above to pull real seasons, episodes, chapters, or posters—or create a custom tracker and bundle editions together.
            </p>
          </div>
        )
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#9397A5]">
              Your Library
            </h2>
            <span className="text-xs tabular-nums text-[#646876]">
              {filtered.length} {filtered.length === 1 ? 'tracker' : 'trackers'}
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#2A2D37] bg-[#15161B] px-6 py-10 text-center">
              <p className="text-sm font-medium text-[#9397A5]">
                No matching trackers in your library.
              </p>
              <button
                type="button"
                onClick={() => onOpenCustomModal(query.trim())}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#303340] bg-[#252731] px-4 py-2 text-xs font-semibold text-[#F1F2F6] hover:bg-[#2E313D] transition cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 text-[#E87151]" />
                Create &ldquo;{query.trim() || 'Custom'}&rdquo; Tracker
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filtered.map((container) => {
                const progress = getContainerProgress(container, completedAtomIds, atomsById);
                const overlapping = getOverlappingContainers(container.id, allContainers);
                const isPinned = activeBoardIds.has(container.id);
                const isBacklog = shelfById[container.id] === 'backlog';
                const dotColor = MEDIUM_COLORS[container.medium] ?? container.accentFrom;

                return (
                  <article
                    key={container.id}
                    className="relative flex flex-col justify-between rounded-2xl border border-[#2A2D37] bg-[#1B1D24] p-4 transition-colors hover:border-[#3A3E4C] hover:bg-[#21242D]"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenDetail(container.id)}
                      aria-label={`Open details for ${container.title}`}
                      className="absolute inset-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#E87151]/60 cursor-pointer"
                    />

                    <div className="flex gap-4">
                      <PosterArt container={container} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[11px] text-[#9397A5]">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: dotColor }}
                          />
                          <span className="font-medium text-[#F1F2F6]">
                            {MEDIUM_LABELS[container.medium]}
                          </span>
                          <span>·</span>
                          <span>{container.kindLabel}</span>
                        </div>

                        <h3 className="mt-1 line-clamp-1 text-base font-semibold text-[#F1F2F6]">
                          {container.title}
                        </h3>
                        <p className="text-xs text-[#9397A5] line-clamp-1">
                          {container.subtitle}
                        </p>

                        {container.description && (
                          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#646876]">
                            {container.description}
                          </p>
                        )}

                        {overlapping.length > 0 && (
                          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#9397A5]">
                            <Link2 className="h-3 w-3 text-[#646876] shrink-0" />
                            <span className="truncate">
                              Syncs with {overlapping.length}{' '}
                              {overlapping.length === 1 ? 'edition' : 'editions'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Live synced progress + Action buttons */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#23252F] pt-3">
                      <div className="flex items-center gap-2.5 min-w-[120px] flex-1">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#252731]">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${progress.percent}%`,
                              backgroundColor: progress.isComplete ? '#30B884' : dotColor,
                            }}
                          />
                        </div>
                        <span className="tabular-nums text-xs font-medium text-[#9397A5]">
                          {progress.completed}/{progress.total}
                        </span>
                      </div>

                      <div className="relative z-10 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onToggleBacklog(container.id)}
                          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                            isBacklog
                              ? 'border-[#D99B43]/40 bg-[#D99B43]/15 text-[#D99B43]'
                              : 'border-[#303340] bg-[#252731] text-[#9397A5] hover:text-[#F1F2F6]'
                          }`}
                        >
                          <Bookmark className="h-3.5 w-3.5" />
                          {isBacklog ? 'In Backlog' : 'Backlog'}
                        </button>

                        <button
                          type="button"
                          onClick={() => onTogglePinCurrently(container.id)}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                            isPinned
                              ? 'border border-[#30B884]/35 bg-[#30B884]/15 text-[#30B884]'
                              : 'bg-[#E87151] text-white hover:bg-[#DC6242]'
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
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
