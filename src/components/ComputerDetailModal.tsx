import {
  Cpu as CpuIcon,
  Edit3,
  HardDrive,
  Laptop,
  Monitor,
  Plus,
  Trash2,
  Trophy,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import type { ComputerWithRelations } from '../types/database';
import { DirectXBadge } from './DirectXBadge';
import { SpecLink } from './SpecLink';

interface ComputerDetailModalProps {
  rig: ComputerWithRelations | null;
  isOwner: boolean;
  onClose: () => void;
  onEdit: (rig: ComputerWithRelations) => void;
  onDelete: (rig: ComputerWithRelations) => void;
  onAddBenchmark: (rig: ComputerWithRelations) => void;
  onDeleteBenchmark: (benchmarkId: number) => void;
}

export function ComputerDetailModal({
  rig,
  isOwner,
  onClose,
  onEdit,
  onDelete,
  onAddBenchmark,
  onDeleteBenchmark,
}: ComputerDetailModalProps) {
  if (!rig) return null;

  const isLaptop = rig.device_type === 'Laptop';
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
            </div>
            <h2 className="mt-2 text-xl font-bold text-white">{rig.name}</h2>
            <p className="text-xs text-slate-400">
              {isLaptop
                ? [rig.brand, rig.model].filter(Boolean).join(' ')
                : [rig.motherboard_brand, rig.motherboard_name]
                    .filter(Boolean)
                    .join(' ')}
              {rig.build_date ? ` · Built ${rig.build_date}` : ''}
              {rig.overall_rank ? ` · Rank #${rig.overall_rank}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isOwner ? (
              <>
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
                      specUrl={rig.cpu.spec_url}
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
                      specUrl={rig.gpu.spec_url}
                    />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-slate-300">
                    <div>
                      <dt className="text-slate-500">Board Partner / OEM</dt>
                      <dd>
                        {[rig.gpu_aib_manufacturer, rig.gpu_aib_model]
                          .filter(Boolean)
                          .join(' ') || 'Reference'}
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
                      <dt className="text-slate-500">TDP / Rank</dt>
                      <dd className="font-mono">
                        {rig.gpu.tdp_w ? `${rig.gpu.tdp_w}W` : '—'}
                        {rig.gpu.rank ? ` · #${rig.gpu.rank}` : ''}
                      </dd>
                    </div>
                  </dl>
                  {rig.igpu ? (
                    <div className="border-t border-slate-800 pt-2 text-xs text-slate-400">
                      Integrated GPU:{' '}
                      <SpecLink
                        label={`${rig.igpu.brand} ${rig.igpu.name}`}
                        specUrl={rig.igpu.spec_url}
                      />
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  No discrete graphics card recorded.
                </p>
              )}
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
                {isLaptop ? 'Memory, Display & Wireless' : 'Memory, Board & Power'}
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-slate-300">
                <div>
                  <dt className="text-slate-500">RAM</dt>
                  <dd className="font-mono">
                    {rig.ram_gb ? `${rig.ram_gb} GB` : '—'}{' '}
                    {rig.ram_type ?? ''}
                    {rig.ram_speed_mhz ? ` @ ${rig.ram_speed_mhz} MHz` : ''}
                  </dd>
                </div>
                {!isLaptop ? (
                  <>
                    <div>
                      <dt className="text-slate-500">Motherboard</dt>
                      <dd>
                        {[rig.motherboard_brand, rig.motherboard_name]
                          .filter(Boolean)
                          .join(' ') || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Power Supply</dt>
                      <dd className="font-mono">
                        {rig.psu_wattage
                          ? `${rig.psu_wattage}W ${rig.psu_brand ?? ''}`
                          : '—'}
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
                      <dd>
                        {[rig.wifi_brand, rig.wifi_product, rig.wifi_model]
                          .filter(Boolean)
                          .join(' ') || '—'}
                        {rig.bluetooth_version
                          ? ` · BT ${rig.bluetooth_version}`
                          : ''}
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
                        <span>
                          {d.capacity_gb ? `${d.capacity_gb} GB ` : ''}
                          {[d.brand, d.model].filter(Boolean).join(' ') ||
                            'Drive'}
                        </span>
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-slate-300">
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
                  return (
                    <div
                      key={b.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs"
                    >
                      <div className="min-w-[140px]">
                        <span className="font-semibold text-white">
                          {b.suite_name}
                        </span>
                        <span className="ml-2 font-mono text-[11px] text-slate-500">
                          {b.recorded_at}
                        </span>
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
                        <span className="w-20 text-right font-mono text-sm font-bold text-amber-300">
                          {b.score.toLocaleString()}
                        </span>
                        {isOwner ? (
                          <button
                            type="button"
                            onClick={() => onDeleteBenchmark(b.id)}
                            title="Delete benchmark run"
                            className="rounded p-1 text-slate-500 hover:bg-rose-500/15 hover:text-rose-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
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
