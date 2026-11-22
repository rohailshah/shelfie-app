import { Sparkles, Undo2, X, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { RippleEvent } from '../engine/types';

interface RippleToastProps {
  ripple: RippleEvent | null;
  onUndo: (atomId: string) => void;
  onDismiss: () => void;
  onInspectContainer: (containerId: string) => void;
}

export function RippleToast({
  ripple,
  onUndo,
  onDismiss,
  onInspectContainer,
}: RippleToastProps) {
  if (!ripple) return null;

  const implicitCompleted = ripple.completedContainers.filter((c) => c.isImplicit);
  const directCompleted = ripple.completedContainers.filter((c) => !c.isImplicit);
  const firstOneLeft = ripple.oneLeftContainers[0];
  const firstAdvanced = ripple.advancedContainers[0];

  const hasMilestone =
    ripple.completedContainers.length > 0 || ripple.oneLeftContainers.length > 0;

  return (
    <div className="fixed bottom-20 sm:bottom-6 inset-x-4 z-50 flex justify-center pointer-events-none">
      <div className="pointer-events-auto animate-ripple-in w-full max-w-lg rounded-2xl border border-white/15 bg-zinc-900/90 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.75)] px-4 py-3.5">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
              hasMilestone
                ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300'
                : 'border-violet-400/30 bg-violet-500/15 text-violet-300'
            }`}
          >
            {hasMilestone ? <Sparkles className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-zinc-400">
              Logged <span className="text-zinc-100 font-semibold">{ripple.atomTitle}</span>
            </p>

            {/* Implicitly unlocked collections (the magic moment!) */}
            {implicitCompleted.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onInspectContainer(item.id)}
                className="mt-1 flex w-full items-center justify-between gap-2 rounded-lg bg-emerald-500/10 border border-emerald-400/20 px-2.5 py-1.5 text-left text-xs text-emerald-200 hover:bg-emerald-500/15 transition"
              >
                <span>
                  You also technically finished{' '}
                  <strong className="font-semibold text-white">{item.title}</strong>!
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
              </button>
            ))}

            {/* Direct container completion */}
            {directCompleted.map((item) => (
              <p key={item.id} className="mt-1 text-sm font-semibold text-white">
                Completed {item.title}!
              </p>
            ))}

            {/* 1 remaining milestone */}
            {firstOneLeft && (
              <button
                type="button"
                onClick={() => onInspectContainer(firstOneLeft.id)}
                className="mt-1 flex w-full items-center justify-between gap-2 rounded-lg bg-amber-500/10 border border-amber-400/20 px-2.5 py-1.5 text-left text-xs text-amber-200 hover:bg-amber-500/15 transition"
              >
                <span>
                  <strong className="font-semibold text-white">1 left</strong> to finish{' '}
                  <strong className="font-semibold text-white">{firstOneLeft.title}</strong> (
                  {firstOneLeft.nextAtomTitle})
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-amber-300" />
              </button>
            )}

            {/* Quiet ripple progress update for overlapping collections */}
            {firstAdvanced && (
              <button
                type="button"
                onClick={() => onInspectContainer(firstAdvanced.id)}
                className="mt-1 inline-flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white transition"
              >
                <span>
                  Also updated <strong className="font-medium text-white">{firstAdvanced.title}</strong>{' '}
                  <span className="tabular-nums text-zinc-400">
                    ({firstAdvanced.completed}/{firstAdvanced.total})
                  </span>
                </span>
                <ArrowUpRight className="h-3 w-3 text-zinc-400" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onUndo(ripple.atomId)}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              <Undo2 className="h-3 w-3" />
              Undo
            </button>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss notification"
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
