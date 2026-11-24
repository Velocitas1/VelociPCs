import { useEffect, useState, type FormEvent } from 'react';
import { ExternalLink, Link2, Plus, Search, Trash2, X } from 'lucide-react';
import {
  COMPUTER_SLOT_META,
  getSafeHttpUrl,
  PART_LINK_PRESETS,
  parseHttpUrl,
  type PartLinkPresetKind,
} from '../lib/specLinks';
import type {
  ComputerPartLinkSlot,
  Cpu,
  Gpu,
  PartSpecLinkEntry,
  PartSpecLinksMap,
  SpecLinkItem,
  StorageDrive,
} from '../types/database';

export type PartLinksEditTarget =
  | { kind: 'cpu'; cpu: Cpu }
  | { kind: 'gpu'; gpu: Gpu }
  | { kind: 'storage_drive'; rigName: string; drive: StorageDrive }
  | {
      kind: 'computer_slot';
      computerId: number;
      rigName: string;
      slot: ComputerPartLinkSlot;
      partLabel: string;
      currentMap: PartSpecLinksMap;
    };

interface PartLinksModalProps {
  target: PartLinksEditTarget | null;
  onClose: () => void;
  onSaveCpuLinks: (
    id: number,
    specUrl: string | null,
    specLinks: SpecLinkItem[],
  ) => Promise<void>;
  onSaveGpuLinks: (
    id: number,
    specUrl: string | null,
    specLinks: SpecLinkItem[],
  ) => Promise<void>;
  onSaveStorageDriveLinks: (
    id: number,
    specUrl: string | null,
    specLinks: SpecLinkItem[],
  ) => Promise<void>;
  onSaveComputerSlotLinks: (
    computerId: number,
    currentMap: PartSpecLinksMap,
    slot: ComputerPartLinkSlot,
    entry: PartSpecLinkEntry | null,
  ) => Promise<void>;
}

function getTargetMeta(target: PartLinksEditTarget): {
  presetKind: PartLinkPresetKind;
  title: string;
  subtitle: string;
  searchQuery: string;
  initialPrimary: string;
  initialLinks: SpecLinkItem[];
} {
  switch (target.kind) {
    case 'cpu': {
      const label = `${target.cpu.brand} ${target.cpu.name}`.trim();
      return {
        presetKind: 'cpu',
        title: `Edit Links · ${label}`,
        subtitle: 'Catalog CPU — updates all rigs using this processor',
        searchQuery: label,
        initialPrimary: target.cpu.spec_url ?? '',
        initialLinks: target.cpu.spec_links ?? [],
      };
    }
    case 'gpu': {
      const label = `${target.gpu.brand} ${target.gpu.name}`.trim();
      return {
        presetKind: 'gpu',
        title: `Edit Links · ${label}`,
        subtitle: 'Catalog GPU — updates all rigs using this graphics chip',
        searchQuery: `${label}${target.gpu.is_mobile ? ' Mobile' : ''}`,
        initialPrimary: target.gpu.spec_url ?? '',
        initialLinks: target.gpu.spec_links ?? [],
      };
    }
    case 'storage_drive': {
      const label =
        [
          target.drive.capacity_gb ? `${target.drive.capacity_gb} GB` : null,
          target.drive.brand,
          target.drive.model,
        ]
          .filter(Boolean)
          .join(' ') || 'Storage Drive';
      return {
        presetKind: 'storage_drive',
        title: `Edit Links · ${label}`,
        subtitle: `${target.rigName} · Storage Drive`,
        searchQuery: [target.drive.brand, target.drive.model_number || target.drive.model]
          .filter(Boolean)
          .join(' '),
        initialPrimary: target.drive.spec_url ?? '',
        initialLinks: target.drive.spec_links ?? [],
      };
    }
    case 'computer_slot': {
      const existing = target.currentMap[target.slot];
      const slotMeta = COMPUTER_SLOT_META[target.slot];
      return {
        presetKind: target.slot,
        title: `Edit Links · ${target.partLabel || slotMeta.label}`,
        subtitle: `${target.rigName} · ${slotMeta.label}`,
        searchQuery: target.partLabel || slotMeta.label,
        initialPrimary: existing?.spec_url ?? '',
        initialLinks: existing?.links ?? [],
      };
    }
  }
}

export function PartLinksModal({
  target,
  onClose,
  onSaveCpuLinks,
  onSaveGpuLinks,
  onSaveStorageDriveLinks,
  onSaveComputerSlotLinks,
}: PartLinksModalProps) {
  const [primaryUrl, setPrimaryUrl] = useState('');
  const [links, setLinks] = useState<Array<{ label: string; url: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    const meta = getTargetMeta(target);
    setPrimaryUrl(meta.initialPrimary);
    setLinks(meta.initialLinks.map((l) => ({ ...l })));
    setError(null);
  }, [target]);

  if (!target) return null;

  const meta = getTargetMeta(target);
  const presets = PART_LINK_PRESETS[meta.presetKind];
  const helperLinks = meta.searchQuery
    ? presets.helperLinks(meta.searchQuery)
    : [];
  const safePrimaryPreview = getSafeHttpUrl(primaryUrl);

  const handleAddRow = (presetLabel = '') => {
    setLinks((prev) => [...prev, { label: presetLabel, url: '' }]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedPrimary = parseHttpUrl(primaryUrl);
    if (!parsedPrimary.valid) {
      setError(`Primary Spec URL: ${parsedPrimary.error}`);
      return;
    }

    const cleanedLinks: SpecLinkItem[] = [];
    const seenUrls = new Set<string>();
    if (parsedPrimary.normalizedUrl) {
      seenUrls.add(parsedPrimary.normalizedUrl);
    }

    for (let i = 0; i < links.length; i += 1) {
      const row = links[i];
      const lbl = row.label.trim();
      const rawUrl = row.url.trim();
      if (!lbl && !rawUrl) continue;
      if (!lbl) {
        setError(`Research link #${i + 1} needs a label.`);
        return;
      }
      if (!rawUrl) {
        setError(`Research link "${lbl}" needs a URL.`);
        return;
      }
      const parsed = parseHttpUrl(rawUrl);
      if (!parsed.valid || !parsed.normalizedUrl) {
        setError(`Research link "${lbl}": ${parsed.error}`);
        return;
      }
      if (seenUrls.has(parsed.normalizedUrl)) continue;
      seenUrls.add(parsed.normalizedUrl);
      cleanedLinks.push({ label: lbl, url: parsed.normalizedUrl });
    }

    setSaving(true);
    try {
      if (target.kind === 'cpu') {
        await onSaveCpuLinks(
          target.cpu.id,
          parsedPrimary.normalizedUrl,
          cleanedLinks,
        );
      } else if (target.kind === 'gpu') {
        await onSaveGpuLinks(
          target.gpu.id,
          parsedPrimary.normalizedUrl,
          cleanedLinks,
        );
      } else if (target.kind === 'storage_drive') {
        await onSaveStorageDriveLinks(
          target.drive.id,
          parsedPrimary.normalizedUrl,
          cleanedLinks,
        );
      } else {
        const entry: PartSpecLinkEntry | null =
          parsedPrimary.normalizedUrl || cleanedLinks.length > 0
            ? {
                ...(parsedPrimary.normalizedUrl
                  ? { spec_url: parsedPrimary.normalizedUrl }
                  : {}),
                ...(cleanedLinks.length > 0 ? { links: cleanedLinks } : {}),
              }
            : null;
        await onSaveComputerSlotLinks(
          target.computerId,
          target.currentMap,
          target.slot,
          entry,
        );
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save links.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
              <Link2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">{meta.title}</h2>
              <p className="text-xs text-slate-400">{meta.subtitle}</p>
            </div>
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
          onSubmit={handleSubmit}
          className="space-y-4 overflow-y-auto p-5 text-xs"
        >
          {helperLinks.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5">
              <span className="text-[11px] font-medium text-slate-400">
                Find direct URLs:
              </span>
              {helperLinks.map((h) => (
                <a
                  key={h.label}
                  href={h.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-medium text-cyan-300 transition hover:border-cyan-500/50 hover:text-cyan-200"
                >
                  <Search className="h-3 w-3" />
                  {h.label}
                </a>
              ))}
            </div>
          ) : null}

          <div>
            <label className="mb-1 flex items-center justify-between text-xs font-medium text-slate-300">
              <span>Primary Canonical Spec URL</span>
              {safePrimaryPreview ? (
                <a
                  href={safePrimaryPreview}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-cyan-300 hover:underline"
                >
                  Test link <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </label>
            <input
              type="url"
              value={primaryUrl}
              onChange={(e) => setPrimaryUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-cyan-200 placeholder-slate-600 focus:border-cyan-400 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Opened when clicking the primary part name. Leave blank to fall back to automatic search.
            </p>
          </div>

          <div className="space-y-2.5 rounded-xl border border-slate-800 bg-slate-950/50 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-slate-300 uppercase">
                Secondary Research Links ({links.length})
              </span>
              <button
                type="button"
                onClick={() => handleAddRow('')}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-cyan-500/50 hover:text-white"
              >
                <Plus className="h-3.5 w-3.5 text-cyan-400" />
                Add Link
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-500">Quick add:</span>
              {presets.labelPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleAddRow(preset)}
                  className="rounded border border-slate-700/80 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-300 transition hover:border-cyan-500/50 hover:text-cyan-200"
                >
                  + {preset}
                </button>
              ))}
            </div>

            {links.length === 0 ? (
              <p className="text-[11px] text-slate-500">
                No custom secondary links added yet. Automatic research links (PassMark, TechPowerUp, Retro Web, Notebookcheck) are still included in the dropdown.
              </p>
            ) : (
              <div className="space-y-2">
                {links.map((row, idx) => (
                  <div
                    key={idx}
                    className="grid items-center gap-2 sm:grid-cols-12"
                  >
                    <input
                      type="text"
                      value={row.label}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLinks((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, label: val } : item,
                          ),
                        );
                      }}
                      placeholder="Label (e.g. PassMark)"
                      className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white sm:col-span-4"
                    />
                    <input
                      type="url"
                      value={row.url}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLinks((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, url: val } : item,
                          ),
                        );
                      }}
                      placeholder="https://..."
                      className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-cyan-200 sm:col-span-7"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setLinks((prev) => prev.filter((_, i) => i !== idx))
                      }
                      title="Remove link"
                      className="flex justify-center rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/15 hover:text-rose-300 sm:col-span-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-rose-300">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={() => {
                setPrimaryUrl('');
                setLinks([]);
              }}
              className="rounded-lg border border-slate-700/80 px-3 py-2 text-xs text-slate-400 hover:border-rose-500/40 hover:text-rose-300"
            >
              Clear all custom links
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-700 px-3.5 py-2 font-medium text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Links'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
