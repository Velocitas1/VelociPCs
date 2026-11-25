import type {
  ComputerWithRelations,
  Cooler,
  Cpu,
  DeviceType,
  GpuCard,
  Motherboard,
  PcCase,
  Psu,
  RamKit,
  SpecLinkItem,
  StorageDriveModel,
  WifiCard,
} from '../types/database';
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
import { getSafeHttpUrl, mergePartSpecEntry } from './specLinks';

export interface AiExportSpareCatalog {
  cpus: Cpu[];
  gpuCards: GpuCard[];
  motherboards: Motherboard[];
  ramKits: RamKit[];
  storageDriveModels: StorageDriveModel[];
  psus: Psu[];
  cases: PcCase[];
  coolers: Cooler[];
  wifiCards: WifiCard[];
}

export interface AiExportOptions {
  includeSpareParts?: boolean;
  deviceScope?: 'All' | DeviceType;
  allComputers?: ComputerWithRelations[];
  partsCatalog?: AiExportSpareCatalog;
}

export interface SparePartsExport {
  scope: 'All' | DeviceType;
  total_spare_units: number;
  total_spare_models: number;
  cpus: Array<{
    name: string;
    brand: string;
    codename: string | null;
    socket: string | null;
    cores: number | null;
    threads: number | null;
    base_ghz: number | null;
    turbo_ghz: number | null;
    cache_mb: number | null;
    tdp_w: number | null;
    max_memory_gb: number | null;
    memory_type: string | null;
    memory_speed_mhz: number | null;
    is_mobile: boolean;
    passmark_score: number | null;
    score_updated_at: string | null;
    spare_count: number;
    installed_count: number;
    total_owned: number;
    spec_url: string | null;
    spec_links: SpecLinkItem[];
  }>;
  gpu_cards: Array<{
    brand: string;
    model: string;
    part_number: string | null;
    cooling_type: string | null;
    length_mm: number | null;
    chip_name: string | null;
    chip_brand: string | null;
    architecture: string | null;
    vram_gb: number | null;
    vram_type: string | null;
    bus_interface: string | null;
    tdp_w: number | null;
    directx: string | null;
    directx_version: string | null;
    directx_feature_level: string | null;
    passmark_score: number | null;
    score_updated_at: string | null;
    spare_count: number;
    installed_count: number;
    total_owned: number;
    spec_url: string | null;
    spec_links: SpecLinkItem[];
    chip_spec_url: string | null;
    notes: string | null;
  }>;
  motherboards: Array<{
    brand: string;
    model: string;
    socket: string | null;
    chipset: string | null;
    form_factor: string | null;
    memory_type: string | null;
    launch_date: string | null;
    spare_count: number;
    installed_count: number;
    total_owned: number;
    spec_url: string | null;
    spec_links: SpecLinkItem[];
    notes: string | null;
  }>;
  ram_kits: Array<{
    brand: string | null;
    model: string;
    capacity_gb: number | null;
    modules_count: number | null;
    ram_type: string | null;
    speed_mhz: number | null;
    pc_rating: string | null;
    is_mobile: boolean;
    spare_count: number;
    installed_count: number;
    total_owned: number;
    spec_url: string | null;
    spec_links: SpecLinkItem[];
    notes: string | null;
  }>;
  storage_drive_models: Array<{
    brand: string | null;
    model: string;
    model_number: string | null;
    capacity_gb: number | null;
    form_factor: string | null;
    nand_type: string | null;
    read_mb_s: number | null;
    write_mb_s: number | null;
    spare_count: number;
    installed_count: number;
    total_owned: number;
    spec_url: string | null;
    spec_links: SpecLinkItem[];
    notes: string | null;
  }>;
  psus: Array<{
    brand: string;
    model: string;
    wattage: number | null;
    efficiency_rating: string | null;
    modular: string | null;
    has_8pin_cpu: boolean | null;
    has_6pin_pcie: boolean | null;
    spare_count: number;
    installed_count: number;
    total_owned: number;
    spec_url: string | null;
    spec_links: SpecLinkItem[];
    notes: string | null;
  }>;
  cases: Array<{
    brand: string;
    model: string;
    form_factor: string | null;
    color: string | null;
    max_gpu_length_mm: number | null;
    spare_count: number;
    installed_count: number;
    total_owned: number;
    spec_url: string | null;
    spec_links: SpecLinkItem[];
    notes: string | null;
  }>;
  coolers: Array<{
    brand: string;
    model: string;
    cooler_type: string | null;
    fan_size_mm: number | null;
    socket_support: string | null;
    tdp_rating_w: number | null;
    spare_count: number;
    installed_count: number;
    total_owned: number;
    spec_url: string | null;
    spec_links: SpecLinkItem[];
    notes: string | null;
  }>;
  wifi_cards: Array<{
    brand: string;
    product: string | null;
    model: string;
    wifi_standard: string | null;
    bluetooth_version: string | null;
    form_factor: string | null;
    is_mobile: boolean;
    spare_count: number;
    installed_count: number;
    total_owned: number;
    spec_url: string | null;
    spec_links: SpecLinkItem[];
    notes: string | null;
  }>;
}

export function getLatestScoresMap(
  rig: ComputerWithRelations,
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const [suite, bench] of Object.entries(getLatestBenchmarksMap(rig))) {
    map[suite] = bench.score;
  }
  return map;
}

function escapeMdCell(value: string): string {
  return value.replace(/\r?\n+/g, ' ').replace(/\|/g, '\\|').trim();
}

function formatTriStateBool(value: boolean | null | undefined): string {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return 'Unknown';
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

function resolveRigPsu(r: ComputerWithRelations) {
  const brand = r.psu?.brand ?? r.psu_brand ?? null;
  const model = r.psu?.model ?? null;
  const wattage = r.psu_wattage ?? r.psu?.wattage ?? null;
  const efficiency_rating = r.psu?.efficiency_rating ?? null;
  const modular = r.psu?.modular ?? null;
  const has_8pin_cpu = r.psu_has_8pin_cpu ?? r.psu?.has_8pin_cpu ?? null;
  const has_6pin_pcie = r.psu_has_6pin_pcie ?? r.psu?.has_6pin_pcie ?? null;
  const power_adapter_notes = r.power_adapter_notes?.trim() || null;
  const notes = r.psu?.notes?.trim() || null;
  const mergedLinks = mergePartSpecEntry(r.psu, r.part_spec_links?.psu);

  const hasData =
    brand !== null ||
    model !== null ||
    wattage !== null ||
    efficiency_rating !== null ||
    modular !== null ||
    has_8pin_cpu !== null ||
    has_6pin_pcie !== null ||
    power_adapter_notes !== null ||
    notes !== null;

  if (!hasData) return null;

  return {
    brand,
    model,
    wattage,
    efficiency_rating,
    modular,
    has_8pin_cpu,
    has_6pin_pcie,
    power_adapter_notes,
    spec_url: mergedLinks?.spec_url ?? null,
    spec_links: mergedLinks?.links ?? [],
    notes,
  };
}

function resolveRigMotherboard(r: ComputerWithRelations) {
  const brand = r.motherboard?.brand ?? r.motherboard_brand ?? null;
  const model = r.motherboard?.model ?? r.motherboard_name ?? null;
  const socket = r.motherboard?.socket ?? null;
  const chipset = r.motherboard?.chipset ?? null;
  const form_factor = r.motherboard?.form_factor ?? null;
  const memory_type = r.motherboard?.memory_type ?? null;
  const launch_date = r.motherboard?.launch_date ?? r.motherboard_launch ?? null;
  const notes = r.motherboard?.notes?.trim() || null;
  const mergedLinks = mergePartSpecEntry(
    r.motherboard,
    r.part_spec_links?.motherboard,
  );

  const hasData =
    brand !== null ||
    model !== null ||
    socket !== null ||
    chipset !== null ||
    form_factor !== null ||
    memory_type !== null ||
    launch_date !== null ||
    notes !== null;

  if (!hasData) return null;

  return {
    brand,
    model,
    socket,
    chipset,
    form_factor,
    memory_type,
    launch_date,
    spec_url: mergedLinks?.spec_url ?? null,
    spec_links: mergedLinks?.links ?? [],
    notes,
  };
}

function resolveRigRam(r: ComputerWithRelations) {
  const brand = r.ram_kit?.brand ?? null;
  const model = r.ram_kit?.model ?? null;
  const size_gb = r.ram_gb ?? r.ram_kit?.capacity_gb ?? null;
  const modules_count = r.ram_kit?.modules_count ?? null;
  const speed_mhz = r.ram_speed_mhz ?? r.ram_kit?.speed_mhz ?? null;
  const type = r.ram_type ?? r.ram_kit?.ram_type ?? null;
  const pc_rating = r.ram_pc_rating ?? r.ram_kit?.pc_rating ?? null;
  const is_mobile = r.ram_kit?.is_mobile ?? null;
  const notes = r.ram_kit?.notes?.trim() || null;
  const mergedLinks = mergePartSpecEntry(r.ram_kit, r.part_spec_links?.ram);

  const hasData =
    brand !== null ||
    model !== null ||
    size_gb !== null ||
    modules_count !== null ||
    speed_mhz !== null ||
    type !== null ||
    pc_rating !== null ||
    notes !== null;

  if (!hasData) return null;

  return {
    brand,
    model,
    size_gb,
    modules_count,
    speed_mhz,
    type,
    pc_rating,
    is_mobile,
    spec_url: mergedLinks?.spec_url ?? null,
    spec_links: mergedLinks?.links ?? [],
    notes,
  };
}

function resolveRigWifi(r: ComputerWithRelations) {
  const brand = r.wifi_card?.brand ?? r.wifi_brand ?? null;
  const product = r.wifi_card?.product ?? r.wifi_product ?? null;
  const model = r.wifi_card?.model ?? r.wifi_model ?? null;
  const standard = r.wifi_standard ?? r.wifi_card?.wifi_standard ?? null;
  const bluetooth_version =
    r.bluetooth_version ?? r.wifi_card?.bluetooth_version ?? null;
  const form_factor = r.wifi_form_factor ?? r.wifi_card?.form_factor ?? null;
  const bands = r.wifi_bands ?? null;
  const max_speed = r.wifi_max_speed ?? null;
  const antenna = r.wifi_antenna ?? null;
  const notes = r.wifi_card?.notes?.trim() || null;
  const mergedLinks = mergePartSpecEntry(r.wifi_card, r.part_spec_links?.wifi);

  const hasData =
    brand !== null ||
    product !== null ||
    model !== null ||
    standard !== null ||
    bluetooth_version !== null ||
    form_factor !== null ||
    bands !== null ||
    max_speed !== null ||
    antenna !== null ||
    notes !== null;

  if (!hasData) return null;

  return {
    brand,
    product,
    model,
    standard,
    bluetooth_version,
    form_factor,
    bands,
    max_speed,
    antenna,
    spec_url: mergedLinks?.spec_url ?? null,
    spec_links: mergedLinks?.links ?? [],
    notes,
  };
}

function incrementCount(map: Map<number, number>, id: number | null, amount = 1) {
  if (id === null) return;
  map.set(id, (map.get(id) ?? 0) + amount);
}

/**
 * Computes scoped spare parts inventory across all 9 spare-tracked tables,
 * paired with full-fleet installed counts.
 */
export function buildSparePartsExport(
  catalog: AiExportSpareCatalog,
  allComputers: ComputerWithRelations[],
  deviceScope: 'All' | DeviceType = 'All',
): SparePartsExport {
  const installedCpus = new Map<number, number>();
  const installedGpuCards = new Map<number, number>();
  const installedMotherboards = new Map<number, number>();
  const installedRamKits = new Map<number, number>();
  const installedDriveModels = new Map<number, number>();
  const installedPsus = new Map<number, number>();
  const installedCases = new Map<number, number>();
  const installedCoolers = new Map<number, number>();
  const installedWifiCards = new Map<number, number>();

  for (const c of allComputers) {
    incrementCount(installedCpus, c.cpu_id, Math.max(1, c.cpu_count || 1));
    incrementCount(installedGpuCards, c.gpu_card_id);
    incrementCount(installedMotherboards, c.motherboard_id);
    incrementCount(installedRamKits, c.ram_kit_id);
    incrementCount(installedPsus, c.psu_id);
    incrementCount(installedCases, c.case_id);
    incrementCount(installedCoolers, c.cooler_id);
    incrementCount(installedWifiCards, c.wifi_card_id);
    for (const d of c.storage_drives) {
      incrementCount(installedDriveModels, d.storage_drive_model_id);
    }
  }

  const allowDesktopParts = deviceScope !== 'Laptop';
  const matchMobileScope = (isMobile: boolean) => {
    if (deviceScope === 'Desktop') return !isMobile;
    if (deviceScope === 'Laptop') return isMobile;
    return true;
  };

  const cpus = catalog.cpus
    .filter((c) => c.spare_count > 0 && matchMobileScope(c.is_mobile))
    .map((c) => {
      const installed_count = installedCpus.get(c.id) ?? 0;
      return {
        name: c.name,
        brand: c.brand,
        codename: c.codename,
        socket: c.socket,
        cores: c.cores,
        threads: c.threads,
        base_ghz: c.base_clock_ghz,
        turbo_ghz: c.turbo_clock_ghz,
        cache_mb: c.cache_mb,
        tdp_w: c.tdp_w,
        max_memory_gb: c.max_memory_gb,
        memory_type: c.memory_type,
        memory_speed_mhz: c.memory_speed_mhz,
        is_mobile: c.is_mobile,
        passmark_score: c.passmark_score,
        score_updated_at: c.score_updated_at,
        spare_count: c.spare_count,
        installed_count,
        total_owned: c.spare_count + installed_count,
        spec_url: c.spec_url,
        spec_links: c.spec_links,
      };
    });

  const gpu_cards = allowDesktopParts
    ? catalog.gpuCards
        .filter((card) => card.spare_count > 0)
        .map((card) => {
          const installed_count = installedGpuCards.get(card.id) ?? 0;
          const chip = card.gpu ?? null;
          return {
            brand: card.brand,
            model: card.model,
            part_number: card.part_number,
            cooling_type: card.cooling_type,
            length_mm: card.length_mm,
            chip_name: chip?.name ?? null,
            chip_brand: chip?.brand ?? null,
            architecture: chip?.architecture ?? null,
            vram_gb: chip?.vram_gb ?? null,
            vram_type: chip?.vram_type ?? null,
            bus_interface: chip?.bus_interface ?? null,
            tdp_w: chip?.tdp_w ?? null,
            directx: chip
              ? formatDirectX(chip.directx_version, chip.directx_feature_level)
              : null,
            directx_version: chip?.directx_version ?? null,
            directx_feature_level: chip?.directx_feature_level ?? null,
            passmark_score: chip?.passmark_score ?? null,
            score_updated_at: chip?.score_updated_at ?? null,
            spare_count: card.spare_count,
            installed_count,
            total_owned: card.spare_count + installed_count,
            spec_url: card.spec_url,
            spec_links: card.spec_links,
            chip_spec_url: chip?.spec_url ?? null,
            notes: card.notes,
          };
        })
    : [];

  const motherboards = allowDesktopParts
    ? catalog.motherboards
        .filter((mb) => mb.spare_count > 0)
        .map((mb) => {
          const installed_count = installedMotherboards.get(mb.id) ?? 0;
          return {
            brand: mb.brand,
            model: mb.model,
            socket: mb.socket,
            chipset: mb.chipset,
            form_factor: mb.form_factor,
            memory_type: mb.memory_type,
            launch_date: mb.launch_date,
            spare_count: mb.spare_count,
            installed_count,
            total_owned: mb.spare_count + installed_count,
            spec_url: mb.spec_url,
            spec_links: mb.spec_links,
            notes: mb.notes,
          };
        })
    : [];

  const ram_kits = catalog.ramKits
    .filter((ram) => ram.spare_count > 0 && matchMobileScope(ram.is_mobile))
    .map((ram) => {
      const installed_count = installedRamKits.get(ram.id) ?? 0;
      return {
        brand: ram.brand,
        model: ram.model,
        capacity_gb: ram.capacity_gb,
        modules_count: ram.modules_count,
        ram_type: ram.ram_type,
        speed_mhz: ram.speed_mhz,
        pc_rating: ram.pc_rating,
        is_mobile: ram.is_mobile,
        spare_count: ram.spare_count,
        installed_count,
        total_owned: ram.spare_count + installed_count,
        spec_url: ram.spec_url,
        spec_links: ram.spec_links,
        notes: ram.notes,
      };
    });

  const storage_drive_models = catalog.storageDriveModels
    .filter((d) => {
      if (d.spare_count <= 0) return false;
      if (deviceScope === 'Laptop') {
        return !(d.form_factor && /\b3\.5\b/i.test(d.form_factor));
      }
      return true;
    })
    .map((d) => {
      const installed_count = installedDriveModels.get(d.id) ?? 0;
      return {
        brand: d.brand,
        model: d.model,
        model_number: d.model_number,
        capacity_gb: d.capacity_gb,
        form_factor: d.form_factor,
        nand_type: d.nand_type,
        read_mb_s: d.read_mb_s,
        write_mb_s: d.write_mb_s,
        spare_count: d.spare_count,
        installed_count,
        total_owned: d.spare_count + installed_count,
        spec_url: d.spec_url,
        spec_links: d.spec_links,
        notes: d.notes,
      };
    });

  const psus = allowDesktopParts
    ? catalog.psus
        .filter((p) => p.spare_count > 0)
        .map((p) => {
          const installed_count = installedPsus.get(p.id) ?? 0;
          return {
            brand: p.brand,
            model: p.model,
            wattage: p.wattage,
            efficiency_rating: p.efficiency_rating,
            modular: p.modular,
            has_8pin_cpu: p.has_8pin_cpu,
            has_6pin_pcie: p.has_6pin_pcie,
            spare_count: p.spare_count,
            installed_count,
            total_owned: p.spare_count + installed_count,
            spec_url: p.spec_url,
            spec_links: p.spec_links,
            notes: p.notes,
          };
        })
    : [];

  const cases = allowDesktopParts
    ? catalog.cases
        .filter((pcCase) => pcCase.spare_count > 0)
        .map((pcCase) => {
          const installed_count = installedCases.get(pcCase.id) ?? 0;
          return {
            brand: pcCase.brand,
            model: pcCase.model,
            form_factor: pcCase.form_factor,
            color: pcCase.color,
            max_gpu_length_mm: pcCase.max_gpu_length_mm,
            spare_count: pcCase.spare_count,
            installed_count,
            total_owned: pcCase.spare_count + installed_count,
            spec_url: pcCase.spec_url,
            spec_links: pcCase.spec_links,
            notes: pcCase.notes,
          };
        })
    : [];

  const coolers = allowDesktopParts
    ? catalog.coolers
        .filter((cooler) => cooler.spare_count > 0)
        .map((cooler) => {
          const installed_count = installedCoolers.get(cooler.id) ?? 0;
          return {
            brand: cooler.brand,
            model: cooler.model,
            cooler_type: cooler.cooler_type,
            fan_size_mm: cooler.fan_size_mm,
            socket_support: cooler.socket_support,
            tdp_rating_w: cooler.tdp_rating_w,
            spare_count: cooler.spare_count,
            installed_count,
            total_owned: cooler.spare_count + installed_count,
            spec_url: cooler.spec_url,
            spec_links: cooler.spec_links,
            notes: cooler.notes,
          };
        })
    : [];

  const wifi_cards = catalog.wifiCards
    .filter((wifi) => wifi.spare_count > 0 && matchMobileScope(wifi.is_mobile))
    .map((wifi) => {
      const installed_count = installedWifiCards.get(wifi.id) ?? 0;
      return {
        brand: wifi.brand,
        product: wifi.product,
        model: wifi.model,
        wifi_standard: wifi.wifi_standard,
        bluetooth_version: wifi.bluetooth_version,
        form_factor: wifi.form_factor,
        is_mobile: wifi.is_mobile,
        spare_count: wifi.spare_count,
        installed_count,
        total_owned: wifi.spare_count + installed_count,
        spec_url: wifi.spec_url,
        spec_links: wifi.spec_links,
        notes: wifi.notes,
      };
    });

  const allGroups = [
    cpus,
    gpu_cards,
    motherboards,
    ram_kits,
    storage_drive_models,
    psus,
    cases,
    coolers,
    wifi_cards,
  ];

  const total_spare_models = allGroups.reduce((sum, list) => sum + list.length, 0);
  const total_spare_units = allGroups.reduce(
    (sum, list) =>
      sum + list.reduce((groupSum, item) => groupSum + item.spare_count, 0),
    0,
  );

  return {
    scope: deviceScope,
    total_spare_units,
    total_spare_models,
    cpus,
    gpu_cards,
    motherboards,
    ram_kits,
    storage_drive_models,
    psus,
    cases,
    coolers,
    wifi_cards,
  };
}

export function buildAiExportJson(
  rigs: ComputerWithRelations[],
  fleetStandings?: Map<number, RigFleetStanding>,
  options?: AiExportOptions,
): string {
  const standings = fleetStandings ?? computeFleetRankings(rigs);
  const orderedRigs = sortRigsByFleetRank(rigs, standings);

  const spareParts =
    options?.includeSpareParts && options?.partsCatalog
      ? buildSparePartsExport(
          options.partsCatalog,
          options.allComputers ?? rigs,
          options.deviceScope ?? 'All',
        )
      : undefined;

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
        (sum, d) => sum + (d.capacity_gb ?? d.storage_drive_model?.capacity_gb ?? 0),
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
      const gpuCardLinks = mergePartSpecEntry(
        r.gpu_card,
        r.part_spec_links?.gpu_aib,
      );

      return {
        name: r.name,
        device_type: r.device_type,
        status: r.status,
        brand: r.brand,
        model: r.model,
        build_date: r.build_date,
        weight_lbs: r.weight_lbs,
        notes: r.notes,
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
              cache_mb: r.cpu.cache_mb,
              tdp_w: r.cpu.tdp_w,
              process_nm: r.cpu.process_nm,
              max_memory_gb: r.cpu.max_memory_gb,
              memory_type: r.cpu.memory_type,
              memory_speed_mhz: r.cpu.memory_speed_mhz,
              launch_date: r.cpu.launch_date,
              passmark_score: r.cpu.passmark_score,
              effective_passmark_score: standing?.effectiveCpuScore ?? null,
              score_updated_at: r.cpu.score_updated_at,
              spec_url: r.cpu.spec_url,
              spec_links: r.cpu.spec_links,
            }
          : null,
        gpu: r.gpu
          ? {
              name: r.gpu.name,
              brand: r.gpu.brand,
              aib_manufacturer: r.gpu_card?.brand ?? r.gpu_aib_manufacturer,
              aib_model: r.gpu_card?.model ?? r.gpu_aib_model,
              architecture: r.gpu.architecture,
              vram_gb: r.gpu.vram_gb,
              vram_type: r.gpu.vram_type,
              bus_interface: r.gpu.bus_interface,
              tdp_w: r.gpu.tdp_w,
              directx: formatDirectX(r.gpu.directx_version, r.gpu.directx_feature_level),
              directx_version: r.gpu.directx_version,
              directx_feature_level: r.gpu.directx_feature_level,
              passmark_score: r.gpu.passmark_score,
              score_updated_at: r.gpu.score_updated_at,
              spec_url: r.gpu.spec_url,
              spec_links: r.gpu.spec_links,
            }
          : null,
        gpu_card: r.gpu_card
          ? {
              brand: r.gpu_card.brand,
              model: r.gpu_card.model,
              part_number: r.gpu_card.part_number,
              cooling_type: r.gpu_card.cooling_type,
              length_mm: r.gpu_card.length_mm,
              spec_url: gpuCardLinks?.spec_url ?? null,
              spec_links: gpuCardLinks?.links ?? [],
              notes: r.gpu_card.notes,
            }
          : null,
        igpu: r.igpu
          ? {
              name: r.igpu.name,
              brand: r.igpu.brand,
              architecture: r.igpu.architecture,
              vram_gb: r.igpu.vram_gb,
              vram_type: r.igpu.vram_type,
              tdp_w: r.igpu.tdp_w,
              directx: formatDirectX(
                r.igpu.directx_version,
                r.igpu.directx_feature_level,
              ),
              directx_version: r.igpu.directx_version,
              directx_feature_level: r.igpu.directx_feature_level,
              passmark_score: r.igpu.passmark_score,
              score_updated_at: r.igpu.score_updated_at,
              spec_url: r.igpu.spec_url,
              spec_links: r.igpu.spec_links,
            }
          : null,
        ram: resolveRigRam(r),
        storage_total_gb: totalStorageGb || null,
        storage_drives: r.storage_drives.map((d) => {
          const model = d.storage_drive_model;
          const mergedDriveLinks = mergePartSpecEntry(model, {
            spec_url: d.spec_url,
            links: d.spec_links,
          });
          return {
            is_primary: d.is_primary,
            capacity_gb: d.capacity_gb ?? model?.capacity_gb ?? null,
            form_factor: d.form_factor ?? model?.form_factor ?? null,
            brand: d.brand ?? model?.brand ?? null,
            model: d.model ?? model?.model ?? null,
            model_number: d.model_number ?? model?.model_number ?? null,
            nand_type: d.nand_type ?? model?.nand_type ?? null,
            read_mb_s: d.read_mb_s ?? model?.read_mb_s ?? null,
            write_mb_s: d.write_mb_s ?? model?.write_mb_s ?? null,
            spec_url: mergedDriveLinks?.spec_url ?? null,
            spec_links: mergedDriveLinks?.links ?? [],
          };
        }),
        motherboard: resolveRigMotherboard(r),
        psu: resolveRigPsu(r),
        pc_case: r.pc_case
          ? {
              brand: r.pc_case.brand,
              model: r.pc_case.model,
              form_factor: r.pc_case.form_factor,
              color: r.pc_case.color,
              max_gpu_length_mm: r.pc_case.max_gpu_length_mm,
              spec_url: r.pc_case.spec_url,
              spec_links: r.pc_case.spec_links,
              notes: r.pc_case.notes,
            }
          : null,
        cooler: r.cooler
          ? {
              brand: r.cooler.brand,
              model: r.cooler.model,
              cooler_type: r.cooler.cooler_type,
              fan_size_mm: r.cooler.fan_size_mm,
              socket_support: r.cooler.socket_support,
              tdp_rating_w: r.cooler.tdp_rating_w,
              spec_url: r.cooler.spec_url,
              spec_links: r.cooler.spec_links,
              notes: r.cooler.notes,
            }
          : null,
        wifi: resolveRigWifi(r),
        display: r.screen_size_inches
          ? `${r.screen_size_inches}" ${r.screen_resolution ?? ''}`.trim()
          : null,
        part_spec_links: r.part_spec_links,
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
    ...(spareParts ? { spare_parts: spareParts } : {}),
  };

  return JSON.stringify(payload, null, 2);
}

function formatPsuTableCell(psu: ReturnType<typeof resolveRigPsu>): string {
  if (!psu) return '—';
  const base = psu.wattage
    ? `${psu.wattage}W`
    : [psu.brand, psu.model].filter(Boolean).join(' ') ||
      (psu.power_adapter_notes ? 'Adapter' : 'PSU');

  const flagParts: string[] = [];
  if (psu.has_8pin_cpu !== null) {
    flagParts.push(`8p CPU: ${formatTriStateBool(psu.has_8pin_cpu)}`);
  }
  if (psu.has_6pin_pcie !== null) {
    flagParts.push(`6p PCIe: ${formatTriStateBool(psu.has_6pin_pcie)}`);
  }
  return flagParts.length > 0 ? `${base} (${flagParts.join(', ')})` : base;
}

function formatMdLinkLabel(label: string, specUrl: string | null | undefined): string {
  const safeUrl = getSafeHttpUrl(specUrl);
  const cleanLabel = escapeMdCell(label);
  return safeUrl ? `${cleanLabel} ([Specs](${safeUrl}))` : cleanLabel;
}

function renderSparePartsMarkdown(spares: SparePartsExport): string[] {
  const out: string[] = ['', '## Spare Parts Inventory', ''];

  if (spares.total_spare_units === 0) {
    out.push(
      `No spare parts available in the current scope (${spares.scope}).`,
    );
    return out;
  }

  out.push(
    `- **Scope:** ${spares.scope} · **Total Spare Units:** ${spares.total_spare_units} across ${spares.total_spare_models} models`,
  );

  const pushTable = (title: string, headers: string[], rows: string[][]) => {
    if (rows.length === 0) return;
    out.push('', `### ${title}`, '');
    out.push(`| ${headers.join(' | ')} |`);
    out.push(`| ${headers.map(() => '---').join(' | ')} |`);
    for (const row of rows) {
      out.push(`| ${row.join(' | ')} |`);
    }
  };

  pushTable(
    'Spare CPUs',
    ['CPU', 'Socket', 'Cores/Threads', 'Clocks', 'TDP', 'PassMark', 'Spare (Installed)'],
    spares.cpus.map((c) => [
      formatMdLinkLabel(`${c.brand} ${c.name}`, c.spec_url),
      escapeMdCell(c.socket ?? '—'),
      c.cores || c.threads ? `${c.cores ?? '?'}C/${c.threads ?? '?'}T` : '—',
      c.base_ghz || c.turbo_ghz
        ? `${c.base_ghz ?? '?'}–${c.turbo_ghz ?? '?'} GHz`
        : '—',
      c.tdp_w ? `${c.tdp_w}W` : '—',
      formatPassMark(c.passmark_score),
      `${c.spare_count} (${c.installed_count})`,
    ]),
  );

  pushTable(
    'Spare GPU Cards',
    [
      'Card',
      'GPU Chip',
      'VRAM',
      'DirectX',
      'TDP',
      'Length / Cooling',
      'PassMark G3D',
      'Spare (Installed)',
    ],
    spares.gpu_cards.map((g) => {
      const lengthCooling = [
        g.length_mm ? `${g.length_mm}mm` : null,
        g.cooling_type,
      ]
        .filter(Boolean)
        .join(' · ');
      return [
        formatMdLinkLabel(
          `${g.brand} ${g.model}${g.part_number ? ` [${g.part_number}]` : ''}`,
          g.spec_url ?? g.chip_spec_url,
        ),
        escapeMdCell(
          [g.chip_brand, g.chip_name].filter(Boolean).join(' ') || '—',
        ),
        g.vram_gb
          ? escapeMdCell(`${g.vram_gb} GB ${g.vram_type ?? ''}`.trim())
          : '—',
        escapeMdCell(g.directx ?? '—'),
        g.tdp_w ? `${g.tdp_w}W` : '—',
        escapeMdCell(lengthCooling || '—'),
        formatPassMark(g.passmark_score),
        `${g.spare_count} (${g.installed_count})`,
      ];
    }),
  );

  pushTable(
    'Spare Motherboards',
    ['Motherboard', 'Socket', 'Chipset', 'Form Factor', 'RAM Type', 'Spare (Installed)'],
    spares.motherboards.map((mb) => [
      formatMdLinkLabel(`${mb.brand} ${mb.model}`, mb.spec_url),
      escapeMdCell(mb.socket ?? '—'),
      escapeMdCell(mb.chipset ?? '—'),
      escapeMdCell(mb.form_factor ?? '—'),
      escapeMdCell(mb.memory_type ?? '—'),
      `${mb.spare_count} (${mb.installed_count})`,
    ]),
  );

  pushTable(
    'Spare RAM Kits',
    ['RAM Kit', 'Capacity', 'Modules', 'Type / Speed', 'Form', 'Spare (Installed)'],
    spares.ram_kits.map((ram) => [
      formatMdLinkLabel(
        [ram.brand, ram.model].filter(Boolean).join(' ') || 'RAM Kit',
        ram.spec_url,
      ),
      ram.capacity_gb ? `${ram.capacity_gb} GB` : '—',
      ram.modules_count ? `${ram.modules_count}x` : '—',
      escapeMdCell(
        [
          ram.ram_type,
          ram.speed_mhz ? `${ram.speed_mhz} MHz` : null,
          ram.pc_rating,
        ]
          .filter(Boolean)
          .join(' · ') || '—',
      ),
      ram.is_mobile ? 'SODIMM / Mobile' : 'DIMM / Desktop',
      `${ram.spare_count} (${ram.installed_count})`,
    ]),
  );

  pushTable(
    'Spare Storage Drives',
    ['Drive', 'Capacity', 'Form Factor', 'NAND', 'Speed (R/W)', 'Spare (Installed)'],
    spares.storage_drive_models.map((d) => [
      formatMdLinkLabel(
        [d.brand, d.model, d.model_number].filter(Boolean).join(' ') || 'Drive',
        d.spec_url,
      ),
      d.capacity_gb ? `${d.capacity_gb} GB` : '—',
      escapeMdCell(d.form_factor ?? '—'),
      escapeMdCell(d.nand_type ?? '—'),
      d.read_mb_s || d.write_mb_s
        ? `${d.read_mb_s ?? '?'} / ${d.write_mb_s ?? '?'} MB/s`
        : '—',
      `${d.spare_count} (${d.installed_count})`,
    ]),
  );

  pushTable(
    'Spare Power Supplies (PSUs)',
    ['PSU', 'Wattage', 'Efficiency / Modular', '8-pin CPU', '6-pin PCIe', 'Spare (Installed)'],
    spares.psus.map((p) => [
      formatMdLinkLabel(`${p.brand} ${p.model}`, p.spec_url),
      p.wattage ? `${p.wattage}W` : '—',
      escapeMdCell(
        [p.efficiency_rating, p.modular].filter(Boolean).join(' · ') || '—',
      ),
      formatTriStateBool(p.has_8pin_cpu),
      formatTriStateBool(p.has_6pin_pcie),
      `${p.spare_count} (${p.installed_count})`,
    ]),
  );

  pushTable(
    'Spare Cases',
    ['Case', 'Form Factor', 'Max GPU Length', 'Color', 'Spare (Installed)'],
    spares.cases.map((pcCase) => [
      formatMdLinkLabel(`${pcCase.brand} ${pcCase.model}`, pcCase.spec_url),
      escapeMdCell(pcCase.form_factor ?? '—'),
      pcCase.max_gpu_length_mm ? `${pcCase.max_gpu_length_mm}mm` : '—',
      escapeMdCell(pcCase.color ?? '—'),
      `${pcCase.spare_count} (${pcCase.installed_count})`,
    ]),
  );

  pushTable(
    'Spare CPU Coolers',
    ['Cooler', 'Type', 'Fan', 'Sockets', 'TDP Rating', 'Spare (Installed)'],
    spares.coolers.map((cooler) => [
      formatMdLinkLabel(`${cooler.brand} ${cooler.model}`, cooler.spec_url),
      escapeMdCell(cooler.cooler_type ?? '—'),
      cooler.fan_size_mm ? `${cooler.fan_size_mm}mm` : '—',
      escapeMdCell(cooler.socket_support ?? '—'),
      cooler.tdp_rating_w ? `${cooler.tdp_rating_w}W` : '—',
      `${cooler.spare_count} (${cooler.installed_count})`,
    ]),
  );

  pushTable(
    'Spare Wi-Fi Cards',
    ['Wi-Fi Card', 'Standard', 'Bluetooth', 'Form Factor', 'Spare (Installed)'],
    spares.wifi_cards.map((wifi) => [
      formatMdLinkLabel(
        [wifi.brand, wifi.product, wifi.model].filter(Boolean).join(' '),
        wifi.spec_url,
      ),
      escapeMdCell(wifi.wifi_standard ?? '—'),
      escapeMdCell(wifi.bluetooth_version ? `BT ${wifi.bluetooth_version}` : '—'),
      escapeMdCell(
        [wifi.form_factor, wifi.is_mobile ? 'Mobile' : null]
          .filter(Boolean)
          .join(' · ') || '—',
      ),
      `${wifi.spare_count} (${wifi.installed_count})`,
    ]),
  );

  return out;
}

export function buildAiExportMarkdown(
  rigs: ComputerWithRelations[],
  fleetStandings?: Map<number, RigFleetStanding>,
  options?: AiExportOptions,
): string {
  const standings = fleetStandings ?? computeFleetRankings(rigs);
  const orderedRigs = sortRigsByFleetRank(rigs, standings);
  const desktops = orderedRigs.filter((r) => r.device_type === 'Desktop');
  const laptops = orderedRigs.filter((r) => r.device_type === 'Laptop');

  const spareParts =
    options?.includeSpareParts && options?.partsCatalog
      ? buildSparePartsExport(
          options.partsCatalog,
          options.allComputers ?? rigs,
          options.deviceScope ?? 'All',
        )
      : null;

  const lines: string[] = [
    '# VelociPCs Hardware Inventory Summary',
    '',
    `- **Exported:** ${new Date().toISOString().slice(0, 10)}`,
    `- **Total Machines:** ${orderedRigs.length} (${desktops.length} Desktops, ${laptops.length} Laptops)`,
    `- **Unified Scoring Model:** PassMark Composite = round(60% GPU G3D + 40% CPU Mark; dual-CPU scaled 1.8x)`,
  ];

  if (spareParts) {
    lines.push(
      `- **Spare Parts Included:** ${spareParts.total_spare_units} spare units across ${spareParts.total_spare_models} models (scope: ${spareParts.scope})`,
    );
  }

  lines.push(
    '',
    '## Quick Comparison Table',
    '',
    '| Fleet Rank | Name | Type | CPU | GPU | PassMark (CPU / GPU) | DirectX | RAM | Storage | PSU | 3DMark (Time Spy / Fire Strike / Cloud Gate) |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  );

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
    let gpuLabel = 'Integrated / None';
    if (r.gpu && r.igpu) {
      gpuLabel = `${r.gpu.name}${r.gpu.vram_gb ? ` (${r.gpu.vram_gb}GB)` : ''} + iGPU: ${r.igpu.name}`;
    } else if (r.gpu) {
      gpuLabel = `${r.gpu.name}${r.gpu.vram_gb ? ` (${r.gpu.vram_gb}GB)` : ''}`;
    } else if (r.igpu) {
      gpuLabel = `iGPU: ${r.igpu.name}${r.igpu.vram_gb ? ` (${r.igpu.vram_gb}GB)` : ''}`;
    }
    const pmPair = `${formatPassMark(standing?.effectiveCpuScore)} / ${formatPassMark(
      standing?.effectiveGpuScore,
    )}`;
    const dxLabel = effectiveGpu
      ? formatDirectX(effectiveGpu.directx_version, effectiveGpu.directx_feature_level)
      : 'N/A';
    const ramInfo = resolveRigRam(r);
    const ramLabel = ramInfo?.size_gb
      ? `${ramInfo.size_gb}GB${ramInfo.speed_mhz ? ` @ ${ramInfo.speed_mhz}MHz` : ''}`
      : '—';
    const totalGb = r.storage_drives.reduce(
      (s, d) => s + (d.capacity_gb ?? d.storage_drive_model?.capacity_gb ?? 0),
      0,
    );
    const storageLabel = totalGb ? `${totalGb}GB` : '—';
    const psuLabel = formatPsuTableCell(resolveRigPsu(r));
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
      `| ${escapeMdCell(fleetLabel)} | ${escapeMdCell(r.name)} | ${escapeMdCell(r.device_type)} | ${escapeMdCell(cpuLabel)} | ${escapeMdCell(gpuLabel)} | ${escapeMdCell(pmPair)} | ${escapeMdCell(dxLabel)} | ${escapeMdCell(ramLabel)} | ${escapeMdCell(storageLabel)} | ${escapeMdCell(psuLabel)} | ${scoreStr} |`,
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
      if (r.brand || r.model || r.weight_lbs) {
        const laptopUrl = getSafeHttpUrl(r.part_spec_links?.laptop?.spec_url);
        const sysName = [r.brand, r.model].filter(Boolean).join(' ') || r.device_type;
        const weightNote = r.weight_lbs ? ` · ${r.weight_lbs} lbs` : '';
        lines.push(
          `- **System:** ${sysName}${weightNote}${
            laptopUrl ? ` ([Specs](${laptopUrl}))` : ''
          }`,
        );
      }
      if (r.build_date) {
        lines.push(`- **Build Date:** ${r.build_date}`);
      }
      const mb = resolveRigMotherboard(r);
      if (mb) {
        const mbTitle = [mb.brand, mb.model].filter(Boolean).join(' ') || 'Motherboard';
        const mbDetails = [mb.socket, mb.chipset, mb.form_factor, mb.memory_type]
          .filter(Boolean)
          .join(' · ');
        lines.push(
          `- **Motherboard:** ${mbTitle}${mbDetails ? ` (${mbDetails})` : ''}${
            mb.spec_url ? ` ([Specs](${mb.spec_url}))` : ''
          }`,
        );
      }
      if (r.cpu) {
        const cpuText = `${r.cpu_count > 1 ? `${r.cpu_count}x ` : ''}${r.cpu.brand} ${r.cpu.name}`;
        const extras = [
          r.cpu.socket,
          r.cpu.tdp_w ? `${r.cpu.tdp_w}W TDP` : null,
          r.cpu.cache_mb ? `${r.cpu.cache_mb}MB cache` : null,
        ]
          .filter(Boolean)
          .join(' · ');
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
          }T @ ${r.cpu.base_clock_ghz ?? '?'}–${r.cpu.turbo_clock_ghz ?? '?'} GHz${
            extras ? ` · ${extras}` : ''
          }${pmNote}${r.cpu.spec_url ? ` ([Specs](${r.cpu.spec_url}))` : ''}`,
        );
      }
      if (r.gpu) {
        const aibBrand = r.gpu_card?.brand ?? r.gpu_aib_manufacturer;
        const aibModel = r.gpu_card?.model ?? r.gpu_aib_model;
        const aibLabel = [aibBrand, aibModel].filter(Boolean).join(' ');
        const cardExtras = [
          r.gpu.architecture,
          r.gpu.tdp_w ? `${r.gpu.tdp_w}W TDP` : null,
          r.gpu_card?.length_mm ? `${r.gpu_card.length_mm}mm` : null,
          r.gpu_card?.cooling_type,
        ]
          .filter(Boolean)
          .join(' · ');
        const g3dNote =
          r.gpu.passmark_score !== null
            ? ` · PassMark G3D ${formatPassMark(r.gpu.passmark_score)}${
                standing?.gpuRank && standing.gpuSource === 'gpu'
                  ? ` (${formatRankBadge(standing.gpuRank)})`
                  : ''
              }`
            : '';
        const gpuCardLinks = mergePartSpecEntry(
          r.gpu_card,
          r.part_spec_links?.gpu_aib,
        );
        const chipUrl = getSafeHttpUrl(r.gpu.spec_url);
        const cardUrl = getSafeHttpUrl(gpuCardLinks?.spec_url);
        const linkParts: string[] = [];
        if (chipUrl) linkParts.push(`[Specs](${chipUrl})`);
        if (cardUrl && cardUrl !== chipUrl) linkParts.push(`[Card Specs](${cardUrl})`);

        lines.push(
          `- **GPU:** ${r.gpu.brand} ${r.gpu.name}${aibLabel ? ` [${aibLabel}]` : ''} (${
            r.gpu.vram_gb ?? '?'
          } GB ${r.gpu.vram_type ?? ''}) — **${formatDirectX(
            r.gpu.directx_version,
            r.gpu.directx_feature_level,
          )}**${cardExtras ? ` · ${cardExtras}` : ''}${g3dNote}${
            linkParts.length > 0 ? ` (${linkParts.join(', ')})` : ''
          }`,
        );
      }
      if (r.igpu) {
        const igpuExtras = [
          r.igpu.vram_gb ? `${r.igpu.vram_gb} GB ${r.igpu.vram_type ?? ''}`.trim() : null,
          formatDirectX(r.igpu.directx_version, r.igpu.directx_feature_level),
          r.igpu.tdp_w ? `${r.igpu.tdp_w}W TDP` : null,
        ]
          .filter(Boolean)
          .join(' · ');
        const igpuG3d =
          r.igpu.passmark_score !== null
            ? ` · PassMark G3D ${formatPassMark(r.igpu.passmark_score)}${
                standing?.gpuRank && standing.gpuSource === 'igpu'
                  ? ` (${formatRankBadge(standing.gpuRank)})`
                  : ''
              }`
            : '';
        lines.push(
          `- **Integrated GPU:** ${r.igpu.brand} ${r.igpu.name}${
            igpuExtras ? ` — ${igpuExtras}` : ''
          }${igpuG3d}${r.igpu.spec_url ? ` ([Specs](${r.igpu.spec_url}))` : ''}`,
        );
      }
      const ram = resolveRigRam(r);
      if (ram) {
        const ramSpecs = [
          ram.size_gb ? `${ram.size_gb} GB` : null,
          ram.modules_count ? `(${ram.modules_count}x)` : null,
          ram.type,
          ram.speed_mhz ? `@ ${ram.speed_mhz} MHz` : null,
          ram.pc_rating,
        ]
          .filter(Boolean)
          .join(' ');
        const ramKitName = [ram.brand, ram.model].filter(Boolean).join(' ');
        lines.push(
          `- **RAM:** ${ramSpecs || ramKitName}${
            ramSpecs && ramKitName ? ` · ${ramKitName}` : ''
          }${ram.spec_url ? ` ([Specs](${ram.spec_url}))` : ''}`,
        );
      }
      if (r.storage_drives.length > 0) {
        const dStr = r.storage_drives
          .map((d) => {
            const model = d.storage_drive_model;
            const cap = d.capacity_gb ?? model?.capacity_gb;
            const ff = d.form_factor ?? model?.form_factor;
            const brand = d.brand ?? model?.brand;
            const modelName = d.model ?? model?.model;
            const nand = d.nand_type ?? model?.nand_type;
            const readMs = d.read_mb_s ?? model?.read_mb_s;
            const writeMs = d.write_mb_s ?? model?.write_mb_s;
            const mergedDriveLinks = mergePartSpecEntry(model, {
              spec_url: d.spec_url,
              links: d.spec_links,
            });
            const driveUrl = getSafeHttpUrl(mergedDriveLinks?.spec_url);
            const nameText = [brand, modelName].filter(Boolean).join(' ');
            const perfParts = [
              nand,
              readMs || writeMs ? `${readMs ?? '?'}/${writeMs ?? '?'} MB/s` : null,
            ]
              .filter(Boolean)
              .join(' · ');
            const label = `${d.is_primary ? '[Primary] ' : ''}${cap ?? '?'} GB ${
              ff ?? ''
            }${nameText ? ` (${nameText})` : ''}${perfParts ? ` [${perfParts}]` : ''}`.trim();
            return driveUrl ? `${label} ([Specs](${driveUrl}))` : label;
          })
          .join('; ');
        lines.push(`- **Storage:** ${dStr}`);
      }
      if (r.screen_size_inches) {
        lines.push(
          `- **Display:** ${r.screen_size_inches}" (${r.screen_resolution ?? 'Unknown'})`,
        );
      }
      const psu = resolveRigPsu(r);
      if (psu) {
        const psuTitle = [
          psu.wattage ? `${psu.wattage}W` : null,
          psu.brand,
          psu.model,
        ]
          .filter(Boolean)
          .join(' ');
        const psuMeta = [psu.efficiency_rating, psu.modular]
          .filter(Boolean)
          .join(' · ');
        const connectorStr = `8-pin CPU: ${formatTriStateBool(
          psu.has_8pin_cpu,
        )} · 6-pin PCIe: ${formatTriStateBool(psu.has_6pin_pcie)}`;
        const adapterStr = psu.power_adapter_notes
          ? ` · Adapter: ${psu.power_adapter_notes}`
          : '';
        lines.push(
          `- **PSU:** ${psuTitle || 'Power Supply'}${psuMeta ? ` (${psuMeta})` : ''} — ${connectorStr}${adapterStr}${
            psu.spec_url ? ` ([Specs](${psu.spec_url}))` : ''
          }`,
        );
      }
      if (r.pc_case) {
        const caseMeta = [
          r.pc_case.form_factor,
          r.pc_case.max_gpu_length_mm
            ? `Max GPU ${r.pc_case.max_gpu_length_mm}mm`
            : null,
          r.pc_case.color,
        ]
          .filter(Boolean)
          .join(' · ');
        lines.push(
          `- **Case:** ${r.pc_case.brand} ${r.pc_case.model}${
            caseMeta ? ` (${caseMeta})` : ''
          }${r.pc_case.spec_url ? ` ([Specs](${r.pc_case.spec_url}))` : ''}`,
        );
      }
      if (r.cooler) {
        const coolerMeta = [
          r.cooler.cooler_type,
          r.cooler.fan_size_mm ? `${r.cooler.fan_size_mm}mm` : null,
          r.cooler.socket_support,
          r.cooler.tdp_rating_w ? `${r.cooler.tdp_rating_w}W TDP` : null,
        ]
          .filter(Boolean)
          .join(' · ');
        lines.push(
          `- **CPU Cooler:** ${r.cooler.brand} ${r.cooler.model}${
            coolerMeta ? ` (${coolerMeta})` : ''
          }${r.cooler.spec_url ? ` ([Specs](${r.cooler.spec_url}))` : ''}`,
        );
      }
      const wifi = resolveRigWifi(r);
      if (wifi) {
        const wifiName = [wifi.brand, wifi.product, wifi.model]
          .filter(Boolean)
          .join(' ');
        const wifiMeta = [
          wifi.standard,
          wifi.bluetooth_version ? `BT ${wifi.bluetooth_version}` : null,
          wifi.form_factor,
          wifi.bands,
          wifi.max_speed,
        ]
          .filter(Boolean)
          .join(' · ');
        lines.push(
          `- **Wireless:** ${wifiName || 'Wi-Fi'}${
            wifiMeta ? ` (${wifiMeta})` : ''
          }${wifi.spec_url ? ` ([Specs](${wifi.spec_url}))` : ''}`,
        );
      }
      if (r.benchmarks.length > 0) {
        const bStr = r.benchmarks
          .map((b) => {
            const safeUrl = getSafeThreeDMarkUrl(b.result_url);
            const subScores =
              b.graphics_score !== null || b.cpu_score !== null
                ? ` (G: ${b.graphics_score ?? '?'} / C: ${b.cpu_score ?? '?'})`
                : '';
            return safeUrl
              ? `[${b.suite_name}: ${b.score}](${safeUrl})${subScores}`
              : `${b.suite_name}: ${b.score}${subScores}`;
          })
          .join(', ');
        lines.push(`- **3DMark Scores:** ${bStr}`);
      }
      if (r.notes?.trim()) {
        lines.push(`- **Notes:** ${r.notes.trim()}`);
      }
    }
  };

  renderGroup('Desktops', desktops);
  renderGroup('Laptops', laptops);

  if (spareParts) {
    lines.push(...renderSparePartsMarkdown(spareParts));
  }

  return lines.join('\n');
}
