import { useState } from 'react';
import { Award, Bookmark, Check, Package, Plus, Sparkles } from 'lucide-react';
import { getContainerProgress, getUnlockedCollections } from '../engine/graph';
import { AtomNode, ContainerNode, ShelfStatus } from '../engine/types';
import { formatShelfLabel, MEDIUM_LABELS } from './mediaMeta';
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
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Shelf & Unlocked Collections
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          What you own stays separate from what you’ve read, watched, or played—plus every collection unlocked via sub-units.
        </p>
      </div>

      {/* Unlocked Collections Spotlight */}
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/10 via-zinc-900/70 to-zinc-950 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-500/15 text-emerald-300">
              <Award className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-white">
                Unlocked Collections
              </h2>
              <p className="text-xs text-zinc-400">
                Hardcovers, volumes, trades & trilogies reached 100% through logged units.
              </p>
            </div>
          </div>
          <span className="tabular-nums rounded-full border border-emerald-400/25 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
            {unlocked.length} unlocked
          </span>
        </div>

        {unlocked.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/25 px-4 py-5 text-xs text-zinc-400">
            Tip: Go to <strong className="text-zinc-200">Currently</strong> and tap{' '}
            <strong className="text-white">+1</strong> on <strong className="text-zinc-200">Chainsaw Man</strong> (Ch. 7)
            or <strong className="text-zinc-200">Batman: The Court of Owls</strong> to watch an edition unlock automatically!
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {unlocked.map(({ container, progress, isImplicit }) => (
              <button
                key={container.id}
                type="button"
                onClick={() => onOpenDetail(container.id)}
                className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-zinc-950/75 p-3 text-left hover:border-emerald-400/40 transition cursor-pointer"
              >
                <PosterArt container={container} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    {container.title}
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    {container.kindLabel} · {progress.total}/{progress.total}{' '}
                    {container.unitPlural}
                  </p>
                  {isImplicit ? (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                      <Sparkles className="h-2.5 w-2.5" />
                      Implicitly unlocked
                    </span>
                  ) : (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
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
                    ? 'bg-white text-zinc-950'
                    : 'border border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white hover:bg-white/[0.07]'
                }`}
              >
                <span>{t.label}</span>
                <span className={`tabular-nums ${active ? 'text-zinc-600' : 'text-zinc-500'}`}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-12 text-center">
            <Package className="mx-auto h-8 w-8 text-zinc-500" />
            <p className="mt-3 text-sm font-medium text-zinc-300">
              No items in this shelf view yet.
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Open any item to mark it as Owned Physical, Owned Digital, Backlog, or Wishlist.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(({ container, progress, status }) => {
              const isPinned = activeBoardIds.has(container.id);
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
                  className="flex flex-col justify-between rounded-3xl border border-white/10 bg-zinc-900/60 p-4 hover:border-white/20 hover:bg-zinc-900/80 transition cursor-pointer"
                >
                  <div className="flex gap-3.5">
                    <PosterArt container={container} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                        <span>{MEDIUM_LABELS[container.medium]}</span>
                        <span>·</span>
                        <span>{container.kindLabel}</span>
                      </div>
                      <h3 className="mt-0.5 truncate text-sm font-semibold text-white">
                        {container.title}
                      </h3>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {status !== 'none' && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                            <Bookmark className="h-2.5 w-2.5" />
                            {formatShelfLabel(status)}
                          </span>
                        )}
                        {progress.isComplete && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                            <Check className="h-2.5 w-2.5" />
                            Completed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
                    <span className="tabular-nums text-xs text-zinc-400">
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
                          ? 'border border-white/15 bg-white/10 text-zinc-200'
                          : 'bg-white text-zinc-950 hover:bg-zinc-200'
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
