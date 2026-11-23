import type { ComputerWithRelations } from '../types/database';
import { getLatestBenchmarksMap, getSafeThreeDMarkUrl } from './benchmarks';
import { formatDirectX } from './directx';

export function getLatestScoresMap(
  rig: ComputerWithRelations,
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const [suite, bench] of Object.entries(getLatestBenchmarksMap(rig))) {
    map[suite] = bench.score;
  }
  return map;
}

export function buildAiExportJson(rigs: ComputerWithRelations[]): string {
  const payload = {
    exported_at: new Date().toISOString(),
    total_rigs: rigs.length,
    desktops: rigs.filter((r) => r.device_type === 'Desktop').length,
    laptops: rigs.filter((r) => r.device_type === 'Laptop').length,
    rigs: rigs.map((r) => {
      const totalStorageGb = r.storage_drives.reduce(
        (sum, d) => sum + (d.capacity_gb ?? 0),
        0,
      );
      return {
        name: r.name,
        device_type: r.device_type,
        status: r.status,
        brand: r.brand,
        model: r.model,
        build_date: r.build_date,
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
              spec_url: r.gpu.spec_url,
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

export function buildAiExportMarkdown(rigs: ComputerWithRelations[]): string {
  const desktops = rigs.filter((r) => r.device_type === 'Desktop');
  const laptops = rigs.filter((r) => r.device_type === 'Laptop');

  const lines: string[] = [
    '# VelociPCs Hardware Inventory Summary',
    '',
    `- **Exported:** ${new Date().toISOString().slice(0, 10)}`,
    `- **Total Machines:** ${rigs.length} (${desktops.length} Desktops, ${laptops.length} Laptops)`,
    '',
    '## Quick Comparison Table',
    '',
    '| Name | Type | CPU | GPU | DirectX | RAM | Storage | 3DMark (Time Spy / Fire Strike / Cloud Gate) |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (const r of rigs) {
    const cpuLabel = r.cpu
      ? `${r.cpu_count > 1 ? `${r.cpu_count}x ` : ''}${r.cpu.name} (${
          (r.cpu.cores ?? 0) * r.cpu_count
        }C/${(r.cpu.threads ?? 0) * r.cpu_count}T)`
      : '—';
    const gpuLabel = r.gpu
      ? `${r.gpu.name}${r.gpu.vram_gb ? ` (${r.gpu.vram_gb}GB)` : ''}`
      : 'Integrated / None';
    const dxLabel = r.gpu
      ? formatDirectX(r.gpu.directx_version, r.gpu.directx_feature_level)
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
      `| ${r.name} | ${r.device_type} | ${cpuLabel} | ${gpuLabel} | ${dxLabel} | ${ramLabel} | ${storageLabel} | ${scoreStr} |`,
    );
  }

  const renderGroup = (title: string, group: ComputerWithRelations[]) => {
    if (group.length === 0) return;
    lines.push('', `## ${title}`);
    for (const r of group) {
      lines.push('', `### ${r.name} (${r.status})`);
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
        lines.push(
          `- **CPU:** ${cpuText} — ${(r.cpu.cores ?? 0) * r.cpu_count}C/${
            (r.cpu.threads ?? 0) * r.cpu_count
          }T @ ${r.cpu.base_clock_ghz ?? '?'}–${r.cpu.turbo_clock_ghz ?? '?'} GHz${
            r.cpu.spec_url ? ` ([Specs](${r.cpu.spec_url}))` : ''
          }`,
        );
      }
      if (r.gpu) {
        lines.push(
          `- **GPU:** ${r.gpu.brand} ${r.gpu.name} (${r.gpu.vram_gb ?? '?'} GB ${
            r.gpu.vram_type ?? ''
          }) — **${formatDirectX(r.gpu.directx_version, r.gpu.directx_feature_level)}**${
            r.gpu.spec_url ? ` ([Specs](${r.gpu.spec_url}))` : ''
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
