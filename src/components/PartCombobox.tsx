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
}: PartComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => parts.find((p) => p.id === selectedId) ?? null,
    [parts, selectedId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return parts;
    return parts.filter((p) =>
      `${p.brand} ${p.name}`.toLowerCase().includes(q),
    );
  }, [parts, query]);

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
        p.is_mobile ? 'Mobile' : 'Desktop',
      ]
        .filter(Boolean)
        .join(' · ');
    }
    const g = p as Gpu;
    return [
      g.vram_gb !== null ? `${g.vram_gb} GB ${g.vram_type ?? ''}` : null,
      formatDirectX(g.directx_version, g.directx_feature_level),
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
                <span className="font-medium">{selected.brand} {selected.name}</span>
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
          <div className="border-b border-slate-800 p-2">
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
          </div>

          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400">
                No saved {partType.toUpperCase()} matches &ldquo;{query}&rdquo;.
              </div>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelect(item.id);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={`flex w-full flex-col rounded-lg px-2.5 py-2 text-left text-xs transition ${
                    item.id === selectedId
                      ? 'bg-cyan-500/20 text-cyan-200'
                      : 'text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <span className="font-semibold">
                    {item.brand} {item.name}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    {renderSubtitle(item)}
                  </span>
                </button>
              ))
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
