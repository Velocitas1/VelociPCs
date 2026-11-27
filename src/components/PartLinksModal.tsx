import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link2, X } from 'lucide-react';
import {
  applySlotResultsFillBlanks,
  lookupPartLinksAndSpecs,
  type SlotLookupResult,
} from '../lib/linkLookup';
import {
  COMPUTER_SLOT_META,
  getSmartLinkSlots,
  parseHttpUrl,
  type PartLinkPresetKind,
} from '../lib/specLinks';
import type {
  ComputerPartLinkSlot,
  Cpu,
  Gpu,
  PartSpecLinkEntry,
  PartSpecLinksMap,
  SpareTableName,
  SpecLinkItem,
  StorageDrive,
} from '../types/database';
import { SmartLinksEditor } from './SmartLinksEditor';

export type PartLinksEditTarget =
  | { kind: 'cpu'; cpu: Cpu }
  | { kind: 'gpu'; gpu: Gpu }
  | { kind: 'storage_drive'; rigName: string; drive: StorageDrive }
  | {
      kind: 'catalog_part';
      table: Exclude<SpareTableName, 'cpus'>;
      id: number;
      presetKind: PartLinkPresetKind;
      partLabel: string;
      subtitle: string;
      specUrl: string | null;
      specLinks: SpecLinkItem[];
    }
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
  onSaveCatalogPartLinks: (
    table: Exclude<SpareTableName, 'cpus'>,
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
  brand: string;
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
        brand: target.cpu.brand,
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
        brand: target.gpu.brand,
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
        brand: target.drive.brand ?? '',
        title: `Edit Links · ${label}`,
        subtitle: `${target.rigName} · Storage Drive`,
        searchQuery: [target.drive.brand, target.drive.model_number || target.drive.model]
          .filter(Boolean)
          .join(' '),
        initialPrimary: target.drive.spec_url ?? '',
        initialLinks: target.drive.spec_links ?? [],
      };
    }
    case 'catalog_part': {
      return {
        presetKind: target.presetKind,
        brand: target.partLabel.split(/\s+/)[0] ?? '',
        title: `Edit Links · ${target.partLabel}`,
        subtitle: target.subtitle,
        searchQuery: target.partLabel,
        initialPrimary: target.specUrl ?? '',
        initialLinks: target.specLinks ?? [],
      };
    }
    case 'computer_slot': {
      const existing = target.currentMap[target.slot];
      const slotMeta = COMPUTER_SLOT_META[target.slot];
      return {
        presetKind: target.slot,
        brand: target.partLabel ? target.partLabel.split(/\s+/)[0] ?? '' : '',
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
  onSaveCatalogPartLinks,
  onSaveComputerSlotLinks,
}: PartLinksModalProps) {
  const [primaryUrl, setPrimaryUrl] = useState('');
  const [links, setLinks] = useState<Array<{ label: string; url: string }>>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupNote, setLookupNote] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [searchProvider, setSearchProvider] = useState<'serper' | 'brave' | 'free' | null>(null);
  const [slotResults, setSlotResults] = useState<Record<string, SlotLookupResult>>({});
  const lookupRequestIdRef = useRef(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    lookupRequestIdRef.current += 1;
    setLookupLoading(false);
    setLookupNote(null);
    setLookupError(null);
    setSearchProvider(null);
    setSlotResults({});
    if (!target) return;
    const meta = getTargetMeta(target);
    setPrimaryUrl(meta.initialPrimary);
    setLinks(meta.initialLinks.map((l) => ({ ...l })));
    setError(null);
  }, [target]);

  if (!target) return null;

  const meta = getTargetMeta(target);

  const handleAutoFindLinks = async () => {
    if (!meta.searchQuery.trim()) return;
    const requestId = ++lookupRequestIdRef.current;
    setLookupLoading(true);
    setLookupError(null);
    setLookupNote(null);

    try {
      const slots = getSmartLinkSlots(meta.presetKind, meta.brand).map((s) => s.id);
      const data = await lookupPartLinksAndSpecs({
        query: meta.searchQuery,
        partType: meta.presetKind,
        brand: meta.brand || undefined,
        slots,
      });
      if (requestId !== lookupRequestIdRef.current) return;

      setSlotResults(data.slotResults);
      setSearchProvider(data.searchProvider);
      setLookupNote(data.note);

      const applied = applySlotResultsFillBlanks({
        partKind: meta.presetKind,
        brand: meta.brand,
        currentSpecUrl: primaryUrl,
        currentSpecLinks: links,
        slotResults: data.slotResults,
      });
      if (applied.filledCount > 0) {
        setPrimaryUrl(applied.specUrl);
        setLinks(applied.specLinks);
      }
    } catch (err) {
      if (requestId !== lookupRequestIdRef.current) return;
      setLookupError(
        err instanceof Error
          ? err.message
          : 'Auto-lookup failed. Ensure you are signed in or paste links manually.',
      );
    } finally {
      if (requestId === lookupRequestIdRef.current) {
        setLookupLoading(false);
      }
    }
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
      if (!rawUrl) continue;
      if (!lbl) {
        setError(`Custom link #${i + 1} needs a label.`);
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
      } else if (target.kind === 'catalog_part') {
        await onSaveCatalogPartLinks(
          target.table,
          target.id,
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
          <SmartLinksEditor
            partKind={meta.presetKind}
            brand={meta.brand}
            query={meta.searchQuery}
            specUrl={primaryUrl}
            specLinks={links}
            onChange={(next) => {
              setPrimaryUrl(next.specUrl);
              setLinks(next.specLinks);
            }}
            onRunAutoLookup={() => void handleAutoFindLinks()}
            lookupLoading={lookupLoading}
            lookupNote={lookupNote}
            lookupError={lookupError}
            searchProvider={searchProvider}
            slotResults={slotResults}
          />

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
