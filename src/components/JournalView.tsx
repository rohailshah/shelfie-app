import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Award,
  BookOpen,
  Check,
  Clock,
  Cloud,
  CloudOff,
  Copy,
  Download,
  Gamepad2,
  Link2,
  Loader2,
  Pencil,
  QrCode,
  RefreshCw,
  Smartphone,
  Sparkles,
  Trash2,
  Tv,
  Undo2,
  Upload,
} from 'lucide-react';
import {
  formatDateGroupLabel,
  formatRelativeTime,
  getContainerProgress,
  getUnlockedCollections,
} from '../engine/graph';
import { validateImportedState } from '../engine/storage';
import { buildPairingUrl, SyncStatus } from '../engine/sync';
import {
  AppState,
  AtomNode,
  ContainerNode,
  ProgressEntry,
  ShelfStatus,
  UserProfile,
} from '../engine/types';
import { MEDIUM_LABELS } from './mediaMeta';
import { PosterArt } from './PosterArt';
import { ShelfView } from './ShelfView';

type JournalSubTab = 'diary' | 'shelf' | 'unlocked';

const AVATAR_SWATCHES = ['#E87151', '#4D8CE8', '#34D399', '#7B6CE6', '#D99B43'];

interface JournalViewProps {
  appState: AppState;
  profile: UserProfile;
  progressMap: Record<string, ProgressEntry>;
  atomsById: Record<string, AtomNode>;
  containersById: Record<string, ContainerNode>;
  allContainers: ContainerNode[];
  completedAtomIds: Set<string>;
  activeBoardIds: Set<string>;
  shelfById: Record<string, ShelfStatus>;
  syncCode: string | null;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  syncError: string | null;
  onCreateSyncCode: () => Promise<string | null>;
  onPairSyncCode: (rawCode: string) => Promise<{ ok: boolean; message: string }>;
  onSyncNow: () => Promise<void>;
  onUnlinkSync: () => void;
  onUpdateProfile: (profile: UserProfile) => void;
  onUndoAtom: (atomId: string) => void;
  onOpenDetail: (containerId: string) => void;
  onTogglePinCurrently: (containerId: string) => void;
  onClearAllData: () => void;
  onImportState: (imported: AppState) => void;
}

function getProfileInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'MS';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export function JournalView({
  appState,
  profile,
  progressMap,
  atomsById,
  containersById,
  allContainers,
  completedAtomIds,
  activeBoardIds,
  shelfById,
  syncCode,
  syncStatus,
  lastSyncedAt,
  syncError,
  onCreateSyncCode,
  onPairSyncCode,
  onSyncNow,
  onUnlinkSync,
  onUpdateProfile,
  onUndoAtom,
  onOpenDetail,
  onTogglePinCurrently,
  onClearAllData,
  onImportState,
}: JournalViewProps) {
  const [subTab, setSubTab] = useState<JournalSubTab>('diary');
  const [editingProfile, setEditingProfile] = useState(false);
  const [draftName, setDraftName] = useState(profile.displayName);
  const [draftTagline, setDraftTagline] = useState(profile.tagline ?? '');
  const [draftColor, setDraftColor] = useState(profile.avatarColor);

  const [confirmReset, setConfirmReset] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync pairing UI states
  const [showPairInput, setShowPairInput] = useState(false);
  const [pairCodeInput, setPairCodeInput] = useState('');
  const [pairFeedback, setPairFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [creatingSync, setCreatingSync] = useState(false);
  const [pairingSync, setPairingSync] = useState(false);
  const [showQrPanel, setShowQrPanel] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copiedMode, setCopiedMode] = useState<'code' | 'link' | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  const pairingUrl = useMemo(() => {
    if (!syncCode || typeof window === 'undefined') return '';
    return buildPairingUrl(
      syncCode,
      window.location.origin,
      window.location.pathname
    );
  }, [syncCode]);

  useEffect(() => {
    if (!pairingUrl) {
      setQrDataUrl(null);
      return;
    }

    let cancelled = false;
    QRCode.toDataURL(pairingUrl, {
      width: 220,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [pairingUrl]);

  const handleCopyText = async (text: string, mode: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMode(mode);
      window.setTimeout(() => {
        setCopiedMode((curr) => (curr === mode ? null : curr));
      }, 2000);
    } catch {
      // Clipboard API unavailable in restricted contexts
    }
  };

  const handleStartSync = async () => {
    setCreatingSync(true);
    setPairFeedback(null);
    const created = await onCreateSyncCode();
    setCreatingSync(false);
    if (created) {
      setShowPairInput(false);
      setShowQrPanel(true);
    }
  };

  const handleSubmitPairCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setPairingSync(true);
    setPairFeedback(null);
    const res = await onPairSyncCode(pairCodeInput);
    setPairingSync(false);
    if (res.ok) {
      setPairCodeInput('');
      setShowPairInput(false);
      setPairFeedback({ type: 'success', message: res.message });
    } else {
      setPairFeedback({ type: 'error', message: res.message });
    }
  };

  const entries = useMemo(
    () =>
      Object.values(progressMap).sort(
        (a, b) =>
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
      ),
    [progressMap]
  );

  const unlocked = useMemo(
    () =>
      getUnlockedCollections(
        allContainers,
        completedAtomIds,
        atomsById,
        activeBoardIds
      ),
    [allContainers, completedAtomIds, atomsById, activeBoardIds]
  );

  const stats = useMemo(() => {
    let watchUnits = 0;
    let readUnits = 0;
    let playUnits = 0;

    let tvUnits = 0;
    let movieUnits = 0;
    let animeUnits = 0;
    let comicUnits = 0;
    let mangaUnits = 0;
    let bookUnits = 0;

    for (const entry of entries) {
      const atom = atomsById[entry.atomId];
      if (!atom) continue;
      if (atom.medium === 'tv') {
        watchUnits += 1;
        tvUnits += 1;
      } else if (atom.medium === 'movie') {
        watchUnits += 1;
        movieUnits += 1;
      } else if (atom.medium === 'anime') {
        watchUnits += 1;
        animeUnits += 1;
      } else if (atom.medium === 'comic') {
        readUnits += 1;
        comicUnits += 1;
      } else if (atom.medium === 'manga') {
        readUnits += 1;
        mangaUnits += 1;
      } else if (atom.medium === 'book') {
        readUnits += 1;
        bookUnits += 1;
      } else if (atom.medium === 'game') {
        playUnits += 1;
      }
    }

    let activeCount = 0;
    let completedCount = 0;
    for (const container of allContainers) {
      const prog = getContainerProgress(container, completedAtomIds, atomsById);
      if (prog.isComplete) completedCount += 1;
      else if (activeBoardIds.has(container.id)) activeCount += 1;
    }

    const totalPillarUnits = watchUnits + readUnits + playUnits;
    const watchPct =
      totalPillarUnits === 0 ? 0 : Math.round((watchUnits / totalPillarUnits) * 100);
    const readPct =
      totalPillarUnits === 0 ? 0 : Math.round((readUnits / totalPillarUnits) * 100);
    const playPct =
      totalPillarUnits === 0
        ? 0
        : Math.max(0, 100 - watchPct - readPct);

    return {
      watchUnits,
      readUnits,
      playUnits,
      tvUnits,
      movieUnits,
      animeUnits,
      comicUnits,
      mangaUnits,
      bookUnits,
      activeCount,
      completedCount,
      totalPillarUnits,
      watchPct,
      readPct,
      playPct,
    };
  }, [entries, atomsById, allContainers, completedAtomIds, activeBoardIds]);

  const groupedDiary = useMemo(() => {
    const groups: { label: string; items: ProgressEntry[] }[] = [];
    const indexByLabel = new Map<string, number>();

    for (const entry of entries) {
      if (!atomsById[entry.atomId]) continue;
      const label = formatDateGroupLabel(entry.completedAt);
      const existingIdx = indexByLabel.get(label);
      if (existingIdx !== undefined) {
        groups[existingIdx].items.push(entry);
      } else {
        indexByLabel.set(label, groups.length);
        groups.push({ label, items: [entry] });
      }
    }

    return groups;
  }, [entries, atomsById]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      ...profile,
      displayName: draftName.trim() || 'My Shelfie',
      tagline: draftTagline.trim() || undefined,
      avatarColor: draftColor,
    });
    setEditingProfile(false);
  };

  const handleExportJson = () => {
    const dateSlug = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(appState, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `shelfie-backup-${dateSlug}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const validated = validateImportedState(parsed);
      if (!validated) {
        setImportStatus({
          type: 'error',
          message: 'Invalid Shelfie backup JSON file.',
        });
        return;
      }
      onImportState(validated);
      setImportStatus({
        type: 'success',
        message: `Imported ${validated.customContainers.length} trackers and ${
          Object.keys(validated.progress).length
        } logged units.`,
      });
    } catch {
      setImportStatus({
        type: 'error',
        message: 'Could not parse JSON backup file.',
      });
    }
  };

  const joinedLabel = useMemo(() => {
    const d = new Date(profile.joinedAt);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }, [profile.joinedAt]);

  return (
    <div className="space-y-6">
      {/* Local Personal Profile Header (Zero Social) */}
      <section className="rounded-[18px] border border-[#1E1E24] bg-[#141417] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: profile.avatarColor }}
            >
              {getProfileInitials(profile.displayName)}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold tracking-tight text-[#F4F4F6]">
                {profile.displayName}
              </h1>
              {profile.tagline && (
                <p className="truncate text-xs text-[#8E8E98]">{profile.tagline}</p>
              )}
              <p className="mt-0.5 text-[11px] text-[#63636D]">
                {syncCode ? 'Cloud synced' : 'Private local log'}
                {joinedLabel ? ` · Tracking since ${joinedLabel}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setDraftName(profile.displayName);
              setDraftTagline(profile.tagline ?? '');
              setDraftColor(profile.avatarColor);
              setEditingProfile((prev) => !prev);
            }}
            aria-label="Edit local profile"
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
              editingProfile
                ? 'border-[#E87151] bg-[#E87151]/15 text-[#E87151]'
                : 'border-[#2A2A32] bg-[#111114] text-[#8E8E98] hover:text-[#F4F4F6]'
            }`}
          >
            <Pencil className="h-3 w-3" />
            <span>Edit</span>
          </button>
        </div>

        {editingProfile && (
          <form
            onSubmit={handleSaveProfile}
            className="mt-4 border-t border-[#222229] pt-4 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="profile-display-name"
                  className="block text-[11px] font-medium text-[#8E8E98] mb-1"
                >
                  Display Name
                </label>
                <input
                  id="profile-display-name"
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="w-full rounded-xl border border-[#26262E] bg-[#111114] px-3 py-1.5 text-sm text-[#F4F4F6] focus:border-[#E87151] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="profile-tagline"
                  className="block text-[11px] font-medium text-[#8E8E98] mb-1"
                >
                  Tagline
                </label>
                <input
                  id="profile-tagline"
                  type="text"
                  value={draftTagline}
                  onChange={(e) => setDraftTagline(e.target.value)}
                  placeholder="Personal Watch, Read & Play log"
                  className="w-full rounded-xl border border-[#26262E] bg-[#111114] px-3 py-1.5 text-sm text-[#F4F4F6] placeholder:text-[#63636D] focus:border-[#E87151] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#8E8E98]">Accent:</span>
                {AVATAR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    onClick={() => setDraftColor(swatch)}
                    aria-label={`Select color ${swatch}`}
                    className={`h-5 w-5 rounded-full transition cursor-pointer ${
                      draftColor === swatch ? 'ring-2 ring-white ring-offset-2 ring-offset-[#16161A]' : ''
                    }`}
                    style={{ backgroundColor: swatch }}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingProfile(false)}
                  className="rounded-xl border border-[#2A2A32] bg-[#111114] px-3 py-1.5 text-xs font-medium text-[#8E8E98] hover:text-[#F4F4F6] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#E87151] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#DC6242] cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>
          </form>
        )}
      </section>

      {/* Device Sync (No-Account Pairing & QR) */}
      <section className="rounded-[18px] border border-[#1E1E24] bg-[#141417] p-4 sm:p-5 space-y-3.5">
        {!syncCode ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#26262E] bg-[#111114] text-[#8E8E98]">
                  <Smartphone className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-[#F4F4F6]">Device Sync</h2>
                  <p className="mt-0.5 text-xs text-[#8E8E98]">
                    Sync Watch, Read & Play with your phone — no account needed.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleStartSync}
                disabled={creatingSync}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#E87151] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#DC6242] disabled:opacity-50 transition cursor-pointer"
              >
                {creatingSync ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <QrCode className="h-3.5 w-3.5" />
                )}
                Create Sync Code
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowPairInput((prev) => !prev);
                  setPairFeedback(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#2A2A32] bg-[#111114] px-3.5 py-2 text-xs font-medium text-[#D4D4DC] hover:bg-[#1C1C22] transition cursor-pointer"
              >
                <Link2 className="h-3.5 w-3.5 text-[#8E8E98]" />
                Pair with Code
              </button>
            </div>

            {showPairInput && (
              <form
                onSubmit={handleSubmitPairCode}
                className="rounded-2xl border border-[#222229] bg-[#111114] p-3 space-y-2.5"
              >
                <label
                  htmlFor="pair-sync-code-input"
                  className="block text-[11px] font-medium text-[#8E8E98]"
                >
                  Enter sync code from your other device
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="pair-sync-code-input"
                    type="text"
                    value={pairCodeInput}
                    onChange={(e) => setPairCodeInput(e.target.value.toUpperCase())}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    className="flex-1 min-w-0 rounded-xl border border-[#26262E] bg-[#141417] px-3 py-1.5 font-mono text-xs tracking-wider text-[#F4F4F6] placeholder:text-[#55555E] focus:border-[#E87151] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={pairingSync || !pairCodeInput.trim()}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#E87151] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#DC6242] disabled:opacity-50 transition cursor-pointer"
                  >
                    {pairingSync ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Link
                  </button>
                </div>
              </form>
            )}

            {(pairFeedback || syncError) && (
              <p
                className={`text-xs font-medium ${
                  pairFeedback?.type === 'success' ? 'text-[#34D399]' : 'text-[#C95252]'
                }`}
              >
                {pairFeedback?.message ?? syncError}
              </p>
            )}
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                    syncStatus === 'error'
                      ? 'border-[#C95252]/35 bg-[#C95252]/12 text-[#C95252]'
                      : 'border-[#34D399]/30 bg-[#34D399]/10 text-[#34D399]'
                  }`}
                >
                  {syncStatus === 'error' ? (
                    <CloudOff className="h-4 w-4" />
                  ) : (
                    <Cloud className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-[#F4F4F6]">
                    Cloud Sync Active
                  </h2>
                  <p
                    className={`mt-0.5 text-xs ${
                      syncStatus === 'error' ? 'text-[#C95252]' : 'text-[#8E8E98]'
                    }`}
                  >
                    {syncStatus === 'syncing'
                      ? 'Syncing...'
                      : syncStatus === 'error'
                        ? syncError || 'Sync failed — tap Sync Now to retry'
                        : lastSyncedAt
                          ? `Synced ${
                              formatRelativeTime(lastSyncedAt) === 'Just now'
                                ? 'just now'
                                : formatRelativeTime(lastSyncedAt).toLowerCase()
                            }`
                          : 'Ready to sync'}
                  </p>
                </div>
              </div>

              <span className="shrink-0 rounded-lg border border-[#26262E] bg-[#111114] px-2 py-1 font-mono text-[11px] text-[#8E8E98]">
                {syncCode.slice(0, 4)}…{syncCode.slice(-4)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowQrPanel((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  showQrPanel
                    ? 'bg-[#E87151] text-white'
                    : 'border border-[#2A2A32] bg-[#111114] text-[#F4F4F6] hover:bg-[#1C1C22]'
                }`}
              >
                <QrCode className="h-3.5 w-3.5" />
                Pair Phone / QR
              </button>

              <button
                type="button"
                onClick={() => void onSyncNow()}
                disabled={syncStatus === 'syncing'}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#2A2A32] bg-[#111114] px-3 py-1.5 text-xs font-medium text-[#D4D4DC] hover:bg-[#1C1C22] disabled:opacity-50 transition cursor-pointer"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 text-[#8E8E98] ${
                    syncStatus === 'syncing' ? 'animate-spin text-[#E87151]' : ''
                  }`}
                />
                Sync Now
              </button>

              {confirmUnlink ? (
                <div className="inline-flex items-center gap-2 rounded-xl border border-[#C95252]/35 bg-[#C95252]/10 px-3 py-1 text-xs">
                  <span className="text-[#F4F4F6]">Unlink this device?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onUnlinkSync();
                      setConfirmUnlink(false);
                      setShowQrPanel(false);
                    }}
                    className="rounded-lg bg-[#C95252] px-2 py-0.5 font-semibold text-white hover:opacity-90 cursor-pointer"
                  >
                    Unlink
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmUnlink(false)}
                    className="px-1.5 py-0.5 text-[#8E8E98] hover:text-[#F4F4F6] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmUnlink(true)}
                  className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs text-[#63636D] hover:text-[#C95252] transition cursor-pointer"
                >
                  Unlink
                </button>
              )}
            </div>

            {showQrPanel && (
              <div className="rounded-2xl border border-[#222229] bg-[#111114] p-4 flex flex-col sm:flex-row items-center gap-4">
                {qrDataUrl && (
                  <div className="shrink-0 rounded-2xl bg-white p-2.5 shadow-sm">
                    <img
                      src={qrDataUrl}
                      alt="Scan QR code to pair mobile device"
                      className="h-36 w-36 block"
                    />
                  </div>
                )}

                <div className="min-w-0 flex-1 space-y-2.5 text-center sm:text-left">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-[#63636D]">
                      Private Sync Code
                    </p>
                    <p
                      data-testid="sync-code-display"
                      className="mt-1 font-mono text-sm font-bold tracking-wider text-[#F4F4F6] break-all"
                    >
                      {syncCode}
                    </p>
                  </div>

                  <p className="text-xs text-[#8E8E98]">
                    Scan with your phone camera or open the link on mobile to sync automatically.
                  </p>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => void handleCopyText(syncCode, 'code')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#2A2A32] bg-[#141417] px-3 py-1.5 text-xs font-medium text-[#F4F4F6] hover:bg-[#1C1C22] transition cursor-pointer"
                    >
                      {copiedMode === 'code' ? (
                        <Check className="h-3.5 w-3.5 text-[#34D399]" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-[#8E8E98]" />
                      )}
                      {copiedMode === 'code' ? 'Copied!' : 'Copy Code'}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleCopyText(pairingUrl, 'link')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#2A2A32] bg-[#141417] px-3 py-1.5 text-xs font-medium text-[#F4F4F6] hover:bg-[#1C1C22] transition cursor-pointer"
                    >
                      {copiedMode === 'link' ? (
                        <Check className="h-3.5 w-3.5 text-[#34D399]" />
                      ) : (
                        <Link2 className="h-3.5 w-3.5 text-[#8E8E98]" />
                      )}
                      {copiedMode === 'link' ? 'Copied!' : 'Copy Link'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Stats Overview */}
      <section className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-[18px] border border-[#1E1E24] bg-[#141417] p-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#63636D]">
              Units Logged
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[#F4F4F6]">
              {entries.length}
            </p>
          </div>

          <div className="rounded-[18px] border border-[#1E1E24] bg-[#141417] p-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#63636D]">
              Completed
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[#34D399]">
              {stats.completedCount}
            </p>
          </div>

          <div className="rounded-[18px] border border-[#1E1E24] bg-[#141417] p-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#63636D]">
              Active
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[#F4F4F6]">
              {stats.activeCount}
            </p>
          </div>

          <div className="rounded-[18px] border border-[#34D399]/25 bg-[#34D399]/8 p-3.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#34D399] flex items-center gap-1">
              <Award className="h-3 w-3" />
              Unlocked
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[#34D399]">
              {unlocked.length}
            </p>
          </div>
        </div>

        {/* Watch / Read / Play Breakdown & Distribution Bar */}
        <div className="rounded-[18px] border border-[#1E1E24] bg-[#141417] p-4 space-y-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#F4F4F6]">Activity Mix</span>
            <span className="tabular-nums text-[#63636D]">
              {stats.totalPillarUnits} total logged
            </span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-[#111114] flex">
            {stats.totalPillarUnits > 0 ? (
              <>
                {stats.watchUnits > 0 && (
                  <div
                    className="h-full bg-[#4D8CE8]"
                    style={{ width: `${stats.watchPct}%` }}
                  />
                )}
                {stats.readUnits > 0 && (
                  <div
                    className="h-full bg-[#E87151]"
                    style={{ width: `${stats.readPct}%` }}
                  />
                )}
                {stats.playUnits > 0 && (
                  <div
                    className="h-full bg-[#7B6CE6]"
                    style={{ width: `${stats.playPct}%` }}
                  />
                )}
              </>
            ) : (
              <div className="h-full w-full bg-[#1D1D23]" />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="rounded-xl border border-[#222229] bg-[#111114] p-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F4F4F6]">
                  <Tv className="h-3.5 w-3.5 text-[#4D8CE8]" />
                  Watch
                </span>
                <span className="tabular-nums text-sm font-bold text-[#F4F4F6]">
                  {stats.watchUnits}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#63636D] tabular-nums">
                {stats.tvUnits} TV · {stats.movieUnits} Movies · {stats.animeUnits} Anime
              </p>
            </div>

            <div className="rounded-xl border border-[#222229] bg-[#111114] p-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F4F4F6]">
                  <BookOpen className="h-3.5 w-3.5 text-[#E87151]" />
                  Read
                </span>
                <span className="tabular-nums text-sm font-bold text-[#F4F4F6]">
                  {stats.readUnits}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#63636D] tabular-nums">
                {stats.comicUnits} Comics · {stats.mangaUnits} Manga · {stats.bookUnits}{' '}
                Books
              </p>
            </div>

            <div className="rounded-xl border border-[#222229] bg-[#111114] p-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F4F4F6]">
                  <Gamepad2 className="h-3.5 w-3.5 text-[#7B6CE6]" />
                  Play
                </span>
                <span className="tabular-nums text-sm font-bold text-[#F4F4F6]">
                  {stats.playUnits}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[#63636D] tabular-nums">
                {stats.playUnits} Game milestones
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Sub-tabs: Diary | Shelf | Unlocked */}
      <div className="space-y-4">
        <div className="inline-flex items-center gap-1 rounded-full border border-[#1E1E24] bg-[#141417] p-1">
          {(
            [
              { id: 'diary', label: 'Diary', count: entries.length },
              { id: 'shelf', label: 'Shelf' },
              { id: 'unlocked', label: 'Unlocked', count: unlocked.length },
            ] as { id: JournalSubTab; label: string; count?: number }[]
          ).map((tab) => {
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  active
                    ? 'bg-[#E87151] text-white'
                    : 'text-[#8E8E98] hover:text-[#F4F4F6]'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`tabular-nums text-[11px] ${
                      active ? 'text-white/80' : 'text-[#63636D]'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {subTab === 'diary' &&
          (groupedDiary.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#222229] bg-[#111114] px-6 py-12 text-center">
              <Clock className="mx-auto h-7 w-7 text-[#63636D]" />
              <p className="mt-3 text-sm font-medium text-[#8E8E98]">
                Your diary is empty.
              </p>
              <p className="mt-1 text-xs text-[#63636D]">
                Tap the check button on anything in Watch, Read, or Play to start logging.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {groupedDiary.map((group) => (
                <div key={group.label} className="space-y-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-[#63636D] px-1">
                    {group.label}
                  </h2>
                  <div className="space-y-2">
                    {group.items.map((entry) => {
                      const atom = atomsById[entry.atomId];
                      if (!atom) return null;

                      const parentContainer =
                        (entry.sourceContainerId &&
                          containersById[entry.sourceContainerId]) ||
                        allContainers.find((c) => c.atomIds.includes(atom.id));

                      return (
                        <article
                          key={entry.atomId}
                          className="group relative flex items-stretch overflow-hidden rounded-[18px] border border-[#18181D] bg-[#101013] min-h-[76px] hover:border-[#24242C] hover:bg-[#141418] transition"
                        >
                          {parentContainer && (
                            <button
                              type="button"
                              onClick={() => onOpenDetail(parentContainer.id)}
                              aria-label={`Open details for ${parentContainer.title}`}
                              className="absolute inset-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#E87151]/50 cursor-pointer"
                            />
                          )}

                          {parentContainer && (
                            <PosterArt
                              container={parentContainer}
                              variant="flush"
                              className="w-[54px] sm:w-[60px] opacity-65 saturate-75"
                            />
                          )}

                          <div className="min-w-0 flex-1 py-2.5 pl-3.5 pr-2 flex flex-col justify-center gap-0.5">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium text-[#D4D4DC]">
                                {parentContainer?.title ?? atom.title}
                              </p>
                              <span className="hidden sm:inline shrink-0 text-[11px] text-[#55555E]">
                                {formatRelativeTime(entry.completedAt)}
                              </span>
                            </div>
                            <p className="truncate text-xs text-[#8E8E98]">
                              {atom.subtitle ? `${atom.subtitle} · ` : ''}
                              {atom.title}
                            </p>
                            <p className="text-[11px] text-[#55555E]">
                              {MEDIUM_LABELS[atom.medium]}
                            </p>
                          </div>

                          <div className="relative z-10 flex items-center gap-2 pr-3.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => onUndoAtom(entry.atomId)}
                              aria-label={`Undo ${atom.title}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#2A2A32] bg-[#16161A] px-2.5 py-1 text-[11px] font-medium text-[#8E8E98] hover:text-[#F4F4F6] transition cursor-pointer"
                            >
                              <Undo2 className="h-3 w-3" />
                              <span className="hidden sm:inline">Undo</span>
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}

        {subTab === 'shelf' && (
          <ShelfView
            allContainers={allContainers}
            atomsById={atomsById}
            completedAtomIds={completedAtomIds}
            activeBoardIds={activeBoardIds}
            shelfById={shelfById}
            embedded
            onOpenDetail={onOpenDetail}
            onTogglePinCurrently={onTogglePinCurrently}
          />
        )}

        {subTab === 'unlocked' &&
          (unlocked.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#222229] bg-[#111114] px-6 py-10 text-center">
              <Award className="mx-auto h-7 w-7 text-[#63636D]" />
              <p className="mt-2.5 text-sm font-medium text-[#8E8E98]">
                No unlocked collections yet.
              </p>
              <p className="mt-1 text-xs text-[#63636D]">
                Finish all units in any series or linked edition to unlock it here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {unlocked.map(({ container, progress, isImplicit }) => (
                <button
                  key={container.id}
                  type="button"
                  onClick={() => onOpenDetail(container.id)}
                  className="flex w-full items-stretch overflow-hidden rounded-2xl border border-[#34D399]/25 bg-[#16161A] min-h-[82px] text-left hover:border-[#34D399]/50 hover:bg-[#1C1C22] transition cursor-pointer"
                >
                  <PosterArt
                    container={container}
                    variant="flush"
                    className="w-[60px] sm:w-[66px]"
                  />
                  <div className="min-w-0 flex-1 py-2.5 pl-3.5 pr-2 flex flex-col justify-center gap-0.5">
                    <p className="truncate text-[15px] font-semibold text-[#F4F4F6]">
                      {container.title}
                    </p>
                    <p className="text-xs text-[#8E8E98] tabular-nums">
                      {container.kindLabel} · {progress.total}/{progress.total}{' '}
                      {container.unitPlural}
                    </p>
                    <div className="mt-0.5">
                      {isImplicit ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#34D399]/12 px-2 py-0.5 text-[10px] font-medium text-[#34D399]">
                          <Sparkles className="h-2.5 w-2.5" />
                          Implicitly unlocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-[#1D1D23] px-2 py-0.5 text-[10px] font-medium text-[#8E8E98]">
                          <Check className="h-2.5 w-2.5 text-[#34D399]" />
                          Completed
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ))}
      </div>

      {/* Backup & Data Controls */}
      <div className="flex flex-col items-center gap-3 pt-2 border-t border-[#1B1B21]">
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#222229] bg-[#16161A] px-3.5 py-1.5 text-xs font-medium text-[#8E8E98] hover:text-[#F4F4F6] hover:bg-[#1C1C22] transition cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Export JSON
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#222229] bg-[#16161A] px-3.5 py-1.5 text-xs font-medium text-[#8E8E98] hover:text-[#F4F4F6] hover:bg-[#1C1C22] transition cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5" />
            Import JSON
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
          />

          {confirmReset ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-[#C95252]/40 bg-[#C95252]/10 px-3.5 py-1 text-xs">
              <span className="text-[#F4F4F6]">Clear all local data?</span>
              <button
                type="button"
                onClick={() => {
                  onClearAllData();
                  setConfirmReset(false);
                  setImportStatus(null);
                }}
                className="rounded-full bg-[#C95252] px-2.5 py-0.5 font-semibold text-white hover:opacity-90 cursor-pointer"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="rounded-full px-2 py-0.5 text-[#8E8E98] hover:text-[#F4F4F6] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-[#63636D] hover:bg-[#16161A] hover:text-[#C95252] transition cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear All Data
            </button>
          )}
        </div>

        {importStatus && (
          <p
            className={`text-xs font-medium ${
              importStatus.type === 'success' ? 'text-[#34D399]' : 'text-[#C95252]'
            }`}
          >
            {importStatus.message}
          </p>
        )}
      </div>
    </div>
  );
}
