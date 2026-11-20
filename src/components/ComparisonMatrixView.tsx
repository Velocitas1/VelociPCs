import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, GitCompare, Search, X } from 'lucide-react';
import { getLatestScoresMap } from '../lib/aiExport';
import { getDirectXTierRank } from '../lib/directx';
import type { ComputerWithRelations, DeviceType } from '../types/database';
import { DirectXBadge } from './DirectXBadge';
import { SpecLink } from './SpecLink';

interface ComparisonMatrixViewProps {
  computers: ComputerWithRelations[];
  onSelectComputer: (rig: ComputerWithRelations) => void;
}

type SortKey =
  | 'name'
  | 'device_type'
  | 'cpu'
  | 'cores'
  | 'gpu'
  | 'vram'
  | 'directx'
  | 'ram'
  | 'storage'
  | 'build_date'
  | 'cloud_gate'
  | 'sky_diver'
  | 'fire_strike'
  | 'time_spy';

export function ComparisonMatrixView({
  computers,
  onSelectComputer,
}: ComparisonMatrixViewProps) {
  const [typeFilter, setTypeFilter] = useState<'All' | DeviceType>('All');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('time_spy');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [pinnedIds, setPinnedIds] = useState<number[]>([]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'device_type' ? 'asc' : 'desc');
    }
  };

  const togglePin = (id: number) => {
    setPinnedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return [...prev.slice(1), id];
      return [...prev, id];
    });
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = computers.filter((c) => {
      if (typeFilter !== 'All' && c.device_type !== typeFilter) return false;
      if (!q) return true;
      return `${c.name} ${c.cpu?.name ?? ''} ${c.gpu?.name ?? ''} ${c.brand ?? ''} ${c.model ?? ''}`
        .toLowerCase()
        .includes(q);
    });

    const getVal = (c: ComputerWithRelations, key: SortKey): string | number => {
      const scores = getLatestScoresMap(c);
      const totalStorage = c.storage_drives.reduce(
        (sum, d) => sum + (d.capacity_gb ?? 0),
        0,
      );
      switch (key) {
        case 'name':
          return c.name.toLowerCase();
        case 'device_type':
          return c.device_type;
        case 'cpu':
          return (c.cpu?.name ?? '').toLowerCase();
        case 'cores':
          return (c.cpu?.cores ?? 0) * c.cpu_count;
        case 'gpu':
          return (c.gpu?.name ?? '').toLowerCase();
        case 'vram':
          return c.gpu?.vram_gb ?? -1;
        case 'directx':
          return getDirectXTierRank(
            c.gpu?.directx_version,
            c.gpu?.directx_feature_level,
          );
        case 'ram':
          return c.ram_gb ?? -1;
        case 'storage':
          return totalStorage || -1;
        case 'build_date':
          return c.build_date ?? '';
        case 'cloud_gate':
          return scores['Cloud Gate'] ?? -1;
        case 'sky_diver':
          return scores['Sky Diver'] ?? -1;
        case 'fire_strike':
          return scores['Fire Strike'] ?? -1;
        case 'time_spy':
          return scores['Time Spy'] ?? -1;
      }
    };

    return [...filtered].sort((a, b) => {
      const av = getVal(a, sortKey);
      const bv = getVal(b, sortKey);
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [computers, typeFilter, search, sortKey, sortDir]);

  const pinnedRigs = useMemo(
    () =>
      pinnedIds
        .map((id) => computers.find((c) => c.id === id))
        .filter((x): x is ComputerWithRelations => Boolean(x)),
    [pinnedIds, computers],
  );

  const SortHeader = ({
    label,
    colKey,
    align = 'left',
  }: {
    label: string;
    colKey: SortKey;
    align?: 'left' | 'right';
  }) => {
    const active = sortKey === colKey;
    return (
      <th
        className={`px-3 py-2.5 font-semibold whitespace-nowrap ${
          align === 'right' ? 'text-right' : 'text-left'
        }`}
      >
        <button
          type="button"
          onClick={() => handleSort(colKey)}
          className={`inline-flex items-center gap-1 text-xs transition ${
            active ? 'text-cyan-300' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {label}
          {active ? (
            sortDir === 'asc' ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-40" />
          )}
        </button>
      </th>
    );
  };

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {(['All', 'Desktop', 'Laptop'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                typeFilter === t
                  ? 'bg-cyan-500 text-slate-950'
                  : 'border border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'
              }`}
            >
              {t === 'All' ? 'All Devices' : `${t}s`}
            </button>
          ))}
          <span className="ml-1 text-xs text-slate-400">
            Select up to 4 rows to compare side-by-side
          </span>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter matrix..."
            className="w-full rounded-lg border border-slate-700 bg-slate-950 py-1.5 pr-3 pl-9 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Pinned Side-by-Side Panel */}
      {pinnedRigs.length >= 2 ? (
        <section className="rounded-xl border border-cyan-500/35 bg-slate-900/90 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300 uppercase">
              <GitCompare className="h-4 w-4" />
              Side-by-Side Comparison ({pinnedRigs.length} Rigs)
            </div>
            <button
              type="button"
              onClick={() => setPinnedIds([])}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
              Clear Selection
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 pr-4 font-medium">Spec</th>
                  {pinnedRigs.map((r) => (
                    <th key={r.id} className="min-w-[180px] px-3 py-2 font-bold text-white">
                      {r.name}
                      <span className="ml-1.5 font-normal text-slate-400">
                        ({r.device_type})
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                <tr>
                  <td className="py-2 pr-4 text-slate-400">CPU</td>
                  {pinnedRigs.map((r) => (
                    <td key={r.id} className="px-3 py-2">
                      {r.cpu ? (
                        <SpecLink
                          label={`${r.cpu.brand} ${r.cpu.name}`}
                          prefix={r.cpu_count > 1 ? `${r.cpu_count}x` : undefined}
                          specUrl={r.cpu.spec_url}
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-slate-400">Cores / Clock</td>
                  {pinnedRigs.map((r) => (
                    <td key={r.id} className="px-3 py-2 font-mono text-slate-200">
                      {r.cpu
                        ? `${(r.cpu.cores ?? 0) * r.cpu_count}C/${
                            (r.cpu.threads ?? 0) * r.cpu_count
                          }T @ ${r.cpu.base_clock_ghz ?? '?'} GHz`
                        : '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-slate-400">GPU</td>
                  {pinnedRigs.map((r) => (
                    <td key={r.id} className="px-3 py-2">
                      {r.gpu ? (
                        <SpecLink
                          label={`${r.gpu.brand} ${r.gpu.name}`}
                          specUrl={r.gpu.spec_url}
                        />
                      ) : (
                        'Integrated / None'
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-slate-400">DirectX Support</td>
                  {pinnedRigs.map((r) => (
                    <td key={r.id} className="px-3 py-2">
                      <DirectXBadge
                        version={r.gpu?.directx_version}
                        featureLevel={r.gpu?.directx_feature_level}
                        compact
                      />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-slate-400">VRAM / RAM</td>
                  {pinnedRigs.map((r) => (
                    <td key={r.id} className="px-3 py-2 font-mono text-slate-200">
                      {r.gpu?.vram_gb !== null && r.gpu?.vram_gb !== undefined
                        ? `${r.gpu.vram_gb} GB VRAM`
                        : '— VRAM'}{' '}
                      · {r.ram_gb ? `${r.ram_gb} GB RAM` : '— RAM'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2 pr-4 text-slate-400">
                    3DMark (TS / FS / SD / CG)
                  </td>
                  {pinnedRigs.map((r) => {
                    const s = getLatestScoresMap(r);
                    return (
                      <td key={r.id} className="px-3 py-2 font-mono text-amber-300">
                        {[
                          s['Time Spy'] !== undefined ? `TS ${s['Time Spy']}` : null,
                          s['Fire Strike'] !== undefined
                            ? `FS ${s['Fire Strike']}`
                            : null,
                          s['Sky Diver'] !== undefined
                            ? `SD ${s['Sky Diver']}`
                            : null,
                          s['Cloud Gate'] !== undefined
                            ? `CG ${s['Cloud Gate']}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* Matrix Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/75">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-slate-950/80">
            <tr>
              <th className="px-3 py-2.5 text-center text-slate-500">Pin</th>
              <SortHeader label="Rig" colKey="name" />
              <SortHeader label="Type" colKey="device_type" />
              <SortHeader label="CPU" colKey="cpu" />
              <SortHeader label="C/T" colKey="cores" align="right" />
              <SortHeader label="GPU" colKey="gpu" />
              <SortHeader label="VRAM" colKey="vram" align="right" />
              <SortHeader label="DirectX" colKey="directx" />
              <SortHeader label="RAM" colKey="ram" align="right" />
              <SortHeader label="Storage" colKey="storage" align="right" />
              <SortHeader label="Cloud Gate" colKey="cloud_gate" align="right" />
              <SortHeader label="Sky Diver" colKey="sky_diver" align="right" />
              <SortHeader label="Fire Strike" colKey="fire_strike" align="right" />
              <SortHeader label="Time Spy" colKey="time_spy" align="right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {rows.map((rig) => {
              const scores = getLatestScoresMap(rig);
              const totalStorage = rig.storage_drives.reduce(
                (sum, d) => sum + (d.capacity_gb ?? 0),
                0,
              );
              const pinned = pinnedIds.includes(rig.id);

              return (
                <tr
                  key={rig.id}
                  className={`transition hover:bg-slate-800/50 ${
                    pinned ? 'bg-cyan-500/5' : ''
                  }`}
                >
                  <td className="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={pinned}
                      onChange={() => togglePin(rig.id)}
                      aria-label={`Select ${rig.name} for comparison`}
                      className="rounded border-slate-600 bg-slate-950 text-cyan-500"
                    />
                  </td>
                  <td className="px-3 py-2.5 font-semibold whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onSelectComputer(rig)}
                      className="text-left text-white hover:text-cyan-300"
                    >
                      {rig.name}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                        rig.device_type === 'Laptop'
                          ? 'bg-violet-500/15 text-violet-300'
                          : 'bg-sky-500/15 text-sky-300'
                      }`}
                    >
                      {rig.device_type}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {rig.cpu ? (
                      <SpecLink
                        label={`${rig.cpu.brand} ${rig.cpu.name}`}
                        prefix={rig.cpu_count > 1 ? `${rig.cpu_count}x` : undefined}
                        specUrl={rig.cpu.spec_url}
                      />
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-slate-300">
                    {rig.cpu
                      ? `${(rig.cpu.cores ?? 0) * rig.cpu_count}/${
                          (rig.cpu.threads ?? 0) * rig.cpu_count
                        }`
                      : '—'}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {rig.gpu ? (
                      <SpecLink
                        label={`${rig.gpu.brand} ${rig.gpu.name}`}
                        specUrl={rig.gpu.spec_url}
                      />
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-slate-300">
                    {rig.gpu?.vram_gb !== null && rig.gpu?.vram_gb !== undefined
                      ? `${rig.gpu.vram_gb} GB`
                      : '—'}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <DirectXBadge
                      version={rig.gpu?.directx_version}
                      featureLevel={rig.gpu?.directx_feature_level}
                      compact
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-slate-300">
                    {rig.ram_gb ? `${rig.ram_gb} GB` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-slate-300">
                    {totalStorage ? `${totalStorage} GB` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-amber-300">
                    {scores['Cloud Gate']?.toLocaleString() ?? (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-amber-300">
                    {scores['Sky Diver']?.toLocaleString() ?? (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-amber-300">
                    {scores['Fire Strike']?.toLocaleString() ?? (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-amber-300">
                    {scores['Time Spy']?.toLocaleString() ?? (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
