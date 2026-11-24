import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Search,
  Square,
  Table2,
} from 'lucide-react';
import { getLatestBenchmarksMap, getSafeThreeDMarkUrl } from '../lib/benchmarks';
import type { CompareState } from '../lib/compare';
import { getDirectXTierRank } from '../lib/directx';
import {
  formatPassMark,
  formatShortRank,
  getCompositeTooltip,
  getRankBadgeClasses,
  type RigFleetStanding,
} from '../lib/scoring';
import { buildCpuResearchLinks, buildGpuResearchLinks } from '../lib/specLinks';
import type {
  Benchmark,
  ComputerWithRelations,
  DeviceType,
} from '../types/database';
import { DetailedComparePanel } from './DetailedComparePanel';
import { DirectXBadge } from './DirectXBadge';
import type { PartLinksEditTarget } from './PartLinksModal';
import { SpecLink } from './SpecLink';

function MatrixScoreCell({
  benchmark,
}: {
  benchmark: Benchmark | undefined;
}) {
  if (!benchmark) {
    return <span className="text-slate-600">—</span>;
  }
  const safeUrl = getSafeThreeDMarkUrl(benchmark.result_url);
  if (!safeUrl) {
    return <>{benchmark.score.toLocaleString()}</>;
  }
  return (
    <a
      href={safeUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open ${benchmark.suite_name} result on 3DMark`}
      className="inline-flex items-center justify-end gap-1 underline decoration-amber-400/50 underline-offset-2 transition hover:text-amber-200 hover:decoration-amber-300"
    >
      {benchmark.score.toLocaleString()}
      <ExternalLink className="h-3 w-3 shrink-0" />
    </a>
  );
}

interface ComparisonMatrixViewProps {
  computers: ComputerWithRelations[];
  fleetStandings: Map<number, RigFleetStanding>;
  compareState: CompareState;
  onChangeCompareState: (
    updater: CompareState | ((prev: CompareState) => CompareState),
  ) => void;
  onSelectComputer: (rig: ComputerWithRelations) => void;
  onNotify: (message: string) => void;
  onEditPartLinks?: (target: PartLinksEditTarget) => void;
}

type SortKey =
  | 'fleet_rank'
  | 'name'
  | 'device_type'
  | 'cpu'
  | 'cores'
  | 'cpu_passmark'
  | 'gpu'
  | 'vram'
  | 'gpu_passmark'
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
  fleetStandings,
  compareState,
  onChangeCompareState,
  onSelectComputer,
  onNotify,
  onEditPartLinks,
}: ComparisonMatrixViewProps) {
  const [typeFilter, setTypeFilter] = useState<'All' | DeviceType>('All');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('fleet_rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [fleetMatrixOpen, setFleetMatrixOpen] = useState(true);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(
        key === 'name' || key === 'device_type' || key === 'fleet_rank'
          ? 'asc'
          : 'desc',
      );
    }
  };

  const togglePin = (id: number) => {
    onChangeCompareState((prev) => ({
      ...prev,
      ids: prev.ids.includes(id)
        ? prev.ids.filter((x) => x !== id)
        : [...prev.ids, id],
    }));
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = computers.filter((c) => {
      if (typeFilter !== 'All' && c.device_type !== typeFilter) return false;
      if (!q) return true;
      return `${c.name} ${c.cpu?.name ?? ''} ${c.gpu?.name ?? ''} ${c.igpu?.name ?? ''} ${c.brand ?? ''} ${c.model ?? ''}`
        .toLowerCase()
        .includes(q);
    });

    const getNullableScore = (
      c: ComputerWithRelations,
      key: 'fleet_rank' | 'cpu_passmark' | 'gpu_passmark',
    ): number | null => {
      const standing = fleetStandings.get(c.id);
      if (key === 'fleet_rank') return standing?.overallRank?.rank ?? null;
      if (key === 'cpu_passmark') return standing?.effectiveCpuScore ?? null;
      return standing?.effectiveGpuScore ?? null;
    };

    const getVal = (c: ComputerWithRelations, key: SortKey): string | number => {
      const benchmarks = getLatestBenchmarksMap(c);
      const totalStorage = c.storage_drives.reduce(
        (sum, d) => sum + (d.capacity_gb ?? 0),
        0,
      );
      const effectiveGpu = c.gpu ?? c.igpu;
      switch (key) {
        case 'fleet_rank':
          return (
            fleetStandings.get(c.id)?.overallRank?.rank ??
            Number.MAX_SAFE_INTEGER
          );
        case 'name':
          return c.name.toLowerCase();
        case 'device_type':
          return c.device_type;
        case 'cpu':
          return (c.cpu?.name ?? '').toLowerCase();
        case 'cores':
          return (c.cpu?.cores ?? 0) * c.cpu_count;
        case 'cpu_passmark':
          return fleetStandings.get(c.id)?.effectiveCpuScore ?? -1;
        case 'gpu':
          return (effectiveGpu?.name ?? '').toLowerCase();
        case 'vram':
          return effectiveGpu?.vram_gb ?? -1;
        case 'gpu_passmark':
          return fleetStandings.get(c.id)?.effectiveGpuScore ?? -1;
        case 'directx':
          return getDirectXTierRank(
            effectiveGpu?.directx_version,
            effectiveGpu?.directx_feature_level,
          );
        case 'ram':
          return c.ram_gb ?? -1;
        case 'storage':
          return totalStorage || -1;
        case 'build_date':
          return c.build_date ?? '';
        case 'cloud_gate':
          return benchmarks['Cloud Gate']?.score ?? -1;
        case 'sky_diver':
          return benchmarks['Sky Diver']?.score ?? -1;
        case 'fire_strike':
          return benchmarks['Fire Strike']?.score ?? -1;
        case 'time_spy':
          return benchmarks['Time Spy']?.score ?? -1;
      }
    };

    return [...filtered].sort((a, b) => {
      if (
        sortKey === 'fleet_rank' ||
        sortKey === 'cpu_passmark' ||
        sortKey === 'gpu_passmark'
      ) {
        const av = getNullableScore(a, sortKey);
        const bv = getNullableScore(b, sortKey);
        if (av !== null && bv !== null) {
          const cmp = sortDir === 'asc' ? av - bv : bv - av;
          return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
        }
        if (av !== null) return -1;
        if (bv !== null) return 1;
        return a.name.localeCompare(b.name);
      }

      const av = getVal(a, sortKey);
      const bv = getVal(b, sortKey);
      if (typeof av === 'number' && typeof bv === 'number') {
        const cmp = sortDir === 'asc' ? av - bv : bv - av;
        return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [computers, fleetStandings, typeFilter, search, sortKey, sortDir]);

  const selectedIdSet = useMemo(
    () => new Set(compareState.ids),
    [compareState.ids],
  );

  const allFilteredSelected =
    rows.length > 0 && rows.every((r) => selectedIdSet.has(r.id));

  const handleToggleFilteredSelection = () => {
    if (rows.length === 0) return;
    const rowIds = rows.map((r) => r.id);
    const rowIdSet = new Set(rowIds);

    onChangeCompareState((prev) => {
      if (allFilteredSelected) {
        return {
          ...prev,
          ids: prev.ids.filter((id) => !rowIdSet.has(id)),
        };
      }
      const existing = new Set(prev.ids);
      const added = rowIds.filter((id) => !existing.has(id));
      return {
        ...prev,
        ids: [...prev.ids, ...added],
      };
    });
  };

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
      {/* Detailed Draggable & Sortable Side-by-Side Comparison */}
      <DetailedComparePanel
        computers={computers}
        filteredComputers={rows}
        fleetStandings={fleetStandings}
        compareState={compareState}
        onChangeCompareState={onChangeCompareState}
        onSelectComputer={onSelectComputer}
        onNotify={onNotify}
        onEditPartLinks={onEditPartLinks}
      />

      {/* Collapsible Fleet Selector Matrix */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/60">
        <div
          onClick={() => setFleetMatrixOpen((open) => !open)}
          className="flex cursor-pointer flex-wrap items-center justify-between gap-3 px-4 py-3 select-none"
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setFleetMatrixOpen((open) => !open);
              }}
              aria-expanded={fleetMatrixOpen}
              className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-200 uppercase"
            >
              {fleetMatrixOpen ? (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-400" />
              )}
              <Table2 className="h-4 w-4 text-cyan-400" />
              Fleet Selector Matrix
            </button>
            <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-[11px] text-slate-300">
              {rows.length} of {computers.length} Rigs
            </span>
            {compareState.ids.length > 0 ? (
              <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 font-mono text-[11px] font-medium text-cyan-200">
                {compareState.ids.length} selected
              </span>
            ) : null}
          </div>

          <div
            onClick={(e) => e.stopPropagation()}
            className="flex flex-wrap items-center gap-2"
          >
            <button
              type="button"
              onClick={handleToggleFilteredSelection}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:border-cyan-500/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {allFilteredSelected ? (
                <>
                  <Square className="h-3.5 w-3.5 text-slate-400" />
                  Deselect Filtered ({rows.length})
                </>
              ) : (
                <>
                  <CheckSquare className="h-3.5 w-3.5 text-cyan-400" />
                  Select All Filtered ({rows.length})
                </>
              )}
            </button>
          </div>
        </div>

        {fleetMatrixOpen ? (
          <div className="space-y-3 border-t border-slate-800/80 p-3.5">
            {/* Filter & Search Controls */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                  Check any number of rigs to compare side-by-side
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

            {/* Matrix Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/75">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950/80">
                  <tr>
                    <th className="px-3 py-2.5 text-center text-slate-500">
                      Compare
                    </th>
                    <SortHeader label="Fleet" colKey="fleet_rank" />
                    <SortHeader label="Rig" colKey="name" />
                    <SortHeader label="Type" colKey="device_type" />
                    <SortHeader label="CPU" colKey="cpu" />
                    <SortHeader label="C/T" colKey="cores" align="right" />
                    <SortHeader
                      label="CPU Mark"
                      colKey="cpu_passmark"
                      align="right"
                    />
                    <SortHeader label="GPU" colKey="gpu" />
                    <SortHeader label="VRAM" colKey="vram" align="right" />
                    <SortHeader
                      label="GPU Mark"
                      colKey="gpu_passmark"
                      align="right"
                    />
                    <SortHeader label="DirectX" colKey="directx" />
                    <SortHeader label="RAM" colKey="ram" align="right" />
                    <SortHeader label="Storage" colKey="storage" align="right" />
                    <SortHeader
                      label="Cloud Gate"
                      colKey="cloud_gate"
                      align="right"
                    />
                    <SortHeader
                      label="Sky Diver"
                      colKey="sky_diver"
                      align="right"
                    />
                    <SortHeader
                      label="Fire Strike"
                      colKey="fire_strike"
                      align="right"
                    />
                    <SortHeader
                      label="Time Spy"
                      colKey="time_spy"
                      align="right"
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={17}
                        className="px-4 py-8 text-center text-xs text-slate-400"
                      >
                        No machines match the current filter.
                      </td>
                    </tr>
                  ) : (
                    rows.map((rig) => {
                      const benchmarks = getLatestBenchmarksMap(rig);
                      const standing = fleetStandings.get(rig.id);
                      const effectiveGpu = rig.gpu ?? rig.igpu;
                      const totalStorage = rig.storage_drives.reduce(
                        (sum, d) => sum + (d.capacity_gb ?? 0),
                        0,
                      );
                      const pinned = selectedIdSet.has(rig.id);

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
                          <td className="px-3 py-2.5 font-mono whitespace-nowrap">
                            {standing?.overallRank ? (
                              <span
                                title={getCompositeTooltip(standing)}
                                className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[11px] font-semibold ${getRankBadgeClasses(
                                  standing.overallRank,
                                )}`}
                              >
                                {formatShortRank(standing.overallRank)}
                                {standing.isPartial ? (
                                  <span className="text-amber-300">*</span>
                                ) : null}
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
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
                                compact
                                label={`${rig.cpu.brand} ${rig.cpu.name}`}
                                prefix={
                                  rig.cpu_count > 1
                                    ? `${rig.cpu_count}x`
                                    : undefined
                                }
                                links={buildCpuResearchLinks(rig.cpu)}
                                onEditLinks={
                                  onEditPartLinks
                                    ? () =>
                                        onEditPartLinks({
                                          kind: 'cpu',
                                          cpu: rig.cpu!,
                                        })
                                    : undefined
                                }
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
                          <td
                            title={
                              standing?.cpuMultiplier &&
                              standing.cpuMultiplier > 1 &&
                              rig.cpu?.passmark_score
                                ? `${formatPassMark(rig.cpu.passmark_score)} × ${standing.cpuMultiplier} (${rig.cpu_count} sockets)`
                                : undefined
                            }
                            className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-cyan-200"
                          >
                            {standing?.effectiveCpuScore !== null &&
                            standing?.effectiveCpuScore !== undefined ? (
                              <>
                                {formatPassMark(standing.effectiveCpuScore)}
                                {standing.cpuMultiplier > 1 ? (
                                  <span className="ml-1 text-[10px] text-slate-400">
                                    ×{standing.cpuMultiplier}
                                  </span>
                                ) : null}
                              </>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {rig.gpu ? (
                              <SpecLink
                                compact
                                label={`${rig.gpu.brand} ${rig.gpu.name}`}
                                links={buildGpuResearchLinks(rig.gpu, {
                                  manufacturer: rig.gpu_aib_manufacturer,
                                  model: rig.gpu_aib_model,
                                  savedEntry: rig.part_spec_links?.gpu_aib,
                                })}
                                onEditLinks={
                                  onEditPartLinks
                                    ? () =>
                                        onEditPartLinks({
                                          kind: 'gpu',
                                          gpu: rig.gpu!,
                                        })
                                    : undefined
                                }
                              />
                            ) : rig.igpu ? (
                              <SpecLink
                                compact
                                label={`${rig.igpu.brand} ${rig.igpu.name}`}
                                prefix="iGPU"
                                links={buildGpuResearchLinks(rig.igpu)}
                                onEditLinks={
                                  onEditPartLinks
                                    ? () =>
                                        onEditPartLinks({
                                          kind: 'gpu',
                                          gpu: rig.igpu!,
                                        })
                                    : undefined
                                }
                              />
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-slate-300">
                            {effectiveGpu?.vram_gb !== null &&
                            effectiveGpu?.vram_gb !== undefined
                              ? `${effectiveGpu.vram_gb} GB`
                              : '—'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-emerald-200">
                            {standing?.effectiveGpuScore !== null &&
                            standing?.effectiveGpuScore !== undefined ? (
                              <>
                                {formatPassMark(standing.effectiveGpuScore)}
                                {standing.gpuSource === 'igpu' ? (
                                  <span className="ml-1 text-[10px] text-slate-400">
                                    iGPU
                                  </span>
                                ) : null}
                              </>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <DirectXBadge
                              version={effectiveGpu?.directx_version}
                              featureLevel={effectiveGpu?.directx_feature_level}
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
                            <MatrixScoreCell
                              benchmark={benchmarks['Cloud Gate']}
                            />
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-amber-300">
                            <MatrixScoreCell
                              benchmark={benchmarks['Sky Diver']}
                            />
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-amber-300">
                            <MatrixScoreCell
                              benchmark={benchmarks['Fire Strike']}
                            />
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-amber-300">
                            <MatrixScoreCell
                              benchmark={benchmarks['Time Spy']}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
