import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTransposedInventoryCsv } from '../src/lib/csvParserCore.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const topsCsv = fs.readFileSync(path.join(rootDir, 'data', 'VelociTops.csv'), 'utf8');
const computersCsv = fs.readFileSync(path.join(rootDir, 'data', 'VelociComputers.csv'), 'utf8');

const laptopsPreview = parseTransposedInventoryCsv(topsCsv, 'Laptop');
const desktopsPreview = parseTransposedInventoryCsv(computersCsv, 'Desktop');
const allRigs = [...desktopsPreview.rigs, ...laptopsPreview.rigs];

function sqlStr(val) {
  if (val === null || val === undefined) return 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

function sqlNum(val) {
  if (val === null || val === undefined || Number.isNaN(val)) return 'NULL';
  return String(val);
}

function sqlBool(val) {
  if (val === null || val === undefined) return 'NULL';
  return val ? 'TRUE' : 'FALSE';
}

function mergeNonNull(existing, incoming) {
  if (!existing) return { ...incoming };
  const merged = { ...existing };
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== null && v !== undefined && v !== 'Unknown') {
      merged[k] = v;
    } else if (merged[k] === undefined) {
      merged[k] = v;
    }
  }
  return merged;
}

const cpuMap = new Map();
const gpuMap = new Map();

for (const rig of allRigs) {
  if (rig.cpu) {
    const key = `${rig.cpu.brand.toLowerCase()}|${rig.cpu.name.toLowerCase()}`;
    cpuMap.set(key, mergeNonNull(cpuMap.get(key), rig.cpu));
  }
  if (rig.gpu) {
    const key = `${rig.gpu.brand.toLowerCase()}|${rig.gpu.name.toLowerCase()}|${rig.gpu.is_mobile}`;
    gpuMap.set(key, mergeNonNull(gpuMap.get(key), rig.gpu));
  }
}

const lines = [
  '-- Idempotent seed script generated from data/VelociComputers.csv & data/VelociTops.csv',
  'begin;',
  '',
  '-- 1. Upsert CPUs',
];

for (const cpu of cpuMap.values()) {
  lines.push(
    `insert into public.cpus (name, brand, codename, socket, base_clock_ghz, turbo_clock_ghz, cache_mb, cores, threads, tdp_w, process_nm, max_memory_gb, memory_type, memory_speed_mhz, launch_date, rank, is_mobile, spec_url) values (${sqlStr(cpu.name)}, ${sqlStr(cpu.brand)}, ${sqlStr(cpu.codename)}, ${sqlStr(cpu.socket)}, ${sqlNum(cpu.base_clock_ghz)}, ${sqlNum(cpu.turbo_clock_ghz)}, ${sqlNum(cpu.cache_mb)}, ${sqlNum(cpu.cores)}, ${sqlNum(cpu.threads)}, ${sqlNum(cpu.tdp_w)}, ${sqlNum(cpu.process_nm)}, ${sqlNum(cpu.max_memory_gb)}, ${sqlStr(cpu.memory_type)}, ${sqlNum(cpu.memory_speed_mhz)}, ${sqlStr(cpu.launch_date)}, ${sqlNum(cpu.rank)}, ${sqlBool(cpu.is_mobile)}, ${sqlStr(cpu.spec_url)}) on conflict ((lower(brand)), (lower(name))) do update set codename = excluded.codename, socket = excluded.socket, base_clock_ghz = excluded.base_clock_ghz, turbo_clock_ghz = excluded.turbo_clock_ghz, cache_mb = excluded.cache_mb, cores = excluded.cores, threads = excluded.threads, tdp_w = excluded.tdp_w, process_nm = excluded.process_nm, max_memory_gb = excluded.max_memory_gb, memory_type = excluded.memory_type, memory_speed_mhz = excluded.memory_speed_mhz, launch_date = excluded.launch_date, rank = excluded.rank, is_mobile = excluded.is_mobile, spec_url = excluded.spec_url;`,
  );
}

lines.push('', '-- 2. Upsert GPUs');

for (const gpu of gpuMap.values()) {
  lines.push(
    `insert into public.gpus (name, brand, architecture, vram_gb, vram_type, bus_interface, process_nm, tdp_w, directx_version, directx_feature_level, category, rank, is_mobile, spec_url) values (${sqlStr(gpu.name)}, ${sqlStr(gpu.brand)}, ${sqlStr(gpu.architecture)}, ${sqlNum(gpu.vram_gb)}, ${sqlStr(gpu.vram_type)}, ${sqlStr(gpu.bus_interface)}, ${sqlNum(gpu.process_nm)}, ${sqlNum(gpu.tdp_w)}, ${sqlStr(gpu.directx_version)}, ${sqlStr(gpu.directx_feature_level)}, ${sqlStr(gpu.category)}, ${sqlNum(gpu.rank)}, ${sqlBool(gpu.is_mobile)}, ${sqlStr(gpu.spec_url)}) on conflict ((lower(brand)), (lower(name)), is_mobile) do update set architecture = excluded.architecture, vram_gb = excluded.vram_gb, vram_type = excluded.vram_type, bus_interface = excluded.bus_interface, process_nm = excluded.process_nm, tdp_w = excluded.tdp_w, directx_version = excluded.directx_version, directx_feature_level = excluded.directx_feature_level, category = excluded.category, rank = excluded.rank, spec_url = excluded.spec_url;`,
  );
}

lines.push('', '-- 3. Upsert Computers, Storage Drives, and Benchmarks');

for (const rig of allRigs) {
  const cpuSubquery = rig.cpu
    ? `(select id from public.cpus where lower(brand) = ${sqlStr(rig.cpu.brand.toLowerCase())} and lower(name) = ${sqlStr(rig.cpu.name.toLowerCase())} limit 1)`
    : 'NULL';
  const gpuSubquery = rig.gpu
    ? `(select id from public.gpus where lower(brand) = ${sqlStr(rig.gpu.brand.toLowerCase())} and lower(name) = ${sqlStr(rig.gpu.name.toLowerCase())} and is_mobile = ${sqlBool(rig.gpu.is_mobile)} limit 1)`
    : 'NULL';

  lines.push(
    `insert into public.computers (name, device_type, brand, model, build_date, overall_rank, status, notes, cpu_id, cpu_count, gpu_id, gpu_aib_manufacturer, gpu_aib_model, motherboard_name, motherboard_brand, motherboard_launch, ram_gb, ram_speed_mhz, ram_type, ram_pc_rating, psu_wattage, psu_brand, psu_has_8pin_cpu, psu_has_6pin_pcie, screen_size_inches, screen_resolution, weight_lbs, wifi_brand, wifi_product, wifi_model, wifi_codename, wifi_launch_date, wifi_antenna, wifi_bands, wifi_max_speed, wifi_standard, bluetooth_version, wifi_form_factor) values (${sqlStr(rig.name)}, ${sqlStr(rig.device_type)}, ${sqlStr(rig.brand)}, ${sqlStr(rig.model)}, ${sqlStr(rig.build_date)}, ${sqlNum(rig.overall_rank)}, ${sqlStr(rig.status)}, ${sqlStr(rig.notes)}, ${cpuSubquery}, ${sqlNum(rig.cpu_count)}, ${gpuSubquery}, ${sqlStr(rig.gpu_aib_manufacturer)}, ${sqlStr(rig.gpu_aib_model)}, ${sqlStr(rig.motherboard_name)}, ${sqlStr(rig.motherboard_brand)}, ${sqlStr(rig.motherboard_launch)}, ${sqlNum(rig.ram_gb)}, ${sqlNum(rig.ram_speed_mhz)}, ${sqlStr(rig.ram_type)}, ${sqlStr(rig.ram_pc_rating)}, ${sqlNum(rig.psu_wattage)}, ${sqlStr(rig.psu_brand)}, ${sqlBool(rig.psu_has_8pin_cpu)}, ${sqlBool(rig.psu_has_6pin_pcie)}, ${sqlNum(rig.screen_size_inches)}, ${sqlStr(rig.screen_resolution)}, ${sqlNum(rig.weight_lbs)}, ${sqlStr(rig.wifi_brand)}, ${sqlStr(rig.wifi_product)}, ${sqlStr(rig.wifi_model)}, ${sqlStr(rig.wifi_codename)}, ${sqlStr(rig.wifi_launch_date)}, ${sqlStr(rig.wifi_antenna)}, ${sqlStr(rig.wifi_bands)}, ${sqlStr(rig.wifi_max_speed)}, ${sqlStr(rig.wifi_standard)}, ${sqlStr(rig.bluetooth_version)}, ${sqlStr(rig.wifi_form_factor)}) on conflict (name, device_type) do update set brand = excluded.brand, model = excluded.model, build_date = excluded.build_date, overall_rank = excluded.overall_rank, cpu_id = excluded.cpu_id, cpu_count = excluded.cpu_count, gpu_id = excluded.gpu_id, gpu_aib_manufacturer = excluded.gpu_aib_manufacturer, gpu_aib_model = excluded.gpu_aib_model, motherboard_name = excluded.motherboard_name, motherboard_brand = excluded.motherboard_brand, motherboard_launch = excluded.motherboard_launch, ram_gb = excluded.ram_gb, ram_speed_mhz = excluded.ram_speed_mhz, ram_type = excluded.ram_type, ram_pc_rating = excluded.ram_pc_rating, psu_wattage = excluded.psu_wattage, psu_brand = excluded.psu_brand, psu_has_8pin_cpu = excluded.psu_has_8pin_cpu, psu_has_6pin_pcie = excluded.psu_has_6pin_pcie, screen_size_inches = excluded.screen_size_inches, screen_resolution = excluded.screen_resolution, weight_lbs = excluded.weight_lbs, wifi_brand = excluded.wifi_brand, wifi_product = excluded.wifi_product, wifi_model = excluded.wifi_model, wifi_codename = excluded.wifi_codename, wifi_launch_date = excluded.wifi_launch_date, wifi_antenna = excluded.wifi_antenna, wifi_bands = excluded.wifi_bands, wifi_max_speed = excluded.wifi_max_speed, wifi_standard = excluded.wifi_standard, bluetooth_version = excluded.bluetooth_version, wifi_form_factor = excluded.wifi_form_factor;`,
  );

  const compSubquery = `(select id from public.computers where name = ${sqlStr(rig.name)} and device_type = ${sqlStr(rig.device_type)} limit 1)`;

  if (rig.drive) {
    lines.push(
      `insert into public.storage_drives (computer_id, capacity_gb, form_factor, brand, model, model_number, nand_type, read_mb_s, write_mb_s, rank, is_primary) select ${compSubquery}, ${sqlNum(rig.drive.capacity_gb)}, ${sqlStr(rig.drive.form_factor)}, ${sqlStr(rig.drive.brand)}, ${sqlStr(rig.drive.model)}, ${sqlStr(rig.drive.model_number)}, ${sqlStr(rig.drive.nand_type)}, ${sqlNum(rig.drive.read_mb_s)}, ${sqlNum(rig.drive.write_mb_s)}, ${sqlNum(rig.drive.rank)}, true where not exists (select 1 from public.storage_drives sd where sd.computer_id = ${compSubquery} and sd.is_primary = true);`,
    );
  }

  for (const bench of rig.benchmarks) {
    lines.push(
      `insert into public.benchmarks (computer_id, suite_name, score, cpu_id, gpu_id, recorded_at) select ${compSubquery}, ${sqlStr(bench.suite_name)}, ${sqlNum(bench.score)}, ${cpuSubquery}, ${gpuSubquery}, coalesce(${sqlStr(rig.build_date)}::date, current_date) where not exists (select 1 from public.benchmarks b where b.computer_id = ${compSubquery} and b.suite_name = ${sqlStr(bench.suite_name)} and b.score = ${sqlNum(bench.score)});`,
    );
  }
}

lines.push('', 'commit;');

const outPath = path.join(rootDir, 'supabase', 'seed_inventory.sql');
fs.writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');

const driveCount = allRigs.filter((r) => Boolean(r.drive)).length;
const benchCount = allRigs.reduce((sum, r) => sum + r.benchmarks.length, 0);

console.log(
  JSON.stringify(
    {
      computers: allRigs.length,
      desktops: desktopsPreview.rigs.length,
      laptops: laptopsPreview.rigs.length,
      cpus: cpuMap.size,
      gpus: gpuMap.size,
      drives: driveCount,
      benchmarks: benchCount,
      cleanups: [...desktopsPreview.cleanupsApplied, ...laptopsPreview.cleanupsApplied],
      outPath,
    },
    null,
    2,
  ),
);
