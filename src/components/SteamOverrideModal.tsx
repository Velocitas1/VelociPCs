import { useEffect, useState, type FormEvent } from 'react';
import { RotateCcw, Save, ShieldAlert, X } from 'lucide-react';
import type { SteamGameOverridePatch } from '../hooks/useInventory';
import { extractHtmlLines } from '../lib/steamCompatibility';
import type { SteamGame } from '../types/database';

interface SteamOverrideModalProps {
  game: SteamGame | null;
  onClose: () => void;
  onSave: (appId: number, patch: SteamGameOverridePatch) => Promise<void>;
  onReset: (game: SteamGame) => Promise<void>;
}

const DIRECTX_PRESETS = ['9.0c', '10', '11', '12', '12_2'] as const;

function numToInput(value: number | null | undefined): string {
  return value !== null && value !== undefined ? String(value) : '';
}

function parseOptionalPositiveNumber(
  raw: string,
  label: string,
): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }
  return Math.round(parsed * 100) / 100;
}

export function SteamOverrideModal({
  game,
  onClose,
  onSave,
  onReset,
}: SteamOverrideModalProps) {
  const [minDx, setMinDx] = useState('');
  const [recDx, setRecDx] = useState('');
  const [minVram, setMinVram] = useState('');
  const [recVram, setRecVram] = useState('');
  const [minRam, setMinRam] = useState('');
  const [recRam, setRecRam] = useState('');
  const [storageGb, setStorageGb] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!game) return;
    setMinDx(game.min_directx ?? '');
    setRecDx(game.rec_directx ?? '');
    setMinVram(numToInput(game.min_vram_gb));
    setRecVram(numToInput(game.rec_vram_gb));
    setMinRam(numToInput(game.min_ram_gb));
    setRecRam(numToInput(game.rec_ram_gb));
    setStorageGb(numToInput(game.storage_gb));
    setNotes(game.override_notes ?? '');
    setError(null);
  }, [game]);

  if (!game) return null;

  const rawMinLines = extractHtmlLines(
    typeof game.raw_requirements?.minimum === 'string'
      ? game.raw_requirements.minimum
      : null,
  );
  const rawRecLines = extractHtmlLines(
    typeof game.raw_requirements?.recommended === 'string'
      ? game.raw_requirements.recommended
      : null,
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const patch: SteamGameOverridePatch = {
        min_directx: minDx.trim() || null,
        rec_directx: recDx.trim() || null,
        min_vram_gb: parseOptionalPositiveNumber(minVram, 'Minimum VRAM (GB)'),
        rec_vram_gb: parseOptionalPositiveNumber(
          recVram,
          'Recommended VRAM (GB)',
        ),
        min_ram_gb: parseOptionalPositiveNumber(minRam, 'Minimum RAM (GB)'),
        rec_ram_gb: parseOptionalPositiveNumber(recRam, 'Recommended RAM (GB)'),
        storage_gb: parseOptionalPositiveNumber(storageGb, 'Storage (GB)'),
        override_notes: notes.trim() || null,
      };
      await onSave(game.app_id, patch);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to save manual requirement override.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setError(null);
    setResetting(true);
    try {
      await onReset(game);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to reset to Steam auto-parsed requirements.',
      );
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                AppID {game.app_id}
              </span>
              {game.manual_override ? (
                <span className="rounded border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                  Manual Override Active
                </span>
              ) : null}
            </div>
            <h2 className="mt-1.5 text-lg font-bold text-white">
              Edit Requirements: {game.title}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Overrides are preserved across future Steam library syncs and
              immediately re-evaluated against all saved rigs.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="space-y-4 overflow-y-auto p-5"
        >
          {(rawMinLines.length > 0 || rawRecLines.length > 0) ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-[11px]">
              <div className="mb-1.5 font-semibold tracking-wider text-slate-400 uppercase">
                Raw Steam Store Requirements (Reference)
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {rawMinLines.length > 0 ? (
                  <div className="space-y-0.5 text-slate-300">
                    {rawMinLines.map((line, i) => (
                      <p key={`min-${i}`}>{line}</p>
                    ))}
                  </div>
                ) : null}
                {rawRecLines.length > 0 ? (
                  <div className="space-y-0.5 text-slate-400">
                    {rawRecLines.map((line, i) => (
                      <p key={`rec-${i}`}>{line}</p>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
              Steam did not return structured PC requirements for this title.
              Enter manual specs below.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Minimum DirectX
              </label>
              <input
                type="text"
                value={minDx}
                onChange={(e) => setMinDx(e.target.value)}
                placeholder="e.g. 9.0c, 11, 12, 12_2"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-600"
              />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {DIRECTX_PRESETS.map((preset) => (
                  <button
                    key={`min-${preset}`}
                    type="button"
                    onClick={() => setMinDx(preset)}
                    className="rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 font-mono text-[10px] text-slate-300 hover:border-cyan-500/50 hover:text-cyan-200"
                  >
                    {preset}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setMinDx('')}
                  className="rounded border border-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500 hover:text-slate-300"
                >
                  Clear
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Recommended DirectX
              </label>
              <input
                type="text"
                value={recDx}
                onChange={(e) => setRecDx(e.target.value)}
                placeholder="e.g. 11, 12, 12_2"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-600"
              />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {DIRECTX_PRESETS.map((preset) => (
                  <button
                    key={`rec-${preset}`}
                    type="button"
                    onClick={() => setRecDx(preset)}
                    className="rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 font-mono text-[10px] text-slate-300 hover:border-cyan-500/50 hover:text-cyan-200"
                  >
                    {preset}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setRecDx('')}
                  className="rounded border border-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500 hover:text-slate-300"
                >
                  Clear
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Minimum VRAM (GB)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={minVram}
                onChange={(e) => setMinVram(e.target.value)}
                placeholder="e.g. 0.5 for 512 MB, 4"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-600"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Recommended VRAM (GB)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={recVram}
                onChange={(e) => setRecVram(e.target.value)}
                placeholder="e.g. 8"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-600"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Minimum RAM (GB)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={minRam}
                onChange={(e) => setMinRam(e.target.value)}
                placeholder="e.g. 0.5 for 512 MB, 8"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-600"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Recommended RAM (GB)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={recRam}
                onChange={(e) => setRecRam(e.target.value)}
                placeholder="e.g. 16"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Required Storage (GB)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={storageGb}
                onChange={(e) => setStorageGb(e.target.value)}
                placeholder="e.g. 0.8 for 800 MB, 50"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white placeholder:text-slate-600"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Override Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Requires DX 9.0c on XP; Steam page omitted VRAM."
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder:text-slate-600"
              />
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-4">
            <div>
              {game.manual_override ? (
                <button
                  type="button"
                  onClick={() => void handleReset()}
                  disabled={saving || resetting}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-300 hover:border-amber-500/40 hover:text-amber-200 disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {resetting ? 'Resetting...' : 'Reset to Steam Auto-Parsed'}
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || resetting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving...' : 'Save Override'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
