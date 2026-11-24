import { useMemo, useState } from 'react';
import { Cpu as CpuIcon, Edit3, Globe, Monitor, Search, Trash2 } from 'lucide-react';
import {
  computeCatalogRanks,
  formatPassMark,
  formatScoreUpdatedDate,
  formatShortRank,
  getRankBadgeClasses,
} from '../lib/scoring';
import { buildCpuResearchLinks, buildGpuResearchLinks } from '../lib/specLinks';
import type { ComputerWithRelations, Cpu, Gpu } from '../types/database';
import { DirectXBadge } from './DirectXBadge';
import type { PartLinksEditTarget } from './PartLinksModal';
import { SpecLink } from './SpecLink';

interface PartsCatalogViewProps {
  cpus: Cpu[];
  gpus: Gpu[];
  computers: ComputerWithRelations[];
  isOwner: boolean;
  onAddPartLookup: (partType: 'cpu' | 'gpu') => void;
  onEditCpu: (cpu: Cpu) => void;
  onDeleteCpu: (cpu: Cpu) => void;
  onEditGpu: (gpu: Gpu) => void;
  onDeleteGpu: (gpu: Gpu) => void;
  onEditPartLinks?: (target: PartLinksEditTarget) => void;
}

function sortCatalogParts<
  T extends { brand: string; name: string; passmark_score: number | null },
>(items: T[], sortMode: 'passmark' | 'name'): T[] {
  return [...items].sort((a, b) => {
    if (sortMode === 'passmark') {
      if (a.passmark_score !== null && b.passmark_score !== null) {
        if (b.passmark_score !== a.passmark_score) {
          return b.passmark_score - a.passmark_score;
        }
      } else if (a.passmark_score !== null) {
        return -1;
      } else if (b.passmark_score !== null) {
        return 1;
      }
    }
    return `${a.brand} ${a.name}`.localeCompare(`${b.brand} ${b.name}`);
  });
}

export function PartsCatalogView({
  cpus,
  gpus,
  computers,
  isOwner,
  onAddPartLookup,
  onEditCpu,
  onDeleteCpu,
  onEditGpu,
  onDeleteGpu,
  onEditPartLinks,
}: PartsCatalogViewProps) {
  const [subTab, setSubTab] = useState<'cpus' | 'gpus'>('cpus');
  const [search, setSearch] = useState('');
  const [partSort, setPartSort] = useState<'passmark' | 'name'>('passmark');

  const cpuRanks = useMemo(() => computeCatalogRanks(cpus), [cpus]);
  const gpuRanks = useMemo(() => computeCatalogRanks(gpus), [gpus]);

  const cpuUsage = useMemo(() => {
    const map = new Map<number, number>();
    for (const c of computers) {
      if (c.cpu_id) map.set(c.cpu_id, (map.get(c.cpu_id) ?? 0) + 1);
    }
    return map;
  }, [computers]);

  const gpuUsage = useMemo(() => {
    const map = new Map<number, number>();
    for (const c of computers) {
      if (c.gpu_id) map.set(c.gpu_id, (map.get(c.gpu_id) ?? 0) + 1);
      if (c.igpu_id) map.set(c.igpu_id, (map.get(c.igpu_id) ?? 0) + 1);
    }
    return map;
  }, [computers]);

  const filteredCpus = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = !q
      ? cpus
      : cpus.filter((c) =>
          `${c.brand} ${c.name} ${c.codename ?? ''} ${c.socket ?? ''}`
            .toLowerCase()
            .includes(q),
        );
    return sortCatalogParts(matches, partSort);
  }, [cpus, search, partSort]);

  const filteredGpus = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = !q
      ? gpus
      : gpus.filter((g) =>
          `${g.brand} ${g.name} ${g.architecture ?? ''} ${g.directx_version ?? ''}`
            .toLowerCase()
            .includes(q),
        );
    return sortCatalogParts(matches, partSort);
  }, [gpus, search, partSort]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('cpus')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              subTab === 'cpus'
                ? 'bg-cyan-500 text-slate-950'
                : 'border border-slate-700 bg-slate-950 text-slate-300'
            }`}
          >
            <CpuIcon className="h-3.5 w-3.5" />
            CPUs ({cpus.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('gpus')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              subTab === 'gpus'
                ? 'bg-cyan-500 text-slate-950'
                : 'border border-slate-700 bg-slate-950 text-slate-300'
            }`}
          >
            <Monitor className="h-3.5 w-3.5" />
            GPUs ({gpus.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${subTab.toUpperCase()}...`}
              className="rounded-lg border border-slate-700 bg-slate-950 py-1.5 pr-3 pl-8 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>
          <select
            value={partSort}
            onChange={(e) => setPartSort(e.target.value as 'passmark' | 'name')}
            aria-label="Sort parts catalog"
            className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none"
          >
            <option value="passmark">Sort: PassMark</option>
            <option value="name">Sort: Name (A–Z)</option>
          </select>
          {isOwner ? (
            <button
              type="button"
              onClick={() => onAddPartLookup(subTab === 'cpus' ? 'cpu' : 'gpu')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/25"
            >
              <Globe className="h-3.5 w-3.5" />
              Search Intel / AMD Specs
            </button>
          ) : null}
        </div>
      </div>

      {subTab === 'cpus' ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/75">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-slate-400">
              <tr>
                <th className="px-3 py-2.5">Rank</th>
                <th className="px-3 py-2.5">Processor (Official Link)</th>
                <th className="px-3 py-2.5">Segment</th>
                <th className="px-3 py-2.5">Codename</th>
                <th className="px-3 py-2.5">Socket</th>
                <th className="px-3 py-2.5 text-right">C/T</th>
                <th className="px-3 py-2.5 text-right">Base / Turbo</th>
                <th className="px-3 py-2.5 text-right">TDP</th>
                <th className="px-3 py-2.5 text-right">CPU Mark</th>
                <th className="px-3 py-2.5 text-right">Rigs</th>
                {isOwner ? <th className="px-3 py-2.5 text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredCpus.map((c) => {
                const rankPos = cpuRanks.get(c.id);
                const updatedDate = formatScoreUpdatedDate(c.score_updated_at);
                return (
                  <tr key={c.id} className="hover:bg-slate-800/40">
                    <td className="px-3 py-2.5 font-mono whitespace-nowrap">
                      {rankPos ? (
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${getRankBadgeClasses(
                            rankPos,
                          )}`}
                        >
                          {formatShortRank(rankPos)}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                      <SpecLink
                        label={`${c.brand} ${c.name}`}
                        links={buildCpuResearchLinks(c)}
                        onEditLinks={
                          onEditPartLinks
                            ? () => onEditPartLinks({ kind: 'cpu', cpu: c })
                            : undefined
                        }
                      />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-400">
                      {c.is_mobile ? 'Mobile' : 'Desktop'}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-300">
                      {c.codename ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 font-mono whitespace-nowrap text-slate-300">
                      {c.socket ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-slate-300">
                      {c.cores ?? '—'}/{c.threads ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-slate-300">
                      {c.base_clock_ghz ?? '—'} / {c.turbo_clock_ghz ?? '—'} GHz
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-slate-300">
                      {c.tdp_w ? `${c.tdp_w}W` : '—'}
                    </td>
                    <td
                      title={updatedDate ? `Updated ${updatedDate}` : undefined}
                      className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-cyan-200"
                    >
                      {formatPassMark(c.passmark_score)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-cyan-300">
                      {cpuUsage.get(c.id) ?? 0}
                    </td>
                    {isOwner ? (
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onEditCpu(c)}
                          className="mr-1 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteCpu(c)}
                          className="rounded p-1 text-slate-400 hover:bg-rose-500/15 hover:text-rose-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/75">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-slate-400">
              <tr>
                <th className="px-3 py-2.5">Rank</th>
                <th className="px-3 py-2.5">Graphics Card (Official Link)</th>
                <th className="px-3 py-2.5">Segment</th>
                <th className="px-3 py-2.5">Architecture</th>
                <th className="px-3 py-2.5">DirectX</th>
                <th className="px-3 py-2.5 text-right">VRAM</th>
                <th className="px-3 py-2.5 text-right">TDP</th>
                <th className="px-3 py-2.5 text-right">G3D Mark</th>
                <th className="px-3 py-2.5 text-right">Rigs</th>
                {isOwner ? <th className="px-3 py-2.5 text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredGpus.map((g) => {
                const rankPos = gpuRanks.get(g.id);
                const updatedDate = formatScoreUpdatedDate(g.score_updated_at);
                return (
                  <tr key={g.id} className="hover:bg-slate-800/40">
                    <td className="px-3 py-2.5 font-mono whitespace-nowrap">
                      {rankPos ? (
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${getRankBadgeClasses(
                            rankPos,
                          )}`}
                        >
                          {formatShortRank(rankPos)}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                      <SpecLink
                        label={`${g.brand} ${g.name}`}
                        links={buildGpuResearchLinks(g)}
                        onEditLinks={
                          onEditPartLinks
                            ? () => onEditPartLinks({ kind: 'gpu', gpu: g })
                            : undefined
                        }
                      />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-400">
                      {g.is_mobile ? 'Mobile' : 'Desktop'}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-300">
                      {g.architecture ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <DirectXBadge
                        version={g.directx_version}
                        featureLevel={g.directx_feature_level}
                        compact
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-slate-300">
                      {g.vram_gb !== null
                        ? `${g.vram_gb} GB ${g.vram_type ?? ''}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-slate-300">
                      {g.tdp_w ? `${g.tdp_w}W` : '—'}
                    </td>
                    <td
                      title={updatedDate ? `Updated ${updatedDate}` : undefined}
                      className="px-3 py-2.5 text-right font-mono whitespace-nowrap text-emerald-200"
                    >
                      {formatPassMark(g.passmark_score)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-cyan-300">
                      {gpuUsage.get(g.id) ?? 0}
                    </td>
                    {isOwner ? (
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onEditGpu(g)}
                          className="mr-1 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteGpu(g)}
                          className="rounded p-1 text-slate-400 hover:bg-rose-500/15 hover:text-rose-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
