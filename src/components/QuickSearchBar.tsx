import { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Search, X } from 'lucide-react';
import {
  OnlineSearchCategory,
  OnlineSearchResult,
  searchOnlineMedia,
} from '../services/onlineSearch';
import { CoverThumb } from './CoverThumb';
import { MEDIUM_COLORS, MEDIUM_LABELS } from './mediaMeta';

interface QuickSearchBarProps {
  onSelectOnlineResult: (result: OnlineSearchResult) => void;
  onOpenCustomModal: (prefillTitle: string) => void;
}

const CATEGORIES: { id: OnlineSearchCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'tv', label: 'TV' },
  { id: 'movie', label: 'Movie' },
  { id: 'anime', label: 'Anime' },
  { id: 'manga', label: 'Manga' },
  { id: 'comic', label: 'Comic' },
  { id: 'book', label: 'Book' },
  { id: 'game', label: 'Game' },
];

export function QuickSearchBar({
  onSelectOnlineResult,
  onOpenCustomModal,
}: QuickSearchBarProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<OnlineSearchCategory>('all');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<OnlineSearchResult[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const items = await searchOnlineMedia(trimmed, category, controller.signal);
        if (!controller.signal.aborted) {
          setResults(items);
          setLoading(false);
        }
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, category]);

  const showDropdown = isOpen && query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md">
      <div
        className={`flex items-center gap-2 rounded-xl border bg-[#1B1D24] px-3 py-1.5 transition ${
          isOpen ? 'border-[#E87151]' : 'border-[#2A2D37] hover:border-[#343846]'
        }`}
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-[#646876]" />
        <input
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          placeholder="Search & add movies, shows, manga, games..."
          className="w-full bg-transparent text-xs sm:text-sm text-[#F1F2F6] placeholder:text-[#646876] focus:outline-none"
        />
        {loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#E87151]" />}
        {!loading && query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setResults([]);
            }}
            aria-label="Clear quick search"
            className="rounded p-0.5 text-[#646876] hover:text-[#F1F2F6] cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Typeahead Dropdown */}
      {showDropdown && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-[#2A2D37] bg-[#1B1D24] shadow-2xl">
          {/* Category Pills */}
          <div className="flex items-center gap-1 overflow-x-auto border-b border-[#23252F] bg-[#15161B] px-2.5 py-2">
            {CATEGORIES.map((cat) => {
              const active = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
                    active
                      ? 'bg-[#E87151] text-white'
                      : 'text-[#9397A5] hover:bg-[#252731] hover:text-[#F1F2F6]'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Results List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-[#23252F]">
            {loading && results.length === 0 ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-xs text-[#9397A5]">
                <Loader2 className="h-4 w-4 animate-spin text-[#E87151]" />
                <span>Searching covers & metadata...</span>
              </div>
            ) : results.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-[#9397A5]">
                No online matches found for &ldquo;{query.trim()}&rdquo;.
              </div>
            ) : (
              results.map((item) => {
                const dotColor = MEDIUM_COLORS[item.medium];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onSelectOnlineResult(item);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[#252731] transition cursor-pointer"
                  >
                    <CoverThumb
                      title={item.title}
                      medium={item.medium}
                      coverUrl={item.coverUrl}
                      fallbackCoverUrl={item.fallbackCoverUrl}
                      size="xs"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs sm:text-sm font-semibold text-[#F1F2F6]">
                        {item.title}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#9397A5]">
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: dotColor }}
                        />
                        <span className="font-medium text-[#F1F2F6]/85">
                          {MEDIUM_LABELS[item.medium]}
                        </span>
                        <span>·</span>
                        <span className="truncate">{item.subtitle}</span>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-lg border border-[#303340] bg-[#252731] px-2 py-1 text-[10px] font-medium text-[#9397A5]">
                      + Add
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Custom Fallback */}
          <button
            type="button"
            onClick={() => {
              const prefill = query.trim();
              setIsOpen(false);
              onOpenCustomModal(prefill);
            }}
            className="flex w-full items-center justify-between border-t border-[#23252F] bg-[#15161B] px-3.5 py-2.5 text-left text-xs font-medium text-[#9397A5] hover:bg-[#252731] hover:text-[#F1F2F6] transition cursor-pointer"
          >
            <span className="inline-flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5 text-[#E87151]" />
              Create custom tracker for &ldquo;{query.trim()}&rdquo;
            </span>
            <span className="text-[11px] text-[#646876]">Custom</span>
          </button>
        </div>
      )}
    </div>
  );
}
