import { useMemo, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  FileCode2,
  FileSpreadsheet,
  ArrowRight,
  Trash2,
  Upload,
} from 'lucide-react';
import type { ComputerUpsertPayload, DriveDraft } from '../hooks/useInventory';
import {
  matchTargetRig,
  type HwinfoApplyResult,
  type InventoryCatalogContext,
} from '../lib/hwinfoMatcher';
import {
  decodeHwinfoXmlFile,
  parseHwinfoXml,
  type ParsedHwinfoReport,
} from '../lib/hwinfoParser';
import type { SpareAdjustment } from '../lib/parts';
import type { AppTab } from '../types/database';
import { CsvImportView } from './CsvImportView';
import { HwinfoImportModal } from './HwinfoImportModal';

interface ImportViewProps {
  catalog: InventoryCatalogContext;
  isOwner: boolean;
  onOpenAuth: () => void;
  onImportComplete: () => Promise<void>;
  onSelectRig: (rigId: number) => void;
  onSelectTab: (tab: AppTab) => void;
  onNotify: (msg: string) => void;
  saveComputer: (
    payload: ComputerUpsertPayload,
    drives: DriveDraft[],
    existingId?: number,
    spareAdjustments?: SpareAdjustment[],
  ) => Promise<number>;
}

interface QueueItem {
  id: string;
  fileName: string;
  report: ParsedHwinfoReport | null;
  parseError: string | null;
  status: 'pending' | 'applied' | 'skipped' | 'error';
  result?: HwinfoApplyResult;
}

export function ImportView({
  catalog,
  isOwner,
  onOpenAuth,
  onImportComplete,
  onSelectRig,
  onSelectTab,
  onNotify,
  saveComputer,
}: ImportViewProps) {
  const [subTab, setSubTab] = useState<'hwinfo' | 'csv'>('hwinfo');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [lastResults, setLastResults] = useState<HwinfoApplyResult[]>([]);

  const ingestFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const newItems: QueueItem[] = [];
    for (const file of files) {
      try {
        const xml = await decodeHwinfoXmlFile(file);
        const parsed = parseHwinfoXml(xml, file.name);
        newItems.push({
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          fileName: file.name,
          report: parsed,
          parseError: null,
          status: 'pending',
        });
      } catch (err) {
        newItems.push({
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          fileName: file.name,
          report: null,
          parseError:
            err instanceof Error ? err.message : 'Unable to parse XML file.',
          status: 'error',
        });
      }
    }

    const startIdx = queue.length;
    setQueue((prev) => [...prev, ...newItems]);

    // Auto-open immediately when dropping/picking a single valid XML into an empty queue
    if (queue.length === 0 && newItems.length === 1 && newItems[0].report) {
      setActiveIndex(startIdx);
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await ingestFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDrop = async (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await ingestFiles(e.dataTransfer.files);
    }
  };

  const nextPendingIndex = (fromIdx: number, items: QueueItem[]): number | null => {
    for (let i = fromIdx + 1; i < items.length; i += 1) {
      if (items[i].status === 'pending' && items[i].report) return i;
    }
    return null;
  };

  const pendingCount = useMemo(
    () => queue.filter((q) => q.status === 'pending' && q.report).length,
    [queue],
  );

  const activeItem =
    activeIndex !== null && queue[activeIndex] ? queue[activeIndex] : null;

  const needsPassMarkParts = useMemo(
    () =>
      lastResults.flatMap((r) =>
        r.createdParts.filter((p) => p.needsPassMark),
      ),
    [lastResults],
  );

  return (
    <div className="space-y-5">
      {/* Sub-tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setSubTab('hwinfo')}
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            subTab === 'hwinfo'
              ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/40'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <FileCode2 className="h-4 w-4" />
          HWiNFO XML Importer
        </button>
        <button
          type="button"
          onClick={() => setSubTab('csv')}
          className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            subTab === 'csv'
              ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/40'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Transposed CSV Importer
        </button>
      </div>

      {subTab === 'csv' ? (
        <CsvImportView
          isOwner={isOwner}
          onOpenAuth={onOpenAuth}
          onImportComplete={onImportComplete}
        />
      ) : (
        <div className="space-y-5">
          {/* Upload & Instructions Card */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                  <FileCode2 className="h-5 w-5 text-cyan-400" />
                  HWiNFO32 / HWiNFO64 XML Hardware Importer
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Import hardware reports from Windows 98 through Windows 11 rigs via{' '}
                  <span className="font-mono text-slate-300">
                    Save Report → XML
                  </span>{' '}
                  or CLI{' '}
                  <span className="font-mono text-slate-300">
                    HWiNFO64.exe -r
                  </span>
                  . Drop one XML for instant diff/merge, or a whole USB/NAS folder of XMLs for a guided batch queue.
                </p>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-1.5 text-[11px] text-slate-400">
                Preserves PSU, Case, Cooler, Build Date, Notes &amp; 3DMark runs
              </div>
            </div>

            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => void handleDrop(e)}
              className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition ${
                dragging
                  ? 'border-cyan-400 bg-cyan-500/10'
                  : 'border-slate-700 bg-slate-950/60 hover:border-cyan-500/60'
              }`}
            >
              <Upload className="h-7 w-7 text-cyan-400" />
              <span className="mt-2 text-sm font-medium text-white">
                Drop one or more HWiNFO XML reports here, or click to browse
              </span>
              <span className="mt-1 text-xs text-slate-500">
                Supports UTF-8 &amp; Windows-1252 legacy XMLs · Auto-matches rigs, PCI Subsys AIBs, and Reference DB specs
              </span>
              <input
                type="file"
                accept=".xml,text/xml,application/xml"
                multiple
                onChange={(e) => void handleFileChange(e)}
                className="hidden"
              />
            </label>
          </div>

          {/* Post-Import Summary */}
          {lastResults.length > 0 ? (
            <div className="space-y-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs text-emerald-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Applied {lastResults.length} HWiNFO report
                  {lastResults.length === 1 ? '' : 's'}
                </div>
                <button
                  type="button"
                  onClick={() => setLastResults([])}
                  className="text-[11px] text-emerald-300/80 hover:text-white"
                >
                  Dismiss
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {lastResults.map((res, i) => (
                  <button
                    key={`${res.computerId}-${i}`}
                    type="button"
                    onClick={() => onSelectRig(res.computerId)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-slate-950/60 px-2.5 py-1 text-[11px] font-medium text-emerald-200 hover:bg-slate-900"
                  >
                    {res.isNew ? 'Created' : 'Updated'} {res.rigName}
                    {res.createdParts.length > 0
                      ? ` (+${res.createdParts.length} catalog parts)`
                      : ''}
                    <ArrowRight className="h-3 w-3" />
                  </button>
                ))}
              </div>
              {needsPassMarkParts.length > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-emerald-500/20 pt-2 text-[11px] text-amber-200">
                  <span>
                    New silicon created without PassMark scores:{' '}
                    {needsPassMarkParts.map((p) => p.label).join(', ')}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectTab('parts')}
                    className="inline-flex items-center gap-1 font-semibold text-amber-300 hover:underline"
                  >
                    <Cpu className="h-3.5 w-3.5" />
                    Open Parts Catalog to add PassMark
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Batch Queue */}
          {queue.length > 0 ? (
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/75 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Import Review Queue ({queue.length} file
                    {queue.length === 1 ? '' : 's'})
                  </h3>
                  <p className="text-xs text-slate-400">
                    {pendingCount} pending review
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {pendingCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        const first = nextPendingIndex(-1, queue);
                        if (first !== null) setActiveIndex(first);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400"
                    >
                      Review Next Pending
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setQueue([]);
                      setActiveIndex(null);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 hover:text-white"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear Queue
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="py-2 pr-3">File / Host</th>
                      <th className="px-3 py-2">Detected Hardware</th>
                      <th className="px-3 py-2">Matched Target</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="py-2 pl-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {queue.map((item, idx) => {
                      const match = item.report
                        ? matchTargetRig(item.report, catalog.computers)
                        : null;
                      return (
                        <tr key={item.id}>
                          <td className="py-2.5 pr-3">
                            <div className="font-medium text-white">
                              {item.fileName}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {item.report?.computerName ?? '—'}
                              {item.report?.osName
                                ? ` · ${item.report.osName}`
                                : ''}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-slate-300">
                            {item.report ? (
                              <div className="space-y-0.5 text-[11px]">
                                <div>
                                  {item.report.cpu
                                    ? `${item.report.cpu.brand} ${item.report.cpu.name}`
                                    : 'No CPU'}
                                </div>
                                <div className="text-slate-400">
                                  {item.report.discreteGpu
                                    ? `${item.report.discreteGpu.brand} ${item.report.discreteGpu.name}`
                                    : item.report.integratedGpu
                                      ? `${item.report.integratedGpu.brand} ${item.report.integratedGpu.name}`
                                      : 'No GPU'}
                                  {item.report.ram?.totalGb
                                    ? ` · ${item.report.ram.totalGb} GB RAM`
                                    : ''}
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-rose-300">
                                <AlertCircle className="h-3.5 w-3.5" />
                                {item.parseError}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-[11px]">
                            {item.report ? (
                              match?.rig ? (
                                <span className="text-cyan-300">
                                  {match.rig.name} ({match.rig.device_type})
                                </span>
                              ) : (
                                <span className="text-emerald-300">
                                  + New {item.report.detectedDeviceType}
                                </span>
                              )
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            {item.status === 'applied' ? (
                              <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                                Applied
                              </span>
                            ) : item.status === 'skipped' ? (
                              <span className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                                Skipped
                              </span>
                            ) : item.status === 'error' ? (
                              <span className="rounded border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                                Parse Error
                              </span>
                            ) : (
                              <span className="rounded border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pl-3 text-right">
                            {item.report ? (
                              <button
                                type="button"
                                onClick={() => setActiveIndex(idx)}
                                className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:border-cyan-500/50 hover:text-white"
                              >
                                {item.status === 'applied'
                                  ? 'Re-open'
                                  : 'Review & Merge'}
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <HwinfoImportModal
        open={activeIndex !== null && Boolean(activeItem?.report)}
        report={activeItem?.report ?? null}
        queuePosition={
          activeIndex !== null && queue.length > 1
            ? { index: activeIndex, total: queue.length }
            : null
        }
        catalog={catalog}
        isOwner={isOwner}
        onOpenAuth={onOpenAuth}
        onClose={() => setActiveIndex(null)}
        onSkip={
          activeIndex !== null && queue.length > 1
            ? () => {
                const updated = queue.map((q, i) =>
                  i === activeIndex ? { ...q, status: 'skipped' as const } : q,
                );
                setQueue(updated);
                setActiveIndex(nextPendingIndex(activeIndex, updated));
              }
            : undefined
        }
        onApplySuccess={(result) => {
          setLastResults((prev) => [...prev, result]);
          onNotify(
            result.isNew
              ? `Created ${result.rigName} from HWiNFO XML`
              : `Updated ${result.rigName} from HWiNFO XML`,
          );
          if (activeIndex !== null) {
            const updated = queue.map((q, i) =>
              i === activeIndex
                ? { ...q, status: 'applied' as const, result }
                : q,
            );
            setQueue(updated);
            setActiveIndex(nextPendingIndex(activeIndex, updated));
          } else {
            setActiveIndex(null);
          }
        }}
        saveComputer={saveComputer}
      />
    </div>
  );
}
