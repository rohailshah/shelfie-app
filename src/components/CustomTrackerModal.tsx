import { useEffect, useMemo, useState } from 'react';
import { Check, Link2, Plus, X } from 'lucide-react';
import { ContainerNode, Medium } from '../engine/types';
import { getMediumPreset, MEDIUM_LABELS, MEDIUM_PRESETS } from './mediaMeta';

export interface CreateCustomPayload {
  title: string;
  creator: string;
  medium: Medium;
  kindLabel: string;
  unitCount: number;
  unitPrefix: string;
  unitPlural: string;
  coverUrl?: string;
  customUnitTitles?: string[];
  linkedAtomIds?: string[];
}

interface CustomTrackerModalProps {
  isOpen: boolean;
  initialTitle?: string;
  existingContainers: ContainerNode[];
  onClose: () => void;
  onCreate: (payload: CreateCustomPayload) => void;
}

export function CustomTrackerModal({
  isOpen,
  initialTitle = '',
  existingContainers,
  onClose,
  onCreate,
}: CustomTrackerModalProps) {
  const [customTitle, setCustomTitle] = useState(initialTitle);
  const [customCreator, setCustomCreator] = useState('');
  const [customMedium, setCustomMedium] = useState<Medium>('game');
  const [customKindLabel, setCustomKindLabel] = useState('Game');
  const [customCoverUrl, setCustomCoverUrl] = useState('');
  const [customUnitCount, setCustomUnitCount] = useState(8);
  const [customUnitNamesText, setCustomUnitNamesText] = useState('');
  const [selectedContainerIds, setSelectedContainerIds] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setCustomTitle(initialTitle);
      setSelectedContainerIds([]);
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

  const linkedAtomIds = useMemo(() => {
    if (selectedContainerIds.length === 0) return [];
    const seen = new Set<string>();
    const combined: string[] = [];
    for (const id of selectedContainerIds) {
      const container = existingContainers.find((c) => c.id === id);
      if (!container) continue;
      for (const atomId of container.atomIds) {
        if (seen.has(atomId)) continue;
        seen.add(atomId);
        combined.push(atomId);
      }
    }
    return combined;
  }, [selectedContainerIds, existingContainers]);

  if (!isOpen) return null;

  const handleMediumSelect = (m: Medium) => {
    setCustomMedium(m);
    const preset = getMediumPreset(m);
    setCustomKindLabel(preset.defaultKindLabel);
  };

  const toggleBundleContainer = (id: string) => {
    setSelectedContainerIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
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

    const hasBundle = linkedAtomIds.length > 0;
    const count = hasBundle
      ? linkedAtomIds.length
      : lines.length > 0
        ? lines.length
        : Math.min(2000, Math.max(1, customUnitCount));

    onCreate({
      title: trimmedTitle,
      creator: customCreator.trim(),
      medium: customMedium,
      kindLabel: customKindLabel.trim() || preset.defaultKindLabel,
      unitCount: count,
      unitPrefix: preset.defaultUnitPrefix,
      unitPlural: preset.defaultUnitPlural,
      coverUrl: customCoverUrl.trim() || undefined,
      customUnitTitles: !hasBundle && lines.length > 0 ? lines : undefined,
      linkedAtomIds: hasBundle ? linkedAtomIds : undefined,
    });

    setCustomTitle('');
    setCustomCreator('');
    setCustomCoverUrl('');
    setCustomUnitNamesText('');
    setCustomUnitCount(8);
    setSelectedContainerIds([]);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-tracker-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border border-[#2A2D37] bg-[#1B1D24] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#23252F] px-6 py-4">
          <div>
            <h2 id="custom-tracker-title" className="text-lg font-bold text-[#F1F2F6]">
              Create Custom Tracker
            </h2>
            <p className="text-xs text-[#9397A5]">
              Break any title into units—or bundle existing trackers into an edition.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-xl border border-[#303340] bg-[#252731] p-2 text-[#9397A5] hover:text-[#F1F2F6] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <span className="block text-xs font-medium text-[#9397A5] mb-1.5">
              Medium
            </span>
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
            <label
              htmlFor="custom-tracker-name"
              className="block text-xs font-medium text-[#9397A5] mb-1"
            >
              Title
            </label>
            <input
              id="custom-tracker-name"
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
              <label
                htmlFor="custom-tracker-format"
                className="block text-xs font-medium text-[#9397A5] mb-1"
              >
                Edition / Format Label
              </label>
              <input
                id="custom-tracker-format"
                type="text"
                value={customKindLabel}
                onChange={(e) => setCustomKindLabel(e.target.value)}
                placeholder="TPB, Trilogy, Game..."
                className="w-full rounded-xl border border-[#2A2D37] bg-[#252731] px-3.5 py-2 text-sm text-[#F1F2F6] focus:border-[#E87151] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="custom-tracker-creator"
                className="block text-xs font-medium text-[#9397A5] mb-1"
              >
                Creator / Studio (optional)
              </label>
              <input
                id="custom-tracker-creator"
                type="text"
                value={customCreator}
                onChange={(e) => setCustomCreator(e.target.value)}
                placeholder="Capcom, Kirkman..."
                className="w-full rounded-xl border border-[#2A2D37] bg-[#252731] px-3.5 py-2 text-sm text-[#F1F2F6] placeholder:text-[#646876] focus:border-[#E87151] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="custom-tracker-cover"
              className="block text-xs font-medium text-[#9397A5] mb-1"
            >
              Cover Image URL (optional)
            </label>
            <input
              id="custom-tracker-cover"
              type="url"
              value={customCoverUrl}
              onChange={(e) => setCustomCoverUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-[#2A2D37] bg-[#252731] px-3.5 py-2 text-sm text-[#F1F2F6] placeholder:text-[#646876] focus:border-[#E87151] focus:outline-none"
            />
          </div>

          {existingContainers.length > 0 && (
            <div className="rounded-2xl border border-[#2A2D37] bg-[#15161B] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F1F2F6]">
                  <Link2 className="h-3.5 w-3.5 text-[#E87151]" />
                  Bundle / Link Existing Trackers (optional)
                </span>
                {linkedAtomIds.length > 0 && (
                  <span className="text-[11px] font-medium text-[#30B884] tabular-nums">
                    {linkedAtomIds.length} shared units
                  </span>
                )}
              </div>

              <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                {existingContainers.map((c) => {
                  const selected = selectedContainerIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleBundleContainer(c.id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-1.5 text-left text-xs transition cursor-pointer ${
                        selected
                          ? 'border-[#30B884]/40 bg-[#30B884]/12 text-[#F1F2F6]'
                          : 'border-[#2A2D37] bg-[#1B1D24] text-[#9397A5] hover:text-[#F1F2F6]'
                      }`}
                    >
                      <span className="truncate font-medium">{c.title}</span>
                      <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-[#646876]">
                        {c.atomIds.length} {c.unitPlural}
                        {selected && <Check className="h-3.5 w-3.5 text-[#30B884]" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {linkedAtomIds.length === 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="custom-tracker-count"
                  className="block text-xs font-medium text-[#9397A5] mb-1"
                >
                  Number of chunks
                </label>
                <input
                  id="custom-tracker-count"
                  type="number"
                  min={1}
                  max={2000}
                  value={customUnitCount}
                  onChange={(e) => setCustomUnitCount(Number(e.target.value) || 1)}
                  disabled={customUnitNamesText.trim().length > 0}
                  className="w-full rounded-xl border border-[#2A2D37] bg-[#252731] px-3.5 py-2 text-sm text-[#F1F2F6] tabular-nums disabled:opacity-50 focus:border-[#E87151] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="custom-tracker-units"
                  className="block text-xs font-medium text-[#9397A5] mb-1"
                >
                  Custom unit names (optional, one per line)
                </label>
                <textarea
                  id="custom-tracker-units"
                  rows={3}
                  value={customUnitNamesText}
                  onChange={(e) => setCustomUnitNamesText(e.target.value)}
                  placeholder={'Leave blank for auto-numbered chunks, or type:\nAct 1 · Village\nAct 2 · Castle'}
                  className="w-full rounded-xl border border-[#2A2D37] bg-[#252731] px-3 py-2 text-xs text-[#F1F2F6] placeholder:text-[#646876] focus:border-[#E87151] focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#23252F] bg-[#15161B] px-6 py-4">
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
