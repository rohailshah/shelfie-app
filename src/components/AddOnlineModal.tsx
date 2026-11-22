import { useEffect, useState } from 'react';
import { Bookmark, Check, Loader2, Maximize2, Plus, X } from 'lucide-react';
import {
  fetchTvMazeSeasonsAndEpisodes,
  OnlineSearchResult,
  TvSeasonGroup,
} from '../services/onlineSearch';
import { CoverThumb } from './CoverThumb';
import { MEDIUM_COLORS, MEDIUM_LABELS } from './mediaMeta';
import { PosterLightbox } from './PosterLightbox';

export interface AddOnlineConfirmPayload {
  result: OnlineSearchResult;
  title: string;
  kindLabel: string;
  unitCount: number;
  startUnit: number;
  preCompletedCount: number;
  seasonNumber?: number;
  unitPrefix: string;
  unitPlural: string;
  units?: { title: string; subtitle?: string; meta?: string; unitNumber?: number }[];
  destination: 'currently' | 'backlog';
}

interface AddOnlineModalProps {
  result: OnlineSearchResult | null;
  onClose: () => void;
  onConfirm: (payload: AddOnlineConfirmPayload) => void;
}

export function AddOnlineModal({ result, onClose, onConfirm }: AddOnlineModalProps) {
  const [title, setTitle] = useState('');
  const [kindLabel, setKindLabel] = useState('');
  const [startUnit, setStartUnit] = useState(1);
  const [unitCount, setUnitCount] = useState(1);
  const [preCompletedCount, setPreCompletedCount] = useState(0);
  const [customUnitsText, setCustomUnitsText] = useState('');

  // TVMaze season loading
  const [seasons, setSeasons] = useState<TvSeasonGroup[]>([]);
  const [loadingSeasons, setLoadingSeasons] = useState(false);
  const [selectedSeasonNum, setSelectedSeasonNum] = useState<number | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!result) return;
    setTitle(result.title);
    setKindLabel(result.kindLabel);
    setStartUnit(1);
    setUnitCount(result.suggestedUnitCount);
    setPreCompletedCount(0);
    setCustomUnitsText('');
    setSeasons([]);
    setSelectedSeasonNum(null);
    setLightboxOpen(false);

    if (result.externalSource !== 'tvmaze') return;

    const controller = new AbortController();
    setLoadingSeasons(true);

    fetchTvMazeSeasonsAndEpisodes(result.externalId, controller.signal)
      .then((groups) => {
        if (controller.signal.aborted) return;
        setSeasons(groups);
        if (groups.length > 0) {
          const first = groups[0];
          setSelectedSeasonNum(first.seasonNumber);
          setTitle(`${result.title} · Season ${first.seasonNumber}`);
          setKindLabel(`Season ${first.seasonNumber}`);
          setUnitCount(first.episodes.length);
        }
        setLoadingSeasons(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoadingSeasons(false);
        }
      });

    return () => controller.abort();
  }, [result]);

  useEffect(() => {
    if (!result) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !lightboxOpen) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [result, lightboxOpen, onClose]);

  if (!result) return null;

  const hasCover = Boolean(
    result.hqCoverUrl || result.coverUrl || result.fallbackCoverUrl
  );

  const selectedSeason = seasons.find((s) => s.seasonNumber === selectedSeasonNum) ?? null;

  const customLines = customUnitsText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const effectiveTotalUnits = selectedSeason
    ? selectedSeason.episodes.length
    : customLines.length > 0
      ? customLines.length
      : Math.min(2000, Math.max(1, unitCount));

  const safeStartUnit = Math.min(5000, Math.max(1, startUnit));
  const safePreCompleted = Math.min(effectiveTotalUnits, Math.max(0, preCompletedCount));

  const handleSelectSeason = (seasonNum: number) => {
    const group = seasons.find((s) => s.seasonNumber === seasonNum);
    if (!group) return;
    setSelectedSeasonNum(seasonNum);
    setTitle(`${result.title} · Season ${seasonNum}`);
    setKindLabel(`Season ${seasonNum}`);
    setUnitCount(group.episodes.length);
    setPreCompletedCount(0);
  };

  const handleAdd = (destination: 'currently' | 'backlog') => {
    const trimmedTitle = title.trim() || result.title;

    if (selectedSeason && selectedSeason.episodes.length > 0) {
      const units = selectedSeason.episodes.map((ep) => ({
        title: ep.name,
        subtitle: `S${selectedSeason.seasonNumber} · E${ep.number}`,
        meta: ep.runtime ? `${ep.runtime}m` : undefined,
        unitNumber: ep.number,
      }));
      onConfirm({
        result,
        title: trimmedTitle,
        kindLabel: kindLabel.trim() || `Season ${selectedSeason.seasonNumber}`,
        unitCount: units.length,
        startUnit: units[0]?.unitNumber ?? 1,
        preCompletedCount: Math.min(units.length, Math.max(0, preCompletedCount)),
        seasonNumber: selectedSeason.seasonNumber,
        unitPrefix: `S${selectedSeason.seasonNumber} · E`,
        unitPlural: 'eps',
        units,
        destination,
      });
      return;
    }

    onConfirm({
      result,
      title: trimmedTitle,
      kindLabel: kindLabel.trim() || result.kindLabel,
      unitCount: effectiveTotalUnits,
      startUnit: safeStartUnit,
      preCompletedCount: safePreCompleted,
      unitPrefix: result.unitPrefix,
      unitPlural: result.unitPlural,
      units:
        customLines.length > 0
          ? customLines.map((line, i) => ({
              title: line,
              subtitle: `${result.unitPrefix}${safeStartUnit + i}`,
              unitNumber: safeStartUnit + i,
            }))
          : undefined,
      destination,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-online-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border border-[#2A2D37] bg-[#1B1D24] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top info with real poster */}
        <div className="flex items-start justify-between gap-4 border-b border-[#23252F] p-5">
          <div className="flex gap-4 min-w-0">
            {hasCover ? (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                title="View fullscreen HQ poster"
                aria-label={`View fullscreen HQ poster for ${result.title}`}
                className="group relative shrink-0 cursor-zoom-in rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#E87151]"
              >
                <CoverThumb
                  title={result.title}
                  medium={result.medium}
                  coverUrl={result.coverUrl}
                  fallbackCoverUrl={result.fallbackCoverUrl}
                  size="md"
                />
                <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-lg border border-[#303340] bg-[#111216]/85 text-[#F1F2F6] opacity-85 group-hover:border-[#E87151] group-hover:bg-[#E87151] group-hover:opacity-100 transition">
                  <Maximize2 className="h-3 w-3" />
                </span>
              </button>
            ) : (
              <CoverThumb
                title={result.title}
                medium={result.medium}
                coverUrl={result.coverUrl}
                fallbackCoverUrl={result.fallbackCoverUrl}
                size="md"
              />
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#9397A5]">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-[#303340] bg-[#252731] px-2 py-0.5 font-medium text-[#F1F2F6]">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: MEDIUM_COLORS[result.medium] }}
                  />
                  {MEDIUM_LABELS[result.medium]}
                </span>
                {result.year && <span>{result.year}</span>}
              </div>

              <h2
                id="add-online-title"
                className="mt-2 text-lg font-bold text-[#F1F2F6] leading-snug"
              >
                {result.title}
              </h2>

              {result.creator && (
                <p className="mt-0.5 text-xs text-[#9397A5]">{result.creator}</p>
              )}

              {result.description && (
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#646876]">
                  {result.description}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-xl border border-[#2A2D37] bg-[#252731] p-2 text-[#9397A5] hover:text-[#F1F2F6] cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Configuration */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {result.externalSource === 'tvmaze' && (
            <div className="rounded-2xl border border-[#2A2D37] bg-[#15161B] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#F1F2F6]">Select Season</span>
                {loadingSeasons && (
                  <span className="inline-flex items-center gap-1.5 text-[#9397A5]">
                    <Loader2 className="h-3 w-3 animate-spin text-[#E87151]" />
                    Loading episodes...
                  </span>
                )}
              </div>

              {!loadingSeasons && seasons.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {seasons.map((s) => {
                    const active = selectedSeasonNum === s.seasonNumber;
                    return (
                      <button
                        key={s.seasonNumber}
                        type="button"
                        onClick={() => handleSelectSeason(s.seasonNumber)}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                          active
                            ? 'bg-[#E87151] text-white'
                            : 'border border-[#303340] bg-[#252731] text-[#9397A5] hover:text-[#F1F2F6]'
                        }`}
                      >
                        S{s.seasonNumber}{' '}
                        <span className={active ? 'text-white/80' : 'text-[#646876]'}>
                          ({s.episodes.length})
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedSeason && (
                <p className="text-[11px] text-[#30B884] flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Fetched {selectedSeason.episodes.length} real episode titles for Season{' '}
                  {selectedSeason.seasonNumber}.
                </p>
              )}
            </div>
          )}

          <div>
            <label
              htmlFor="add-online-card-title"
              className="block text-xs font-medium text-[#9397A5] mb-1"
            >
              Card Title
            </label>
            <input
              id="add-online-card-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-[#2A2D37] bg-[#252731] px-3.5 py-2 text-sm text-[#F1F2F6] focus:border-[#E87151] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="add-online-format-badge"
                className="block text-xs font-medium text-[#9397A5] mb-1"
              >
                Format Badge
              </label>
              <input
                id="add-online-format-badge"
                type="text"
                value={kindLabel}
                onChange={(e) => setKindLabel(e.target.value)}
                className="w-full rounded-xl border border-[#2A2D37] bg-[#252731] px-3.5 py-2 text-sm text-[#F1F2F6] focus:border-[#E87151] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="add-online-already-finished"
                className="block text-xs font-medium text-[#9397A5] mb-1"
              >
                Already finished (0–{effectiveTotalUnits})
              </label>
              <input
                id="add-online-already-finished"
                type="number"
                min={0}
                max={effectiveTotalUnits}
                value={preCompletedCount}
                onChange={(e) =>
                  setPreCompletedCount(Math.max(0, Number(e.target.value) || 0))
                }
                className="w-full rounded-xl border border-[#2A2D37] bg-[#252731] px-3.5 py-2 text-sm text-[#F1F2F6] tabular-nums focus:border-[#E87151] focus:outline-none"
              />
            </div>
          </div>

          {!selectedSeason && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="add-online-start-unit"
                  className="block text-xs font-medium text-[#9397A5] mb-1"
                >
                  Start #
                </label>
                <input
                  id="add-online-start-unit"
                  type="number"
                  min={1}
                  max={5000}
                  value={startUnit}
                  onChange={(e) => setStartUnit(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full rounded-xl border border-[#2A2D37] bg-[#252731] px-3.5 py-2 text-sm text-[#F1F2F6] tabular-nums focus:border-[#E87151] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="add-online-unit-count"
                  className="block text-xs font-medium text-[#9397A5] mb-1"
                >
                  Count ({result.unitPlural})
                </label>
                <input
                  id="add-online-unit-count"
                  type="number"
                  min={1}
                  max={2000}
                  value={unitCount}
                  onChange={(e) => setUnitCount(Math.max(1, Number(e.target.value) || 1))}
                  disabled={customLines.length > 0}
                  className="w-full rounded-xl border border-[#2A2D37] bg-[#252731] px-3.5 py-2 text-sm text-[#F1F2F6] tabular-nums disabled:opacity-50 focus:border-[#E87151] focus:outline-none"
                />
              </div>
            </div>
          )}

          {!selectedSeason && result.medium !== 'movie' && (
            <div>
              <label
                htmlFor="add-online-custom-units"
                className="block text-xs font-medium text-[#9397A5] mb-1"
              >
                Custom chunk names (optional, one per line)
              </label>
              <textarea
                id="add-online-custom-units"
                rows={3}
                value={customUnitsText}
                onChange={(e) => setCustomUnitsText(e.target.value)}
                placeholder={`Leave blank for ${result.unitPrefix}${safeStartUnit}–${
                  safeStartUnit + effectiveTotalUnits - 1
                }`}
                className="w-full rounded-xl border border-[#2A2D37] bg-[#252731] px-3 py-2 text-xs text-[#F1F2F6] placeholder:text-[#646876] focus:border-[#E87151] focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 border-t border-[#23252F] bg-[#15161B] px-5 py-4">
          <button
            type="button"
            onClick={() => handleAdd('backlog')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#303340] bg-[#252731] px-4 py-2 text-xs font-semibold text-[#F1F2F6] hover:bg-[#2E313D] transition cursor-pointer"
          >
            <Bookmark className="h-3.5 w-3.5 text-[#D99B43]" />
            Save to Backlog
          </button>
          <button
            type="button"
            onClick={() => handleAdd('currently')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#E87151] px-4 py-2 text-xs font-semibold text-white hover:bg-[#DC6242] transition cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Add to Currently
          </button>
        </div>
      </div>

      <PosterLightbox
        isOpen={lightboxOpen}
        title={result.title}
        subtitle={result.creator || result.subtitle}
        hqUrl={result.hqCoverUrl}
        coverUrl={result.coverUrl}
        fallbackUrl={result.fallbackCoverUrl}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}
