import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Globe, Plus, Search, X } from 'lucide-react';
import { formatDirectX } from '../lib/directx';
import type { Cpu, Gpu } from '../types/database';

type PartItem = Cpu | Gpu;

interface PartComboboxProps {
  partType: 'cpu' | 'gpu';
  label: string;
  parts: PartItem[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onOpenLookup: (mode: 'search' | 'manual', initialQuery: string) => void;
  placeholder?: string;
  hideMobileByDefault?: boolean;
  spareCountById?: Map<number, number>;
  installedCountById?: Map<number, number>;
}

function isCpu(item: PartItem, partType: 'cpu' | 'gpu'): item is Cpu {
  return partType === 'cpu' && 'cores' in item;
}

export function PartCombobox({
  partType,
  label,
  parts,
  selectedId,
  onSelect,
  onOpenLookup,
  placeholder,
  hideMobileByDefault = false,
  spareCountById,
  installedCountById,
}: PartComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showMobile, setShowMobile] = useState(!hideMobileByDefault);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setShowMobile(!hideMobileByDefault);
  }, [hideMobileByDefault]);

  const selected = useMemo(
    () => parts.find((p) => p.id === selectedId) ?? null,
    [parts, selectedId],
  );

  const hiddenMobileCount = useMemo(() => {
    if (!hideMobileByDefault || showMobile) return 0;
    return parts.filter((p) => p.is_mobile && p.id !== selectedId).length;
  }, [hideMobileByDefault, showMobile, parts, selectedId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return parts.filter((p) => {
      if (hideMobileByDefault && !showMobile && p.is_mobile && p.id !== selectedId) {
        return false;
      }
      if (!q) return true;
      return `${p.brand} ${p.name} ${isCpu(p, partType) ? p.socket ?? '' : ''}`
        .toLowerCase()
        .includes(q);
    });
  }, [parts, query, hideMobileByDefault, showMobile, selectedId, partType]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const renderSubtitle = (p: PartItem) => {
    if (isCpu(p, partType)) {
      return [
        p.cores ? `${p.cores}C/${p.threads ?? p.cores}T` : null,
        p.base_clock_ghz ? `${p.base_clock_ghz} GHz` : null,
        p.socket,
        p.passmark_score !== null
          ? `PM ${p.passmark_score.toLocaleString()}`
          : null,
        p.is_mobile ? 'Mobile' : 'Desktop',
      ]
        .filter(Boolean)
        .join(' · ');
    }
    const g = p as Gpu;
    return [
      g.vram_gb !== null ? `${g.vram_gb} GB ${g.vram_type ?? ''}` : null,
      formatDirectX(g.directx_version, g.directx_feature_level),
      g.passmark_score !== null
        ? `G3D ${g.passmark_score.toLocaleString()}`
        : null,
      g.is_mobile ? 'Mobile' : 'Desktop',
    ]
      .filter(Boolean)
      .join(' · ');
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1 block text-xs font-medium text-slate-300">
        {label}
      </label>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-left text-sm text-white hover:border-slate-500 focus:border-cyan-400 focus:outline-none"
        >
          <span className="truncate">
            {selected ? (
              <>
                <span className="font-medium">
                  {selected.brand} {selected.name}
                </span>
                <span className="ml-2 font-mono text-[11px] text-slate-400">
                  {renderSubtitle(selected)}
                </span>
              </>
            ) : (
              <span className="text-slate-500">
                {placeholder ?? `Select ${partType.toUpperCase()}...`}
              </span>
            )}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
        </button>

        {selectedId !== null ? (
          <button
            type="button"
            onClick={() => onSelect(null)}
            title="Clear selection"
            className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="absolute right-0 left-0 z-40 mt-1.5 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
          <div className="space-y-1.5 border-b border-slate-800 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Filter saved ${partType.toUpperCase()}s...`}
                className="w-full rounded-md border border-slate-700 bg-slate-950 py-1.5 pr-2.5 pl-8 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>
            {hideMobileByDefault && (hiddenMobileCount > 0 || showMobile) ? (
              <div className="flex items-center justify-between px-0.5 text-[11px] text-slate-400">
                <span>
                  {showMobile
                    ? 'Showing desktop + mobile/laptop chips'
                    : `Hiding ${hiddenMobileCount} mobile/laptop chips`}
                </span>
                <button
                  type="button"
                  onClick={() => setShowMobile((v) => !v)}
                  className="font-medium text-cyan-300 hover:underline"
                >
                  {showMobile ? 'Hide mobile' : `Show mobile (${hiddenMobileCount})`}
                </button>
              </div>
            ) : null}
          </div>

          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400">
                No saved {partType.toUpperCase()} matches &ldquo;{query}&rdquo;.
              </div>
            ) : (
              filtered.map((item) => {
                const spare = spareCountById?.get(item.id) ?? 0;
                const installed = installedCountById?.get(item.id) ?? 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelect(item.id);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={`flex w-full items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${
                      item.id === selectedId
                        ? 'bg-cyan-500/20 text-cyan-200'
                        : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">
                        {item.brand} {item.name}
                      </div>
                      <div className="truncate font-mono text-[11px] text-slate-400">
                        {renderSubtitle(item)}
                      </div>
                    </div>
                    {spare > 0 || installed > 0 ? (
                      <div className="flex shrink-0 items-center gap-1 pt-0.5 font-mono text-[10px]">
                        {spare > 0 ? (
                          <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">
                            {spare} spare
                          </span>
                        ) : null}
                        {installed > 0 ? (
                          <span className="rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-slate-400">
                            {installed} in use
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-slate-950/90 p-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenLookup('search', query);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/15 px-2.5 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25"
            >
              <Globe className="h-3.5 w-3.5" />
              Search Intel / AMD Specs
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenLookup('manual', query);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Manually
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface CatalogPartComboboxProps<T extends { id: number }> {
  label?: string;
  items: T[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onAddNew: (initialQuery: string) => void;
  addNewLabel: string;
  getLabel: (item: T) => string;
  getSubtitle?: (item: T) => string;
  getSearchText?: (item: T) => string;
  getSpareCount?: (item: T) => number;
  getInstalledCount?: (item: T) => number;
  isItemMobile?: (item: T) => boolean;
  hideMobileByDefault?: boolean;
  placeholder?: string;
  compact?: boolean;
}

export function CatalogPartCombobox<T extends { id: number }>({
  label,
  items,
  selectedId,
  onSelect,
  onAddNew,
  addNewLabel,
  getLabel,
  getSubtitle,
  getSearchText,
  getSpareCount,
  getInstalledCount,
  isItemMobile,
  hideMobileByDefault = false,
  placeholder = 'Select part...',
  compact = false,
}: CatalogPartComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showMobile, setShowMobile] = useState(!hideMobileByDefault);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setShowMobile(!hideMobileByDefault);
  }, [hideMobileByDefault]);

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId],
  );

  const hiddenMobileCount = useMemo(() => {
    if (!hideMobileByDefault || showMobile || !isItemMobile) return 0;
    return items.filter((i) => isItemMobile(i) && i.id !== selectedId).length;
  }, [hideMobileByDefault, showMobile, isItemMobile, items, selectedId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (
        hideMobileByDefault &&
        !showMobile &&
        isItemMobile?.(item) &&
        item.id !== selectedId
      ) {
        return false;
      }
      if (!q) return true;
      const haystack = (
        getSearchText
          ? getSearchText(item)
          : `${getLabel(item)} ${getSubtitle ? getSubtitle(item) : ''}`
      ).toLowerCase();
      return haystack.includes(q);
    });
  }, [
    items,
    query,
    hideMobileByDefault,
    showMobile,
    isItemMobile,
    selectedId,
    getSearchText,
    getLabel,
    getSubtitle,
  ]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedSubtitle =
    selected && getSubtitle ? getSubtitle(selected) : '';

  return (
    <div ref={containerRef} className="relative">
      {label ? (
        <label className="mb-1 block text-xs font-medium text-slate-300">
          {label}
        </label>
      ) : null}

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-950 text-left text-white hover:border-slate-500 focus:border-cyan-400 focus:outline-none ${
            compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'
          }`}
        >
          <span className="truncate">
            {selected ? (
              <>
                <span className="font-medium">{getLabel(selected)}</span>
                {selectedSubtitle ? (
                  <span className="ml-2 font-mono text-[11px] text-slate-400">
                    {selectedSubtitle}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-slate-500">{placeholder}</span>
            )}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
        </button>

        {selectedId !== null ? (
          <button
            type="button"
            onClick={() => onSelect(null)}
            title="Clear selection"
            className={`rounded-lg border border-slate-700 bg-slate-950 text-slate-400 hover:text-white ${
              compact ? 'p-1.5' : 'p-2'
            }`}
          >
            <X className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="absolute right-0 left-0 z-40 mt-1.5 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
          <div className="space-y-1.5 border-b border-slate-800 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search catalog parts..."
                className="w-full rounded-md border border-slate-700 bg-slate-950 py-1.5 pr-2.5 pl-8 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
            </div>
            {hideMobileByDefault && (hiddenMobileCount > 0 || showMobile) ? (
              <div className="flex items-center justify-between px-0.5 text-[11px] text-slate-400">
                <span>
                  {showMobile
                    ? 'Showing desktop + laptop/mobile parts'
                    : `Hiding ${hiddenMobileCount} laptop/mobile parts`}
                </span>
                <button
                  type="button"
                  onClick={() => setShowMobile((v) => !v)}
                  className="font-medium text-cyan-300 hover:underline"
                >
                  {showMobile
                    ? 'Hide laptop parts'
                    : `Show laptop parts (${hiddenMobileCount})`}
                </button>
              </div>
            ) : null}
          </div>

          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400">
                {query.trim()
                  ? `No saved parts match "${query}".`
                  : 'No saved parts in catalog yet.'}
              </div>
            ) : (
              filtered.map((item) => {
                const spare = getSpareCount ? getSpareCount(item) : 0;
                const installed = getInstalledCount
                  ? getInstalledCount(item)
                  : 0;
                const sub = getSubtitle ? getSubtitle(item) : '';
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelect(item.id);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={`flex w-full items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${
                      item.id === selectedId
                        ? 'bg-cyan-500/20 text-cyan-200'
                        : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">
                        {getLabel(item)}
                      </div>
                      {sub ? (
                        <div className="truncate font-mono text-[11px] text-slate-400">
                          {sub}
                        </div>
                      ) : null}
                    </div>
                    {spare > 0 || installed > 0 ? (
                      <div className="flex shrink-0 items-center gap-1 pt-0.5 font-mono text-[10px]">
                        {spare > 0 ? (
                          <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">
                            {spare} spare
                          </span>
                        ) : null}
                        {installed > 0 ? (
                          <span className="rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-slate-400">
                            {installed} in use
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-slate-800 bg-slate-950/90 p-2">
            <button
              type="button"
              onClick={() => {
                const q = query.trim();
                setOpen(false);
                setQuery('');
                onAddNew(q);
              }}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/25"
            >
              <Plus className="h-3.5 w-3.5" />
              {query.trim()
                ? `${addNewLabel} "${query.trim()}"`
                : addNewLabel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
