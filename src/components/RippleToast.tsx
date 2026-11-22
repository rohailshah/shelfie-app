import { ArrowUpRight, CheckCircle2, Sparkles, Undo2, X } from 'lucide-react';
import { RippleEvent } from '../engine/types';

interface RippleToastProps {
  ripple: RippleEvent | null;
  onUndo: (atomIds: string[]) => void;
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
    <div className="fixed bottom-20 sm:bottom-6 inset-x-4 z-[55] flex justify-center pointer-events-none">
      <div className="pointer-events-auto animate-ripple-in w-full max-w-lg rounded-2xl border border-[#2A2D37] bg-[#1B1D24] shadow-2xl px-4 py-3.5">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
              hasMilestone
                ? 'border-[#30B884]/30 bg-[#30B884]/15 text-[#30B884]'
                : 'border-[#303340] bg-[#252731] text-[#E87151]'
            }`}
          >
            {hasMilestone ? <Sparkles className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[#9397A5]">
              Logged <span className="text-[#F1F2F6] font-semibold">{ripple.atomTitle}</span>
            </p>

            {/* Implicitly unlocked collections */}
            {implicitCompleted.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onInspectContainer(item.id)}
                className="mt-1.5 flex w-full items-center justify-between gap-2 rounded-xl border border-[#30B884]/30 bg-[#30B884]/12 px-2.5 py-1.5 text-left text-xs text-[#F1F2F6] hover:bg-[#30B884]/20 transition cursor-pointer"
              >
                <span>
                  You also technically finished{' '}
                  <strong className="font-semibold text-[#30B884]">{item.title}</strong>!
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#30B884]" />
              </button>
            ))}

            {/* Direct container completion */}
            {directCompleted.map((item) => (
              <p key={item.id} className="mt-1 text-sm font-semibold text-[#30B884]">
                Completed {item.title}!
              </p>
            ))}

            {/* 1 remaining milestone */}
            {firstOneLeft && (
              <button
                type="button"
                onClick={() => onInspectContainer(firstOneLeft.id)}
                className="mt-1.5 flex w-full items-center justify-between gap-2 rounded-xl border border-[#D99B43]/30 bg-[#D99B43]/12 px-2.5 py-1.5 text-left text-xs text-[#F1F2F6] hover:bg-[#D99B43]/20 transition cursor-pointer"
              >
                <span>
                  <strong className="font-semibold text-[#D99B43]">1 left</strong> to finish{' '}
                  <strong className="font-semibold">{firstOneLeft.title}</strong> (
                  {firstOneLeft.nextAtomTitle})
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#D99B43]" />
              </button>
            )}

            {/* Quiet ripple progress update */}
            {firstAdvanced && (
              <button
                type="button"
                onClick={() => onInspectContainer(firstAdvanced.id)}
                className="mt-1 inline-flex items-center gap-1.5 text-xs text-[#9397A5] hover:text-[#F1F2F6] transition cursor-pointer"
              >
                <span>
                  Updated <strong className="font-medium text-[#F1F2F6]">{firstAdvanced.title}</strong>{' '}
                  <span className="tabular-nums text-[#646876]">
                    ({firstAdvanced.completed}/{firstAdvanced.total})
                  </span>
                </span>
                <ArrowUpRight className="h-3 w-3 text-[#646876]" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onUndo(ripple.atomIds ?? [ripple.atomId])}
              className="inline-flex items-center gap-1 rounded-xl border border-[#303340] bg-[#252731] px-2.5 py-1.5 text-xs font-medium text-[#F1F2F6] hover:bg-[#2E313D] transition cursor-pointer"
            >
              <Undo2 className="h-3 w-3" />
              Undo
            </button>
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss notification"
              className="rounded-xl p-1.5 text-[#646876] hover:bg-[#252731] hover:text-[#F1F2F6] transition cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
