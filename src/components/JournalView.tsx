import { useState } from 'react';
import { Award, BookOpen, Clock, Film, Gamepad2, RotateCcw, Undo2 } from 'lucide-react';
import { formatRelativeTime, getUnlockedCollections } from '../engine/graph';
import { AtomNode, ContainerNode, ProgressEntry } from '../engine/types';
import { MEDIUM_COLORS, MEDIUM_LABELS } from './mediaMeta';

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
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F1F2F6]">
          Journal
        </h1>
        <p className="mt-1 text-sm text-[#9397A5]">
          One chronological diary across every issue, episode, film, chapter, and game chunk.
        </p>
      </div>

      {/* Flat Matte Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-2xl border border-[#2A2D37] bg-[#1B1D24] p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#646876]">
            Units Logged
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[#F1F2F6]">
            {entries.length}
          </p>
        </div>

        <div className="rounded-2xl border border-[#30B884]/30 bg-[#30B884]/10 p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#30B884] flex items-center gap-1">
            <Award className="h-3 w-3" />
            Unlocked
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[#30B884]">
            {unlockedCount}
          </p>
        </div>

        <div className="rounded-2xl border border-[#2A2D37] bg-[#1B1D24] p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#9397A5] flex items-center gap-1">
            <Film className="h-3 w-3 text-[#4D8CE8]" />
            Watch
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[#F1F2F6]">{watchCount}</p>
        </div>

        <div className="rounded-2xl border border-[#2A2D37] bg-[#1B1D24] p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#9397A5] flex items-center gap-1">
            <BookOpen className="h-3 w-3 text-[#E87151]" />
            Read
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[#F1F2F6]">{readCount}</p>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded-2xl border border-[#2A2D37] bg-[#1B1D24] p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#9397A5] flex items-center gap-1">
            <Gamepad2 className="h-3 w-3 text-[#7B6CE6]" />
            Play
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[#F1F2F6]">{playCount}</p>
        </div>
      </div>

      {/* Chronological Timeline */}
      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#2A2D37] bg-[#15161B] px-6 py-12 text-center">
          <Clock className="mx-auto h-7 w-7 text-[#646876]" />
          <p className="mt-3 text-sm font-medium text-[#9397A5]">
            Your journal is empty.
          </p>
          <p className="mt-1 text-xs text-[#646876]">
            Tap +1 on anything in Currently to start logging your timeline.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#23252F] overflow-hidden rounded-2xl border border-[#2A2D37] bg-[#1B1D24]">
          {entries.map((entry) => {
            const atom = atomsById[entry.atomId];
            if (!atom) return null;

            const parentContainer =
              (entry.sourceContainerId && containersById[entry.sourceContainerId]) ||
              allContainers.find((c) => c.atomIds.includes(atom.id));

            return (
              <div
                key={entry.atomId}
                className="flex items-center justify-between gap-4 px-4 sm:px-5 py-3.5 hover:bg-[#21242D] transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-[#303340] bg-[#252731] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#9397A5]">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: MEDIUM_COLORS[atom.medium] }}
                      />
                      {MEDIUM_LABELS[atom.medium]}
                    </span>
                    <p className="truncate text-sm font-medium text-[#F1F2F6]">
                      {atom.title}
                    </p>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#646876]">
                    {parentContainer && (
                      <button
                        type="button"
                        onClick={() => onOpenDetail(parentContainer.id)}
                        className="text-[#9397A5] hover:text-[#F1F2F6] transition cursor-pointer"
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
                  className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[#303340] bg-[#252731] px-2.5 py-1.5 text-xs font-medium text-[#9397A5] hover:text-[#F1F2F6] transition cursor-pointer"
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
          <div className="inline-flex items-center gap-2 rounded-2xl border border-[#C95252]/40 bg-[#C95252]/10 px-4 py-2 text-xs">
            <span className="text-[#F1F2F6]">Reset all progress to default alpha demo?</span>
            <button
              type="button"
              onClick={() => {
                onResetDemo();
                setConfirmReset(false);
              }}
              className="rounded-lg bg-[#C95252] px-2.5 py-1 font-semibold text-white hover:opacity-90 cursor-pointer"
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="rounded-lg px-2 py-1 text-[#9397A5] hover:text-[#F1F2F6] cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs text-[#646876] hover:bg-[#1B1D24] hover:text-[#9397A5] transition cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Demo Data
          </button>
        )}
      </div>
    </div>
  );
}
