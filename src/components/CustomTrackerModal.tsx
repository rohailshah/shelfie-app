import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Medium } from '../engine/types';
import { getMediumPreset, MEDIUM_LABELS, MEDIUM_PRESETS } from './mediaMeta';

export interface CreateCustomPayload {
  title: string;
  creator: string;
  medium: Medium;
  kindLabel: string;
  unitCount: number;
  unitPrefix: string;
  unitPlural: string;
  customUnitTitles?: string[];
}

interface CustomTrackerModalProps {
  isOpen: boolean;
  initialTitle?: string;
  onClose: () => void;
  onCreate: (payload: CreateCustomPayload) => void;
}

export function CustomTrackerModal({
  isOpen,
  initialTitle = '',
  onClose,
  onCreate,
}: CustomTrackerModalProps) {
  const [customTitle, setCustomTitle] = useState(initialTitle);
  const [customCreator, setCustomCreator] = useState('');
  const [customMedium, setCustomMedium] = useState<Medium>('game');
  const [customKindLabel, setCustomKindLabel] = useState('Game');
  const [customUnitCount, setCustomUnitCount] = useState(8);
  const [customUnitNamesText, setCustomUnitNamesText] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCustomTitle(initialTitle);
    }
  }, [isOpen, initialTitle]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleMediumSelect = (m: Medium) => {
    setCustomMedium(m);
    const preset = getMediumPreset(m);
    setCustomKindLabel(preset.defaultKindLabel);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = customTitle.trim();
    if (!trimmedTitle) return;

    const preset = getMediumPreset(customMedium);
    const lines = customUnitNamesText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const count =
      lines.length > 0 ? lines.length : Math.min(100, Math.max(1, customUnitCount));

    onCreate({
      title: trimmedTitle,
      creator: customCreator.trim(),
      medium: customMedium,
      kindLabel: customKindLabel.trim() || preset.defaultKindLabel,
      unitCount: count,
      unitPrefix: preset.defaultUnitPrefix,
      unitPlural: preset.defaultUnitPlural,
      customUnitTitles: lines.length > 0 ? lines : undefined,
    });

    setCustomTitle('');
    setCustomCreator('');
    setCustomUnitNamesText('');
    setCustomUnitCount(8);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-[#2A2D37] bg-[#1B1D24] p-6 shadow-2xl space-y-5"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#F1F2F6]">Create Custom Tracker</h2>
            <p className="text-xs text-[#9397A5]">
              Break any game, comic run, trilogy, book, or show into trackable chunks.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#303340] bg-[#252731] p-2 text-[#9397A5] hover:text-[#F1F2F6] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-[#9397A5] mb-1.5">
              Medium
            </label>
            <div className="flex flex-wrap gap-1.5">
              {MEDIUM_PRESETS.map((opt) => (
                <button
                  key={opt.medium}
                  type="button"
                  onClick={() => handleMediumSelect(opt.medium)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                    customMedium === opt.medium
                      ? 'bg-[#E87151] text-white'
                      : 'border border-[#303340] bg-[#252731] text-[#9397A5] hover:text-[#F1F2F6]'
                  }`}
                >
                  {MEDIUM_LABELS[opt.medium]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#9397A5] mb-1">
              Title
            </label>
            <input
              type="text"
              required
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="e.g., Resident Evil 4 Remake, Invincible Compendium 1..."
              className="w-full rounded-xl border border-[#2A2D37] bg-[#252731] px-3.5 py-2.5 text-sm text-[#F1F2F6] placeholder:text-[#646876] focus:border-[#E87151] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#9397A5] mb-1">
                Edition / Format Label
              </label>
              <input
                type="text"
                value={customKindLabel}
                onChange={(e) => setCustomKindLabel(e.target.value)}
                placeholder="TPB, Trilogy, Game..."
                className="w-full rounded-xl border border-[#2A2D37] bg-[#252731] px-3.5 py-2 text-sm text-[#F1F2F6] focus:border-[#E87151] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#9397A5] mb-1">
                Creator / Studio (optional)
              </label>
              <input
                type="text"
                value={customCreator}
                onChange={(e) => setCustomCreator(e.target.value)}
                placeholder="Capcom, Kirkman..."
                className="w-full rounded-xl border border-[#2A2D37] bg-[#252731] px-3.5 py-2 text-sm text-[#F1F2F6] placeholder:text-[#646876] focus:border-[#E87151] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#9397A5] mb-1">
                Number of chunks
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={customUnitCount}
                onChange={(e) => setCustomUnitCount(Number(e.target.value) || 1)}
                disabled={customUnitNamesText.trim().length > 0}
                className="w-full rounded-xl border border-[#2A2D37] bg-[#252731] px-3.5 py-2 text-sm text-[#F1F2F6] tabular-nums disabled:opacity-50 focus:border-[#E87151] focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#9397A5] mb-1">
                Custom unit names (optional, one per line)
              </label>
              <textarea
                rows={3}
                value={customUnitNamesText}
                onChange={(e) => setCustomUnitNamesText(e.target.value)}
                placeholder={'Leave blank for auto-numbered chunks, or type:\nAct 1 · Village\nAct 2 · Castle'}
                className="w-full rounded-xl border border-[#2A2D37] bg-[#252731] px-3 py-2 text-xs text-[#F1F2F6] placeholder:text-[#646876] focus:border-[#E87151] focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#303340] bg-[#252731] px-4 py-2 text-xs font-medium text-[#9397A5] hover:text-[#F1F2F6] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#E87151] px-4 py-2 text-xs font-semibold text-white hover:bg-[#DC6242] cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Add & Pin to Currently
          </button>
        </div>
      </form>
    </div>
  );
}
