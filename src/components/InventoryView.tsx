import { useMemo, useState } from 'react';
import {
  Cpu as CpuIcon,
  ExternalLink,
  HardDrive,
  Laptop,
  Monitor,
  Search,
  Trophy,
  Wifi,
  Zap,
} from 'lucide-react';
import { getLatestBenchmarksMap, getSafeThreeDMarkUrl } from '../lib/benchmarks';
import { getDirectXTierRank } from '../lib/directx';
import {
  formatPassMark,
  formatRankBadge,
  getCompositeTooltip,
  getRankBadgeClasses,
  type RigFleetStanding,
} from '../lib/scoring';
import {
  buildCpuResearchLinks,
  buildGpuResearchLinks,
  buildLaptopResearchLinks,
  buildMotherboardResearchLinks,
  buildPsuResearchLinks,
  buildWifiResearchLinks,
  mergePartSpecEntry,
} from '../lib/specLinks';
import type { ComputerWithRelations, DeviceType } from '../types/database';
import { DirectXBadge } from './DirectXBadge';
import type { PartLinksEditTarget } from './PartLinksModal';
import { SpecLink } from './SpecLink';

interface InventoryViewProps {
  computers: ComputerWithRelations[];
  fleetStandings: Map<number, RigFleetStanding>;
  onSelectComputer: (rig: ComputerWithRelations) => void;
  onEditPartLinks?: (target: PartLinksEditTarget) => void;
}

type DxFilter = 'all' | 'dx12_ult' | 'dx12' | 'dx11' | 'legacy';
type InventorySortKey =
  | 'fleet_rank'
  | 'cpu_passmark'
  | 'gpu_passmark'
  | 'directx'
  | 'name'
  | 'build_year';

export function InventoryView({
  computers,
  fleetStandings,
  onSelectComputer,
  onEditPartLinks,
}: InventoryViewProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | DeviceType>('All');
  const [dxFilter, setDxFilter] = useState<DxFilter>('all');
  const [sortKey, setSortKey] = useState<InventorySortKey>('fleet_rank');

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

    let topFireStrike: {
      name: string;
      score: number;
      resultUrl: string | null;
    } | null = null;
    for (const c of computers) {
      for (const b of c.benchmarks) {
        if (b.suite_name.toLowerCase() === 'fire strike') {
          const candidateUrl = getSafeThreeDMarkUrl(b.result_url);
          if (
            !topFireStrike ||
            b.score > topFireStrike.score ||
            (b.score === topFireStrike.score &&
              !topFireStrike.resultUrl &&
              candidateUrl)
          ) {
            topFireStrike = {
              name: c.name,
              score: b.score,
              resultUrl: candidateUrl,
            };
          }
        }
      }
    }

    return { desktops, laptops, dx12Count, topFireStrike };
  }, [computers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = computers.filter((c) => {
      if (typeFilter !== 'All' && c.device_type !== typeFilter) return false;

      const effectiveDxGpu = c.gpu ?? c.igpu;
      const dxRank = getDirectXTierRank(
        effectiveDxGpu?.directx_version,
        effectiveDxGpu?.directx_feature_level,
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
        c.igpu?.brand,
        c.igpu?.name,
        c.gpu_aib_manufacturer,
        c.gpu_aib_model,
        c.pc_case?.brand,
        c.pc_case?.model,
        c.cooler?.brand,
        c.cooler?.model,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });

    const compareNullsLastDesc = (
      av: number | null | undefined,
      bv: number | null | undefined,
    ): number => {
      if (av != null && bv != null) return bv - av;
      if (av != null) return -1;
      if (bv != null) return 1;
      return 0;
    };

    return [...matches].sort((a, b) => {
      const sa = fleetStandings.get(a.id);
      const sb = fleetStandings.get(b.id);

      if (sortKey === 'fleet_rank') {
        const ra = sa?.overallRank?.rank ?? null;
        const rb = sb?.overallRank?.rank ?? null;
        if (ra !== null && rb !== null && ra !== rb) return ra - rb;
        if (ra !== null && rb === null) return -1;
        if (ra === null && rb !== null) return 1;
        return a.name.localeCompare(b.name);
      }
      if (sortKey === 'cpu_passmark') {
        const diff = compareNullsLastDesc(
          sa?.effectiveCpuScore,
          sb?.effectiveCpuScore,
        );
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      }
      if (sortKey === 'gpu_passmark') {
        const diff = compareNullsLastDesc(
          sa?.effectiveGpuScore,
          sb?.effectiveGpuScore,
        );
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      }
      if (sortKey === 'directx') {
        const dxA = getDirectXTierRank(
          (a.gpu ?? a.igpu)?.directx_version,
          (a.gpu ?? a.igpu)?.directx_feature_level,
        );
        const dxB = getDirectXTierRank(
          (b.gpu ?? b.igpu)?.directx_version,
          (b.gpu ?? b.igpu)?.directx_feature_level,
        );
        if (dxA !== dxB) return dxB - dxA;
        const compDiff = compareNullsLastDesc(
          sa?.compositeScore,
          sb?.compositeScore,
        );
        return compDiff !== 0 ? compDiff : a.name.localeCompare(b.name);
      }
      if (sortKey === 'build_year') {
        if (a.build_date && b.build_date) {
          const cmp = b.build_date.localeCompare(a.build_date);
          if (cmp !== 0) return cmp;
        } else if (a.build_date) {
          return -1;
        } else if (b.build_date) {
          return 1;
        }
        return a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
  }, [computers, fleetStandings, search, typeFilter, dxFilter, sortKey]);

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
        {stats.topFireStrike?.resultUrl ? (
          <a
            href={stats.topFireStrike.resultUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={`Open ${stats.topFireStrike.name} Fire Strike result on 3DMark`}
            className="group rounded-xl border border-slate-800 bg-slate-900/70 p-4 transition hover:border-emerald-500/50 hover:bg-slate-900"
          >
            <p className="flex items-center justify-between text-xs font-medium text-slate-400">
              <span>Top Fire Strike</span>
              <ExternalLink className="h-3.5 w-3.5 text-emerald-400/70 transition group-hover:text-emerald-300" />
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-300 underline decoration-emerald-400/40 underline-offset-4 group-hover:text-emerald-200">
              {stats.topFireStrike.score.toLocaleString()}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {stats.topFireStrike.name}
            </p>
          </a>
        ) : (
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
        )}
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

          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as InventorySortKey)}
            aria-label="Sort inventory rigs"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none"
          >
            <option value="fleet_rank">Sort: Fleet Rank</option>
            <option value="cpu_passmark">Sort: CPU PassMark</option>
            <option value="gpu_passmark">Sort: GPU PassMark</option>
            <option value="directx">Sort: DirectX Tier</option>
            <option value="name">Sort: Name (A–Z)</option>
            <option value="build_year">Sort: Build Year</option>
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
            const latestBenchmarks = getLatestBenchmarksMap(rig);
            const isLaptop = rig.device_type === 'Laptop';
            const standing = fleetStandings.get(rig.id);

            return (
              <article
                key={rig.id}
                onClick={() => onSelectComputer(rig)}
                className="group cursor-pointer rounded-xl border border-slate-800 bg-slate-900/75 p-4 transition hover:border-cyan-500/50 hover:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
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
                      {standing?.overallRank ? (
                        <span
                          title={getCompositeTooltip(standing)}
                          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-semibold ${getRankBadgeClasses(
                            standing.overallRank,
                          )}`}
                        >
                          {formatRankBadge(standing.overallRank)}
                          {standing.isPartial ? (
                            <span
                              className="text-amber-300"
                              aria-label="Partial score"
                            >
                              *
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                      {rig.build_date ? (
                        <span className="font-mono text-[11px] text-slate-500">
                          {rig.build_date.slice(0, 4)}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-1.5 text-base font-bold text-white transition group-hover:text-cyan-300">
                      {rig.name}
                    </h3>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {isLaptop ? (
                        (() => {
                          const laptopLabel = [rig.brand, rig.model]
                            .filter(Boolean)
                            .join(' ');
                          return laptopLabel ? (
                            <SpecLink
                              compact
                              stopPropagation
                              label={laptopLabel}
                              links={buildLaptopResearchLinks(
                                rig.brand,
                                rig.model,
                                rig.part_spec_links?.laptop,
                              )}
                              onEditLinks={
                                onEditPartLinks
                                  ? () =>
                                      onEditPartLinks({
                                        kind: 'computer_slot',
                                        computerId: rig.id,
                                        rigName: rig.name,
                                        slot: 'laptop',
                                        partLabel: laptopLabel,
                                        currentMap: rig.part_spec_links,
                                      })
                                  : undefined
                              }
                            />
                          ) : (
                            <span>Laptop System</span>
                          );
                        })()
                      ) : (
                        (() => {
                          const mbLabel = [
                            rig.motherboard_brand,
                            rig.motherboard_name,
                          ]
                            .filter(Boolean)
                            .join(' ');
                          return mbLabel ? (
                            <SpecLink
                              compact
                              stopPropagation
                              label={mbLabel}
                              links={buildMotherboardResearchLinks(
                                rig.motherboard_brand,
                                rig.motherboard_name,
                                rig.motherboard_launch,
                                mergePartSpecEntry(
                                  rig.motherboard,
                                  rig.part_spec_links?.motherboard,
                                ),
                              )}
                              onEditLinks={
                                onEditPartLinks
                                  ? () =>
                                      rig.motherboard
                                        ? onEditPartLinks({
                                            kind: 'catalog_part',
                                            table: 'motherboards',
                                            id: rig.motherboard.id,
                                            presetKind: 'motherboard',
                                            partLabel: mbLabel,
                                            subtitle: 'Motherboard Catalog Entry',
                                            specUrl: rig.motherboard.spec_url,
                                            specLinks: rig.motherboard.spec_links,
                                          })
                                        : onEditPartLinks({
                                            kind: 'computer_slot',
                                            computerId: rig.id,
                                            rigName: rig.name,
                                            slot: 'motherboard',
                                            partLabel: mbLabel,
                                            currentMap: rig.part_spec_links,
                                          })
                                  : undefined
                              }
                            />
                          ) : (
                            <span>Custom Desktop</span>
                          );
                        })()
                      )}
                    </div>
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
                          compact
                          label={`${rig.cpu.brand} ${rig.cpu.name}`}
                          prefix={rig.cpu_count > 1 ? `${rig.cpu_count}x` : undefined}
                          links={buildCpuResearchLinks(rig.cpu)}
                          stopPropagation
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
                        <span className="text-slate-500">Unassigned</span>
                      )}
                      {rig.cpu ? (
                        <p className="font-mono text-[11px] text-slate-500">
                          {(rig.cpu.cores ?? 0) * rig.cpu_count}C/
                          {(rig.cpu.threads ?? 0) * rig.cpu_count}T
                          {rig.cpu.base_clock_ghz
                            ? ` · ${rig.cpu.base_clock_ghz} GHz`
                            : ''}
                          {standing?.effectiveCpuScore !== null &&
                          standing?.effectiveCpuScore !== undefined
                            ? ` · PM ${formatPassMark(standing.effectiveCpuScore)}${
                                rig.cpu_count > 1
                                  ? ` (${rig.cpu_count}× est.)`
                                  : ''
                              }`
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
                          compact
                          label={`${rig.gpu.brand} ${rig.gpu.name}`}
                          links={buildGpuResearchLinks(rig.gpu, {
                            manufacturer: rig.gpu_aib_manufacturer,
                            model: rig.gpu_aib_model,
                            savedEntry: mergePartSpecEntry(
                              rig.gpu_card,
                              rig.part_spec_links?.gpu_aib,
                            ),
                          })}
                          stopPropagation
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
                          stopPropagation
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
                          {rig.gpu.passmark_score !== null
                            ? ` · G3D ${formatPassMark(rig.gpu.passmark_score)}`
                            : ''}
                        </p>
                      ) : rig.igpu?.passmark_score !== null &&
                        rig.igpu?.passmark_score !== undefined ? (
                        <p className="font-mono text-[11px] text-slate-500">
                          G3D {formatPassMark(rig.igpu.passmark_score)}
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

                  {isLaptop &&
                  (rig.screen_size_inches ||
                    rig.wifi_brand ||
                    rig.wifi_product ||
                    rig.wifi_model) ? (
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex shrink-0 items-center gap-1.5 text-slate-400">
                        <Wifi className="h-3.5 w-3.5 text-slate-500" />
                        Display / Wi-Fi
                      </span>
                      <div className="flex flex-wrap items-center justify-end gap-1.5 text-right font-mono text-[11px] text-slate-300">
                        {rig.screen_size_inches ? (
                          <span>
                            {rig.screen_size_inches}"{' '}
                            {rig.screen_resolution ?? ''}
                          </span>
                        ) : null}
                        {(() => {
                          const wifiLabel = [
                            rig.wifi_brand,
                            rig.wifi_product,
                            rig.wifi_model,
                          ]
                            .filter(Boolean)
                            .join(' ');
                          if (!wifiLabel) return null;
                          return (
                            <SpecLink
                              compact
                              stopPropagation
                              label={wifiLabel}
                              links={buildWifiResearchLinks(
                                rig.wifi_brand,
                                rig.wifi_product,
                                rig.wifi_model,
                                mergePartSpecEntry(
                                  rig.wifi_card,
                                  rig.part_spec_links?.wifi,
                                ),
                              )}
                              onEditLinks={
                                onEditPartLinks
                                  ? () =>
                                      onEditPartLinks({
                                        kind: 'computer_slot',
                                        computerId: rig.id,
                                        rigName: rig.name,
                                        slot: 'wifi',
                                        partLabel: wifiLabel,
                                        currentMap: rig.part_spec_links,
                                      })
                                  : undefined
                              }
                            />
                          );
                        })()}
                      </div>
                    </div>
                  ) : null}

                  {!isLaptop && rig.psu_wattage ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Zap className="h-3.5 w-3.5 text-slate-500" />
                        PSU
                      </span>
                      {(() => {
                        const psuLabel = `${rig.psu_wattage}W ${rig.psu_brand ?? ''}`.trim();
                        return (
                          <SpecLink
                            compact
                            stopPropagation
                            label={psuLabel}
                            links={buildPsuResearchLinks(
                              rig.psu_brand,
                              rig.psu_wattage,
                              mergePartSpecEntry(
                                rig.psu,
                                rig.part_spec_links?.psu,
                              ),
                            )}
                            onEditLinks={
                              onEditPartLinks
                                ? () =>
                                    onEditPartLinks({
                                      kind: 'computer_slot',
                                      computerId: rig.id,
                                      rigName: rig.name,
                                      slot: 'psu',
                                      partLabel: psuLabel,
                                      currentMap: rig.part_spec_links,
                                    })
                                : undefined
                            }
                          />
                        );
                      })()}
                    </div>
                  ) : null}
                </div>

                {Object.keys(latestBenchmarks).length > 0 ? (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-800/80 pt-2.5">
                    <Trophy className="h-3.5 w-3.5 text-amber-400" />
                    {Object.entries(latestBenchmarks).map(([suite, bench]) => {
                      const safeUrl = getSafeThreeDMarkUrl(bench.result_url);
                      if (safeUrl) {
                        return (
                          <a
                            key={suite}
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title={`Open ${suite} result on 3DMark`}
                            className="inline-flex items-center gap-1 rounded-md border border-amber-500/35 bg-slate-950 px-2 py-0.5 font-mono text-[11px] text-slate-200 transition hover:border-amber-400 hover:bg-amber-500/10"
                          >
                            {suite}:{' '}
                            <strong className="text-amber-300 underline decoration-amber-400/50 underline-offset-2">
                              {bench.score.toLocaleString()}
                            </strong>
                            <ExternalLink className="h-2.5 w-2.5 text-amber-300/80" />
                          </a>
                        );
                      }
                      return (
                        <span
                          key={suite}
                          className="rounded-md border border-slate-700/80 bg-slate-950 px-2 py-0.5 font-mono text-[11px] text-slate-200"
                        >
                          {suite}:{' '}
                          <strong className="text-amber-300">
                            {bench.score.toLocaleString()}
                          </strong>
                        </span>
                      );
                    })}
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
