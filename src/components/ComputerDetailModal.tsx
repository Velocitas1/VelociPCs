import {
  Cpu as CpuIcon,
  Edit3,
  ExternalLink,
  FileCode2,
  Gamepad2,
  HardDrive,
  Laptop,
  Link2,
  Monitor,
  Plus,
  Trash2,
  Trophy,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import { getLatestBenchmarksMap, getSafeThreeDMarkUrl } from '../lib/benchmarks';
import type { RigCompatibilitySummary } from '../lib/steamCompatibility';
import {
  formatPassMark,
  formatRankBadge,
  formatScoreUpdatedDate,
  getCompositeTooltip,
  getRankBadgeClasses,
  type RigFleetStanding,
} from '../lib/scoring';
import {
  buildAibGpuResearchLinks,
  buildCaseResearchLinks,
  buildCoolerResearchLinks,
  buildCpuResearchLinks,
  buildGpuResearchLinks,
  buildLaptopResearchLinks,
  buildMotherboardResearchLinks,
  buildPsuResearchLinks,
  buildRamResearchLinks,
  buildStorageDriveResearchLinks,
  buildWifiResearchLinks,
  mergePartSpecEntry,
} from '../lib/specLinks';
import type { Benchmark, ComputerWithRelations } from '../types/database';
import { DirectXBadge } from './DirectXBadge';
import type { PartLinksEditTarget } from './PartLinksModal';
import { SpecLink } from './SpecLink';

interface ComputerDetailModalProps {
  rig: ComputerWithRelations | null;
  standing: RigFleetStanding | null;
  isOwner: boolean;
  onClose: () => void;
  onEdit: (rig: ComputerWithRelations) => void;
  onDelete: (rig: ComputerWithRelations) => void;
  onAddBenchmark: (rig: ComputerWithRelations) => void;
  onEditBenchmark: (
    rig: ComputerWithRelations,
    benchmark: Benchmark,
    focusUrl?: boolean,
  ) => void;
  onDeleteBenchmark: (benchmarkId: number) => void;
  onEditPartLinks?: (target: PartLinksEditTarget) => void;
  onImportHwinfo?: (rig: ComputerWithRelations) => void;
  steamSummary?: RigCompatibilitySummary | null;
  onViewSteamForRig?: (rigId: number) => void;
}

export function ComputerDetailModal({
  rig,
  standing,
  isOwner,
  onClose,
  onEdit,
  onDelete,
  onAddBenchmark,
  onEditBenchmark,
  onDeleteBenchmark,
  onEditPartLinks,
  onImportHwinfo,
  steamSummary,
  onViewSteamForRig,
}: ComputerDetailModalProps) {
  if (!rig) return null;

  const isLaptop = rig.device_type === 'Laptop';
  const latestBySuite = getLatestBenchmarksMap(rig);
  const maxBySuite = new Map<string, number>();
  for (const b of rig.benchmarks) {
    maxBySuite.set(
      b.suite_name,
      Math.max(maxBySuite.get(b.suite_name) ?? 0, b.score),
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${
                  isLaptop
                    ? 'bg-violet-500/15 text-violet-300'
                    : 'bg-sky-500/15 text-sky-300'
                }`}
              >
                {isLaptop ? (
                  <Laptop className="h-3.5 w-3.5" />
                ) : (
                  <Monitor className="h-3.5 w-3.5" />
                )}
                {rig.device_type}
              </span>
              <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-0.5 text-xs text-slate-300">
                {rig.status}
              </span>
              <DirectXBadge
                version={rig.gpu?.directx_version}
                featureLevel={rig.gpu?.directx_feature_level}
              />
              {standing?.overallRank ? (
                <span
                  title={getCompositeTooltip(standing)}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-xs font-semibold ${getRankBadgeClasses(
                    standing.overallRank,
                  )}`}
                >
                  Fleet {formatRankBadge(standing.overallRank)}
                </span>
              ) : null}
              {standing?.classRank ? (
                <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-xs text-slate-300">
                  #{standing.classRank.rank} {rig.device_type}
                </span>
              ) : null}
              {standing?.isPartial ? (
                <span className="rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-300">
                  {standing.effectiveGpuScore === null
                    ? 'Partial (No GPU)'
                    : 'Partial (No CPU)'}
                </span>
              ) : null}
            </div>
            <h2 className="mt-2 text-xl font-bold text-white">{rig.name}</h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-400">
              {isLaptop ? (
                (() => {
                  const laptopLabel = [rig.brand, rig.model]
                    .filter(Boolean)
                    .join(' ');
                  const laptopLinks = buildLaptopResearchLinks(
                    rig.brand,
                    rig.model,
                    rig.part_spec_links?.laptop,
                  );
                  return laptopLabel ? (
                    <SpecLink
                      compact
                      label={laptopLabel}
                      links={laptopLinks}
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
                  ) : null;
                })()
              ) : (
                <span>
                  {[rig.motherboard_brand, rig.motherboard_name]
                    .filter(Boolean)
                    .join(' ')}
                </span>
              )}
              {rig.build_date ? <span>· Built {rig.build_date}</span> : null}
              {standing?.compositeScore !== null &&
              standing?.compositeScore !== undefined ? (
                <span>· Composite {formatPassMark(standing.compositeScore)}</span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isOwner ? (
              <>
                {onImportHwinfo ? (
                  <button
                    type="button"
                    onClick={() => onImportHwinfo(rig)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20"
                  >
                    <FileCode2 className="h-3.5 w-3.5 text-cyan-400" />
                    Import HWiNFO
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onEdit(rig)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 hover:border-cyan-500/50 hover:text-white"
                >
                  <Edit3 className="h-3.5 w-3.5 text-cyan-400" />
                  Edit Rig
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(rig)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-6 overflow-y-auto p-5">
          {/* Core Hardware Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* CPU Card */}
            <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
                <CpuIcon className="h-4 w-4 text-cyan-400" />
                Processor
              </div>
              {rig.cpu ? (
                <div className="space-y-2 text-xs">
                  <div className="text-sm font-semibold">
                    <SpecLink
                      label={`${rig.cpu.brand} ${rig.cpu.name}`}
                      prefix={rig.cpu_count > 1 ? `${rig.cpu_count}x` : undefined}
                      links={buildCpuResearchLinks(rig.cpu)}
                      onEditLinks={
                        onEditPartLinks
                          ? () =>
                              onEditPartLinks({ kind: 'cpu', cpu: rig.cpu! })
                          : undefined
                      }
                    />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-slate-300">
                    <div>
                      <dt className="text-slate-500">Codename</dt>
                      <dd>{rig.cpu.codename ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Socket</dt>
                      <dd className="font-mono">{rig.cpu.socket ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Cores / Threads</dt>
                      <dd className="font-mono">
                        {(rig.cpu.cores ?? 0) * rig.cpu_count}C /{' '}
                        {(rig.cpu.threads ?? 0) * rig.cpu_count}T
                        {rig.cpu_count > 1 ? ` (${rig.cpu_count} sockets)` : ''}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Clock (Base / Turbo)</dt>
                      <dd className="font-mono">
                        {rig.cpu.base_clock_ghz ?? '—'} /{' '}
                        {rig.cpu.turbo_clock_ghz ?? '—'} GHz
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Cache / Process</dt>
                      <dd className="font-mono">
                        {rig.cpu.cache_mb ?? '—'} MB ·{' '}
                        {rig.cpu.process_nm ?? '—'} nm
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">TDP / Launch</dt>
                      <dd className="font-mono">
                        {rig.cpu.tdp_w ? `${rig.cpu.tdp_w * rig.cpu_count}W` : '—'} ·{' '}
                        {rig.cpu.launch_date ?? '—'}
                      </dd>
                    </div>
                    <div className="col-span-2 border-t border-slate-800/80 pt-1.5">
                      <dt className="text-slate-500">PassMark CPU Mark</dt>
                      <dd
                        title={
                          formatScoreUpdatedDate(rig.cpu.score_updated_at)
                            ? `Updated ${formatScoreUpdatedDate(rig.cpu.score_updated_at)}`
                            : undefined
                        }
                        className="mt-0.5 flex flex-wrap items-center gap-2 font-mono"
                      >
                        <span className="font-semibold text-cyan-200">
                          {standing?.effectiveCpuScore !== null &&
                          standing?.effectiveCpuScore !== undefined
                            ? `${formatPassMark(standing.effectiveCpuScore)}${
                                rig.cpu_count > 1 ? ' est.' : ''
                              }`
                            : '—'}
                        </span>
                        {rig.cpu_count > 1 && rig.cpu.passmark_score !== null ? (
                          <span className="text-[11px] text-slate-400">
                            ({formatPassMark(rig.cpu.passmark_score)} ×{' '}
                            {standing?.cpuMultiplier})
                          </span>
                        ) : null}
                        {standing?.cpuRank ? (
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[11px] ${getRankBadgeClasses(
                              standing.cpuRank,
                            )}`}
                          >
                            CPU {formatRankBadge(standing.cpuRank)}
                          </span>
                        ) : null}
                        {formatScoreUpdatedDate(rig.cpu.score_updated_at) ? (
                          <span className="text-[11px] text-slate-500">
                            Updated {formatScoreUpdatedDate(rig.cpu.score_updated_at)}
                          </span>
                        ) : null}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <p className="text-xs text-slate-500">No CPU assigned.</p>
              )}
            </section>

            {/* GPU Card */}
            <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
                <Monitor className="h-4 w-4 text-emerald-400" />
                Graphics Card
              </div>
              {rig.gpu ? (
                <div className="space-y-2 text-xs">
                  <div className="text-sm font-semibold">
                    <SpecLink
                      label={`${rig.gpu.brand} ${rig.gpu.name}`}
                      links={buildGpuResearchLinks(rig.gpu, {
                        manufacturer: rig.gpu_aib_manufacturer,
                        model: rig.gpu_aib_model,
                        savedEntry: mergePartSpecEntry(
                          rig.gpu_card,
                          rig.part_spec_links?.gpu_aib,
                        ),
                      })}
                      onEditLinks={
                        onEditPartLinks
                          ? () =>
                              onEditPartLinks({ kind: 'gpu', gpu: rig.gpu! })
                          : undefined
                      }
                    />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-slate-300">
                    <div>
                      <dt className="text-slate-500">Board Partner / OEM</dt>
                      <dd className="mt-0.5">
                        {(() => {
                          const aibLabel = [
                            rig.gpu_aib_manufacturer,
                            rig.gpu_aib_model,
                          ]
                            .filter(Boolean)
                            .join(' ');
                          const mergedAibEntry = mergePartSpecEntry(
                            rig.gpu_card,
                            rig.part_spec_links?.gpu_aib,
                          );
                          const aibLinks = buildAibGpuResearchLinks(
                            rig.gpu,
                            rig.gpu_aib_manufacturer,
                            rig.gpu_aib_model,
                            mergedAibEntry,
                          );
                          return (
                            <SpecLink
                              compact
                              label={aibLabel || 'Reference'}
                              links={aibLinks}
                              onEditLinks={
                                onEditPartLinks
                                  ? () =>
                                      rig.gpu_card
                                        ? onEditPartLinks({
                                            kind: 'catalog_part',
                                            table: 'gpu_cards',
                                            id: rig.gpu_card.id,
                                            presetKind: 'gpu_aib',
                                            partLabel:
                                              aibLabel ||
                                              `${rig.gpu_card.brand} ${rig.gpu_card.model}`,
                                            subtitle: 'GPU Card Catalog Entry',
                                            specUrl: rig.gpu_card.spec_url,
                                            specLinks: rig.gpu_card.spec_links,
                                          })
                                        : onEditPartLinks({
                                            kind: 'computer_slot',
                                            computerId: rig.id,
                                            rigName: rig.name,
                                            slot: 'gpu_aib',
                                            partLabel:
                                              aibLabel ||
                                              `${rig.gpu!.brand} ${rig.gpu!.name} Board Partner`,
                                            currentMap: rig.part_spec_links,
                                          })
                                  : undefined
                              }
                            />
                          );
                        })()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Architecture</dt>
                      <dd>{rig.gpu.architecture ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">VRAM</dt>
                      <dd className="font-mono">
                        {rig.gpu.vram_gb !== null
                          ? `${rig.gpu.vram_gb} GB ${rig.gpu.vram_type ?? ''}`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Bus / Process</dt>
                      <dd className="font-mono">
                        {rig.gpu.bus_interface ?? '—'}
                        {rig.gpu.process_nm ? ` · ${rig.gpu.process_nm}nm` : ''}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Category</dt>
                      <dd>{rig.gpu.category ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">TDP</dt>
                      <dd className="font-mono">
                        {rig.gpu.tdp_w ? `${rig.gpu.tdp_w}W` : '—'}
                      </dd>
                    </div>
                    <div className="col-span-2 border-t border-slate-800/80 pt-1.5">
                      <dt className="text-slate-500">PassMark G3D Mark</dt>
                      <dd
                        title={
                          formatScoreUpdatedDate(rig.gpu.score_updated_at)
                            ? `Updated ${formatScoreUpdatedDate(rig.gpu.score_updated_at)}`
                            : undefined
                        }
                        className="mt-0.5 flex flex-wrap items-center gap-2 font-mono"
                      >
                        <span className="font-semibold text-emerald-200">
                          {formatPassMark(rig.gpu.passmark_score)}
                        </span>
                        {standing?.gpuRank && standing.gpuSource === 'gpu' ? (
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[11px] ${getRankBadgeClasses(
                              standing.gpuRank,
                            )}`}
                          >
                            GPU {formatRankBadge(standing.gpuRank)}
                          </span>
                        ) : null}
                        {formatScoreUpdatedDate(rig.gpu.score_updated_at) ? (
                          <span className="text-[11px] text-slate-500">
                            Updated {formatScoreUpdatedDate(rig.gpu.score_updated_at)}
                          </span>
                        ) : null}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  No discrete graphics card recorded.
                </p>
              )}
              {rig.igpu ? (
                <div className="mt-2.5 border-t border-slate-800 pt-2 text-xs text-slate-400">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span>Integrated GPU:</span>
                      <SpecLink
                        compact
                        label={`${rig.igpu.brand} ${rig.igpu.name}`}
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
                    </span>
                    <span className="flex items-center gap-1.5 font-mono text-[11px] text-slate-300">
                      <span>G3D {formatPassMark(rig.igpu.passmark_score)}</span>
                      {standing?.gpuRank && standing.gpuSource === 'igpu' ? (
                        <span
                          className={`rounded border px-1.5 py-0.5 ${getRankBadgeClasses(
                            standing.gpuRank,
                          )}`}
                        >
                          GPU {formatRankBadge(standing.gpuRank)}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </div>
              ) : null}
            </section>
          </div>

          {/* Platform, RAM & Storage */}
          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs">
              <div className="mb-2.5 flex items-center gap-2 font-semibold tracking-wider text-slate-400 uppercase">
                {isLaptop ? (
                  <Wifi className="h-4 w-4 text-violet-400" />
                ) : (
                  <Zap className="h-4 w-4 text-amber-400" />
                )}
                {isLaptop ? 'Memory, Display & Wireless' : 'Memory, Board, Chassis & Power'}
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-slate-300">
                <div>
                  <dt className="text-slate-500">RAM</dt>
                  <dd className="mt-0.5 font-mono">
                    {(() => {
                      const ramText = [
                        rig.ram_gb ? `${rig.ram_gb} GB` : null,
                        rig.ram_type || null,
                        rig.ram_speed_mhz ? `@ ${rig.ram_speed_mhz} MHz` : null,
                      ]
                        .filter(Boolean)
                        .join(' ');
                      const ramLinks = buildRamResearchLinks(
                        mergePartSpecEntry(
                          rig.ram_kit,
                          rig.part_spec_links?.ram,
                        ),
                      );
                      if (ramLinks.length > 0 || (onEditPartLinks && ramText)) {
                        return (
                          <SpecLink
                            compact
                            label={ramText || '—'}
                            links={ramLinks}
                            onEditLinks={
                              onEditPartLinks
                                ? () =>
                                    rig.ram_kit
                                      ? onEditPartLinks({
                                          kind: 'catalog_part',
                                          table: 'ram_kits',
                                          id: rig.ram_kit.id,
                                          presetKind: 'ram',
                                          partLabel:
                                            ramText ||
                                            `${rig.ram_kit.brand ?? ''} ${rig.ram_kit.model}`.trim(),
                                          subtitle: 'RAM Kit Catalog Entry',
                                          specUrl: rig.ram_kit.spec_url,
                                          specLinks: rig.ram_kit.spec_links,
                                        })
                                      : onEditPartLinks({
                                          kind: 'computer_slot',
                                          computerId: rig.id,
                                          rigName: rig.name,
                                          slot: 'ram',
                                          partLabel: ramText || 'RAM Kit',
                                          currentMap: rig.part_spec_links,
                                        })
                                : undefined
                            }
                          />
                        );
                      }
                      return ramText || '—';
                    })()}
                  </dd>
                </div>
                {!isLaptop ? (
                  <>
                    <div>
                      <dt className="text-slate-500">Motherboard</dt>
                      <dd className="mt-0.5">
                        {(() => {
                          const mbText = [
                            rig.motherboard_brand,
                            rig.motherboard_name,
                          ]
                            .filter(Boolean)
                            .join(' ');
                          const mbLinks = buildMotherboardResearchLinks(
                            rig.motherboard_brand,
                            rig.motherboard_name,
                            rig.motherboard_launch,
                            mergePartSpecEntry(
                              rig.motherboard,
                              rig.part_spec_links?.motherboard,
                            ),
                          );
                          return mbText || mbLinks.length > 0 ? (
                            <SpecLink
                              compact
                              label={mbText || 'Motherboard'}
                              links={mbLinks}
                              onEditLinks={
                                onEditPartLinks
                                  ? () =>
                                      rig.motherboard
                                        ? onEditPartLinks({
                                            kind: 'catalog_part',
                                            table: 'motherboards',
                                            id: rig.motherboard.id,
                                            presetKind: 'motherboard',
                                            partLabel:
                                              mbText ||
                                              `${rig.motherboard.brand} ${rig.motherboard.model}`,
                                            subtitle: 'Motherboard Catalog Entry',
                                            specUrl: rig.motherboard.spec_url,
                                            specLinks: rig.motherboard.spec_links,
                                          })
                                        : onEditPartLinks({
                                            kind: 'computer_slot',
                                            computerId: rig.id,
                                            rigName: rig.name,
                                            slot: 'motherboard',
                                            partLabel: mbText || 'Motherboard',
                                            currentMap: rig.part_spec_links,
                                          })
                                  : undefined
                              }
                            />
                          ) : (
                            '—'
                          );
                        })()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Power Supply</dt>
                      <dd className="mt-0.5 font-mono">
                        {(() => {
                          const psuText = [
                            rig.psu_wattage ? `${rig.psu_wattage}W` : null,
                            rig.psu_brand,
                          ]
                            .filter(Boolean)
                            .join(' ');
                          const psuLinks = buildPsuResearchLinks(
                            rig.psu_brand,
                            rig.psu_wattage,
                            mergePartSpecEntry(
                              rig.psu,
                              rig.part_spec_links?.psu,
                            ),
                          );
                          return psuText || psuLinks.length > 0 ? (
                            <SpecLink
                              compact
                              label={psuText || 'Power Supply'}
                              links={psuLinks}
                              onEditLinks={
                                onEditPartLinks
                                  ? () =>
                                      rig.psu
                                        ? onEditPartLinks({
                                            kind: 'catalog_part',
                                            table: 'psus',
                                            id: rig.psu.id,
                                            presetKind: 'psu',
                                            partLabel:
                                              psuText ||
                                              `${rig.psu.brand} ${rig.psu.model}`,
                                            subtitle: 'PSU Catalog Entry',
                                            specUrl: rig.psu.spec_url,
                                            specLinks: rig.psu.spec_links,
                                          })
                                        : onEditPartLinks({
                                            kind: 'computer_slot',
                                            computerId: rig.id,
                                            rigName: rig.name,
                                            slot: 'psu',
                                            partLabel: psuText || 'Power Supply',
                                            currentMap: rig.part_spec_links,
                                          })
                                  : undefined
                              }
                            />
                          ) : (
                            '—'
                          );
                        })()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">PSU Connectors</dt>
                      <dd className="font-mono">
                        8-pin CPU:{' '}
                        {rig.psu_has_8pin_cpu === null
                          ? '—'
                          : rig.psu_has_8pin_cpu
                            ? 'Yes'
                            : 'No'}{' '}
                        · 6-pin PCIe:{' '}
                        {rig.psu_has_6pin_pcie === null
                          ? '—'
                          : rig.psu_has_6pin_pcie
                            ? 'Yes'
                            : 'No'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">PC Case</dt>
                      <dd className="mt-0.5">
                        {rig.pc_case ? (
                          <SpecLink
                            compact
                            label={`${rig.pc_case.brand} ${rig.pc_case.model}`}
                            links={buildCaseResearchLinks(
                              rig.pc_case.brand,
                              rig.pc_case.model,
                              {
                                spec_url: rig.pc_case.spec_url,
                                links: rig.pc_case.spec_links,
                              },
                            )}
                            onEditLinks={
                              onEditPartLinks
                                ? () =>
                                    onEditPartLinks({
                                      kind: 'catalog_part',
                                      table: 'cases',
                                      id: rig.pc_case!.id,
                                      presetKind: 'case',
                                      partLabel: `${rig.pc_case!.brand} ${rig.pc_case!.model}`,
                                      subtitle: 'Case Catalog Entry',
                                      specUrl: rig.pc_case!.spec_url,
                                      specLinks: rig.pc_case!.spec_links,
                                    })
                                : undefined
                            }
                          />
                        ) : (
                          '—'
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">CPU Cooler</dt>
                      <dd className="mt-0.5">
                        {rig.cooler ? (
                          <SpecLink
                            compact
                            label={`${rig.cooler.brand} ${rig.cooler.model}`}
                            links={buildCoolerResearchLinks(
                              rig.cooler.brand,
                              rig.cooler.model,
                              {
                                spec_url: rig.cooler.spec_url,
                                links: rig.cooler.spec_links,
                              },
                            )}
                            onEditLinks={
                              onEditPartLinks
                                ? () =>
                                    onEditPartLinks({
                                      kind: 'catalog_part',
                                      table: 'coolers',
                                      id: rig.cooler!.id,
                                      presetKind: 'cooler',
                                      partLabel: `${rig.cooler!.brand} ${rig.cooler!.model}`,
                                      subtitle: 'Cooler Catalog Entry',
                                      specUrl: rig.cooler!.spec_url,
                                      specLinks: rig.cooler!.spec_links,
                                    })
                                : undefined
                            }
                          />
                        ) : (
                          '—'
                        )}
                      </dd>
                    </div>
                    {rig.wifi_card || rig.wifi_model || rig.wifi_product ? (
                      <div className="col-span-2">
                        <dt className="text-slate-500">Wi-Fi / Bluetooth</dt>
                        <dd className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          {(() => {
                            const wifiText = [
                              rig.wifi_brand,
                              rig.wifi_product,
                              rig.wifi_model,
                            ]
                              .filter(Boolean)
                              .join(' ');
                            const wifiLinks = buildWifiResearchLinks(
                              rig.wifi_brand,
                              rig.wifi_product,
                              rig.wifi_model,
                              mergePartSpecEntry(
                                rig.wifi_card,
                                rig.part_spec_links?.wifi,
                              ),
                            );
                            return (
                              <>
                                <SpecLink
                                  compact
                                  label={wifiText || 'Wi-Fi Adapter'}
                                  links={wifiLinks}
                                  onEditLinks={
                                    onEditPartLinks
                                      ? () =>
                                          rig.wifi_card
                                            ? onEditPartLinks({
                                                kind: 'catalog_part',
                                                table: 'wifi_cards',
                                                id: rig.wifi_card.id,
                                                presetKind: 'wifi',
                                                partLabel:
                                                  wifiText || rig.wifi_card.model,
                                                subtitle: 'Wi-Fi Card Catalog Entry',
                                                specUrl: rig.wifi_card.spec_url,
                                                specLinks: rig.wifi_card.spec_links,
                                              })
                                            : onEditPartLinks({
                                                kind: 'computer_slot',
                                                computerId: rig.id,
                                                rigName: rig.name,
                                                slot: 'wifi',
                                                partLabel:
                                                  wifiText || 'Wi-Fi Adapter',
                                                currentMap: rig.part_spec_links,
                                              })
                                      : undefined
                                  }
                                />
                                {rig.bluetooth_version ? (
                                  <span className="font-mono text-[11px] text-slate-400">
                                    · BT {rig.bluetooth_version}
                                  </span>
                                ) : null}
                              </>
                            );
                          })()}
                        </dd>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <div>
                      <dt className="text-slate-500">Display</dt>
                      <dd className="font-mono">
                        {rig.screen_size_inches
                          ? `${rig.screen_size_inches}"`
                          : '—'}{' '}
                        {rig.screen_resolution ?? ''}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Weight</dt>
                      <dd className="font-mono">
                        {rig.weight_lbs ? `${rig.weight_lbs} lbs` : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Wi-Fi / Bluetooth</dt>
                      <dd className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        {(() => {
                          const wifiText = [
                            rig.wifi_brand,
                            rig.wifi_product,
                            rig.wifi_model,
                          ]
                            .filter(Boolean)
                            .join(' ');
                          const wifiLinks = buildWifiResearchLinks(
                            rig.wifi_brand,
                            rig.wifi_product,
                            rig.wifi_model,
                            mergePartSpecEntry(
                              rig.wifi_card,
                              rig.part_spec_links?.wifi,
                            ),
                          );
                          return (
                            <>
                              {wifiText || wifiLinks.length > 0 ? (
                                <SpecLink
                                  compact
                                  label={wifiText || 'Wi-Fi Adapter'}
                                  links={wifiLinks}
                                  onEditLinks={
                                    onEditPartLinks
                                      ? () =>
                                          rig.wifi_card
                                            ? onEditPartLinks({
                                                kind: 'catalog_part',
                                                table: 'wifi_cards',
                                                id: rig.wifi_card.id,
                                                presetKind: 'wifi',
                                                partLabel:
                                                  wifiText || rig.wifi_card.model,
                                                subtitle: 'Wi-Fi Card Catalog Entry',
                                                specUrl: rig.wifi_card.spec_url,
                                                specLinks: rig.wifi_card.spec_links,
                                              })
                                            : onEditPartLinks({
                                                kind: 'computer_slot',
                                                computerId: rig.id,
                                                rigName: rig.name,
                                                slot: 'wifi',
                                                partLabel:
                                                  wifiText || 'Wi-Fi Adapter',
                                                currentMap: rig.part_spec_links,
                                              })
                                      : undefined
                                  }
                                />
                              ) : (
                                <span>—</span>
                              )}
                              {rig.bluetooth_version ? (
                                <span className="font-mono text-[11px] text-slate-400">
                                  · BT {rig.bluetooth_version}
                                </span>
                              ) : null}
                            </>
                          );
                        })()}
                      </dd>
                    </div>
                  </>
                )}
              </dl>
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs">
              <div className="mb-2.5 flex items-center gap-2 font-semibold tracking-wider text-slate-400 uppercase">
                <HardDrive className="h-4 w-4 text-sky-400" />
                Storage Drives ({rig.storage_drives.length})
              </div>
              {rig.storage_drives.length === 0 ? (
                <p className="text-slate-500">No storage drives recorded.</p>
              ) : (
                <div className="space-y-2">
                  {rig.storage_drives.map((d) => (
                    <div
                      key={d.id}
                      className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5"
                    >
                      <div className="flex items-center justify-between gap-2 font-medium text-slate-200">
                        <SpecLink
                          compact
                          label={`${d.capacity_gb ? `${d.capacity_gb} GB ` : ''}${
                            [d.brand, d.model].filter(Boolean).join(' ') ||
                            'Drive'
                          }`}
                          links={buildStorageDriveResearchLinks({
                            ...d,
                            spec_url:
                              d.spec_url ??
                              d.storage_drive_model?.spec_url ??
                              null,
                            spec_links:
                              (d.spec_links?.length ?? 0) > 0
                                ? d.spec_links
                                : (d.storage_drive_model?.spec_links ?? []),
                          })}
                          onEditLinks={
                            onEditPartLinks
                              ? () =>
                                  onEditPartLinks({
                                    kind: 'storage_drive',
                                    rigName: rig.name,
                                    drive: d,
                                  })
                              : undefined
                          }
                        />
                        <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-slate-300">
                          {d.form_factor ?? 'Storage'}
                        </span>
                      </div>
                      {(d.read_mb_s || d.write_mb_s || d.nand_type) ? (
                        <p className="mt-1 font-mono text-[11px] text-slate-400">
                          {d.nand_type ? `${d.nand_type} · ` : ''}
                          {d.read_mb_s ? `R: ${d.read_mb_s} MB/s` : ''}
                          {d.write_mb_s ? ` / W: ${d.write_mb_s} MB/s` : ''}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Steam Library Compatibility Summary */}
          {steamSummary && steamSummary.total > 0 ? (
            <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
                  <Gamepad2 className="h-4 w-4 text-cyan-400" />
                  Steam Library Compatibility ({steamSummary.total} Titles)
                </div>
                {onViewSteamForRig ? (
                  <button
                    type="button"
                    onClick={() => onViewSteamForRig(rig.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-300 transition hover:bg-cyan-500/20"
                  >
                    Browse in Steam Tab →
                  </button>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 font-mono text-xs">
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-emerald-300">
                  Playable: {steamSummary.playable}
                </span>
                <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-amber-300">
                  Minimum: {steamSummary.minimum}
                </span>
                <span className="rounded-full border border-rose-500/40 bg-rose-500/15 px-2.5 py-0.5 text-rose-300">
                  Blocked: {steamSummary.blocked}
                </span>
                {steamSummary.unknown > 0 ? (
                  <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-slate-400">
                    Unknown: {steamSummary.unknown}
                  </span>
                ) : null}
              </div>
            </section>
          ) : null}

          {/* 3DMark Benchmark History */}
          <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
                <Trophy className="h-4 w-4 text-amber-400" />
                3DMark Benchmark History ({rig.benchmarks.length})
              </div>
              {isOwner ? (
                <button
                  type="button"
                  onClick={() => onAddBenchmark(rig)}
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300 transition hover:bg-amber-500/25"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Log 3DMark Score
                </button>
              ) : null}
            </div>

            {rig.benchmarks.length === 0 ? (
              <p className="text-xs text-slate-500">
                No 3DMark scores logged for this build yet.
              </p>
            ) : (
              <div className="space-y-2">
                {rig.benchmarks.map((b) => {
                  const suiteMax = maxBySuite.get(b.suite_name) ?? b.score;
                  const pct =
                    suiteMax > 0
                      ? Math.max(12, Math.round((b.score / suiteMax) * 100))
                      : 100;
                  const safeUrl = getSafeThreeDMarkUrl(b.result_url);
                  return (
                    <div
                      key={b.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs"
                    >
                      <div className="min-w-[140px]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-white">
                            {b.suite_name}
                          </span>
                          {latestBySuite[b.suite_name]?.id === b.id &&
                          standing?.benchmarkRanks[b.suite_name] ? (
                            <span
                              className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${getRankBadgeClasses(
                                standing.benchmarkRanks[b.suite_name],
                              )}`}
                            >
                              Fleet{' '}
                              {formatRankBadge(
                                standing.benchmarkRanks[b.suite_name],
                              )}
                            </span>
                          ) : null}
                          <span className="font-mono text-[11px] text-slate-500">
                            {b.recorded_at}
                          </span>
                        </div>
                        {b.graphics_score !== null || b.cpu_score !== null ? (
                          <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                            {[
                              b.graphics_score !== null
                                ? `Graphics: ${b.graphics_score.toLocaleString()}`
                                : null,
                              b.cpu_score !== null
                                ? `CPU: ${b.cpu_score.toLocaleString()}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        ) : null}
                        {b.notes ? (
                          <p className="text-[11px] text-slate-400">
                            {b.notes}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-1 items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-cyan-400"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {safeUrl ? (
                          <a
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Open ${b.suite_name} result on 3DMark`}
                            className="inline-flex min-w-20 items-center justify-end gap-1 font-mono text-sm font-bold text-amber-300 underline decoration-amber-400/50 underline-offset-2 transition hover:text-amber-200 hover:decoration-amber-300"
                          >
                            {b.score.toLocaleString()}
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        ) : (
                          <span className="min-w-20 text-right font-mono text-sm font-bold text-amber-300">
                            {b.score.toLocaleString()}
                          </span>
                        )}
                        {isOwner ? (
                          <div className="flex items-center gap-1">
                            {!safeUrl ? (
                              <button
                                type="button"
                                onClick={() => onEditBenchmark(rig, b, true)}
                                title="Add 3DMark result link"
                                className="inline-flex items-center gap-1 rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[11px] font-medium text-cyan-300 transition hover:bg-cyan-500/20 hover:text-cyan-200"
                              >
                                <Link2 className="h-3 w-3" />
                                Add link
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => onEditBenchmark(rig, b, false)}
                              title="Edit benchmark run"
                              className="rounded p-1 text-slate-500 hover:bg-cyan-500/15 hover:text-cyan-300"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteBenchmark(b.id)}
                              title="Delete benchmark run"
                              className="rounded p-1 text-slate-500 hover:bg-rose-500/15 hover:text-rose-300"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {rig.notes ? (
            <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-300">
              <div className="mb-1 font-semibold text-slate-400 uppercase">
                Notes
              </div>
              <p className="whitespace-pre-wrap">{rig.notes}</p>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
