import { useEffect, useRef, useState } from 'react';
import {
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
import { MEDIUM_COLORS, MEDIUM_LABELS } from './mediaMeta';
import { PosterArt } from './PosterArt';

export type SearchFilter = 'all' | Pillar | Medium;

interface SearchViewProps {
  allContainers: ContainerNode[];
  atomsById: Record<string, AtomNode>;
  completedAtomIds: Set<string>;
  activeBoardIds: Set<string>;
  shelfById: Record<string, ShelfStatus>;
  initialFilter?: SearchFilter;
  autoFocusTrigger?: number;
  onTogglePinCurrently: (containerId: string) => void;
  onOpenDetail: (containerId: string) => void;
  onSelectOnlineResult: (result: OnlineSearchResult) => void;
  onOpenCustomModal: (prefillTitle?: string) => void;
}

const QUICK_SEARCH_EXAMPLES = [
  'Dragon Ball',
  'Severance',
  'Dune',
  'Chainsaw Man',
  'Alan Wake 2',
  'Elden Ring',
];

function mapFilterToOnlineCategory(filter: SearchFilter): OnlineSearchCategory {
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

function getSearchInitials(title: string): string {
  const words = title
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'SHF';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function FlushSearchCover({
  title,
  medium,
  coverUrl,
  fallbackCoverUrl,
}: {
  title: string;
  medium: Medium;
  coverUrl?: string;
  fallbackCoverUrl?: string;
}) {
  const [stage, setStage] = useState<'primary' | 'fallback' | 'none'>(
    coverUrl ? 'primary' : fallbackCoverUrl ? 'fallback' : 'none'
  );
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setStage(coverUrl ? 'primary' : fallbackCoverUrl ? 'fallback' : 'none');
  }, [coverUrl, fallbackCoverUrl]);

  const src =
    stage === 'primary'
      ? coverUrl
      : stage === 'fallback'
        ? fallbackCoverUrl
        : undefined;

  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  }, [src]);

  if (src) {
    return (
      <div className="relative w-[60px] sm:w-[66px] shrink-0 self-stretch overflow-hidden bg-[#1D1D23] select-none">
        {!loaded && <div className="absolute inset-0 bg-[#1D1D23] animate-pulse" />}
        <img
          ref={imgRef}
          src={src}
          alt={title}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            if (stage === 'primary' && fallbackCoverUrl) setStage('fallback');
            else setStage('none');
          }}
          className={`h-full w-full object-cover transition-opacity duration-200 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </div>
    );
  }

  return (
    <div className="relative w-[60px] sm:w-[66px] shrink-0 self-stretch overflow-hidden bg-[#1E1E25] select-none flex flex-col justify-between">
      <div
        className="h-1 w-full shrink-0"
        style={{ backgroundColor: MEDIUM_COLORS[medium] }}
      />
      <div className="flex flex-1 items-center justify-center px-1">
        <span className="text-xs font-bold tracking-wider text-[#F4F4F6]">
          {getSearchInitials(title)}
        </span>
      </div>
      <div className="h-1 w-full shrink-0 opacity-0" aria-hidden="true" />
    </div>
  );
}

export function SearchView({
  allContainers,
  atomsById,
  completedAtomIds,
  activeBoardIds,
  shelfById,
  initialFilter = 'all',
  autoFocusTrigger = 0,
  onTogglePinCurrently,
  onOpenDetail,
  onSelectOnlineResult,
  onOpenCustomModal,
}: SearchViewProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchFilter>(initialFilter);
  const [onlineResults, setOnlineResults] = useState<OnlineSearchResult[]>([]);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [autoFocusTrigger]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setOnlineResults([]);
      setOnlineLoading(false);
      return;
    }

    const controller = new AbortController();
    setOnlineLoading(true);
    const category = mapFilterToOnlineCategory(filter);

    const timer = window.setTimeout(async () => {
      try {
        const items = await searchOnlineMedia(trimmed, category, controller.signal);
        if (!controller.signal.aborted) {
          const filteredByPillar =
            filter === 'watch' || filter === 'read' || filter === 'play'
              ? items.filter((i) => i.pillar === filter)
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
    }, 280);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, filter]);

  const localMatches = allContainers.filter((container) => {
    if (filter === 'watch' || filter === 'read' || filter === 'play') {
      if (container.pillar !== filter) return false;
    } else if (filter !== 'all') {
      if (container.medium !== filter) return false;
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

  const filterChips: { id: SearchFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'watch', label: 'Watch' },
    { id: 'read', label: 'Read' },
    { id: 'play', label: 'Play' },
    { id: 'tv', label: 'TV' },
    { id: 'movie', label: 'Movies' },
    { id: 'anime', label: 'Anime' },
    { id: 'manga', label: 'Manga' },
    { id: 'comic', label: 'Comics' },
    { id: 'book', label: 'Books' },
    { id: 'game', label: 'Games' },
  ];

  const hasSearchQuery = query.trim().length >= 2;

  return (
    <div className="space-y-5">
      {/* Compact Header */}
      <header className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E87151] text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#F4F4F6]">
            Search
          </h1>
        </div>

        <button
          type="button"
          onClick={() => onOpenCustomModal(query.trim())}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#222229] bg-[#16161A] px-3.5 py-1.5 text-xs font-semibold text-[#F4F4F6] hover:border-[#E87151] hover:bg-[#E87151] transition cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Custom
        </button>
      </header>

      {/* Search Input & Category Chips */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#63636D]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search TV, movies, anime, manga, comics, books, games..."
            aria-label="Search live media catalogs"
            className="w-full rounded-2xl border border-[#26262E] bg-[#16161A] py-3 pl-11 pr-10 text-sm text-[#F4F4F6] placeholder:text-[#63636D] focus:border-[#E87151] focus:outline-none transition"
          />
          {onlineLoading ? (
            <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#E87151]" />
          ) : (
            query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#63636D] hover:text-[#F4F4F6] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {filterChips.map((chip) => {
            const active = filter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFilter(chip.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition cursor-pointer ${
                  active
                    ? 'bg-[#E87151] text-white'
                    : 'border border-[#222229] bg-[#16161A] text-[#8E8E98] hover:text-[#F4F4F6]'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {!hasSearchQuery && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[11px] font-medium text-[#63636D] mr-1">Try:</span>
            {QUICK_SEARCH_EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setQuery(example);
                  inputRef.current?.focus();
                }}
                className="rounded-full border border-[#222229] bg-[#111114] px-2.5 py-1 text-xs text-[#8E8E98] hover:border-[#2F2F38] hover:text-[#F4F4F6] transition cursor-pointer"
              >
                {example}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Live Online Matches */}
      {hasSearchQuery && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#8E8E98]">
              <Globe className="h-3.5 w-3.5 text-[#E87151]" />
              Online Matches
            </div>
            {onlineLoading && (
              <span className="text-xs text-[#63636D]">Fetching covers...</span>
            )}
          </div>

          {!onlineLoading && onlineResults.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#222229] bg-[#111114] px-5 py-6 text-center text-xs text-[#8E8E98]">
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
            <div className="space-y-2.5">
              {onlineResults.map((item) => {
                const dotColor = MEDIUM_COLORS[item.medium];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectOnlineResult(item)}
                    className="group flex w-full items-stretch overflow-hidden rounded-2xl border border-[#222229] bg-[#16161A] min-h-[82px] text-left hover:border-[#E87151]/60 hover:bg-[#1C1C22] transition cursor-pointer"
                  >
                    <FlushSearchCover
                      title={item.title}
                      medium={item.medium}
                      coverUrl={item.coverUrl}
                      fallbackCoverUrl={item.fallbackCoverUrl}
                    />
                    <div className="min-w-0 flex-1 py-2.5 pl-3.5 pr-2 flex flex-col justify-center gap-0.5">
                      <p className="truncate text-[15px] font-semibold text-[#F4F4F6]">
                        {item.title}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-[#8E8E98]">
                        <span
                          className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: dotColor }}
                        />
                        <span>{MEDIUM_LABELS[item.medium]}</span>
                        {item.year && (
                          <>
                            <span className="text-[#55555E]">·</span>
                            <span>{item.year}</span>
                          </>
                        )}
                      </div>
                      <p className="truncate text-xs text-[#63636D]">{item.subtitle}</p>
                    </div>
                    <div className="flex items-center pr-3.5 shrink-0">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#32323A] bg-[#16161A] text-[#E87151] group-hover:border-[#E87151] group-hover:bg-[#E87151] group-hover:text-white transition">
                        <Plus className="h-4 w-4" />
                      </span>
                    </div>
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
          <div className="rounded-2xl border border-dashed border-[#222229] bg-[#111114] px-6 py-12 text-center">
            <Globe className="mx-auto h-7 w-7 text-[#63636D]" />
            <p className="mt-3 text-sm font-medium text-[#F4F4F6]">
              Search any movie, show, comic, book, or game
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-[#8E8E98]">
              Pick a result above to pull real episodes, chapters, and artwork straight into Watch, Read, or Play.
            </p>
          </div>
        )
      ) : (
        <section className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8E8E98]">
              In Your Library
            </h2>
            <span className="text-xs tabular-nums text-[#63636D]">
              {localMatches.length}
            </span>
          </div>

          {localMatches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#222229] bg-[#111114] px-5 py-8 text-center">
              <p className="text-xs text-[#8E8E98]">
                No matching trackers in your saved library.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {localMatches.map((container) => {
                const progress = getContainerProgress(
                  container,
                  completedAtomIds,
                  atomsById
                );
                const overlapping = getOverlappingContainers(
                  container.id,
                  allContainers
                );
                const isPinned = activeBoardIds.has(container.id);
                const isBacklog = shelfById[container.id] === 'backlog';
                const dotColor = MEDIUM_COLORS[container.medium] ?? container.accentFrom;

                return (
                  <article
                    key={container.id}
                    className="relative flex items-stretch overflow-hidden rounded-2xl border border-[#222229] bg-[#16161A] min-h-[82px] hover:border-[#2F2F38] hover:bg-[#1C1C22] transition"
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
                      className="w-[60px] sm:w-[66px]"
                    />

                    <div className="min-w-0 flex-1 py-2.5 pl-3.5 pr-2 flex flex-col justify-center gap-0.5">
                      <h3 className="truncate text-[15px] font-semibold text-[#F4F4F6]">
                        {container.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-[#8E8E98] tabular-nums">
                        <span
                          className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: dotColor }}
                        />
                        <span>{MEDIUM_LABELS[container.medium]}</span>
                        <span className="text-[#55555E]">·</span>
                        <span>
                          {progress.completed}/{progress.total} {container.unitPlural}
                        </span>
                        {isBacklog && (
                          <>
                            <span className="text-[#55555E]">·</span>
                            <span className="text-[#D99B43]">Dust</span>
                          </>
                        )}
                        {overlapping.length > 0 && (
                          <Link2 className="h-3 w-3 shrink-0 text-[#63636D]" />
                        )}
                      </div>
                      <p className="truncate text-xs text-[#63636D]">
                        {container.subtitle}
                      </p>
                    </div>

                    <div className="relative z-10 flex items-center pr-3.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onTogglePinCurrently(container.id)}
                        aria-label={
                          isPinned
                            ? `Remove ${container.title} from active queue`
                            : `Add ${container.title} to active queue`
                        }
                        className={`flex h-8 w-8 items-center justify-center rounded-full border transition cursor-pointer ${
                          isPinned
                            ? 'border-[#34D399]/40 bg-[#34D399]/15 text-[#34D399]'
                            : 'border-[#32323A] bg-[#16161A] text-[#8E8E98] hover:border-[#E87151] hover:text-[#E87151]'
                        }`}
                      >
                        {isPinned ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                      </button>
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
