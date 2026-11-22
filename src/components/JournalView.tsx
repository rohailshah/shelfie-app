import { useState } from 'react';
import { Award, BookOpen, Clock, Film, Gamepad2, RotateCcw, Undo2 } from 'lucide-react';
import { formatRelativeTime, getUnlockedCollections } from '../engine/graph';
import { AtomNode, ContainerNode, ProgressEntry } from '../engine/types';
import { MEDIUM_LABELS } from './mediaMeta';

interface JournalViewProps {
  progressMap: Record<string, ProgressEntry>;
  atomsById: Record<string, AtomNode>;
  containersById: Record<string, ContainerNode>;
  allContainers: ContainerNode[];
  completedAtomIds: Set<string>;
  activeBoardIds: Set<string>;
  onUndoAtom: (atomId: string) => void;
  onOpenDetail: (containerId: string) => void;
  onResetDemo: () => void;
}

export function JournalView({
  progressMap,
  atomsById,
  containersById,
  allContainers,
  completedAtomIds,
  activeBoardIds,
  onUndoAtom,
  onOpenDetail,
  onResetDemo,
}: JournalViewProps) {
  const [confirmReset, setConfirmReset] = useState(false);

  const entries = Object.values(progressMap).sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );

  const unlockedCount = getUnlockedCollections(
    allContainers,
    completedAtomIds,
    atomsById,
    activeBoardIds
  ).length;

  let watchCount = 0;
  let readCount = 0;
  let playCount = 0;

  for (const entry of entries) {
    const atom = atomsById[entry.atomId];
    if (!atom) continue;
    if (atom.medium === 'tv' || atom.medium === 'anime' || atom.medium === 'movie') {
      watchCount += 1;
    } else if (atom.medium === 'comic' || atom.medium === 'manga' || atom.medium === 'book') {
      readCount += 1;
    } else if (atom.medium === 'game') {
      playCount += 1;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Journal
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          One chronological diary across every issue, episode, film, chapter, and game chunk.
        </p>
      </div>

      {/* Compact Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Units Logged
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-white">
            {entries.length}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-300/80 flex items-center gap-1">
            <Award className="h-3 w-3" />
            Unlocked
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-300">
            {unlockedCount}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 flex items-center gap-1">
            <Film className="h-3 w-3" />
            Watch
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-white">{watchCount}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            Read
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-white">{readCount}</p>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 flex items-center gap-1">
            <Gamepad2 className="h-3 w-3" />
            Play
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-white">{playCount}</p>
        </div>
      </div>

      {/* Chronological Timeline */}
      {entries.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-12 text-center">
          <Clock className="mx-auto h-7 w-7 text-zinc-500" />
          <p className="mt-3 text-sm font-medium text-zinc-300">
            Your journal is empty.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Tap +1 on anything in Currently to start logging your timeline.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.06] overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/50 backdrop-blur-xl">
          {entries.map((entry) => {
            const atom = atomsById[entry.atomId];
            if (!atom) return null;

            const parentContainer =
              (entry.sourceContainerId && containersById[entry.sourceContainerId]) ||
              allContainers.find((c) => c.atomIds.includes(atom.id));

            return (
              <div
                key={entry.atomId}
                className="flex items-center justify-between gap-4 px-4 sm:px-5 py-3.5 hover:bg-white/[0.03] transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300">
                      {MEDIUM_LABELS[atom.medium]}
                    </span>
                    <p className="truncate text-sm font-medium text-white">
                      {atom.title}
                    </p>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    {parentContainer && (
                      <button
                        type="button"
                        onClick={() => onOpenDetail(parentContainer.id)}
                        className="text-zinc-400 hover:text-white transition cursor-pointer"
                      >
                        {parentContainer.title}
                      </button>
                    )}
                    <span>·</span>
                    <span>{formatRelativeTime(entry.completedAt)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onUndoAtom(entry.atomId)}
                  aria-label={`Undo ${atom.title}`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
                >
                  <Undo2 className="h-3 w-3" />
                  <span className="hidden sm:inline">Undo</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Subtle Reset Demo Data */}
      <div className="flex justify-center pt-4">
        {confirmReset ? (
          <div className="inline-flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs">
            <span className="text-rose-200">Reset all progress to default alpha demo?</span>
            <button
              type="button"
              onClick={() => {
                onResetDemo();
                setConfirmReset(false);
              }}
              className="rounded-lg bg-rose-500 px-2.5 py-1 font-semibold text-white hover:bg-rose-400 cursor-pointer"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="rounded-lg px-2 py-1 text-zinc-300 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Demo Data
          </button>
        )}
      </div>
    </div>
  );
}
