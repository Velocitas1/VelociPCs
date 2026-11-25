export type DeviceType = 'Desktop' | 'Laptop';
export type BuildStatus = 'Active' | 'Retired' | 'Storage' | 'In Progress';
export type CompatibilityStatus =
  | 'playable'
  | 'minimum'
  | 'blocked_directx'
  | 'blocked_vram'
  | 'blocked_ram'
  | 'blocked_storage'
  | 'unknown';

export type SteamRequirementsStatus = 'pending' | 'parsed' | 'missing' | 'error';

export interface SpecLinkItem {
  label: string;
  url: string;
}

export type ComputerPartLinkSlot =
  | 'gpu_aib'
  | 'motherboard'
  | 'laptop'
  | 'wifi'
  | 'psu'
  | 'ram';

export interface PartSpecLinkEntry {
  spec_url?: string | null;
  links?: SpecLinkItem[];
}

export type PartSpecLinksMap = Partial<
  Record<ComputerPartLinkSlot, PartSpecLinkEntry>
>;

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
  /** @deprecated Legacy ordinal rank preserved during PassMark migration */
  rank: number | null;
  passmark_score: number | null;
  score_updated_at: string | null;
  is_mobile: boolean;
  spare_count: number;
  spec_url: string | null;
  spec_links: SpecLinkItem[];
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
  /** @deprecated Legacy ordinal rank preserved during PassMark migration */
  rank: number | null;
  passmark_score: number | null;
  score_updated_at: string | null;
  is_mobile: boolean;
  spec_url: string | null;
  spec_links: SpecLinkItem[];
  created_at: string;
  updated_at: string;
}

export interface GpuCard {
  id: number;
  gpu_id: number;
  brand: string;
  model: string;
  part_number: string | null;
  cooling_type: string | null;
  length_mm: number | null;
  spare_count: number;
  spec_url: string | null;
  spec_links: SpecLinkItem[];
  notes: string | null;
  created_at: string;
  updated_at: string;
  gpu?: Gpu | null;
}

export interface Motherboard {
  id: number;
  brand: string;
  model: string;
  socket: string | null;
  chipset: string | null;
  form_factor: string | null;
  memory_type: string | null;
  launch_date: string | null;
  spare_count: number;
  spec_url: string | null;
  spec_links: SpecLinkItem[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RamKit {
  id: number;
  brand: string | null;
  model: string;
  capacity_gb: number | null;
  modules_count: number | null;
  ram_type: string | null;
  speed_mhz: number | null;
  pc_rating: string | null;
  is_mobile: boolean;
  spare_count: number;
  spec_url: string | null;
  spec_links: SpecLinkItem[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StorageDriveModel {
  id: number;
  brand: string | null;
  model: string;
  model_number: string | null;
  capacity_gb: number | null;
  form_factor: string | null;
  nand_type: string | null;
  read_mb_s: number | null;
  write_mb_s: number | null;
  spare_count: number;
  spec_url: string | null;
  spec_links: SpecLinkItem[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Psu {
  id: number;
  brand: string;
  model: string;
  wattage: number | null;
  efficiency_rating: string | null;
  modular: string | null;
  has_8pin_cpu: boolean | null;
  has_6pin_pcie: boolean | null;
  spare_count: number;
  spec_url: string | null;
  spec_links: SpecLinkItem[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PcCase {
  id: number;
  brand: string;
  model: string;
  form_factor: string | null;
  color: string | null;
  max_gpu_length_mm: number | null;
  spare_count: number;
  spec_url: string | null;
  spec_links: SpecLinkItem[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Cooler {
  id: number;
  brand: string;
  model: string;
  cooler_type: string | null;
  fan_size_mm: number | null;
  socket_support: string | null;
  tdp_rating_w: number | null;
  spare_count: number;
  spec_url: string | null;
  spec_links: SpecLinkItem[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WifiCard {
  id: number;
  brand: string;
  product: string | null;
  model: string;
  wifi_standard: string | null;
  bluetooth_version: string | null;
  form_factor: string | null;
  is_mobile: boolean;
  spare_count: number;
  spec_url: string | null;
  spec_links: SpecLinkItem[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type CatalogPartCategory =
  | 'gpu_card'
  | 'motherboard'
  | 'ram_kit'
  | 'storage_drive_model'
  | 'psu'
  | 'case'
  | 'cooler'
  | 'wifi_card';

export type CatalogPart =
  | GpuCard
  | Motherboard
  | RamKit
  | StorageDriveModel
  | Psu
  | PcCase
  | Cooler
  | WifiCard;

export type SpareTableName =
  | 'cpus'
  | 'gpu_cards'
  | 'motherboards'
  | 'ram_kits'
  | 'storage_drive_models'
  | 'psus'
  | 'cases'
  | 'coolers'
  | 'wifi_cards';

export type PartsCatalogTab = 'gpus' | SpareTableName;

export interface StorageDrive {
  id: number;
  computer_id: number;
  storage_drive_model_id: number | null;
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
  spec_url: string | null;
  spec_links: SpecLinkItem[];
  created_at: string;
  updated_at: string;
  storage_drive_model?: StorageDriveModel | null;
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
  /** @deprecated Legacy ordinal rank preserved during PassMark migration */
  overall_rank: number | null;
  status: BuildStatus;
  notes: string | null;
  cpu_id: number | null;
  cpu_count: number;
  gpu_id: number | null;
  gpu_card_id: number | null;
  gpu_aib_manufacturer: string | null;
  gpu_aib_model: string | null;
  igpu_id: number | null;
  motherboard_id: number | null;
  motherboard_name: string | null;
  motherboard_brand: string | null;
  motherboard_launch: string | null;
  ram_kit_id: number | null;
  ram_gb: number | null;
  ram_speed_mhz: number | null;
  ram_type: string | null;
  ram_pc_rating: string | null;
  psu_id: number | null;
  psu_wattage: number | null;
  psu_brand: string | null;
  psu_has_8pin_cpu: boolean | null;
  psu_has_6pin_pcie: boolean | null;
  power_adapter_notes: string | null;
  case_id: number | null;
  cooler_id: number | null;
  screen_size_inches: number | null;
  screen_resolution: string | null;
  weight_lbs: number | null;
  wifi_card_id: number | null;
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
  part_spec_links: PartSpecLinksMap;
  created_at: string;
  updated_at: string;
}

export interface ComputerWithRelations extends Computer {
  cpu: Cpu | null;
  gpu: Gpu | null;
  gpu_card: GpuCard | null;
  igpu: Gpu | null;
  motherboard: Motherboard | null;
  ram_kit: RamKit | null;
  psu: Psu | null;
  pc_case: PcCase | null;
  cooler: Cooler | null;
  wifi_card: WifiCard | null;
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
  playtime_minutes: number;
  manual_override: boolean;
  override_notes: string | null;
  requirements_synced_at: string | null;
  requirements_status: SteamRequirementsStatus;
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
