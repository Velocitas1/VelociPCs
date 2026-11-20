import type { DeviceType } from '../types/database';

export interface ParsedCpu {
  name: string;
  brand: string;
  codename: string | null;
  socket: string | null;
  base_clock_ghz: number | null;
  turbo_clock_ghz: number | null;
  cache_mb: number | null;
  cores: number | null;
  threads: number | null;
  tdp_w: number | null;
  process_nm: number | null;
  max_memory_gb: number | null;
  memory_type: string | null;
  memory_speed_mhz: number | null;
  launch_date: string | null;
  rank: number | null;
  is_mobile: boolean;
  spec_url: string | null;
}

export interface ParsedGpu {
  name: string;
  brand: string;
  architecture: string | null;
  vram_gb: number | null;
  vram_type: string | null;
  bus_interface: string | null;
  process_nm: number | null;
  tdp_w: number | null;
  directx_version: string | null;
  directx_feature_level: string | null;
  category: string | null;
  rank: number | null;
  is_mobile: boolean;
  spec_url: string | null;
}

export interface ParsedDrive {
  capacity_gb: number | null;
  form_factor: string | null;
  brand: string | null;
  model: string | null;
  model_number: string | null;
  nand_type: string | null;
  read_mb_s: number | null;
  write_mb_s: number | null;
  rank: number | null;
  is_primary: boolean;
}

export interface ParsedBenchmark {
  suite_name: string;
  score: number;
}

export interface ParsedRig {
  name: string;
  device_type: DeviceType;
  brand: string | null;
  model: string | null;
  build_date: string | null;
  overall_rank: number | null;
  status: 'Active';
  notes: string | null;
  cpu_count: number;
  cpu: ParsedCpu | null;
  gpu: ParsedGpu | null;
  gpu_aib_manufacturer: string | null;
  gpu_aib_model: string | null;
  motherboard_name: string | null;
  motherboard_brand: string | null;
  motherboard_launch: string | null;
  ram_gb: number | null;
  ram_speed_mhz: number | null;
  ram_type: string | null;
  ram_pc_rating: string | null;
  psu_wattage: number | null;
  psu_brand: string | null;
  psu_has_8pin_cpu: boolean | null;
  psu_has_6pin_pcie: boolean | null;
  screen_size_inches: number | null;
  screen_resolution: string | null;
  weight_lbs: number | null;
  wifi_brand: string | null;
  wifi_product: string | null;
  wifi_model: string | null;
  wifi_codename: string | null;
  wifi_launch_date: string | null;
  wifi_antenna: string | null;
  wifi_bands: string | null;
  wifi_max_speed: string | null;
  wifi_standard: string | null;
  bluetooth_version: string | null;
  wifi_form_factor: string | null;
  drive: ParsedDrive | null;
  benchmarks: ParsedBenchmark[];
}

export interface ParsedImportPreview {
  deviceType: DeviceType;
  rigs: ParsedRig[];
  warnings: string[];
  cleanupsApplied: string[];
}

export function parseCsvRows(csvText: string): string[][];
export function parseTransposedInventoryCsv(
  csvText: string,
  forcedDeviceType?: DeviceType,
): ParsedImportPreview;
