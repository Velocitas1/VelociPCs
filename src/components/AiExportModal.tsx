import { useMemo, useState } from 'react';
import { Check, Copy, Download, FileCode2, FileText, X } from 'lucide-react';
import { buildAiExportJson, buildAiExportMarkdown } from '../lib/aiExport';
import type { ComputerWithRelations, DeviceType } from '../types/database';

interface AiExportModalProps {
  open: boolean;
  computers: ComputerWithRelations[];
  onClose: () => void;
}

export function AiExportModal({
  open,
  computers,
  onClose,
}: AiExportModalProps) {
  const [format, setFormat] = useState<'markdown' | 'json'>('markdown');
  const [filter, setFilter] = useState<'All' | DeviceType>('All');
  const [copied, setCopied] = useState(false);

  const scopedRigs = useMemo(
    () =>
      filter === 'All'
        ? computers
        : computers.filter((c) => c.device_type === filter),
    [computers, filter],
  );

  const output = useMemo(
    () =>
      format === 'markdown'
        ? buildAiExportMarkdown(scopedRigs)
        : buildAiExportJson(scopedRigs),
    [format, scopedRigs],
  );

  if (!open) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    const ext = format === 'markdown' ? 'md' : 'json';
    const blob = new Blob([output], {
      type: format === 'markdown' ? 'text/markdown' : 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `velocipcs-inventory-${new Date().toISOString().slice(0, 10)}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">
              Export Inventory for AI Assistant
            </h2>
            <p className="text-xs text-slate-400">
              Share rigs, specs, DirectX levels, and 3DMark scores in one paste for upgrade or game compatibility advice
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

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/60 px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFormat('markdown')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                format === 'markdown'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'border border-slate-700 bg-slate-900 text-slate-300'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Markdown
            </button>
            <button
              type="button"
              onClick={() => setFormat('json')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                format === 'json'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'border border-slate-700 bg-slate-900 text-slate-300'
              }`}
            >
              <FileCode2 className="h-3.5 w-3.5" />
              JSON
            </button>

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'All' | DeviceType)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
            >
              <option value="All">All Rigs ({computers.length})</option>
              <option value="Desktop">Desktops Only</option>
              <option value="Laptop">Laptops Only</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy {format === 'markdown' ? 'Markdown' : 'JSON'}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5" />
              Download .{format === 'markdown' ? 'md' : 'json'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <pre className="rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-slate-200">
            {output}
          </pre>
        </div>
      </div>
    </div>
  );
}
