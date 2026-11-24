import type { ComputerWithRelations } from '../types/database';
import { getLatestBenchmarksMap, getSafeThreeDMarkUrl } from './benchmarks';
import { formatDirectX } from './directx';
import {
  computeFleetRankings,
  DUAL_CPU_EXTRA_SOCKET_FACTOR,
  formatPassMark,
  formatRankBadge,
  PASSMARK_CPU_WEIGHT,
  PASSMARK_GPU_WEIGHT,
  type RigFleetStanding,
} from './scoring';

export function getLatestScoresMap(
  rig: ComputerWithRelations,
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const [suite, bench] of Object.entries(getLatestBenchmarksMap(rig))) {
    map[suite] = bench.score;
  }
  return map;
}

function sortRigsByFleetRank(
  rigs: ComputerWithRelations[],
  standings: Map<number, RigFleetStanding>,
): ComputerWithRelations[] {
  return [...rigs].sort((a, b) => {
    const ra = standings.get(a.id)?.overallRank?.rank ?? null;
    const rb = standings.get(b.id)?.overallRank?.rank ?? null;
    if (ra !== null && rb !== null && ra !== rb) return ra - rb;
    if (ra !== null && rb === null) return -1;
    if (ra === null && rb !== null) return 1;
    return a.name.localeCompare(b.name);
  });
}

export function buildAiExportJson(
  rigs: ComputerWithRelations[],
  fleetStandings?: Map<number, RigFleetStanding>,
): string {
  const standings = fleetStandings ?? computeFleetRankings(rigs);
  const orderedRigs = sortRigsByFleetRank(rigs, standings);

  const payload = {
    exported_at: new Date().toISOString(),
    total_rigs: orderedRigs.length,
    desktops: orderedRigs.filter((r) => r.device_type === 'Desktop').length,
    laptops: orderedRigs.filter((r) => r.device_type === 'Laptop').length,
    scoring_model: {
      name: 'Unified PassMark Composite',
      formula: `round(${PASSMARK_GPU_WEIGHT.toFixed(2)} * effective_gpu_g3d + ${PASSMARK_CPU_WEIGHT.toFixed(2)} * effective_cpu_mark)`,
      dual_cpu_extra_socket_factor: DUAL_CPU_EXTRA_SOCKET_FACTOR,
    },
    rigs: orderedRigs.map((r) => {
      const totalStorageGb = r.storage_drives.reduce(
        (sum, d) => sum + (d.capacity_gb ?? 0),
        0,
      );
      const standing = standings.get(r.id);
      const benchmarkRanks = standing
        ? Object.fromEntries(
            Object.entries(standing.benchmarkRanks).map(([suite, pos]) => [
              suite,
              { rank: pos.rank, total: pos.total, is_tied: pos.isTied },
            ]),
          )
        : {};

      return {
        name: r.name,
        device_type: r.device_type,
        status: r.status,
        brand: r.brand,
        model: r.model,
        build_date: r.build_date,
        fleet_rank: standing
          ? {
              overall_rank: standing.overallRank?.rank ?? null,
              overall_total: standing.overallRank?.total ?? null,
              class_rank: standing.classRank?.rank ?? null,
              class_total: standing.classRank?.total ?? null,
              composite_passmark: standing.compositeScore,
              is_partial: standing.isPartial,
              cpu_rank: standing.cpuRank?.rank ?? null,
              cpu_total: standing.cpuRank?.total ?? null,
              gpu_rank: standing.gpuRank?.rank ?? null,
              gpu_total: standing.gpuRank?.total ?? null,
              gpu_source: standing.gpuSource,
              benchmarks_3dmark_ranks: benchmarkRanks,
            }
          : null,
        cpu: r.cpu
          ? {
              name: r.cpu_count > 1 ? `${r.cpu_count}x ${r.cpu.name}` : r.cpu.name,
              brand: r.cpu.brand,
              codename: r.cpu.codename,
              socket: r.cpu.socket,
              total_cores: (r.cpu.cores ?? 0) * r.cpu_count || null,
              total_threads: (r.cpu.threads ?? 0) * r.cpu_count || null,
              base_ghz: r.cpu.base_clock_ghz,
              turbo_ghz: r.cpu.turbo_clock_ghz,
              passmark_score: r.cpu.passmark_score,
              effective_passmark_score: standing?.effectiveCpuScore ?? null,
              score_updated_at: r.cpu.score_updated_at,
              spec_url: r.cpu.spec_url,
            }
          : null,
        gpu: r.gpu
          ? {
              name: r.gpu.name,
              brand: r.gpu.brand,
              aib_manufacturer: r.gpu_aib_manufacturer,
              aib_model: r.gpu_aib_model,
              vram_gb: r.gpu.vram_gb,
              vram_type: r.gpu.vram_type,
              directx: formatDirectX(r.gpu.directx_version, r.gpu.directx_feature_level),
              directx_version: r.gpu.directx_version,
              directx_feature_level: r.gpu.directx_feature_level,
              passmark_score: r.gpu.passmark_score,
              score_updated_at: r.gpu.score_updated_at,
              spec_url: r.gpu.spec_url,
            }
          : null,
        igpu: r.igpu
          ? {
              name: r.igpu.name,
              brand: r.igpu.brand,
              passmark_score: r.igpu.passmark_score,
              spec_url: r.igpu.spec_url,
            }
          : null,
        ram: r.ram_gb
          ? {
              size_gb: r.ram_gb,
              speed_mhz: r.ram_speed_mhz,
              type: r.ram_type,
            }
          : null,
        storage_total_gb: totalStorageGb || null,
        storage_drives: r.storage_drives.map((d) => ({
          capacity_gb: d.capacity_gb,
          form_factor: d.form_factor,
          brand: d.brand,
          model: d.model,
        })),
        motherboard: r.motherboard_name
          ? `${r.motherboard_brand ? `${r.motherboard_brand} ` : ''}${r.motherboard_name}`
          : null,
        psu_wattage: r.psu_wattage,
        display: r.screen_size_inches
          ? `${r.screen_size_inches}" ${r.screen_resolution ?? ''}`.trim()
          : null,
        benchmarks_3dmark: getLatestScoresMap(r),
        benchmarks_3dmark_runs: r.benchmarks.map((b) => ({
          suite_name: b.suite_name,
          score: b.score,
          graphics_score: b.graphics_score,
          cpu_score: b.cpu_score,
          recorded_at: b.recorded_at,
          result_url: getSafeThreeDMarkUrl(b.result_url),
          notes: b.notes,
        })),
      };
    }),
  };

  return JSON.stringify(payload, null, 2);
}

export function buildAiExportMarkdown(
  rigs: ComputerWithRelations[],
  fleetStandings?: Map<number, RigFleetStanding>,
): string {
  const standings = fleetStandings ?? computeFleetRankings(rigs);
  const orderedRigs = sortRigsByFleetRank(rigs, standings);
  const desktops = orderedRigs.filter((r) => r.device_type === 'Desktop');
  const laptops = orderedRigs.filter((r) => r.device_type === 'Laptop');

  const lines: string[] = [
    '# VelociPCs Hardware Inventory Summary',
    '',
    `- **Exported:** ${new Date().toISOString().slice(0, 10)}`,
    `- **Total Machines:** ${orderedRigs.length} (${desktops.length} Desktops, ${laptops.length} Laptops)`,
    `- **Unified Scoring Model:** PassMark Composite = round(60% GPU G3D + 40% CPU Mark; dual-CPU scaled 1.8x)`,
    '',
    '## Quick Comparison Table',
    '',
    '| Fleet Rank | Name | Type | CPU | GPU | PassMark (CPU / GPU) | DirectX | RAM | Storage | 3DMark (Time Spy / Fire Strike / Cloud Gate) |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (const r of orderedRigs) {
    const standing = standings.get(r.id);
    const fleetLabel = standing?.overallRank
      ? `${formatRankBadge(standing.overallRank)} (${formatPassMark(standing.compositeScore)}${
          standing.isPartial ? '*' : ''
        })`
      : '—';
    const cpuLabel = r.cpu
      ? `${r.cpu_count > 1 ? `${r.cpu_count}x ` : ''}${r.cpu.name} (${
          (r.cpu.cores ?? 0) * r.cpu_count
        }C/${(r.cpu.threads ?? 0) * r.cpu_count}T)`
      : '—';
    const effectiveGpu = r.gpu ?? r.igpu;
    const gpuLabel = r.gpu
      ? `${r.gpu.name}${r.gpu.vram_gb ? ` (${r.gpu.vram_gb}GB)` : ''}`
      : r.igpu
        ? `iGPU: ${r.igpu.name}`
        : 'Integrated / None';
    const pmPair = `${formatPassMark(standing?.effectiveCpuScore)} / ${formatPassMark(
      standing?.effectiveGpuScore,
    )}`;
    const dxLabel = effectiveGpu
      ? formatDirectX(effectiveGpu.directx_version, effectiveGpu.directx_feature_level)
      : 'N/A';
    const ramLabel = r.ram_gb
      ? `${r.ram_gb}GB${r.ram_speed_mhz ? ` @ ${r.ram_speed_mhz}MHz` : ''}`
      : '—';
    const totalGb = r.storage_drives.reduce((s, d) => s + (d.capacity_gb ?? 0), 0);
    const storageLabel = totalGb ? `${totalGb}GB` : '—';
    const latestBenchmarks = getLatestBenchmarksMap(r);
    const formatCellEntry = (abbr: string, suite: string) => {
      const bench = latestBenchmarks[suite];
      if (!bench) return null;
      const safeUrl = getSafeThreeDMarkUrl(bench.result_url);
      return safeUrl
        ? `[${abbr}: ${bench.score}](${safeUrl})`
        : `${abbr}: ${bench.score}`;
    };
    const scoreParts = [
      formatCellEntry('TS', 'Time Spy'),
      formatCellEntry('FS', 'Fire Strike'),
      formatCellEntry('SD', 'Sky Diver'),
      formatCellEntry('CG', 'Cloud Gate'),
    ].filter(Boolean);
    const scoreStr = scoreParts.length ? scoreParts.join(' / ') : '—';

    lines.push(
      `| ${fleetLabel} | ${r.name} | ${r.device_type} | ${cpuLabel} | ${gpuLabel} | ${pmPair} | ${dxLabel} | ${ramLabel} | ${storageLabel} | ${scoreStr} |`,
    );
  }

  const renderGroup = (title: string, group: ComputerWithRelations[]) => {
    if (group.length === 0) return;
    lines.push('', `## ${title}`);
    for (const r of group) {
      const standing = standings.get(r.id);
      lines.push('', `### ${r.name} (${r.status})`);
      if (standing?.overallRank) {
        const classNote = standing.classRank
          ? ` · #${standing.classRank.rank} of ${standing.classRank.total} ${r.device_type}s`
          : '';
        const partialNote = standing.isPartial ? ' · Partial (missing GPU/CPU PassMark)' : '';
        lines.push(
          `- **Fleet Rank:** ${formatRankBadge(standing.overallRank)}${classNote} — Composite PassMark ${formatPassMark(
            standing.compositeScore,
          )}${partialNote}`,
        );
      }
      if (r.brand || r.model) {
        lines.push(`- **System:** ${[r.brand, r.model].filter(Boolean).join(' ')}`);
      }
      if (r.motherboard_name) {
        lines.push(
          `- **Motherboard:** ${[r.motherboard_brand, r.motherboard_name].filter(Boolean).join(' ')}`,
        );
      }
      if (r.cpu) {
        const cpuText = `${r.cpu_count > 1 ? `${r.cpu_count}x ` : ''}${r.cpu.brand} ${r.cpu.name}`;
        const pmNote =
          standing?.effectiveCpuScore !== null &&
          standing?.effectiveCpuScore !== undefined
            ? ` · PassMark CPU Mark ${formatPassMark(standing.effectiveCpuScore)}${
                standing.cpuRank ? ` (${formatRankBadge(standing.cpuRank)})` : ''
              }`
            : '';
        lines.push(
          `- **CPU:** ${cpuText} — ${(r.cpu.cores ?? 0) * r.cpu_count}C/${
            (r.cpu.threads ?? 0) * r.cpu_count
          }T @ ${r.cpu.base_clock_ghz ?? '?'}–${r.cpu.turbo_clock_ghz ?? '?'} GHz${pmNote}${
            r.cpu.spec_url ? ` ([Specs](${r.cpu.spec_url}))` : ''
          }`,
        );
      }
      if (r.gpu) {
        const g3dNote =
          r.gpu.passmark_score !== null
            ? ` · PassMark G3D ${formatPassMark(r.gpu.passmark_score)}${
                standing?.gpuRank && standing.gpuSource === 'gpu'
                  ? ` (${formatRankBadge(standing.gpuRank)})`
                  : ''
              }`
            : '';
        lines.push(
          `- **GPU:** ${r.gpu.brand} ${r.gpu.name} (${r.gpu.vram_gb ?? '?'} GB ${
            r.gpu.vram_type ?? ''
          }) — **${formatDirectX(r.gpu.directx_version, r.gpu.directx_feature_level)}**${g3dNote}${
            r.gpu.spec_url ? ` ([Specs](${r.gpu.spec_url}))` : ''
          }`,
        );
      }
      if (r.igpu) {
        const igpuG3d =
          r.igpu.passmark_score !== null
            ? ` · PassMark G3D ${formatPassMark(r.igpu.passmark_score)}`
            : '';
        lines.push(
          `- **Integrated GPU:** ${r.igpu.brand} ${r.igpu.name}${igpuG3d}${
            r.igpu.spec_url ? ` ([Specs](${r.igpu.spec_url}))` : ''
          }`,
        );
      }
      if (r.ram_gb) {
        lines.push(
          `- **RAM:** ${r.ram_gb} GB ${r.ram_type ?? ''} ${
            r.ram_speed_mhz ? `@ ${r.ram_speed_mhz} MHz` : ''
          }`.trim(),
        );
      }
      if (r.storage_drives.length > 0) {
        const dStr = r.storage_drives
          .map(
            (d) =>
              `${d.capacity_gb ?? '?'} GB ${d.form_factor ?? ''} (${[d.brand, d.model]
                .filter(Boolean)
                .join(' ')})`,
          )
          .join('; ');
        lines.push(`- **Storage:** ${dStr}`);
      }
      if (r.screen_size_inches) {
        lines.push(
          `- **Display:** ${r.screen_size_inches}" (${r.screen_resolution ?? 'Unknown'})`,
        );
      }
      if (r.psu_wattage) {
        lines.push(
          `- **PSU:** ${r.psu_wattage}W ${r.psu_brand ?? ''}`.trim(),
        );
      }
      if (r.benchmarks.length > 0) {
        const bStr = r.benchmarks
          .map((b) => {
            const safeUrl = getSafeThreeDMarkUrl(b.result_url);
            return safeUrl
              ? `[${b.suite_name}: ${b.score}](${safeUrl})`
              : `${b.suite_name}: ${b.score}`;
          })
          .join(', ');
        lines.push(`- **3DMark Scores:** ${bStr}`);
      }
    }
  };

  renderGroup('Desktops', desktops);
  renderGroup('Laptops', laptops);

  return lines.join('\n');
}
