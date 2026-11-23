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
  embedded?: boolean;
  onOpenDetail: (containerId: string) => void;
  onTogglePinCurrently: (containerId: string) => void;
}

export function ShelfView({
  allContainers,
  atomsById,
  completedAtomIds,
  activeBoardIds,
  shelfById,
  embedded = false,
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
      label: 'All',
      count: itemsWithMeta.filter((i) => i.status !== 'none' || i.progress.isComplete)
        .length,
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
    <div className="space-y-5">
      {!embedded && (
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#F4F4F6]">
            Shelf & Unlocked Collections
          </h1>
          <p className="mt-1 text-sm text-[#8E8E98]">
            Ownership status stays independent of unit progress.
          </p>
        </div>
      )}

      {!embedded && (
        <section className="rounded-2xl border border-[#222229] bg-[#16161A] p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Award className="h-4 w-4 text-[#34D399]" />
              <h2 className="text-sm font-semibold text-[#F4F4F6]">
                Unlocked Collections
              </h2>
            </div>
            <span className="tabular-nums rounded-full border border-[#34D399]/30 bg-[#34D399]/12 px-2.5 py-0.5 text-xs font-semibold text-[#34D399]">
              {unlocked.length}
            </span>
          </div>

          {unlocked.length === 0 ? (
            <p className="text-xs text-[#63636D]">
              Complete all units in any tracker—or bundle linked trackers together—and finished editions unlock here automatically.
            </p>
          ) : (
            <div className="space-y-2">
              {unlocked.map(({ container, progress, isImplicit }) => (
                <button
                  key={container.id}
                  type="button"
                  onClick={() => onOpenDetail(container.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-[#34D399]/25 bg-[#111114] p-2.5 text-left hover:bg-[#1C1C22] transition cursor-pointer"
                >
                  <PosterArt container={container} size="xs" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#F4F4F6]">
                      {container.title}
                    </p>
                    <p className="text-[11px] text-[#8E8E98]">
                      {container.kindLabel} · {progress.total}/{progress.total}{' '}
                      {container.unitPlural}
                    </p>
                  </div>
                  {isImplicit && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#34D399]/12 px-2 py-0.5 text-[10px] font-medium text-[#34D399]">
                      <Sparkles className="h-2.5 w-2.5" />
                      Unlocked
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Filter Tabs */}
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                  active
                    ? 'bg-[#E87151] text-white'
                    : 'border border-[#222229] bg-[#16161A] text-[#8E8E98] hover:text-[#F4F4F6]'
                }`}
              >
                <span>{t.label}</span>
                <span className={`tabular-nums ${active ? 'text-white/80' : 'text-[#63636D]'}`}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#222229] bg-[#111114] px-6 py-10 text-center">
            <Package className="mx-auto h-7 w-7 text-[#63636D]" />
            <p className="mt-2.5 text-sm font-medium text-[#8E8E98]">
              No items in this shelf filter yet.
            </p>
            <p className="mt-1 text-xs text-[#63636D]">
              Open any item to mark it as Owned Physical, Owned Digital, Backlog, or Wishlist.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map(({ container, progress, status }) => {
              const isPinned = activeBoardIds.has(container.id);
              const dotColor = MEDIUM_COLORS[container.medium] ?? container.accentFrom;
              return (
                <article
                  key={container.id}
                  className="relative flex items-stretch overflow-hidden rounded-[18px] border border-[#1E1E24] bg-[#141417] min-h-[82px] hover:border-[#2A2A32] hover:bg-[#1A1A1F] transition"
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
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {status !== 'none' && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-[#2A2A32] bg-[#111114] px-2 py-0.5 text-[10px] font-medium text-[#8E8E98]">
                          <Bookmark className="h-2.5 w-2.5" />
                          {formatShelfLabel(status)}
                        </span>
                      )}
                      {progress.isComplete && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-[#34D399]/30 bg-[#34D399]/12 px-2 py-0.5 text-[10px] font-medium text-[#34D399]">
                          <Check className="h-2.5 w-2.5" />
                          Completed
                        </span>
                      )}
                    </div>
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
      </div>
    </div>
  );
}
