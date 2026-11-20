import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Gamepad2,
  Loader2,
  Play,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type {
  BuildGameCompatibility,
  CompatibilityStatus,
  ComputerWithRelations,
  SteamGame,
} from '../types/database';
import { DirectXBadge } from './DirectXBadge';

interface SteamCompatibilityViewProps {
  computers: ComputerWithRelations[];
  steamGames: SteamGame[];
  compatibilityRows: BuildGameCompatibility[];
  isOwner: boolean;
}

export function SteamCompatibilityView({
  computers,
  steamGames,
  compatibilityRows,
  isOwner,
}: SteamCompatibilityViewProps) {
  const [selectedRigId, setSelectedRigId] = useState<number | ''>(() =>
    computers[0]?.id ?? '',
  );
  const [statusFilter, setStatusFilter] = useState<'all' | CompatibilityStatus>(
    'all',
  );
  const [stubTesting, setStubTesting] = useState(false);
  const [stubResult, setStubResult] = useState<Record<string, unknown> | null>(
    null,
  );
  const [stubError, setStubError] = useState<string | null>(null);

  const selectedRig = useMemo(
    () =>
      computers.find((c) => c.id === selectedRigId) ?? computers[0] ?? null,
    [computers, selectedRigId],
  );

  const gameById = useMemo(() => {
    const map = new Map<number, SteamGame>();
    for (const g of steamGames) map.set(g.app_id, g);
    return map;
  }, [steamGames]);

  const rigCompatList = useMemo(() => {
    if (!selectedRig) return [];
    return compatibilityRows
      .filter((row) => row.computer_id === selectedRig.id)
      .filter((row) => statusFilter === 'all' || row.status === statusFilter)
      .map((row) => ({
        ...row,
        game: gameById.get(row.steam_app_id) ?? null,
      }));
  }, [selectedRig, compatibilityRows, statusFilter, gameById]);

  const handleTestStub = async () => {
    setStubTesting(true);
    setStubError(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        'sync-steam-library',
        {
          body: { dryRun: true },
        },
      );
      if (error) throw error;
      setStubResult(data as Record<string, unknown>);
    } catch (err) {
      setStubError(
        err instanceof Error
          ? err.message
          : 'Unable to invoke sync-steam-library Edge Function.',
      );
    } finally {
      setStubTesting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Phase 2 Roadmap Banner */}
      <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-slate-900 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-300">
              <Sparkles className="h-3 w-3" />
              Phase 2 Roadmap Ready
            </div>
            <h2 className="mt-2 flex items-center gap-2 text-lg font-bold text-white">
              <Gamepad2 className="h-5 w-5 text-cyan-400" />
              Steam Library Compatibility Matcher
            </h2>
            <p className="mt-1 max-w-2xl text-xs text-slate-300">
              The database schema (`steam_library` &amp; `build_game_compatibility`) and Edge Function (`sync-steam-library`) are already provisioned. When you add your Steam Web API key later, selecting any desktop or laptop below will filter your Steam library by DirectX feature level, VRAM, and RAM requirements.
            </p>
          </div>

          {isOwner ? (
            <button
              type="button"
              onClick={() => void handleTestStub()}
              disabled={stubTesting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3.5 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-60"
            >
              {stubTesting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Test `sync-steam-library` Stub
            </button>
          ) : null}
        </div>

        {stubError ? (
          <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
            {stubError}
          </div>
        ) : null}

        {stubResult ? (
          <pre className="mt-3 max-h-48 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-emerald-300">
            {JSON.stringify(stubResult, null, 2)}
          </pre>
        ) : null}
      </div>

      {/* Rig Selector & Effective Capability Profile */}
      <div className="grid gap-4 lg:grid-cols-3">
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

          {selectedRig ? (
            <div className="mt-4 space-y-2 border-t border-slate-800 pt-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">DirectX Ceiling</span>
                <DirectXBadge
                  version={selectedRig.gpu?.directx_version}
                  featureLevel={selectedRig.gpu?.directx_feature_level}
                  compact
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">VRAM</span>
                <span className="font-mono text-slate-200">
                  {selectedRig.gpu?.vram_gb !== null &&
                  selectedRig.gpu?.vram_gb !== undefined
                    ? `${selectedRig.gpu.vram_gb} GB ${selectedRig.gpu.vram_type ?? ''}`
                    : 'Integrated / Unknown'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">System RAM</span>
                <span className="font-mono text-slate-200">
                  {selectedRig.ram_gb ? `${selectedRig.ram_gb} GB` : '—'}
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
            </div>
          ) : null}
        </div>

        {/* Compatibility Results Panel */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-4 lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">
              Matched Steam Titles ({rigCompatList.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['all', 'All'],
                  ['playable', 'Playable'],
                  ['minimum', 'Minimum'],
                  ['blocked_directx', 'Blocked by DirectX'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setStatusFilter(id)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${
                    statusFilter === id
                      ? 'bg-cyan-500 text-slate-950'
                      : 'border border-slate-700 bg-slate-950 text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {steamGames.length === 0 || rigCompatList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/60 p-8 text-center">
              <ShieldAlert className="mx-auto h-7 w-7 text-slate-500" />
              <p className="mt-2 text-sm font-medium text-slate-300">
                No Steam games synced yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {selectedRig
                  ? `${selectedRig.name} is ready for matching with ${
                      selectedRig.gpu
                        ? `${selectedRig.gpu.directx_version ?? 'unknown'} (${
                            selectedRig.gpu.directx_feature_level ?? '—'
                          })`
                        : 'no discrete GPU'
                    } and ${selectedRig.ram_gb ?? '?'} GB RAM.`
                  : 'Select a rig to preview requirements.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {rigCompatList.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs"
                >
                  <div>
                    <span className="font-semibold text-white">
                      {row.game?.title ?? `App ${row.steam_app_id}`}
                    </span>
                    {row.blocking_reason ? (
                      <p className="text-[11px] text-rose-300">
                        {row.blocking_reason}
                      </p>
                    ) : null}
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-2.5 py-0.5 font-mono text-[11px] text-slate-200">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
