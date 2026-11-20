import { useMemo, useState } from 'react';
import {
  Cpu as CpuIcon,
  HardDrive,
  Laptop,
  Monitor,
  Search,
  Trophy,
  Wifi,
  Zap,
} from 'lucide-react';
import { getDirectXTierRank } from '../lib/directx';
import { getLatestScoresMap } from '../lib/aiExport';
import type { ComputerWithRelations, DeviceType } from '../types/database';
import { DirectXBadge } from './DirectXBadge';
import { SpecLink } from './SpecLink';

interface InventoryViewProps {
  computers: ComputerWithRelations[];
  onSelectComputer: (rig: ComputerWithRelations) => void;
}

type DxFilter = 'all' | 'dx12_ult' | 'dx12' | 'dx11' | 'legacy';

export function InventoryView({
  computers,
  onSelectComputer,
}: InventoryViewProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | DeviceType>('All');
  const [dxFilter, setDxFilter] = useState<DxFilter>('all');

  const stats = useMemo(() => {
    const desktops = computers.filter((c) => c.device_type === 'Desktop').length;
    const laptops = computers.filter((c) => c.device_type === 'Laptop').length;
    const dx12Count = computers.filter(
      (c) =>
        getDirectXTierRank(
          c.gpu?.directx_version,
          c.gpu?.directx_feature_level,
        ) >= 1180,
    ).length;

    let topFireStrike: { name: string; score: number } | null = null;
    for (const c of computers) {
      for (const b of c.benchmarks) {
        if (
          b.suite_name.toLowerCase() === 'fire strike' &&
          (!topFireStrike || b.score > topFireStrike.score)
        ) {
          topFireStrike = { name: c.name, score: b.score };
        }
      }
    }

    return { desktops, laptops, dx12Count, topFireStrike };
  }, [computers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return computers.filter((c) => {
      if (typeFilter !== 'All' && c.device_type !== typeFilter) return false;

      const dxRank = getDirectXTierRank(
        c.gpu?.directx_version,
        c.gpu?.directx_feature_level,
      );
      if (dxFilter === 'dx12_ult' && dxRank < 1220) return false;
      if (dxFilter === 'dx12' && dxRank < 1180) return false;
      if (dxFilter === 'dx11' && (dxRank < 1100 || dxRank >= 1180)) return false;
      if (dxFilter === 'legacy' && (dxRank === 0 || dxRank >= 1100))
        return false;

      if (!q) return true;
      const haystack = [
        c.name,
        c.brand,
        c.model,
        c.motherboard_brand,
        c.motherboard_name,
        c.cpu?.brand,
        c.cpu?.name,
        c.gpu?.brand,
        c.gpu?.name,
        c.gpu_aib_manufacturer,
        c.gpu_aib_model,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [computers, search, typeFilter, dxFilter]);

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs font-medium text-slate-400">Total Inventory</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {computers.length}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {stats.desktops} Desktops · {stats.laptops} Laptops
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs font-medium text-slate-400">DX12 Capable</p>
          <p className="mt-1 text-2xl font-bold text-cyan-300">
            {stats.dx12Count}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            API DX12 / Feature Level 11_0+
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs font-medium text-slate-400">Legacy / Pre-DX12</p>
          <p className="mt-1 text-2xl font-bold text-amber-300">
            {computers.length - stats.dx12Count}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            DX11 / DX10 / Integrated GPUs
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="text-xs font-medium text-slate-400">Top Fire Strike</p>
          <p className="mt-1 text-2xl font-bold text-emerald-300">
            {stats.topFireStrike
              ? stats.topFireStrike.score.toLocaleString()
              : '—'}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {stats.topFireStrike ? stats.topFireStrike.name : 'No runs logged'}
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by rig name, CPU, GPU, motherboard, or model..."
            className="w-full rounded-lg border border-slate-700/80 bg-slate-950 py-2 pr-3 pl-9 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
          />
        </div>

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
              {t === 'All' ? 'All Rigs' : `${t}s`}
            </button>
          ))}

          <select
            value={dxFilter}
            onChange={(e) => setDxFilter(e.target.value as DxFilter)}
            aria-label="Filter by DirectX level"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none"
          >
            <option value="all">All DirectX Tiers</option>
            <option value="dx12_ult">DX 12 Ultimate (12_2)</option>
            <option value="dx12">DX 12 Capable (11_0+)</option>
            <option value="dx11">DX 11 Era Only</option>
            <option value="legacy">DX 10 &amp; Older</option>
          </select>
        </div>
      </div>

      {/* Cards Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-10 text-center text-sm text-slate-400">
          No machines match the current search and filters.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((rig) => {
            const totalStorageGb = rig.storage_drives.reduce(
              (sum, d) => sum + (d.capacity_gb ?? 0),
              0,
            );
            const latestScores = getLatestScoresMap(rig);
            const isLaptop = rig.device_type === 'Laptop';

            return (
              <article
                key={rig.id}
                onClick={() => onSelectComputer(rig)}
                className="group cursor-pointer rounded-xl border border-slate-800 bg-slate-900/75 p-4 transition hover:border-cyan-500/50 hover:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                          isLaptop
                            ? 'bg-violet-500/15 text-violet-300'
                            : 'bg-sky-500/15 text-sky-300'
                        }`}
                      >
                        {isLaptop ? (
                          <Laptop className="h-3 w-3" />
                        ) : (
                          <Monitor className="h-3 w-3" />
                        )}
                        {rig.device_type}
                      </span>
                      {rig.build_date ? (
                        <span className="font-mono text-[11px] text-slate-500">
                          {rig.build_date.slice(0, 4)}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-1.5 text-base font-bold text-white transition group-hover:text-cyan-300">
                      {rig.name}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {isLaptop
                        ? [rig.brand, rig.model].filter(Boolean).join(' ') ||
                          'Laptop System'
                        : [rig.motherboard_brand, rig.motherboard_name]
                            .filter(Boolean)
                            .join(' ') || 'Custom Desktop'}
                    </p>
                  </div>

                  <DirectXBadge
                    version={rig.gpu?.directx_version}
                    featureLevel={rig.gpu?.directx_feature_level}
                    compact
                  />
                </div>

                <div className="mt-4 space-y-2 border-t border-slate-800/80 pt-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex shrink-0 items-center gap-1.5 text-slate-400">
                      <CpuIcon className="h-3.5 w-3.5 text-slate-500" />
                      CPU
                    </span>
                    <div className="text-right">
                      {rig.cpu ? (
                        <SpecLink
                          label={`${rig.cpu.brand} ${rig.cpu.name}`}
                          prefix={rig.cpu_count > 1 ? `${rig.cpu_count}x` : undefined}
                          specUrl={rig.cpu.spec_url}
                          stopPropagation
                        />
                      ) : (
                        <span className="text-slate-500">Unassigned</span>
                      )}
                      {rig.cpu ? (
                        <p className="font-mono text-[11px] text-slate-500">
                          {(rig.cpu.cores ?? 0) * rig.cpu_count}C/
                          {(rig.cpu.threads ?? 0) * rig.cpu_count}T
                          {rig.cpu.base_clock_ghz
                            ? ` · ${rig.cpu.base_clock_ghz} GHz`
                            : ''}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <span className="flex shrink-0 items-center gap-1.5 text-slate-400">
                      <Monitor className="h-3.5 w-3.5 text-slate-500" />
                      GPU
                    </span>
                    <div className="text-right">
                      {rig.gpu ? (
                        <SpecLink
                          label={`${rig.gpu.brand} ${rig.gpu.name}`}
                          specUrl={rig.gpu.spec_url}
                          stopPropagation
                        />
                      ) : (
                        <span className="text-slate-500">
                          Integrated / None
                        </span>
                      )}
                      {rig.gpu ? (
                        <p className="font-mono text-[11px] text-slate-500">
                          {rig.gpu.vram_gb !== null
                            ? `${rig.gpu.vram_gb} GB ${rig.gpu.vram_type ?? ''}`
                            : rig.gpu.vram_type ?? ''}
                          {rig.gpu_aib_manufacturer
                            ? ` · ${rig.gpu_aib_manufacturer}`
                            : ''}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <HardDrive className="h-3.5 w-3.5 text-slate-500" />
                      Memory / Storage
                    </span>
                    <span className="font-mono text-slate-200">
                      {rig.ram_gb ? `${rig.ram_gb} GB RAM` : '— RAM'}
                      {totalStorageGb ? ` · ${totalStorageGb} GB` : ''}
                    </span>
                  </div>

                  {isLaptop && (rig.screen_size_inches || rig.wifi_product) ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Wifi className="h-3.5 w-3.5 text-slate-500" />
                        Display / Wi-Fi
                      </span>
                      <span className="truncate font-mono text-[11px] text-slate-300">
                        {rig.screen_size_inches
                          ? `${rig.screen_size_inches}" ${rig.screen_resolution ?? ''}`
                          : ''}
                        {rig.wifi_product ? ` · ${rig.wifi_product}` : ''}
                      </span>
                    </div>
                  ) : null}

                  {!isLaptop && rig.psu_wattage ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Zap className="h-3.5 w-3.5 text-slate-500" />
                        PSU
                      </span>
                      <span className="font-mono text-[11px] text-slate-300">
                        {rig.psu_wattage}W {rig.psu_brand ?? ''}
                      </span>
                    </div>
                  ) : null}
                </div>

                {Object.keys(latestScores).length > 0 ? (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-800/80 pt-2.5">
                    <Trophy className="h-3.5 w-3.5 text-amber-400" />
                    {Object.entries(latestScores).map(([suite, score]) => (
                      <span
                        key={suite}
                        className="rounded-md border border-slate-700/80 bg-slate-950 px-2 py-0.5 font-mono text-[11px] text-slate-200"
                      >
                        {suite}: <strong className="text-amber-300">{score.toLocaleString()}</strong>
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
