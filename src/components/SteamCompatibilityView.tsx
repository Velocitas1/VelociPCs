import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Cpu,
  Edit3,
  ExternalLink,
  Gamepad2,
  HardDrive,
  Laptop,
  Layers,
  Loader2,
  Monitor,
  Pause,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Wrench,
} from 'lucide-react';
import type { SteamGameOverridePatch } from '../hooks/useInventory';
import {
  COMPAT_STATUS_META,
  extractHtmlLines,
  formatGbSpec,
  formatPlaytime,
  getEffectiveRigProfile,
  getRequiredDirectXRank,
  summarizeRigCompatibility,
} from '../lib/steamCompatibility';
import { supabase } from '../lib/supabase';
import type {
  BuildGameCompatibility,
  CompatibilityStatus,
  ComputerWithRelations,
  SteamGame,
} from '../types/database';
import { DirectXBadge } from './DirectXBadge';
import { SteamOverrideModal } from './SteamOverrideModal';

interface SteamCompatibilityViewProps {
  computers: ComputerWithRelations[];
  steamGames: SteamGame[];
  compatibilityRows: BuildGameCompatibility[];
  isOwner: boolean;
  initialRigId?: number | null;
  onConsumeInitialRigId?: () => void;
  onRefreshSteam: () => Promise<void>;
  onSaveOverride: (
    appId: number,
    patch: SteamGameOverridePatch,
  ) => Promise<void>;
  onResetOverride: (game: SteamGame) => Promise<void>;
  onReevaluateAll: () => Promise<{
    computersEvaluated: number;
    gamesEvaluated: number;
    rowsUpserted: number;
  }>;
  onSelectComputer?: (rig: ComputerWithRelations) => void;
  onNotify?: (msg: string) => void;
}

type ViewMode = 'by_rig' | 'by_game';
type SortMode = 'playtime' | 'status' | 'title' | 'directx' | 'storage';

const STEAM_ID_STORAGE_KEY = 'velocipcs_steam_id_input';
const PAGE_SIZE = 60;

const STATUS_FILTER_ORDER: Array<'all' | CompatibilityStatus> = [
  'all',
  'playable',
  'minimum',
  'blocked_directx',
  'blocked_vram',
  'blocked_ram',
  'blocked_storage',
  'unknown',
];

function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function GameCoverThumb({
  url,
  title,
  compact = false,
}: {
  url: string | null | undefined;
  title: string;
  compact?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const safeSrc = safeHttpUrl(url);

  if (!safeSrc || failed) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-500 ${
          compact ? 'h-9 w-16' : 'h-14 w-28'
        }`}
      >
        <Gamepad2 className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
      </div>
    );
  }

  return (
    <img
      src={safeSrc}
      alt={title}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-lg border border-slate-800 bg-slate-950 object-cover ${
        compact ? 'h-9 w-16' : 'h-14 w-28'
      }`}
    />
  );
}

export function SteamCompatibilityView({
  computers,
  steamGames,
  compatibilityRows,
  isOwner,
  initialRigId,
  onConsumeInitialRigId,
  onRefreshSteam,
  onSaveOverride,
  onResetOverride,
  onReevaluateAll,
  onSelectComputer,
  onNotify,
}: SteamCompatibilityViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('by_rig');
  const [selectedRigId, setSelectedRigId] = useState<number | ''>(
    () => initialRigId ?? computers[0]?.id ?? '',
  );
  const [selectedGameId, setSelectedGameId] = useState<number | null>(
    () => steamGames[0]?.app_id ?? null,
  );
  const [statusFilter, setStatusFilter] = useState<'all' | CompatibilityStatus>(
    'all',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('playtime');
  const [overridesOnly, setOverridesOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [expandedRawIds, setExpandedRawIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [editingGame, setEditingGame] = useState<SteamGame | null>(null);

  // Sync state
  const [steamInput, setSteamInput] = useState(() => {
    try {
      return window.localStorage.getItem(STEAM_ID_STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [includeFreeGames, setIncludeFreeGames] = useState(false);
  const [forceResync, setForceResync] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [reevaluating, setReevaluating] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    phase: 'library' | 'details' | 'cooldown';
    processed: number;
    total: number;
    remaining: number;
    message: string;
  } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const pauseRequestedRef = useRef(false);

  // Consume initialRigId when jumping from ComputerDetailModal
  useEffect(() => {
    if (initialRigId) {
      setSelectedRigId(initialRigId);
      setViewMode('by_rig');
      onConsumeInitialRigId?.();
    }
  }, [initialRigId, onConsumeInitialRigId]);

  useEffect(() => {
    if (steamGames.length > 0 && selectedGameId === null) {
      setSelectedGameId(steamGames[0].app_id);
    }
  }, [steamGames, selectedGameId]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedRigId, statusFilter, searchQuery, sortMode, overridesOnly, viewMode]);

  const handleSteamInputChange = (value: string) => {
    setSteamInput(value);
    try {
      window.localStorage.setItem(STEAM_ID_STORAGE_KEY, value);
    } catch {
      // Ignore storage quota / private mode issues
    }
  };

  const selectedRig = useMemo(
    () =>
      computers.find((c) => c.id === selectedRigId) ?? computers[0] ?? null,
    [computers, selectedRigId],
  );

  const selectedRigProfile = useMemo(
    () => (selectedRig ? getEffectiveRigProfile(selectedRig) : null),
    [selectedRig],
  );

  const gameById = useMemo(() => {
    const map = new Map<number, SteamGame>();
    for (const g of steamGames) map.set(g.app_id, g);
    return map;
  }, [steamGames]);

  const compatByRigAndApp = useMemo(() => {
    const map = new Map<string, BuildGameCompatibility>();
    for (const row of compatibilityRows) {
      map.set(`${row.computer_id}:${row.steam_app_id}`, row);
    }
    return map;
  }, [compatibilityRows]);

  const rigAllCompatRows = useMemo(() => {
    if (!selectedRig) return [];
    return compatibilityRows.filter((r) => r.computer_id === selectedRig.id);
  }, [compatibilityRows, selectedRig]);

  const rigSummary = useMemo(
    () => summarizeRigCompatibility(rigAllCompatRows),
    [rigAllCompatRows],
  );

  const libraryStats = useMemo(() => {
    let pending = 0;
    let overrides = 0;
    let latestSync: string | null = null;
    for (const g of steamGames) {
      if (
        !g.manual_override &&
        (g.requirements_status === 'pending' ||
          g.requirements_status === 'error')
      ) {
        pending += 1;
      }
      if (g.manual_override) overrides += 1;
      if (g.last_synced_at && (!latestSync || g.last_synced_at > latestSync)) {
        latestSync = g.last_synced_at;
      }
    }
    return { total: steamGames.length, pending, overrides, latestSync };
  }, [steamGames]);

  const filteredRigEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const joined = rigAllCompatRows
      .map((row) => ({
        row,
        game: gameById.get(row.steam_app_id) ?? null,
      }))
      .filter((item): item is { row: BuildGameCompatibility; game: SteamGame } =>
        Boolean(item.game),
      )
      .filter((item) => {
        if (statusFilter !== 'all' && item.row.status !== statusFilter) {
          return false;
        }
        if (overridesOnly && !item.game.manual_override) {
          return false;
        }
        if (q) {
          const matchesTitle = item.game.title.toLowerCase().includes(q);
          const matchesAppId = String(item.game.app_id).includes(q);
          if (!matchesTitle && !matchesAppId) return false;
        }
        return true;
      });

    joined.sort((a, b) => {
      if (sortMode === 'playtime') {
        const diff = b.game.playtime_minutes - a.game.playtime_minutes;
        if (diff !== 0) return diff;
        return a.game.title.localeCompare(b.game.title);
      }
      if (sortMode === 'status') {
        const orderDiff =
          COMPAT_STATUS_META[a.row.status].sortOrder -
          COMPAT_STATUS_META[b.row.status].sortOrder;
        if (orderDiff !== 0) return orderDiff;
        return b.game.playtime_minutes - a.game.playtime_minutes;
      }
      if (sortMode === 'directx') {
        const dxDiff =
          getRequiredDirectXRank(b.game.min_directx) -
          getRequiredDirectXRank(a.game.min_directx);
        if (dxDiff !== 0) return dxDiff;
        return a.game.title.localeCompare(b.game.title);
      }
      if (sortMode === 'storage') {
        const stDiff = (b.game.storage_gb ?? 0) - (a.game.storage_gb ?? 0);
        if (stDiff !== 0) return stDiff;
        return a.game.title.localeCompare(b.game.title);
      }
      return a.game.title.localeCompare(b.game.title);
    });

    return joined;
  }, [
    rigAllCompatRows,
    gameById,
    statusFilter,
    overridesOnly,
    searchQuery,
    sortMode,
  ]);

  // By-Game fleet stats
  const playableCountByAppId = useMemo(() => {
    const map = new Map<number, number>();
    for (const row of compatibilityRows) {
      if (row.status === 'playable' || row.status === 'minimum') {
        map.set(row.steam_app_id, (map.get(row.steam_app_id) ?? 0) + 1);
      }
    }
    return map;
  }, [compatibilityRows]);

  const filteredGamesList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = steamGames.filter((g) => {
      if (overridesOnly && !g.manual_override) return false;
      if (q) {
        return (
          g.title.toLowerCase().includes(q) || String(g.app_id).includes(q)
        );
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortMode === 'playtime') {
        const diff = b.playtime_minutes - a.playtime_minutes;
        if (diff !== 0) return diff;
      } else if (sortMode === 'directx') {
        const diff =
          getRequiredDirectXRank(b.min_directx) -
          getRequiredDirectXRank(a.min_directx);
        if (diff !== 0) return diff;
      } else if (sortMode === 'storage') {
        const diff = (b.storage_gb ?? 0) - (a.storage_gb ?? 0);
        if (diff !== 0) return diff;
      }
      return a.title.localeCompare(b.title);
    });
    return list;
  }, [steamGames, searchQuery, overridesOnly, sortMode]);

  const selectedGame = useMemo(
    () =>
      (selectedGameId !== null ? gameById.get(selectedGameId) : null) ??
      filteredGamesList[0] ??
      steamGames[0] ??
      null,
    [selectedGameId, gameById, filteredGamesList, steamGames],
  );

  const selectedGameRigMatrix = useMemo(() => {
    if (!selectedGame) return [];
    return computers
      .map((rig) => ({
        rig,
        profile: getEffectiveRigProfile(rig),
        compat:
          compatByRigAndApp.get(`${rig.id}:${selectedGame.app_id}`) ?? null,
      }))
      .sort((a, b) => {
        const sa = a.compat
          ? COMPAT_STATUS_META[a.compat.status].sortOrder
          : 99;
        const sb = b.compat
          ? COMPAT_STATUS_META[b.compat.status].sortOrder
          : 99;
        if (sa !== sb) return sa - sb;
        return a.rig.name.localeCompare(b.rig.name);
      });
  }, [selectedGame, computers, compatByRigAndApp]);

  const runBatchSyncLoop = async (
    initialTotalToSync: number,
    options: { force: boolean; cursorSyncBefore?: string },
  ) => {
    let processedSoFar = 0;
    let batchCounter = 0;

    while (!pauseRequestedRef.current) {
      const { data, error } = await supabase.functions.invoke(
        'sync-steam-library',
        {
          body: {
            action: 'sync_batch',
            batchSize: 12,
            forceResync: options.force,
            cursorSyncBefore: options.cursorSyncBefore,
          },
        },
      );

      if (error) throw error;
      const res = data as {
        status?: string;
        error?: string;
        processed?: number;
        rateLimited?: boolean;
        retryAfterMs?: number;
        remainingPending?: number;
        batchTitles?: string[];
      };

      if (res.status === 'error') {
        throw new Error(res.error || 'Steam batch sync failed.');
      }

      const batchProcessed = res.processed ?? 0;
      const remaining = res.remainingPending ?? 0;
      processedSoFar += batchProcessed;
      batchCounter += 1;

      const totalEstimate = Math.max(
        initialTotalToSync,
        processedSoFar + remaining,
      );

      if (batchCounter % 3 === 0) {
        await onRefreshSteam();
      }

      if (res.rateLimited) {
        const waitSec = Math.ceil((res.retryAfterMs ?? 15000) / 1000);
        for (let s = waitSec; s > 0; s -= 1) {
          if (pauseRequestedRef.current) break;
          setSyncProgress({
            phase: 'cooldown',
            processed: processedSoFar,
            total: totalEstimate,
            remaining,
            message: `Steam rate limit hit — resuming politely in ${s}s...`,
          });
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        continue;
      }

      const previewTitle =
        res.batchTitles && res.batchTitles.length > 0
          ? res.batchTitles[res.batchTitles.length - 1]
          : null;

      setSyncProgress({
        phase: 'details',
        processed: processedSoFar,
        total: totalEstimate,
        remaining,
        message: previewTitle
          ? `Synced ${processedSoFar} of ${totalEstimate} · Latest: ${previewTitle}`
          : `Synced ${processedSoFar} of ${totalEstimate}`,
      });

      if (remaining <= 0 || batchProcessed === 0) {
        break;
      }
    }
  };

  const handleStartSync = async (resumeOnly: boolean) => {
    setSyncError(null);
    pauseRequestedRef.current = false;
    setSyncing(true);

    try {
      let totalTarget = libraryStats.pending;
      const cursorIso = forceResync ? new Date().toISOString() : undefined;

      if (!resumeOnly) {
        if (!steamInput.trim()) {
          throw new Error(
            'Enter your SteamID64, custom vanity URL name, or Steam profile URL first.',
          );
        }

        setSyncProgress({
          phase: 'library',
          processed: 0,
          total: 0,
          remaining: 0,
          message: 'Fetching owned Steam games list...',
        });

        const { data: libData, error: libErr } =
          await supabase.functions.invoke('sync-steam-library', {
            body: {
              action: 'fetch_library',
              steamInput: steamInput.trim(),
              includeFreeGames,
            },
          });

        if (libErr) throw libErr;
        const libRes = libData as {
          status?: string;
          error?: string;
          totalOwned?: number;
          newGamesCount?: number;
          pendingCount?: number;
          manualOverrideCount?: number;
        };

        if (libRes.status === 'error') {
          throw new Error(libRes.error || 'Failed to fetch Steam library.');
        }

        totalTarget = forceResync
          ? Math.max(
              0,
              (libRes.totalOwned ?? 0) - (libRes.manualOverrideCount ?? 0),
            )
          : (libRes.pendingCount ?? 0);

        await onRefreshSteam();

        if (totalTarget === 0) {
          onNotify?.(
            `Library refreshed (${libRes.totalOwned ?? 0} titles, all specs already synced).`,
          );
          setSyncProgress(null);
          return;
        }

        setSyncProgress({
          phase: 'details',
          processed: 0,
          total: totalTarget,
          remaining: totalTarget,
          message: `Found ${libRes.totalOwned ?? 0} owned games (${
            libRes.newGamesCount ?? 0
          } new). Syncing PC requirements...`,
        });
      } else {
        totalTarget = forceResync
          ? Math.max(0, libraryStats.total - libraryStats.overrides)
          : libraryStats.pending;
      }

      await runBatchSyncLoop(totalTarget, {
        force: forceResync,
        cursorSyncBefore: cursorIso,
      });

      await onRefreshSteam();

      if (pauseRequestedRef.current) {
        onNotify?.('Steam sync paused — you can resume anytime.');
      } else {
        onNotify?.('Steam library sync & rig evaluation complete.');
      }
      setSyncProgress(null);
    } catch (err) {
      setSyncError(
        err instanceof Error
          ? err.message
          : 'Unable to sync Steam library. Verify your Steam privacy settings and Edge Function secrets.',
      );
    } finally {
      setSyncing(false);
    }
  };

  const handlePauseSync = () => {
    pauseRequestedRef.current = true;
  };

  const handleReevaluateAll = async () => {
    setSyncError(null);
    setReevaluating(true);
    try {
      const summary = await onReevaluateAll();
      onNotify?.(
        `Evaluated ${summary.gamesEvaluated} games across ${summary.computersEvaluated} rigs.`,
      );
    } catch (err) {
      setSyncError(
        err instanceof Error
          ? err.message
          : 'Failed to re-evaluate compatibility across rigs.',
      );
    } finally {
      setReevaluating(false);
    }
  };

  const toggleRawExpanded = (appId: number) => {
    setExpandedRawIds((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) {
        next.delete(appId);
      } else {
        next.add(appId);
      }
      return next;
    });
  };

  const progressPct =
    syncProgress && syncProgress.total > 0
      ? Math.min(
          100,
          Math.round((syncProgress.processed / syncProgress.total) * 100),
        )
      : 0;

  return (
    <div className="space-y-5">
      {/* Steam Sync & Header Card */}
      <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-slate-900 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-300">
                <Sparkles className="h-3 w-3" />
                Live Steam Integration
              </div>
              <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-0.5 font-mono text-[11px] text-slate-300">
                {libraryStats.total} Games
              </span>
              {libraryStats.pending > 0 ? (
                <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 font-mono text-[11px] text-amber-300">
                  {libraryStats.pending} Pending Specs
                </span>
              ) : null}
              {libraryStats.overrides > 0 ? (
                <span className="rounded-full border border-violet-500/40 bg-violet-500/15 px-2.5 py-0.5 font-mono text-[11px] text-violet-300">
                  {libraryStats.overrides} Manual Overrides
                </span>
              ) : null}
            </div>
            <h2 className="mt-2 flex items-center gap-2 text-lg font-bold text-white">
              <Gamepad2 className="h-5 w-5 text-cyan-400" />
              Steam Library Compatibility Matcher
            </h2>
            <p className="mt-1 max-w-2xl text-xs text-slate-300">
              Evaluates every owned Steam title against each rig&apos;s DirectX
              tier (including iGPU fallback), VRAM, system RAM, and largest
              storage drive.
              {libraryStats.latestSync ? (
                <span className="ml-1.5 text-slate-400">
                  Last synced{' '}
                  {new Date(libraryStats.latestSync).toLocaleDateString()}.
                </span>
              ) : null}
            </p>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/90 p-1">
            <button
              type="button"
              onClick={() => setViewMode('by_rig')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === 'by_rig'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
              By Rig
            </button>
            <button
              type="button"
              onClick={() => setViewMode('by_game')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === 'by_game'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              By Game (Fleet)
            </button>
          </div>
        </div>

        {/* Owner-Only Sync Controls */}
        {isOwner ? (
          <div className="mt-4 space-y-3 border-t border-cyan-500/20 pt-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[260px] flex-1">
                <label className="mb-1 block text-[11px] font-medium text-slate-300">
                  SteamID64, Vanity Name, or Profile URL (saved privately in
                  this browser)
                </label>
                <input
                  type="text"
                  value={steamInput}
                  onChange={(e) => handleSteamInputChange(e.target.value)}
                  disabled={syncing}
                  placeholder="e.g. 76561198000000000 or https://steamcommunity.com/id/yourname"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-500 disabled:opacity-60"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {syncing ? (
                  <button
                    type="button"
                    onClick={handlePauseSync}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3.5 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/25"
                  >
                    <Pause className="h-3.5 w-3.5" />
                    Pause Sync
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleStartSync(false)}
                      disabled={reevaluating}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Sync Steam Library
                    </button>

                    {libraryStats.pending > 0 ? (
                      <button
                        type="button"
                        onClick={() => void handleStartSync(true)}
                        disabled={reevaluating}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3.5 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-60"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Resume Pending ({libraryStats.pending})
                      </button>
                    ) : null}

                    {libraryStats.total > 0 ? (
                      <button
                        type="button"
                        onClick={() => void handleReevaluateAll()}
                        disabled={reevaluating}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:border-cyan-500/50 hover:text-white disabled:opacity-60"
                      >
                        {reevaluating ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5 text-cyan-400" />
                        )}
                        Re-evaluate All Rigs
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-300">
              <label className="inline-flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={includeFreeGames}
                  onChange={(e) => setIncludeFreeGames(e.target.checked)}
                  disabled={syncing}
                  className="rounded border-slate-600 bg-slate-950 text-cyan-500"
                />
                Include free-to-play / zero-playtime free subs
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={forceResync}
                  onChange={(e) => setForceResync(e.target.checked)}
                  disabled={syncing}
                  className="rounded border-slate-600 bg-slate-950 text-cyan-500"
                />
                Re-sync non-overridden store specs
              </label>
            </div>

            {syncProgress ? (
              <div className="rounded-lg border border-cyan-500/30 bg-slate-950/80 p-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-2 font-medium text-cyan-200">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {syncProgress.message}
                  </span>
                  {syncProgress.total > 0 ? (
                    <span className="font-mono text-[11px] text-slate-400">
                      {progressPct}%
                    </span>
                  ) : null}
                </div>
                {syncProgress.total > 0 ? (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {syncError ? (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
                {syncError}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Main Content */}
      {viewMode === 'by_rig' ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left Column: Rig Selector & Status Breakdown */}
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4">
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                Select Saved Rig to Evaluate
              </label>
              <select
                value={selectedRig?.id ?? ''}
                onChange={(e) => setSelectedRigId(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                {computers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.device_type})
                  </option>
                ))}
              </select>

              {selectedRig && selectedRigProfile ? (
                <div className="mt-4 space-y-2.5 border-t border-slate-800 pt-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Effective GPU</span>
                    <span className="text-right font-medium text-slate-200">
                      {selectedRigProfile.effectiveGpu
                        ? `${selectedRigProfile.effectiveGpu.brand} ${selectedRigProfile.effectiveGpu.name}`
                        : 'None'}
                      {selectedRigProfile.isIntegratedOnly ? (
                        <span className="ml-1.5 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-amber-300">
                          iGPU
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">DirectX Ceiling</span>
                    <DirectXBadge
                      version={selectedRigProfile.directxVersion}
                      featureLevel={selectedRigProfile.directxFeatureLevel}
                      compact
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">VRAM</span>
                    <span className="font-mono text-slate-200">
                      {selectedRigProfile.vramGb !== null
                        ? `${formatGbSpec(selectedRigProfile.vramGb)} ${
                            selectedRigProfile.effectiveGpu?.vram_type ?? ''
                          }`
                        : selectedRigProfile.isIntegratedOnly
                          ? 'Shared System RAM'
                          : 'Unknown'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">System RAM</span>
                    <span className="font-mono text-slate-200">
                      {selectedRigProfile.ramGb !== null
                        ? formatGbSpec(selectedRigProfile.ramGb)
                        : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Largest Drive</span>
                    <span className="font-mono text-slate-200">
                      {selectedRigProfile.largestDriveGb !== null
                        ? `${formatGbSpec(selectedRigProfile.largestDriveGb)}${
                            selectedRigProfile.driveCount > 1
                              ? ` (${formatGbSpec(selectedRigProfile.totalStorageGb)} total)`
                              : ''
                          }`
                        : 'No drives recorded'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">CPU Threads</span>
                    <span className="font-mono text-slate-200">
                      {selectedRig.cpu
                        ? `${(selectedRig.cpu.threads ?? 0) * selectedRig.cpu_count} Threads`
                        : '—'}
                    </span>
                  </div>
                  {onSelectComputer ? (
                    <button
                      type="button"
                      onClick={() => onSelectComputer(selectedRig)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 py-1.5 text-center text-[11px] font-medium text-cyan-300 hover:border-cyan-500/50 hover:text-cyan-200"
                    >
                      Open {selectedRig.name} Hardware Sheet
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            {rigSummary.total > 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4">
                <h3 className="mb-2.5 text-xs font-semibold tracking-wider text-slate-400 uppercase">
                  Compatibility Breakdown ({rigSummary.total})
                </h3>
                <div className="space-y-1.5 text-xs">
                  {(
                    [
                      ['playable', rigSummary.playable],
                      ['minimum', rigSummary.minimum],
                      ['blocked_directx', rigSummary.blockedDirectx],
                      ['blocked_vram', rigSummary.blockedVram],
                      ['blocked_ram', rigSummary.blockedRam],
                      ['blocked_storage', rigSummary.blockedStorage],
                      ['unknown', rigSummary.unknown],
                    ] as Array<[CompatibilityStatus, number]>
                  ).map(([status, count]) => {
                    const meta = COMPAT_STATUS_META[status];
                    const pct = Math.round((count / rigSummary.total) * 100);
                    const active = statusFilter === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() =>
                          setStatusFilter((prev) =>
                            prev === status ? 'all' : status,
                          )
                        }
                        className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-left transition ${
                          active
                            ? 'border-cyan-500/60 bg-cyan-500/10'
                            : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                        }`}
                      >
                        <span className="flex items-center gap-2 text-slate-200">
                          <span
                            className={`h-2 w-2 rounded-full ${meta.dotClass}`}
                          />
                          {meta.label}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">
                          {count}{' '}
                          <span className="text-slate-600">({pct}%)</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          {/* Right Column: Matched Games */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4 lg:col-span-2">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">
                Matched Steam Titles ({filteredRigEntries.length})
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter games or AppID..."
                    className="w-48 rounded-lg border border-slate-700 bg-slate-950 py-1.5 pr-3 pl-8 text-xs text-white placeholder:text-slate-500"
                  />
                </div>
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200"
                >
                  <option value="playtime">Sort: Most Played</option>
                  <option value="status">Sort: Compatibility</option>
                  <option value="title">Sort: Title A–Z</option>
                  <option value="directx">Sort: DirectX Required</option>
                  <option value="storage">Sort: Storage Size</option>
                </select>
                {libraryStats.overrides > 0 ? (
                  <button
                    type="button"
                    onClick={() => setOverridesOnly((v) => !v)}
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ${
                      overridesOnly
                        ? 'border-violet-500/60 bg-violet-500/20 text-violet-200'
                        : 'border-slate-700 bg-slate-950 text-slate-300'
                    }`}
                  >
                    Overrides Only
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mb-3 flex flex-wrap gap-1.5">
              {STATUS_FILTER_ORDER.map((id) => {
                const label =
                  id === 'all' ? 'All' : COMPAT_STATUS_META[id].shortLabel;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setStatusFilter(id)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                      statusFilter === id
                        ? 'bg-cyan-500 text-slate-950'
                        : 'border border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {steamGames.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/60 p-8 text-center">
                <ShieldAlert className="mx-auto h-7 w-7 text-slate-500" />
                <p className="mt-2 text-sm font-medium text-slate-300">
                  No Steam games synced yet
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {isOwner
                    ? 'Enter your SteamID64 or vanity profile URL above and click Sync Steam Library.'
                    : selectedRig
                      ? `${selectedRig.name} is ready once the owner syncs a Steam library.`
                      : 'Select a rig to preview hardware readiness.'}
                </p>
              </div>
            ) : filteredRigEntries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/60 p-8 text-center text-xs text-slate-400">
                No games match the current filter criteria.
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredRigEntries
                  .slice(0, visibleCount)
                  .map(({ row, game }) => {
                    const meta = COMPAT_STATUS_META[row.status];
                    const isExpanded = expandedRawIds.has(game.app_id);
                    const minLines = extractHtmlLines(
                      typeof game.raw_requirements?.minimum === 'string'
                        ? game.raw_requirements.minimum
                        : null,
                    );
                    const recLines = extractHtmlLines(
                      typeof game.raw_requirements?.recommended === 'string'
                        ? game.raw_requirements.recommended
                        : null,
                    );
                    const safeStoreUrl = safeHttpUrl(game.store_url);

                    return (
                      <div
                        key={row.id}
                        className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs"
                      >
                        <div className="flex flex-wrap items-start gap-3">
                          <GameCoverThumb
                            url={game.header_image_url}
                            title={game.title}
                          />

                          <div className="min-w-[200px] flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  {safeStoreUrl ? (
                                    <a
                                      href={safeStoreUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-sm font-semibold text-white hover:text-cyan-300"
                                    >
                                      {game.title}
                                      <ExternalLink className="h-3 w-3 text-slate-500" />
                                    </a>
                                  ) : (
                                    <span className="text-sm font-semibold text-white">
                                      {game.title}
                                    </span>
                                  )}
                                  {game.manual_override ? (
                                    <span className="rounded border border-violet-500/40 bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-violet-300">
                                      Override
                                    </span>
                                  ) : null}
                                </div>

                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-slate-400">
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="h-3 w-3 text-slate-500" />
                                    {formatPlaytime(game.playtime_minutes)}
                                  </span>
                                  <span>
                                    DX:{' '}
                                    {game.min_directx
                                      ? `${game.min_directx}${
                                          game.rec_directx &&
                                          game.rec_directx !== game.min_directx
                                            ? ` / ${game.rec_directx}`
                                            : ''
                                        }`
                                      : '—'}
                                  </span>
                                  <span>
                                    VRAM:{' '}
                                    {game.min_vram_gb !== null ||
                                    game.rec_vram_gb !== null
                                      ? `${formatGbSpec(game.min_vram_gb)} / ${formatGbSpec(game.rec_vram_gb)}`
                                      : '—'}
                                  </span>
                                  <span>
                                    RAM:{' '}
                                    {game.min_ram_gb !== null ||
                                    game.rec_ram_gb !== null
                                      ? `${formatGbSpec(game.min_ram_gb)} / ${formatGbSpec(game.rec_ram_gb)}`
                                      : '—'}
                                  </span>
                                  <span>
                                    Storage: {formatGbSpec(game.storage_gb)}
                                  </span>
                                </div>
                              </div>

                              <span
                                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium ${meta.badgeClass}`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${meta.dotClass}`}
                                />
                                {meta.label}
                              </span>
                            </div>

                            {row.blocking_reason ? (
                              <p
                                className={`mt-1.5 text-[11px] ${
                                  row.status === 'minimum'
                                    ? 'text-amber-300'
                                    : row.status === 'unknown'
                                      ? 'text-slate-400'
                                      : 'text-rose-300'
                                }`}
                              >
                                {row.blocking_reason}
                              </p>
                            ) : null}

                            {game.override_notes ? (
                              <p className="mt-1 text-[11px] text-violet-300">
                                Note: {game.override_notes}
                              </p>
                            ) : null}

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {minLines.length > 0 || recLines.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => toggleRawExpanded(game.app_id)}
                                  className="inline-flex items-center gap-1 rounded border border-slate-800 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-300 hover:border-slate-700 hover:text-white"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="h-3 w-3" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3" />
                                  )}
                                  Raw Steam Specs
                                </button>
                              ) : null}

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedGameId(game.app_id);
                                  setViewMode('by_game');
                                }}
                                className="inline-flex items-center gap-1 rounded border border-slate-800 bg-slate-900 px-2 py-0.5 text-[11px] text-cyan-300 hover:border-cyan-500/40"
                              >
                                <Layers className="h-3 w-3" />
                                Check Across Fleet
                              </button>

                              {isOwner ? (
                                <button
                                  type="button"
                                  onClick={() => setEditingGame(game)}
                                  className="inline-flex items-center gap-1 rounded border border-slate-800 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-200 hover:border-cyan-500/40 hover:text-cyan-200"
                                >
                                  <Edit3 className="h-3 w-3" />
                                  Edit Specs
                                </button>
                              ) : null}
                            </div>

                            {isExpanded ? (
                              <div className="mt-2.5 grid gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-2.5 text-[11px] sm:grid-cols-2">
                                {minLines.length > 0 ? (
                                  <div className="space-y-0.5 text-slate-300">
                                    {minLines.map((line, i) => (
                                      <p key={`raw-min-${i}`}>{line}</p>
                                    ))}
                                  </div>
                                ) : null}
                                {recLines.length > 0 ? (
                                  <div className="space-y-0.5 text-slate-400">
                                    {recLines.map((line, i) => (
                                      <p key={`raw-rec-${i}`}>{line}</p>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {filteredRigEntries.length > visibleCount ? (
                  <button
                    type="button"
                    onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 text-xs font-medium text-cyan-300 hover:border-cyan-500/40 hover:bg-slate-900"
                  >
                    Show {Math.min(PAGE_SIZE, filteredRigEntries.length - visibleCount)}{' '}
                    more ({filteredRigEntries.length - visibleCount} remaining)
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* By Game (Fleet Matrix) Mode */
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left: Game Picker */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4">
            <div className="mb-3 space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search synced Steam games..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 py-1.5 pr-3 pl-8 text-xs text-white placeholder:text-slate-500"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <select
                  value={sortMode === 'status' ? 'playtime' : sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200"
                >
                  <option value="playtime">Sort: Most Played</option>
                  <option value="title">Sort: Title A–Z</option>
                  <option value="directx">Sort: DirectX Required</option>
                  <option value="storage">Sort: Storage Size</option>
                </select>
                <span className="font-mono text-[11px] text-slate-400">
                  {filteredGamesList.length} titles
                </span>
              </div>
            </div>

            {filteredGamesList.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">
                No synced Steam games match your search.
              </p>
            ) : (
              <div className="max-h-[620px] space-y-1.5 overflow-y-auto pr-1">
                {filteredGamesList.slice(0, visibleCount).map((game) => {
                  const active = selectedGame?.app_id === game.app_id;
                  const playableCount =
                    playableCountByAppId.get(game.app_id) ?? 0;
                  return (
                    <button
                      key={game.app_id}
                      type="button"
                      onClick={() => setSelectedGameId(game.app_id)}
                      className={`flex w-full items-center gap-2.5 rounded-lg border p-2 text-left transition ${
                        active
                          ? 'border-cyan-500/60 bg-cyan-500/10'
                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                      }`}
                    >
                      <GameCoverThumb
                        url={game.header_image_url}
                        title={game.title}
                        compact
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-white">
                          {game.title}
                        </div>
                        <div className="mt-0.5 flex items-center justify-between font-mono text-[10px] text-slate-400">
                          <span>{formatPlaytime(game.playtime_minutes)}</span>
                          <span className="text-emerald-300">
                            {playableCount}/{computers.length} rigs
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {filteredGamesList.length > visibleCount ? (
                  <button
                    type="button"
                    onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 text-[11px] font-medium text-cyan-300 hover:border-cyan-500/40"
                  >
                    Show more games (
                    {filteredGamesList.length - visibleCount} left)
                  </button>
                ) : null}
              </div>
            )}
          </div>

          {/* Right: Fleet Compatibility Matrix for Selected Game */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4 lg:col-span-2">
            {!selectedGame ? (
              <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/60 p-10 text-center text-xs text-slate-400">
                Select or sync a Steam game to inspect compatibility across all
                saved rigs.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <GameCoverThumb
                      url={selectedGame.header_image_url}
                      title={selectedGame.title}
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-white">
                          {selectedGame.title}
                        </h3>
                        {selectedGame.manual_override ? (
                          <span className="rounded border border-violet-500/40 bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-violet-300">
                            Manual Override
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-slate-400">
                        <span>AppID {selectedGame.app_id}</span>
                        <span>
                          {formatPlaytime(selectedGame.playtime_minutes)}
                        </span>
                        {safeHttpUrl(selectedGame.store_url) ? (
                          <a
                            href={safeHttpUrl(selectedGame.store_url)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-cyan-300 hover:underline"
                          >
                            Steam Store
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : null}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 font-mono text-[11px]">
                        <span className="rounded border border-slate-800 bg-slate-950 px-2 py-0.5 text-slate-300">
                          Min DX: {selectedGame.min_directx ?? '—'} · Rec:{' '}
                          {selectedGame.rec_directx ?? '—'}
                        </span>
                        <span className="rounded border border-slate-800 bg-slate-950 px-2 py-0.5 text-slate-300">
                          VRAM: {formatGbSpec(selectedGame.min_vram_gb)} /{' '}
                          {formatGbSpec(selectedGame.rec_vram_gb)}
                        </span>
                        <span className="rounded border border-slate-800 bg-slate-950 px-2 py-0.5 text-slate-300">
                          RAM: {formatGbSpec(selectedGame.min_ram_gb)} /{' '}
                          {formatGbSpec(selectedGame.rec_ram_gb)}
                        </span>
                        <span className="rounded border border-slate-800 bg-slate-950 px-2 py-0.5 text-slate-300">
                          Storage: {formatGbSpec(selectedGame.storage_gb)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isOwner ? (
                    <button
                      type="button"
                      onClick={() => setEditingGame(selectedGame)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-500/50 hover:text-cyan-200"
                    >
                      <Wrench className="h-3.5 w-3.5 text-cyan-400" />
                      Edit Specs
                    </button>
                  ) : null}
                </div>

                <div className="space-y-2">
                  {selectedGameRigMatrix.map(({ rig, profile, compat }) => {
                    const status = compat?.status ?? 'unknown';
                    const meta = COMPAT_STATUS_META[status];
                    return (
                      <div
                        key={rig.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3.5 py-2.5 text-xs"
                      >
                        <div className="min-w-[200px] flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (onSelectComputer) {
                                  onSelectComputer(rig);
                                } else {
                                  setSelectedRigId(rig.id);
                                  setViewMode('by_rig');
                                }
                              }}
                              className="inline-flex items-center gap-1.5 font-semibold text-white hover:text-cyan-300"
                            >
                              {rig.device_type === 'Laptop' ? (
                                <Laptop className="h-3.5 w-3.5 text-violet-400" />
                              ) : (
                                <Monitor className="h-3.5 w-3.5 text-sky-400" />
                              )}
                              {rig.name}
                            </button>
                            <DirectXBadge
                              version={profile.directxVersion}
                              featureLevel={profile.directxFeatureLevel}
                              compact
                            />
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] text-slate-400">
                            <span className="inline-flex items-center gap-1">
                              <Cpu className="h-3 w-3 text-slate-500" />
                              {profile.effectiveGpu
                                ? `${profile.effectiveGpu.brand} ${profile.effectiveGpu.name}${
                                    profile.isIntegratedOnly ? ' (iGPU)' : ''
                                  }`
                                : 'No GPU'}
                            </span>
                            <span>
                              VRAM:{' '}
                              {profile.vramGb !== null
                                ? formatGbSpec(profile.vramGb)
                                : profile.isIntegratedOnly
                                  ? 'Shared'
                                  : '—'}
                            </span>
                            <span>RAM: {formatGbSpec(profile.ramGb)}</span>
                            <span className="inline-flex items-center gap-1">
                              <HardDrive className="h-3 w-3 text-slate-500" />
                              {profile.largestDriveGb !== null
                                ? formatGbSpec(profile.largestDriveGb)
                                : '—'}
                            </span>
                          </div>
                          {compat?.blocking_reason ? (
                            <p
                              className={`mt-1 text-[11px] ${
                                status === 'minimum'
                                  ? 'text-amber-300'
                                  : status === 'unknown'
                                    ? 'text-slate-400'
                                    : 'text-rose-300'
                              }`}
                            >
                              {compat.blocking_reason}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRigId(rig.id);
                              setViewMode('by_rig');
                            }}
                            className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 hover:border-slate-700 hover:text-white"
                          >
                            View Rig
                          </button>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium ${meta.badgeClass}`}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            {meta.shortLabel}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <SteamOverrideModal
        game={editingGame}
        onClose={() => setEditingGame(null)}
        onSave={async (appId, patch) => {
          await onSaveOverride(appId, patch);
          onNotify?.('Saved manual requirement override & re-evaluated rigs');
        }}
        onReset={async (game) => {
          await onResetOverride(game);
          onNotify?.('Reset to Steam auto-parsed requirements');
        }}
      />
    </div>
  );
}
