export type DeviceType = 'Desktop' | 'Laptop';
export type BuildStatus = 'Active' | 'Retired' | 'Storage' | 'In Progress';
export type CompatibilityStatus =
  | 'playable'
  | 'minimum'
  | 'blocked_directx'
  | 'blocked_vram'
  | 'blocked_ram'
  | 'unknown';

export interface Cpu {
  id: number;
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
  created_at: string;
  updated_at: string;
}

export interface Gpu {
  id: number;
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
  created_at: string;
  updated_at: string;
}

export interface StorageDrive {
  id: number;
  computer_id: number;
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
  created_at: string;
  updated_at: string;
}

export interface Benchmark {
  id: number;
  computer_id: number;
  suite_name: string;
  score: number;
  graphics_score: number | null;
  cpu_score: number | null;
  cpu_id: number | null;
  gpu_id: number | null;
  recorded_at: string;
  notes: string | null;
  result_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Computer {
  id: number;
  name: string;
  device_type: DeviceType;
  brand: string | null;
  model: string | null;
  build_date: string | null;
  overall_rank: number | null;
  status: BuildStatus;
  notes: string | null;
  cpu_id: number | null;
  cpu_count: number;
  gpu_id: number | null;
  gpu_aib_manufacturer: string | null;
  gpu_aib_model: string | null;
  igpu_id: number | null;
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
  power_adapter_notes: string | null;
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
  created_at: string;
  updated_at: string;
}

export interface ComputerWithRelations extends Computer {
  cpu: Cpu | null;
  gpu: Gpu | null;
  igpu: Gpu | null;
  storage_drives: StorageDrive[];
  benchmarks: Benchmark[];
}

export interface SteamGame {
  app_id: number;
  title: string;
  min_directx: string | null;
  rec_directx: string | null;
  min_vram_gb: number | null;
  rec_vram_gb: number | null;
  min_ram_gb: number | null;
  rec_ram_gb: number | null;
  storage_gb: number | null;
  header_image_url: string | null;
  store_url: string | null;
  raw_requirements: Record<string, unknown> | null;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface BuildGameCompatibility {
  id: number;
  computer_id: number;
  steam_app_id: number;
  status: CompatibilityStatus;
  blocking_reason: string | null;
  evaluated_at: string;
  steam_game?: SteamGame | null;
}

export type AppTab = 'inventory' | 'compare' | 'parts' | 'steam' | 'import';
