import { useMemo, useState } from 'react';
import { Cpu as CpuIcon, Edit3, Globe, Monitor, Search, Trash2 } from 'lucide-react';
import type { ComputerWithRelations, Cpu, Gpu } from '../types/database';
import { DirectXBadge } from './DirectXBadge';
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
}: PartsCatalogViewProps) {
  const [subTab, setSubTab] = useState<'cpus' | 'gpus'>('cpus');
  const [search, setSearch] = useState('');

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
    if (!q) return cpus;
    return cpus.filter((c) =>
      `${c.brand} ${c.name} ${c.codename ?? ''} ${c.socket ?? ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [cpus, search]);

  const filteredGpus = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return gpus;
    return gpus.filter((g) =>
      `${g.brand} ${g.name} ${g.architecture ?? ''} ${g.directx_version ?? ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [gpus, search]);

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
                <th className="px-3 py-2.5">Processor (Official Link)</th>
                <th className="px-3 py-2.5">Segment</th>
                <th className="px-3 py-2.5">Codename</th>
                <th className="px-3 py-2.5">Socket</th>
                <th className="px-3 py-2.5 text-right">C/T</th>
                <th className="px-3 py-2.5 text-right">Base / Turbo</th>
                <th className="px-3 py-2.5 text-right">TDP</th>
                <th className="px-3 py-2.5 text-right">Rigs</th>
                {isOwner ? <th className="px-3 py-2.5 text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredCpus.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/40">
                  <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                    <SpecLink
                      label={`${c.brand} ${c.name}`}
                      specUrl={c.spec_url}
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
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/75">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-slate-400">
              <tr>
                <th className="px-3 py-2.5">Graphics Card (Official Link)</th>
                <th className="px-3 py-2.5">Segment</th>
                <th className="px-3 py-2.5">Architecture</th>
                <th className="px-3 py-2.5">DirectX</th>
                <th className="px-3 py-2.5 text-right">VRAM</th>
                <th className="px-3 py-2.5 text-right">TDP</th>
                <th className="px-3 py-2.5 text-right">Rigs</th>
                {isOwner ? <th className="px-3 py-2.5 text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredGpus.map((g) => (
                <tr key={g.id} className="hover:bg-slate-800/40">
                  <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                    <SpecLink
                      label={`${g.brand} ${g.name}`}
                      specUrl={g.spec_url}
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
