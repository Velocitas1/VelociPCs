import { useState, type ChangeEvent } from 'react';
import {
  CheckCircle2,
  FileSpreadsheet,
  Lock,
  Sparkles,
  Upload,
} from 'lucide-react';
import {
  importParsedRigsToSupabase,
  parseTransposedInventoryCsv,
  type ImportSummary,
  type ParsedImportPreview,
} from '../lib/csvImporter';
import { supabase } from '../lib/supabase';
import type { DeviceType } from '../types/database';
import { DirectXBadge } from './DirectXBadge';

interface CsvImportViewProps {
  isOwner: boolean;
  onOpenAuth: () => void;
  onImportComplete: () => Promise<void>;
}

export function CsvImportView({
  isOwner,
  onOpenAuth,
  onImportComplete,
}: CsvImportViewProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [overrideType, setOverrideType] = useState<'auto' | DeviceType>('auto');
  const [rawCsv, setRawCsv] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsedImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parseContent = (
    text: string,
    mode: 'auto' | DeviceType,
    name: string,
  ) => {
    setError(null);
    setSummary(null);
    try {
      const parsed = parseTransposedInventoryCsv(
        text,
        mode === 'auto' ? undefined : mode,
      );
      setPreview(parsed);
      setFileName(name);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : 'Unable to parse CSV.');
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setRawCsv(text);
    const inferredMode: 'auto' | DeviceType =
      overrideType !== 'auto'
        ? overrideType
        : file.name.toLowerCase().includes('top')
          ? 'Laptop'
          : file.name.toLowerCase().includes('computer')
            ? 'Desktop'
            : 'auto';
    setOverrideType(inferredMode);
    parseContent(text, inferredMode, file.name);
  };

  const handleOverrideChange = (nextMode: 'auto' | DeviceType) => {
    setOverrideType(nextMode);
    if (rawCsv && fileName) {
      parseContent(rawCsv, nextMode, fileName);
    }
  };

  const handleImport = async () => {
    if (!preview || !isOwner) return;
    setImporting(true);
    setError(null);
    try {
      const res = await importParsedRigsToSupabase(supabase, preview);
      setSummary(res);
      await onImportComplete();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Import failed. Verify owner permissions.',
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
              <FileSpreadsheet className="h-5 w-5 text-cyan-400" />
              Transposed CSV Importer (`VelociComputers` &amp; `VelociTops`)
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              All 21 baseline rigs from your CSVs are already seeded in Supabase. Use this flow anytime you export updated CSVs from Google Sheets—it parses your transposed layout, cleans minor typos, pre-fills DirectX levels, and upserts without creating duplicates.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Device Type:</label>
            <select
              value={overrideType}
              onChange={(e) =>
                handleOverrideChange(e.target.value as 'auto' | DeviceType)
              }
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white"
            >
              <option value="auto">Auto-Detect</option>
              <option value="Desktop">Desktop (`VelociComputers`)</option>
              <option value="Laptop">Laptop (`VelociTops`)</option>
            </select>
          </div>
        </div>

        <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/60 p-8 text-center transition hover:border-cyan-500/60">
          <Upload className="h-7 w-7 text-cyan-400" />
          <span className="mt-2 text-sm font-medium text-white">
            {fileName
              ? `Loaded: ${fileName} (click to choose another CSV)`
              : 'Choose VelociComputers.csv or VelociTops.csv'}
          </span>
          <span className="mt-1 text-xs text-slate-500">
            Supports transposed columns-as-rigs Google Sheet exports
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void handleFileChange(e)}
            className="hidden"
          />
        </label>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-300">
          {error}
        </div>
      ) : null}

      {summary ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs text-emerald-200">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <div>
            <strong>Import complete!</strong> Upserted{' '}
            {summary.computersUpserted} computers, synced {summary.cpusSynced}{' '}
            CPUs, {summary.gpusSynced} GPUs, {summary.drivesSynced} primary
            drives, and added {summary.benchmarksInserted} new benchmark runs.
          </div>
        </div>
      ) : null}

      {preview ? (
        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/75 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Import Preview · {preview.rigs.length} {preview.deviceType}s
              </h3>
              <p className="text-xs text-slate-400">
                Review normalized specs and pre-filled DirectX levels before writing to Supabase
              </p>
            </div>

            {isOwner ? (
              <button
                type="button"
                onClick={() => void handleImport()}
                disabled={importing}
                className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
              >
                {importing
                  ? 'Importing into Supabase...'
                  : `Import ${preview.rigs.length} Rigs into Supabase`}
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAuth}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/20"
              >
                <Lock className="h-3.5 w-3.5" />
                Sign In as Owner to Import
              </button>
            )}
          </div>

          {preview.cleanupsApplied.length > 0 ? (
            <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-3 text-xs text-slate-300">
              <div className="mb-1 flex items-center gap-1.5 font-semibold text-cyan-300">
                <Sparkles className="h-3.5 w-3.5" />
                Automatic Cleanups &amp; DirectX Enrichment ({preview.cleanupsApplied.length})
              </div>
              <p className="text-[11px] text-slate-400">
                {preview.cleanupsApplied.slice(0, 8).join(' · ')}
                {preview.cleanupsApplied.length > 8
                  ? ` · +${preview.cleanupsApplied.length - 8} more`
                  : ''}
              </p>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="py-2 pr-3">Rig Name</th>
                  <th className="px-3 py-2">CPU</th>
                  <th className="px-3 py-2">GPU</th>
                  <th className="px-3 py-2">DirectX</th>
                  <th className="px-3 py-2">RAM / Drive</th>
                  <th className="px-3 py-2 text-right">3DMark Runs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {preview.rigs.map((r) => (
                  <tr key={`${r.device_type}-${r.name}`}>
                    <td className="py-2 pr-3 font-semibold text-white">
                      {r.name}
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      {r.cpu
                        ? `${r.cpu_count > 1 ? `${r.cpu_count}x ` : ''}${r.cpu.brand} ${r.cpu.name}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      {r.gpu ? `${r.gpu.brand} ${r.gpu.name}` : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <DirectXBadge
                        version={r.gpu?.directx_version}
                        featureLevel={r.gpu?.directx_feature_level}
                        compact
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-300">
                      {r.ram_gb ? `${r.ram_gb} GB` : '—'} /{' '}
                      {r.drive?.capacity_gb ? `${r.drive.capacity_gb} GB` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-amber-300">
                      {r.benchmarks.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
