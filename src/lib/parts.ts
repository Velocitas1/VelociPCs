import type {
  CatalogPartCategory,
  ComputerWithRelations,
  Cooler,
  Cpu,
  GpuCard,
  Motherboard,
  PcCase,
  Psu,
  RamKit,
  SpareTableName,
  StorageDriveModel,
  WifiCard,
} from '../types/database';

export const PART_CATEGORY_META: Record<
  CatalogPartCategory,
  {
    table: Exclude<SpareTableName, 'cpus'>;
    singular: string;
    plural: string;
    placeholder: string;
  }
> = {
  gpu_card: {
    table: 'gpu_cards',
    singular: 'GPU Card',
    plural: 'GPU Cards',
    placeholder: 'Select GPU card model...',
  },
  motherboard: {
    table: 'motherboards',
    singular: 'Motherboard',
    plural: 'Motherboards',
    placeholder: 'Select motherboard...',
  },
  ram_kit: {
    table: 'ram_kits',
    singular: 'RAM Kit',
    plural: 'RAM Kits',
    placeholder: 'Select RAM kit...',
  },
  storage_drive_model: {
    table: 'storage_drive_models',
    singular: 'Storage Drive',
    plural: 'Storage Drives',
    placeholder: 'Select drive model...',
  },
  psu: {
    table: 'psus',
    singular: 'PSU',
    plural: 'PSUs',
    placeholder: 'Select power supply...',
  },
  case: {
    table: 'cases',
    singular: 'Case',
    plural: 'Cases',
    placeholder: 'Select PC case...',
  },
  cooler: {
    table: 'coolers',
    singular: 'CPU Cooler',
    plural: 'Coolers',
    placeholder: 'Select CPU cooler...',
  },
  wifi_card: {
    table: 'wifi_cards',
    singular: 'Wi-Fi Card',
    plural: 'Wi-Fi Cards',
    placeholder: 'Select Wi-Fi adapter...',
  },
};

export function formatGpuCardLabel(card: GpuCard): string {
  const chip = card.gpu ? ` (${card.gpu.brand} ${card.gpu.name})` : '';
  return `${card.brand} ${card.model}${chip}`.trim();
}

export function formatGpuCardSubtitle(card: GpuCard): string {
  return [
    card.gpu ? `${card.gpu.brand} ${card.gpu.name}` : null,
    card.gpu?.vram_gb !== null && card.gpu?.vram_gb !== undefined
      ? `${card.gpu.vram_gb} GB`
      : null,
    card.cooling_type,
    card.part_number,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function formatMotherboardLabel(mb: Motherboard): string {
  return `${mb.brand} ${mb.model}`.trim();
}

export function formatMotherboardSubtitle(mb: Motherboard): string {
  return [mb.socket, mb.chipset, mb.form_factor, mb.memory_type, mb.launch_date]
    .filter(Boolean)
    .join(' · ');
}

export function formatRamKitLabel(kit: RamKit): string {
  const base = [kit.brand, kit.model].filter(Boolean).join(' ').trim();
  return base || 'RAM Kit';
}

export function formatRamKitSubtitle(kit: RamKit): string {
  return [
    kit.capacity_gb ? `${kit.capacity_gb} GB` : null,
    kit.modules_count ? `${kit.modules_count}x` : null,
    kit.ram_type,
    kit.speed_mhz ? `${kit.speed_mhz} MHz` : null,
    kit.pc_rating,
    kit.is_mobile ? 'Mobile/SODIMM' : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function formatStorageDriveModelLabel(d: StorageDriveModel): string {
  const cap = d.capacity_gb ? `${d.capacity_gb} GB ` : '';
  const name = [d.brand, d.model].filter(Boolean).join(' ').trim();
  return `${cap}${name}`.trim() || 'Storage Drive';
}

export function formatStorageDriveModelSubtitle(d: StorageDriveModel): string {
  return [
    d.form_factor,
    d.model_number,
    d.nand_type,
    d.read_mb_s ? `R ${d.read_mb_s} MB/s` : null,
    d.write_mb_s ? `W ${d.write_mb_s} MB/s` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function formatPsuLabel(psu: Psu): string {
  return `${psu.brand} ${psu.model}`.trim();
}

export function formatPsuSubtitle(psu: Psu): string {
  return [
    psu.wattage ? `${psu.wattage}W` : null,
    psu.efficiency_rating,
    psu.modular,
    psu.has_8pin_cpu === true ? '8-pin CPU' : null,
    psu.has_6pin_pcie === true ? '6-pin PCIe' : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function formatCaseLabel(pcCase: PcCase): string {
  return `${pcCase.brand} ${pcCase.model}`.trim();
}

export function formatCaseSubtitle(pcCase: PcCase): string {
  return [
    pcCase.form_factor,
    pcCase.color,
    pcCase.max_gpu_length_mm ? `Max GPU ${pcCase.max_gpu_length_mm}mm` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function formatCoolerLabel(cooler: Cooler): string {
  return `${cooler.brand} ${cooler.model}`.trim();
}

export function formatCoolerSubtitle(cooler: Cooler): string {
  return [
    cooler.cooler_type,
    cooler.fan_size_mm ? `${cooler.fan_size_mm}mm` : null,
    cooler.socket_support,
    cooler.tdp_rating_w ? `${cooler.tdp_rating_w}W TDP` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function formatWifiCardLabel(wifi: WifiCard): string {
  return [wifi.brand, wifi.product, wifi.model].filter(Boolean).join(' ').trim();
}

export function formatWifiCardSubtitle(wifi: WifiCard): string {
  return [
    wifi.wifi_standard,
    wifi.bluetooth_version ? `BT ${wifi.bluetooth_version}` : null,
    wifi.form_factor,
    wifi.is_mobile ? 'Laptop/Mobile' : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export interface SpareAdjustment {
  table: SpareTableName;
  id: number;
  delta: number;
}

export interface PendingSwapItem {
  key: string;
  slotLabel: string;
  partLabel: string;
  table: SpareTableName;
  id: number;
  delta: number;
  currentSpare: number;
}

export interface DesktopPartSnapshot {
  cpuId: number | null;
  cpuCount: number;
  gpuCardId: number | null;
  motherboardId: number | null;
  ramKitId: number | null;
  psuId: number | null;
  caseId: number | null;
  coolerId: number | null;
  wifiCardId: number | null;
  driveModelIds: number[];
}

export function snapshotFromRig(rig: ComputerWithRelations): DesktopPartSnapshot {
  return {
    cpuId: rig.cpu_id,
    cpuCount: Math.max(1, rig.cpu_count || 1),
    gpuCardId: rig.gpu_card_id,
    motherboardId: rig.motherboard_id,
    ramKitId: rig.ram_kit_id,
    psuId: rig.psu_id,
    caseId: rig.case_id,
    coolerId: rig.cooler_id,
    wifiCardId: rig.wifi_card_id,
    driveModelIds: rig.storage_drives
      .map((d) => d.storage_drive_model_id)
      .filter((id): id is number => id !== null),
  };
}

export function computeDesktopSwapAdjustments(
  before: DesktopPartSnapshot,
  after: DesktopPartSnapshot,
  catalog: {
    cpus: Cpu[];
    gpuCards: GpuCard[];
    motherboards: Motherboard[];
    ramKits: RamKit[];
    storageDriveModels: StorageDriveModel[];
    psus: Psu[];
    cases: PcCase[];
    coolers: Cooler[];
    wifiCards: WifiCard[];
  },
): PendingSwapItem[] {
  const items: PendingSwapItem[] = [];

  const lookup = <T extends { id: number; spare_count: number }>(
    list: T[],
    id: number,
  ) => list.find((x) => x.id === id);

  // 1. CPU (accounts for cpuCount!)
  if (before.cpuId !== after.cpuId) {
    if (before.cpuId !== null) {
      const prev = lookup(catalog.cpus, before.cpuId);
      if (prev) {
        items.push({
          key: `cpus:${prev.id}:removed`,
          slotLabel: 'CPU Removed',
          partLabel: `${prev.brand} ${prev.name}`,
          table: 'cpus',
          id: prev.id,
          delta: before.cpuCount,
          currentSpare: prev.spare_count,
        });
      }
    }
    if (after.cpuId !== null) {
      const next = lookup(catalog.cpus, after.cpuId);
      if (next) {
        items.push({
          key: `cpus:${next.id}:installed`,
          slotLabel: 'CPU Installed',
          partLabel: `${next.brand} ${next.name}`,
          table: 'cpus',
          id: next.id,
          delta: -after.cpuCount,
          currentSpare: next.spare_count,
        });
      }
    }
  } else if (before.cpuId !== null && before.cpuCount !== after.cpuCount) {
    const cpu = lookup(catalog.cpus, before.cpuId);
    if (cpu) {
      const diff = before.cpuCount - after.cpuCount;
      items.push({
        key: `cpus:${cpu.id}:count`,
        slotLabel: diff > 0 ? 'CPU Removed' : 'CPU Added',
        partLabel: `${cpu.brand} ${cpu.name}`,
        table: 'cpus',
        id: cpu.id,
        delta: diff,
        currentSpare: cpu.spare_count,
      });
    }
  }

  // 2. Single-slot catalog FKs
  const diffSingle = <T extends { id: number; spare_count: number }>(
    table: Exclude<SpareTableName, 'cpus' | 'storage_drive_models'>,
    slotName: string,
    prevId: number | null,
    nextId: number | null,
    list: T[],
    getLabel: (item: T) => string,
  ) => {
    if (prevId === nextId) return;
    if (prevId !== null) {
      const prev = lookup(list, prevId);
      if (prev) {
        items.push({
          key: `${table}:${prev.id}:removed`,
          slotLabel: `${slotName} Removed`,
          partLabel: getLabel(prev),
          table,
          id: prev.id,
          delta: 1,
          currentSpare: prev.spare_count,
        });
      }
    }
    if (nextId !== null) {
      const next = lookup(list, nextId);
      if (next) {
        items.push({
          key: `${table}:${next.id}:installed`,
          slotLabel: `${slotName} Installed`,
          partLabel: getLabel(next),
          table,
          id: next.id,
          delta: -1,
          currentSpare: next.spare_count,
        });
      }
    }
  };

  diffSingle(
    'gpu_cards',
    'GPU Card',
    before.gpuCardId,
    after.gpuCardId,
    catalog.gpuCards,
    formatGpuCardLabel,
  );
  diffSingle(
    'motherboards',
    'Motherboard',
    before.motherboardId,
    after.motherboardId,
    catalog.motherboards,
    formatMotherboardLabel,
  );
  diffSingle(
    'ram_kits',
    'RAM Kit',
    before.ramKitId,
    after.ramKitId,
    catalog.ramKits,
    formatRamKitLabel,
  );
  diffSingle(
    'psus',
    'PSU',
    before.psuId,
    after.psuId,
    catalog.psus,
    formatPsuLabel,
  );
  diffSingle(
    'cases',
    'Case',
    before.caseId,
    after.caseId,
    catalog.cases,
    formatCaseLabel,
  );
  diffSingle(
    'coolers',
    'Cooler',
    before.coolerId,
    after.coolerId,
    catalog.coolers,
    formatCoolerLabel,
  );
  diffSingle(
    'wifi_cards',
    'Wi-Fi Card',
    before.wifiCardId,
    after.wifiCardId,
    catalog.wifiCards,
    formatWifiCardLabel,
  );

  // 3. Storage Drive Models (multiset diff)
  const driveCounts = new Map<number, number>();
  for (const id of before.driveModelIds) {
    driveCounts.set(id, (driveCounts.get(id) ?? 0) + 1);
  }
  for (const id of after.driveModelIds) {
    driveCounts.set(id, (driveCounts.get(id) ?? 0) - 1);
  }
  for (const [id, delta] of driveCounts.entries()) {
    if (delta === 0) continue;
    const model = lookup(catalog.storageDriveModels, id);
    if (!model) continue;
    items.push({
      key: `storage_drive_models:${id}:${delta > 0 ? 'removed' : 'installed'}`,
      slotLabel: delta > 0 ? 'Storage Drive Removed' : 'Storage Drive Installed',
      partLabel: formatStorageDriveModelLabel(model),
      table: 'storage_drive_models',
      id,
      delta,
      currentSpare: model.spare_count,
    });
  }

  return items;
}
