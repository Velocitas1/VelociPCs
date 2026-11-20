import type { SupabaseClient } from '@supabase/supabase-js';
import {
  parseTransposedInventoryCsv,
  type ParsedCpu,
  type ParsedGpu,
  type ParsedImportPreview,
} from './csvParserCore.mjs';
import type { Cpu, DeviceType, Gpu } from '../types/database';

export { parseTransposedInventoryCsv, type ParsedImportPreview };

export interface ImportSummary {
  computersUpserted: number;
  cpusSynced: number;
  gpusSynced: number;
  drivesSynced: number;
  benchmarksInserted: number;
}

function mergeNonNull<T extends Record<string, unknown>>(
  existing: T | undefined,
  incoming: T,
): T {
  if (!existing) return incoming;
  const merged = { ...existing } as Record<string, unknown>;
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== null && v !== undefined && v !== 'Unknown') {
      merged[k] = v;
    } else if (merged[k] === undefined) {
      merged[k] = v;
    }
  }
  return merged as T;
}

export async function importParsedRigsToSupabase(
  supabase: SupabaseClient,
  preview: ParsedImportPreview,
): Promise<ImportSummary> {
  const cpuMap = new Map<string, ParsedCpu>();
  const gpuMap = new Map<string, ParsedGpu>();

  for (const rig of preview.rigs) {
    if (rig.cpu) {
      const key = `${rig.cpu.brand.toLowerCase()}|${rig.cpu.name.toLowerCase()}`;
      cpuMap.set(key, mergeNonNull(cpuMap.get(key) as unknown as Record<string, unknown>, rig.cpu as unknown as Record<string, unknown>) as unknown as ParsedCpu);
    }
    if (rig.gpu) {
      const key = `${rig.gpu.brand.toLowerCase()}|${rig.gpu.name.toLowerCase()}|${rig.gpu.is_mobile}`;
      gpuMap.set(key, mergeNonNull(gpuMap.get(key) as unknown as Record<string, unknown>, rig.gpu as unknown as Record<string, unknown>) as unknown as ParsedGpu);
    }
  }

  // 1. Load existing CPUs & GPUs so we update or insert cleanly without relying on expression index ON CONFLICT quirks
  const [{ data: existingCpus, error: cpuErr }, { data: existingGpus, error: gpuErr }] =
    await Promise.all([
      supabase.from('cpus').select('*'),
      supabase.from('gpus').select('*'),
    ]);
  if (cpuErr) throw cpuErr;
  if (gpuErr) throw gpuErr;

  const cpuIdByKey = new Map<string, number>();
  for (const c of (existingCpus ?? []) as Cpu[]) {
    cpuIdByKey.set(`${c.brand.toLowerCase()}|${c.name.toLowerCase()}`, c.id);
  }

  let cpusSynced = 0;
  for (const [key, cpu] of cpuMap.entries()) {
    const existingId = cpuIdByKey.get(key);
    if (existingId) {
      const { error } = await supabase.from('cpus').update(cpu).eq('id', existingId);
      if (error) throw error;
      cpusSynced += 1;
    } else {
      const { data, error } = await supabase.from('cpus').insert(cpu).select('id').single();
      if (error) throw error;
      cpuIdByKey.set(key, data.id);
      cpusSynced += 1;
    }
  }

  const gpuIdByKey = new Map<string, number>();
  for (const g of (existingGpus ?? []) as Gpu[]) {
    gpuIdByKey.set(`${g.brand.toLowerCase()}|${g.name.toLowerCase()}|${g.is_mobile}`, g.id);
  }

  let gpusSynced = 0;
  for (const [key, gpu] of gpuMap.entries()) {
    const existingId = gpuIdByKey.get(key);
    if (existingId) {
      const { error } = await supabase.from('gpus').update(gpu).eq('id', existingId);
      if (error) throw error;
      gpusSynced += 1;
    } else {
      const { data, error } = await supabase.from('gpus').insert(gpu).select('id').single();
      if (error) throw error;
      gpuIdByKey.set(key, data.id);
      gpusSynced += 1;
    }
  }

  // 2. Upsert computers using unique (name, device_type) constraint
  let computersUpserted = 0;
  let drivesSynced = 0;
  let benchmarksInserted = 0;

  for (const rig of preview.rigs) {
    const cpuId = rig.cpu
      ? (cpuIdByKey.get(`${rig.cpu.brand.toLowerCase()}|${rig.cpu.name.toLowerCase()}`) ?? null)
      : null;
    const gpuId = rig.gpu
      ? (gpuIdByKey.get(
          `${rig.gpu.brand.toLowerCase()}|${rig.gpu.name.toLowerCase()}|${rig.gpu.is_mobile}`,
        ) ?? null)
      : null;

    const payload = {
      name: rig.name,
      device_type: rig.device_type as DeviceType,
      brand: rig.brand,
      model: rig.model,
      build_date: rig.build_date,
      overall_rank: rig.overall_rank,
      status: rig.status,
      notes: rig.notes,
      cpu_id: cpuId,
      cpu_count: rig.cpu_count,
      gpu_id: gpuId,
      gpu_aib_manufacturer: rig.gpu_aib_manufacturer,
      gpu_aib_model: rig.gpu_aib_model,
      motherboard_name: rig.motherboard_name,
      motherboard_brand: rig.motherboard_brand,
      motherboard_launch: rig.motherboard_launch,
      ram_gb: rig.ram_gb,
      ram_speed_mhz: rig.ram_speed_mhz,
      ram_type: rig.ram_type,
      ram_pc_rating: rig.ram_pc_rating,
      psu_wattage: rig.psu_wattage,
      psu_brand: rig.psu_brand,
      psu_has_8pin_cpu: rig.psu_has_8pin_cpu,
      psu_has_6pin_pcie: rig.psu_has_6pin_pcie,
      screen_size_inches: rig.screen_size_inches,
      screen_resolution: rig.screen_resolution,
      weight_lbs: rig.weight_lbs,
      wifi_brand: rig.wifi_brand,
      wifi_product: rig.wifi_product,
      wifi_model: rig.wifi_model,
      wifi_codename: rig.wifi_codename,
      wifi_launch_date: rig.wifi_launch_date,
      wifi_antenna: rig.wifi_antenna,
      wifi_bands: rig.wifi_bands,
      wifi_max_speed: rig.wifi_max_speed,
      wifi_standard: rig.wifi_standard,
      bluetooth_version: rig.bluetooth_version,
      wifi_form_factor: rig.wifi_form_factor,
    };

    const { data: compRow, error: compErr } = await supabase
      .from('computers')
      .upsert(payload, { onConflict: 'name,device_type' })
      .select('id')
      .single();

    if (compErr) throw compErr;
    const computerId = compRow.id as number;
    computersUpserted += 1;

    if (rig.drive) {
      const { error: delDriveErr } = await supabase
        .from('storage_drives')
        .delete()
        .eq('computer_id', computerId)
        .eq('is_primary', true);
      if (delDriveErr) throw delDriveErr;

      const { error: insDriveErr } = await supabase.from('storage_drives').insert({
        computer_id: computerId,
        ...rig.drive,
      });
      if (insDriveErr) throw insDriveErr;
      drivesSynced += 1;
    }

    if (rig.benchmarks.length > 0) {
      const { data: existingBench, error: benchReadErr } = await supabase
        .from('benchmarks')
        .select('suite_name, score')
        .eq('computer_id', computerId);
      if (benchReadErr) throw benchReadErr;

      const existingSet = new Set(
        ((existingBench ?? []) as { suite_name: string; score: number }[]).map(
          (b) => `${b.suite_name}|${b.score}`,
        ),
      );

      const newBenchRows = rig.benchmarks
        .filter((b: { suite_name: string; score: number }) => !existingSet.has(`${b.suite_name}|${b.score}`))
        .map((b: { suite_name: string; score: number }) => ({
          computer_id: computerId,
          suite_name: b.suite_name,
          score: b.score,
          cpu_id: cpuId,
          gpu_id: gpuId,
          recorded_at: rig.build_date ?? new Date().toISOString().slice(0, 10),
        }));

      if (newBenchRows.length > 0) {
        const { error: benchInsErr } = await supabase
          .from('benchmarks')
          .insert(newBenchRows);
        if (benchInsErr) throw benchInsErr;
        benchmarksInserted += newBenchRows.length;
      }
    }
  }

  return {
    computersUpserted,
    cpusSynced,
    gpusSynced,
    drivesSynced,
    benchmarksInserted,
  };
}
