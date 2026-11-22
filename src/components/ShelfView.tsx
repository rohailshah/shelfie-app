import { useState } from 'react';
import { Award, Bookmark, Check, Package, Plus, Sparkles } from 'lucide-react';
import { getContainerProgress, getUnlockedCollections } from '../engine/graph';
import { AtomNode, ContainerNode, ShelfStatus } from '../engine/types';
import { formatShelfLabel, MEDIUM_COLORS, MEDIUM_LABELS } from './mediaMeta';
import { PosterArt } from './PosterArt';

type ShelfTab = 'all' | 'owned' | 'backlog' | 'wishlist' | 'completed';

interface ShelfViewProps {
  allContainers: ContainerNode[];
  atomsById: Record<string, AtomNode>;
  completedAtomIds: Set<string>;
  activeBoardIds: Set<string>;
  shelfById: Record<string, ShelfStatus>;
  onOpenDetail: (containerId: string) => void;
  onTogglePinCurrently: (containerId: string) => void;
}

export function ShelfView({
  allContainers,
  atomsById,
  completedAtomIds,
  activeBoardIds,
  shelfById,
  onOpenDetail,
  onTogglePinCurrently,
}: ShelfViewProps) {
  const [tab, setTab] = useState<ShelfTab>('all');

  const unlocked = getUnlockedCollections(
    allContainers,
    completedAtomIds,
    atomsById,
    activeBoardIds
  );

  const itemsWithMeta = allContainers.map((container) => {
    const progress = getContainerProgress(container, completedAtomIds, atomsById);
    const status = shelfById[container.id] ?? 'none';
    return { container, progress, status };
  });

  const tabs: { id: ShelfTab; label: string; count: number }[] = [
    {
      id: 'all',
      label: 'All Shelf',
      count: itemsWithMeta.filter((i) => i.status !== 'none' || i.progress.isComplete).length,
    },
    {
      id: 'owned',
      label: 'Owned',
      count: itemsWithMeta.filter(
        (i) => i.status === 'owned_physical' || i.status === 'owned_digital'
      ).length,
    },
    {
      id: 'backlog',
      label: 'Backlog',
      count: itemsWithMeta.filter((i) => i.status === 'backlog').length,
    },
    {
      id: 'wishlist',
      label: 'Wishlist',
      count: itemsWithMeta.filter((i) => i.status === 'wishlist').length,
    },
    {
      id: 'completed',
      label: 'Completed',
      count: itemsWithMeta.filter((i) => i.progress.isComplete).length,
    },
  ];

  const filtered = itemsWithMeta.filter(({ status, progress }) => {
    switch (tab) {
      case 'owned':
        return status === 'owned_physical' || status === 'owned_digital';
      case 'backlog':
        return status === 'backlog';
      case 'wishlist':
        return status === 'wishlist';
      case 'completed':
        return progress.isComplete;
      case 'all':
      default:
        return status !== 'none' || progress.isComplete;
    }
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F1F2F6]">
          Shelf & Unlocked Collections
        </h1>
        <p className="mt-1 text-sm text-[#9397A5]">
          What you own stays separate from what you’ve read, watched, or played—plus every collection unlocked via sub-units.
        </p>
      </div>

      {/* Unlocked Collections Spotlight (Flat Matte) */}
      <section className="rounded-2xl border border-[#2A2D37] bg-[#1B1D24] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#30B884]/30 bg-[#30B884]/15 text-[#30B884]">
              <Award className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-[#F1F2F6]">
                Unlocked Collections
              </h2>
              <p className="text-xs text-[#9397A5]">
                Hardcovers, volumes, trades & trilogies reached 100% through logged units.
              </p>
            </div>
          </div>
          <span className="tabular-nums rounded-xl border border-[#30B884]/30 bg-[#30B884]/15 px-3 py-1 text-xs font-semibold text-[#30B884]">
            {unlocked.length} unlocked
          </span>
        </div>

        {unlocked.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-[#2A2D37] bg-[#15161B] px-4 py-4 text-xs text-[#9397A5]">
            Tip: Go to <strong className="text-[#F1F2F6]">Currently</strong> and tap{' '}
            <strong className="text-[#F1F2F6]">+1</strong> on{' '}
            <strong className="text-[#F1F2F6]">Chainsaw Man</strong> (Ch. 7) or{' '}
            <strong className="text-[#F1F2F6]">Batman: The Court of Owls</strong> to watch an edition unlock automatically.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {unlocked.map(({ container, progress, isImplicit }) => (
              <button
                key={container.id}
                type="button"
                onClick={() => onOpenDetail(container.id)}
                className="flex items-center gap-3 rounded-2xl border border-[#30B884]/25 bg-[#15161B] p-3 text-left hover:border-[#30B884]/50 hover:bg-[#21242D] transition cursor-pointer"
              >
                <PosterArt container={container} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#F1F2F6]">
                    {container.title}
                  </p>
                  <p className="text-[11px] text-[#9397A5]">
                    {container.kindLabel} · {progress.total}/{progress.total}{' '}
                    {container.unitPlural}
                  </p>
                  {isImplicit ? (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-lg bg-[#30B884]/15 px-2 py-0.5 text-[10px] font-medium text-[#30B884]">
                      <Sparkles className="h-2.5 w-2.5" />
                      Implicitly unlocked
                    </span>
                  ) : (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-lg bg-[#252731] px-2 py-0.5 text-[10px] font-medium text-[#9397A5]">
                      <Check className="h-2.5 w-2.5" />
                      Completed
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Filter Tabs */}
      <div className="space-y-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium transition cursor-pointer ${
                  active
                    ? 'bg-[#E87151] text-white'
                    : 'border border-[#2A2D37] bg-[#15161B] text-[#9397A5] hover:text-[#F1F2F6] hover:bg-[#1B1D24]'
                }`}
              >
                <span>{t.label}</span>
                <span className={`tabular-nums ${active ? 'text-white/80' : 'text-[#646876]'}`}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#2A2D37] bg-[#15161B] px-6 py-12 text-center">
            <Package className="mx-auto h-8 w-8 text-[#646876]" />
            <p className="mt-3 text-sm font-medium text-[#9397A5]">
              No items in this shelf view yet.
            </p>
            <p className="mt-1 text-xs text-[#646876]">
              Open any item to mark it as Owned Physical, Owned Digital, Backlog, or Wishlist.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(({ container, progress, status }) => {
              const isPinned = activeBoardIds.has(container.id);
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
                  className="flex flex-col justify-between rounded-2xl border border-[#2A2D37] bg-[#1B1D24] p-4 hover:border-[#3A3E4C] hover:bg-[#21242D] transition cursor-pointer"
                >
                  <div className="flex gap-3.5">
                    <PosterArt container={container} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-[#9397A5]">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: dotColor }}
                        />
                        <span>{MEDIUM_LABELS[container.medium]}</span>
                        <span>·</span>
                        <span>{container.kindLabel}</span>
                      </div>
                      <h3 className="mt-0.5 truncate text-sm font-semibold text-[#F1F2F6]">
                        {container.title}
                      </h3>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {status !== 'none' && (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-[#303340] bg-[#252731] px-2 py-0.5 text-[10px] font-medium text-[#9397A5]">
                            <Bookmark className="h-2.5 w-2.5" />
                            {formatShelfLabel(status)}
                          </span>
                        )}
                        {progress.isComplete && (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-[#30B884]/30 bg-[#30B884]/15 px-2 py-0.5 text-[10px] font-medium text-[#30B884]">
                            <Check className="h-2.5 w-2.5" />
                            Completed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#23252F] pt-3">
                    <span className="tabular-nums text-xs text-[#9397A5]">
                      {progress.completed} / {progress.total} {container.unitPlural}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePinCurrently(container.id);
                      }}
                      className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                        isPinned
                          ? 'border border-[#303340] bg-[#252731] text-[#9397A5]'
                          : 'bg-[#E87151] text-white hover:bg-[#DC6242]'
                      }`}
                    >
                      {isPinned ? (
                        'On Currently'
                      ) : (
                        <>
                          <Plus className="h-3 w-3" />
                          Currently
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
