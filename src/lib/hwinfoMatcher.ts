import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ComputerUpsertPayload,
  DriveDraft,
} from '../hooks/useInventory';
import type {
  BuildStatus,
  ComputerWithRelations,
  Cooler,
  Cpu,
  DeviceType,
  Gpu,
  GpuCard,
  Motherboard,
  PcCase,
  Psu,
  RamKit,
  StorageDriveModel,
  WifiCard,
} from '../types/database';
import {
  inferDirectXFromGpu,
  type ParsedHwinfoDrive,
  type ParsedHwinfoGpu,
  type ParsedHwinfoReport,
} from './hwinfoParser';
import {
  computeDesktopSwapAdjustments,
  snapshotFromRig,
  type PendingSwapItem,
  type SpareAdjustment,
} from './parts';
import {
  findReferenceGpuForChipset,
  searchReferenceCatalog,
} from './referenceCatalog';
import { getSafeHttpUrl } from './specLinks';

export interface InventoryCatalogContext {
  computers: ComputerWithRelations[];
  cpus: Cpu[];
  gpus: Gpu[];
  gpuCards: GpuCard[];
  motherboards: Motherboard[];
  ramKits: RamKit[];
  storageDriveModels: StorageDriveModel[];
  psus: Psu[];
  cases: PcCase[];
  coolers: Cooler[];
  wifiCards: WifiCard[];
}

export interface TargetRigMatch {
  rig: ComputerWithRelations | null;
  confidence: 'exact' | 'fuzzy' | 'none';
  reason: string;
}

export type ResolutionAction = 'existing' | 'create' | 'inline' | 'none';
export type MatchConfidence = 'exact' | 'fuzzy' | 'reference' | 'raw' | 'none';
export type DiffChangeKind = 'unchanged' | 'fill_blank' | 'changed';

export type NewCpuPayload = Omit<Cpu, 'id' | 'created_at' | 'updated_at'>;
export type NewGpuPayload = Omit<Gpu, 'id' | 'created_at' | 'updated_at'>;
export type NewGpuCardPayload = Omit<
  GpuCard,
  'id' | 'created_at' | 'updated_at' | 'gpu'
>;
export type NewMotherboardPayload = Omit<
  Motherboard,
  'id' | 'created_at' | 'updated_at'
>;
export type NewRamKitPayload = Omit<RamKit, 'id' | 'created_at' | 'updated_at'>;
export type NewStorageDriveModelPayload = Omit<
  StorageDriveModel,
  'id' | 'created_at' | 'updated_at'
>;
export type NewWifiCardPayload = Omit<
  WifiCard,
  'id' | 'created_at' | 'updated_at'
>;

export interface SlotResolution<TCreate> {
  action: ResolutionAction;
  matchedId: number | null;
  confidence: MatchConfidence;
  matchLabel: string;
  referenceEnriched: boolean;
  createPayload: TCreate | null;
}

export interface DriveResolutionItem {
  drive: ParsedHwinfoDrive;
  resolution: SlotResolution<NewStorageDriveModelPayload>;
  checked: boolean;
  isPrimary: boolean;
}

export interface ResolvedHwinfoPlan {
  deviceType: DeviceType;
  cpu: SlotResolution<NewCpuPayload>;
  gpu: SlotResolution<NewGpuPayload>;
  gpuCard: SlotResolution<Omit<NewGpuCardPayload, 'gpu_id'> & { gpu_id: number | null }>;
  igpu: SlotResolution<NewGpuPayload>;
  motherboard: SlotResolution<NewMotherboardPayload>;
  ramKit: SlotResolution<NewRamKitPayload>;
  wifiCard: SlotResolution<NewWifiCardPayload>;
  drives: DriveResolutionItem[];
}

export interface HwinfoReviewSelections {
  applyIdentity: boolean;
  applyCpu: boolean;
  applyGpu: boolean;
  applyGpuCard: boolean;
  applyIgpu: boolean;
  applyMotherboard: boolean;
  applyRam: boolean;
  applyWifi: boolean;
  applyDisplay: boolean;
  applyDrives: boolean;
  driveMode: 'replace' | 'append';
}

export interface HwinfoApplyResult {
  computerId: number;
  rigName: string;
  deviceType: DeviceType;
  isNew: boolean;
  createdParts: Array<{
    category: string;
    label: string;
    id: number;
    needsPassMark?: boolean;
  }>;
  swapAdjustmentsApplied: number;
}

function normTokens(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9.+]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function compactNorm(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function tokenOverlapScore(a: string, b: string): number {
  const ta = new Set(normTokens(a));
  const tb = new Set(normTokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) {
    if (tb.has(t)) shared += 1;
  }
  return shared / Math.max(ta.size, tb.size);
}

/**
 * Auto-match an HWiNFO XML report to an existing rig by Computer Name or filename.
 */
export function matchTargetRig(
  report: ParsedHwinfoReport,
  computers: ComputerWithRelations[],
): TargetRigMatch {
  const candidates: string[] = [];
  if (report.computerName) candidates.push(report.computerName);
  if (report.fileName) {
    const stripped = report.fileName
      .replace(/\.xml$/i, '')
      .replace(/[_-]*(hwinfo\d*|report|specs|export)$/i, '')
      .trim();
    if (stripped) candidates.push(stripped);
  }

  for (const cand of candidates) {
    const candCompact = compactNorm(cand);
    if (!candCompact) continue;
    const exact = computers.find((c) => compactNorm(c.name) === candCompact);
    if (exact) {
      return {
        rig: exact,
        confidence: 'exact',
        reason: `Exact name match with "${cand}"`,
      };
    }
  }

  let best: { rig: ComputerWithRelations; score: number; cand: string } | null =
    null;
  for (const cand of candidates) {
    const candCompact = compactNorm(cand);
    if (candCompact.length < 3) continue;
    for (const c of computers) {
      const rigCompact = compactNorm(c.name);
      if (!rigCompact) continue;
      let score = tokenOverlapScore(cand, c.name);
      if (rigCompact.includes(candCompact) || candCompact.includes(rigCompact)) {
        score = Math.max(score, 0.78);
      }
      if (score >= 0.6 && (!best || score > best.score)) {
        best = { rig: c, score, cand };
      }
    }
  }

  if (best) {
    return {
      rig: best.rig,
      confidence: 'fuzzy',
      reason: `Fuzzy match from "${best.cand}"`,
    };
  }

  return {
    rig: null,
    confidence: 'none',
    reason: 'No matching rig found — select an existing rig or create a new one',
  };
}

function matchCpuInCatalog(
  brand: string,
  name: string,
  cpus: Cpu[],
): { item: Cpu; confidence: 'exact' | 'fuzzy' } | null {
  const target = compactNorm(`${brand} ${name}`);
  const nameOnly = compactNorm(name);
  const exact = cpus.find(
    (c) =>
      compactNorm(`${c.brand} ${c.name}`) === target ||
      (c.brand.toLowerCase() === brand.toLowerCase() &&
        compactNorm(c.name) === nameOnly),
  );
  if (exact) return { item: exact, confidence: 'exact' };

  let best: { item: Cpu; score: number } | null = null;
  for (const c of cpus) {
    if (
      brand !== 'Unknown' &&
      c.brand.toLowerCase() !== brand.toLowerCase()
    ) {
      continue;
    }
    const score = tokenOverlapScore(name, c.name);
    if (score >= 0.75 && (!best || score > best.score)) {
      best = { item: c, score };
    }
  }
  return best ? { item: best.item, confidence: 'fuzzy' } : null;
}

function matchGpuInCatalog(
  parsed: ParsedHwinfoGpu,
  gpus: Gpu[],
  preferMobile: boolean,
): { item: Gpu; confidence: 'exact' | 'fuzzy' } | null {
  const nameTarget = compactNorm(parsed.name);
  const fullTarget = compactNorm(`${parsed.brand} ${parsed.name}`);

  const exactMobileMatch = gpus.find(
    (g) =>
      g.is_mobile === preferMobile &&
      (compactNorm(`${g.brand} ${g.name}`) === fullTarget ||
        (g.brand.toLowerCase() === parsed.brand.toLowerCase() &&
          compactNorm(g.name) === nameTarget)),
  );
  if (exactMobileMatch) return { item: exactMobileMatch, confidence: 'exact' };

  const exactAny = gpus.find(
    (g) =>
      compactNorm(`${g.brand} ${g.name}`) === fullTarget ||
      (g.brand.toLowerCase() === parsed.brand.toLowerCase() &&
        compactNorm(g.name) === nameTarget),
  );
  if (exactAny) return { item: exactAny, confidence: 'exact' };

  let best: { item: Gpu; score: number } | null = null;
  for (const g of gpus) {
    if (
      parsed.brand !== 'Unknown' &&
      g.brand.toLowerCase() !== parsed.brand.toLowerCase()
    ) {
      continue;
    }
    let score = tokenOverlapScore(parsed.name, g.name);
    if (g.is_mobile === preferMobile) score += 0.05;
    if (score >= 0.75 && (!best || score > best.score)) {
      best = { item: g, score };
    }
  }
  return best ? { item: best.item, confidence: 'fuzzy' } : null;
}

function matchGpuCardInCatalog(
  parsed: ParsedHwinfoGpu,
  gpuId: number | null,
  gpuCards: GpuCard[],
): { item: GpuCard; confidence: 'exact' | 'fuzzy' } | null {
  if (gpuId === null) return null;
  const candidates = gpuCards.filter((c) => c.gpu_id === gpuId);
  if (candidates.length === 0) return null;

  const targetBrand = (parsed.aibManufacturer ?? parsed.brand).toLowerCase();
  const targetModel = parsed.aibModel ?? '';

  if (targetModel) {
    const exact = candidates.find(
      (c) =>
        c.brand.toLowerCase() === targetBrand &&
        compactNorm(c.model) === compactNorm(targetModel),
    );
    if (exact) return { item: exact, confidence: 'exact' };
  }

  // Match by AIB brand + best model overlap on the same GPU silicon
  const sameBrand = candidates.filter(
    (c) => c.brand.toLowerCase() === targetBrand,
  );
  if (sameBrand.length === 1 && !targetModel) {
    return { item: sameBrand[0], confidence: 'fuzzy' };
  }
  if (sameBrand.length > 0 && targetModel) {
    let best: { item: GpuCard; score: number } | null = null;
    for (const c of sameBrand) {
      const score = tokenOverlapScore(targetModel, c.model);
      if (score >= 0.5 && (!best || score > best.score)) {
        best = { item: c, score };
      }
    }
    if (best) return { item: best.item, confidence: 'fuzzy' };
  }

  return null;
}

function matchMotherboardInCatalog(
  brand: string,
  model: string,
  motherboards: Motherboard[],
): { item: Motherboard; confidence: 'exact' | 'fuzzy' } | null {
  const bNorm = brand.toLowerCase();
  const mCompact = compactNorm(model);

  const exact = motherboards.find(
    (m) => m.brand.toLowerCase() === bNorm && compactNorm(m.model) === mCompact,
  );
  if (exact) return { item: exact, confidence: 'exact' };

  let best: { item: Motherboard; score: number } | null = null;
  for (const m of motherboards) {
    if (brand !== 'Unknown' && m.brand.toLowerCase() !== bNorm) continue;
    const score = tokenOverlapScore(model, m.model);
    if (score >= 0.72 && (!best || score > best.score)) {
      best = { item: m, score };
    }
  }
  return best ? { item: best.item, confidence: 'fuzzy' } : null;
}

function matchRamKitInCatalog(
  ram: NonNullable<ParsedHwinfoReport['ram']>,
  ramKits: RamKit[],
  isLaptop: boolean,
): { item: RamKit; confidence: 'exact' | 'fuzzy' } | null {
  const candidates = ramKits.filter((k) => k.is_mobile === isLaptop);
  if (ram.partNumber) {
    const partCompact = compactNorm(ram.partNumber);
    const byPart = candidates.find((k) =>
      compactNorm(k.model).includes(partCompact),
    );
    if (byPart) return { item: byPart, confidence: 'exact' };
  }

  const exactSpec = candidates.find(
    (k) =>
      (ram.totalGb === null || k.capacity_gb === ram.totalGb) &&
      (!ram.ramType ||
        (k.ram_type ?? '').toLowerCase() === ram.ramType.toLowerCase()) &&
      (ram.speedMhz === null || k.speed_mhz === ram.speedMhz) &&
      (!ram.brand ||
        !k.brand ||
        k.brand.toLowerCase() === ram.brand.toLowerCase()),
  );
  if (exactSpec) return { item: exactSpec, confidence: 'fuzzy' };
  return null;
}

function matchDriveModelInCatalog(
  drive: ParsedHwinfoDrive,
  models: StorageDriveModel[],
): { item: StorageDriveModel; confidence: 'exact' | 'fuzzy' } | null {
  const targetModel = compactNorm(drive.model);
  const targetNum = drive.modelNumber ? compactNorm(drive.modelNumber) : '';

  const exact = models.find((m) => {
    const mComp = compactNorm(m.model);
    const mnComp = m.model_number ? compactNorm(m.model_number) : '';
    if (targetNum && (mnComp === targetNum || mComp === targetNum)) return true;
    return (
      mComp === targetModel &&
      (drive.capacityGb === null ||
        m.capacity_gb === null ||
        m.capacity_gb === drive.capacityGb)
    );
  });
  if (exact) return { item: exact, confidence: 'exact' };

  let best: { item: StorageDriveModel; score: number } | null = null;
  for (const m of models) {
    if (
      drive.brand &&
      m.brand &&
      drive.brand.toLowerCase() !== m.brand.toLowerCase()
    ) {
      continue;
    }
    const score = tokenOverlapScore(drive.model, m.model);
    if (score >= 0.72 && (!best || score > best.score)) {
      best = { item: m, score };
    }
  }
  return best ? { item: best.item, confidence: 'fuzzy' } : null;
}

function matchWifiInCatalog(
  wifi: NonNullable<ParsedHwinfoReport['wifi']>,
  wifiCards: WifiCard[],
  isLaptop: boolean,
): { item: WifiCard; confidence: 'exact' | 'fuzzy' } | null {
  const mCompact = compactNorm(wifi.model);
  const sameMobile = wifiCards.filter((w) => w.is_mobile === isLaptop);
  const pool = sameMobile.length > 0 ? sameMobile : wifiCards;

  const exact = pool.find(
    (w) =>
      compactNorm(w.model) === mCompact &&
      w.brand.toLowerCase() === wifi.brand.toLowerCase(),
  );
  if (exact) return { item: exact, confidence: 'exact' };

  const byModel = pool.find(
    (w) =>
      compactNorm(w.model) === mCompact ||
      compactNorm(`${w.product ?? ''} ${w.model}`).includes(mCompact),
  );
  if (byModel) return { item: byModel, confidence: 'fuzzy' };
  return null;
}

/**
 * Perform 3-tier resolution (Supabase catalog -> static Reference Catalog -> raw HWiNFO)
 * for all hardware components in a parsed HWiNFO XML report.
 */
export async function resolveHwinfoReport(
  report: ParsedHwinfoReport,
  catalog: InventoryCatalogContext,
  deviceType: DeviceType,
): Promise<ResolvedHwinfoPlan> {
  const isLaptop = deviceType === 'Laptop';

  // 1. CPU resolution
  let cpuRes: SlotResolution<NewCpuPayload> = {
    action: 'none',
    matchedId: null,
    confidence: 'none',
    matchLabel: 'Not detected',
    referenceEnriched: false,
    createPayload: null,
  };
  if (report.cpu) {
    const existing = matchCpuInCatalog(
      report.cpu.brand,
      report.cpu.name,
      catalog.cpus,
    );
    if (existing) {
      cpuRes = {
        action: 'existing',
        matchedId: existing.item.id,
        confidence: existing.confidence,
        matchLabel: `${existing.item.brand} ${existing.item.name}`,
        referenceEnriched: false,
        createPayload: null,
      };
    } else {
      const refResults = await searchReferenceCatalog(
        'cpu',
        `${report.cpu.brand} ${report.cpu.name}`,
        { limit: 1, vendor: report.cpu.brand },
      ).catch(() => []);
      const ref = refResults[0] ?? null;
      const useRef =
        ref &&
        (compactNorm(`${ref.brand} ${ref.name}`) ===
          compactNorm(`${report.cpu.brand} ${report.cpu.name}`) ||
          tokenOverlapScore(report.cpu.name, ref.name) >= 0.75);

      const createPayload: NewCpuPayload = {
        brand: useRef ? ref.brand : report.cpu.brand,
        name: useRef ? ref.name : report.cpu.name,
        codename: report.cpu.codename ?? (useRef ? ref.codename : null),
        socket: report.cpu.socket ?? (useRef ? ref.socket : null),
        base_clock_ghz:
          report.cpu.baseClockGhz ?? (useRef ? ref.base_clock_ghz : null),
        turbo_clock_ghz:
          report.cpu.turboClockGhz ?? (useRef ? ref.turbo_clock_ghz : null),
        cache_mb: report.cpu.cacheMb ?? (useRef ? ref.cache_mb : null),
        cores: report.cpu.cores ?? (useRef ? ref.cores : null),
        threads: report.cpu.threads ?? (useRef ? ref.threads : null),
        tdp_w: report.cpu.tdpW ?? (useRef ? ref.tdp_w : null),
        process_nm: report.cpu.processNm ?? (useRef ? ref.process_nm : null),
        max_memory_gb: useRef ? ref.max_memory_gb : null,
        memory_type: useRef ? ref.memory_type : null,
        memory_speed_mhz: useRef ? ref.memory_speed_mhz : null,
        launch_date: useRef ? ref.launch_date : null,
        rank: null,
        passmark_score: null,
        score_updated_at: null,
        is_mobile: isLaptop || report.cpu.isMobile || Boolean(useRef && ref.is_mobile),
        spare_count: 0,
        spec_url: useRef ? getSafeHttpUrl(ref.spec_url) : null,
        spec_links: [],
      };
      cpuRes = {
        action: 'create',
        matchedId: null,
        confidence: useRef ? 'reference' : 'raw',
        matchLabel: `+ Create ${createPayload.brand} ${createPayload.name}`,
        referenceEnriched: Boolean(useRef),
        createPayload,
      };
    }
  }

  // Helper for GPU silicon resolution (discrete or iGPU)
  const resolveGpuChip = async (
    parsed: ParsedHwinfoGpu | null,
    preferMobile: boolean,
  ): Promise<SlotResolution<NewGpuPayload>> => {
    if (!parsed) {
      return {
        action: 'none',
        matchedId: null,
        confidence: 'none',
        matchLabel: 'Not detected',
        referenceEnriched: false,
        createPayload: null,
      };
    }
    const existing = matchGpuInCatalog(parsed, catalog.gpus, preferMobile);
    if (existing) {
      return {
        action: 'existing',
        matchedId: existing.item.id,
        confidence: existing.confidence,
        matchLabel: `${existing.item.brand} ${existing.item.name}`,
        referenceEnriched: false,
        createPayload: null,
      };
    }

    const ref = await findReferenceGpuForChipset(
      `${parsed.brand} ${parsed.name}`,
    ).catch(() => null);
    const useRef =
      ref &&
      (compactNorm(ref.name) === compactNorm(parsed.name) ||
        tokenOverlapScore(parsed.name, ref.name) >= 0.7);
    const dxInferred = inferDirectXFromGpu(
      useRef ? ref.brand : parsed.brand,
      useRef ? ref.name : parsed.name,
      parsed.architecture ?? (useRef ? ref.architecture : null),
    );

    const createPayload: NewGpuPayload = {
      brand: useRef ? ref.brand : parsed.brand,
      name: useRef ? ref.name : parsed.name,
      architecture: parsed.architecture ?? (useRef ? ref.architecture : null),
      vram_gb: parsed.vramGb ?? (useRef ? ref.vram_gb : null),
      vram_type: parsed.vramType ?? (useRef ? ref.vram_type : null),
      bus_interface:
        parsed.busInterface ?? (useRef ? ref.bus_interface : null),
      process_nm: parsed.processNm ?? (useRef ? ref.process_nm : null),
      tdp_w: parsed.tdpW ?? (useRef ? ref.tdp_w : null),
      directx_version:
        (useRef ? ref.directx_version : null) ?? dxInferred.directx_version,
      directx_feature_level:
        (useRef ? ref.directx_feature_level : null) ??
        dxInferred.directx_feature_level,
      category: useRef ? ref.category : null,
      rank: null,
      passmark_score: null,
      score_updated_at: null,
      is_mobile: preferMobile || parsed.isMobile,
      spec_url: useRef ? getSafeHttpUrl(ref.spec_url) : null,
      spec_links: [],
    };
    return {
      action: 'create',
      matchedId: null,
      confidence: useRef ? 'reference' : 'raw',
      matchLabel: `+ Create ${createPayload.brand} ${createPayload.name}`,
      referenceEnriched: Boolean(useRef),
      createPayload,
    };
  };

  const gpuRes = await resolveGpuChip(
    report.discreteGpu,
    isLaptop || Boolean(report.discreteGpu?.isMobile),
  );
  const igpuRes = await resolveGpuChip(
    report.integratedGpu,
    isLaptop || Boolean(report.integratedGpu?.isMobile),
  );

  // 3. GPU Card (AIB) resolution (Desktop discrete GPU only)
  let gpuCardRes: SlotResolution<
    Omit<NewGpuCardPayload, 'gpu_id'> & { gpu_id: number | null }
  > = {
    action: 'none',
    matchedId: null,
    confidence: 'none',
    matchLabel: 'Not applicable',
    referenceEnriched: false,
    createPayload: null,
  };
  if (!isLaptop && report.discreteGpu) {
    const resolvedGpuId =
      gpuRes.action === 'existing' ? gpuRes.matchedId : null;
    const existingCard = matchGpuCardInCatalog(
      report.discreteGpu,
      resolvedGpuId,
      catalog.gpuCards,
    );
    if (existingCard) {
      gpuCardRes = {
        action: 'existing',
        matchedId: existingCard.item.id,
        confidence: existingCard.confidence,
        matchLabel: `${existingCard.item.brand} ${existingCard.item.model}`,
        referenceEnriched: false,
        createPayload: null,
      };
    } else {
      const aibBrand =
        report.discreteGpu.aibManufacturer || report.discreteGpu.brand;
      const aibModel = report.discreteGpu.aibModel || 'Reference';
      const refCards = await searchReferenceCatalog(
        'gpu_card',
        `${aibBrand} ${report.discreteGpu.name} ${aibModel}`,
        { limit: 1 },
      ).catch(() => []);
      const refCard = refCards[0] ?? null;
      const useRefCard =
        refCard &&
        refCard.brand.toLowerCase() === aibBrand.toLowerCase() &&
        tokenOverlapScore(
          `${report.discreteGpu.name} ${aibModel}`,
          `${refCard.chipset ?? ''} ${refCard.model}`,
        ) >= 0.6;

      gpuCardRes = {
        action: 'create',
        matchedId: null,
        confidence: useRefCard ? 'reference' : 'raw',
        matchLabel: `+ Create ${useRefCard ? refCard.brand : aibBrand} ${useRefCard ? refCard.model : aibModel}`,
        referenceEnriched: Boolean(useRefCard),
        createPayload: {
          gpu_id: resolvedGpuId,
          brand: useRefCard ? refCard.brand : aibBrand,
          model: useRefCard ? refCard.model : aibModel,
          part_number: useRefCard ? refCard.part_number : null,
          cooling_type: useRefCard ? refCard.cooling_type : null,
          length_mm: useRefCard ? refCard.length_mm : null,
          spare_count: 0,
          spec_url: useRefCard ? getSafeHttpUrl(refCard.spec_url) : null,
          spec_links: [],
          notes: report.discreteGpu.pciSubsysVendorId
            ? `PCI Subsys ${report.discreteGpu.pciSubsysVendorId}:${report.discreteGpu.pciSubsysDeviceId ?? '0000'}`
            : null,
        },
      };
    }
  }

  // 4. Motherboard resolution (Desktop catalog; Laptop skips catalog creation)
  let moboRes: SlotResolution<NewMotherboardPayload> = {
    action: 'none',
    matchedId: null,
    confidence: 'none',
    matchLabel: 'Not detected',
    referenceEnriched: false,
    createPayload: null,
  };
  if (report.motherboard) {
    if (isLaptop) {
      moboRes = {
        action: 'inline',
        matchedId: null,
        confidence: 'raw',
        matchLabel: `${report.motherboard.brand} ${report.motherboard.model} (Laptop — inline skipped)`,
        referenceEnriched: false,
        createPayload: null,
      };
    } else {
      const existingMb = matchMotherboardInCatalog(
        report.motherboard.brand,
        report.motherboard.model,
        catalog.motherboards,
      );
      if (existingMb) {
        moboRes = {
          action: 'existing',
          matchedId: existingMb.item.id,
          confidence: existingMb.confidence,
          matchLabel: `${existingMb.item.brand} ${existingMb.item.model}`,
          referenceEnriched: false,
          createPayload: null,
        };
      } else {
        const refMbs = await searchReferenceCatalog(
          'motherboard',
          `${report.motherboard.brand} ${report.motherboard.model}`,
          { limit: 1 },
        ).catch(() => []);
        const refMb = refMbs[0] ?? null;
        const useRefMb =
          refMb &&
          tokenOverlapScore(
            `${report.motherboard.brand} ${report.motherboard.model}`,
            `${refMb.brand} ${refMb.model}`,
          ) >= 0.72;

        const createPayload: NewMotherboardPayload = {
          brand: useRefMb ? refMb.brand : report.motherboard.brand,
          model: useRefMb ? refMb.model : report.motherboard.model,
          socket:
            report.motherboard.socket ?? (useRefMb ? refMb.socket : null),
          chipset:
            report.motherboard.chipset ?? (useRefMb ? refMb.chipset : null),
          form_factor: useRefMb ? refMb.form_factor : null,
          memory_type:
            report.ram?.ramType ?? (useRefMb ? refMb.memory_type : null),
          launch_date: useRefMb ? refMb.launch_date : null,
          spare_count: 0,
          spec_url: useRefMb ? getSafeHttpUrl(refMb.spec_url) : null,
          spec_links: [],
          notes: null,
        };
        moboRes = {
          action: 'create',
          matchedId: null,
          confidence: useRefMb ? 'reference' : 'raw',
          matchLabel: `+ Create ${createPayload.brand} ${createPayload.model}`,
          referenceEnriched: Boolean(useRefMb),
          createPayload,
        };
      }
    }
  }

  // 5. RAM resolution (Desktop links/creates RamKit; Laptop updates inline specs unless existing match found)
  let ramRes: SlotResolution<NewRamKitPayload> = {
    action: 'none',
    matchedId: null,
    confidence: 'none',
    matchLabel: 'Not detected',
    referenceEnriched: false,
    createPayload: null,
  };
  if (report.ram) {
    const existingRam = matchRamKitInCatalog(
      report.ram,
      catalog.ramKits,
      isLaptop,
    );
    if (existingRam && !isLaptop) {
      ramRes = {
        action: 'existing',
        matchedId: existingRam.item.id,
        confidence: existingRam.confidence,
        matchLabel: [existingRam.item.brand, existingRam.item.model]
          .filter(Boolean)
          .join(' '),
        referenceEnriched: false,
        createPayload: null,
      };
    } else if (isLaptop) {
      ramRes = {
        action: 'inline',
        matchedId: null,
        confidence: 'raw',
        matchLabel: 'Inline Laptop RAM specs',
        referenceEnriched: false,
        createPayload: null,
      };
    } else {
      const modelLabel =
        report.ram.partNumber ||
        [
          report.ram.totalGb ? `${report.ram.totalGb}GB` : null,
          report.ram.ramType,
          report.ram.speedMhz ? `${report.ram.speedMhz}MHz` : null,
        ]
          .filter(Boolean)
          .join(' ') ||
        'RAM Kit';

      const refRams = report.ram.partNumber
        ? await searchReferenceCatalog('ram_kit', report.ram.partNumber, {
            limit: 1,
            hideMobile: true,
          }).catch(() => [])
        : [];
      const refRam = refRams[0] ?? null;
      const useRefRam =
        refRam &&
        report.ram.partNumber &&
        compactNorm(refRam.model).includes(compactNorm(report.ram.partNumber));

      const createPayload: NewRamKitPayload = {
        brand: report.ram.brand ?? (useRefRam ? refRam.brand : null),
        model: useRefRam ? refRam.model : modelLabel,
        capacity_gb:
          report.ram.totalGb ?? (useRefRam ? refRam.capacity_gb : null),
        modules_count:
          report.ram.modulesCount ?? (useRefRam ? refRam.modules_count : null),
        ram_type: report.ram.ramType ?? (useRefRam ? refRam.ram_type : null),
        speed_mhz:
          report.ram.speedMhz ?? (useRefRam ? refRam.speed_mhz : null),
        pc_rating:
          report.ram.pcRating ?? (useRefRam ? refRam.pc_rating : null),
        is_mobile: false,
        spare_count: 0,
        spec_url: useRefRam ? getSafeHttpUrl(refRam.spec_url) : null,
        spec_links: [],
        notes: null,
      };
      ramRes = {
        action: 'create',
        matchedId: null,
        confidence: useRefRam ? 'reference' : 'raw',
        matchLabel: `+ Create ${[createPayload.brand, createPayload.model].filter(Boolean).join(' ')}`,
        referenceEnriched: Boolean(useRefRam),
        createPayload,
      };
    }
  }

  // 6. Wi-Fi Card resolution
  let wifiRes: SlotResolution<NewWifiCardPayload> = {
    action: 'none',
    matchedId: null,
    confidence: 'none',
    matchLabel: 'Not detected',
    referenceEnriched: false,
    createPayload: null,
  };
  if (report.wifi) {
    const existingWifi = matchWifiInCatalog(
      report.wifi,
      catalog.wifiCards,
      isLaptop,
    );
    if (existingWifi) {
      wifiRes = {
        action: 'existing',
        matchedId: existingWifi.item.id,
        confidence: existingWifi.confidence,
        matchLabel: [
          existingWifi.item.brand,
          existingWifi.item.product,
          existingWifi.item.model,
        ]
          .filter(Boolean)
          .join(' '),
        referenceEnriched: false,
        createPayload: null,
      };
    } else {
      const refWifis = await searchReferenceCatalog(
        'wifi_card',
        `${report.wifi.brand} ${report.wifi.model}`,
        { limit: 1 },
      ).catch(() => []);
      const refWifi = refWifis[0] ?? null;
      const useRefWifi =
        refWifi &&
        compactNorm(refWifi.model) === compactNorm(report.wifi.model);

      const createPayload: NewWifiCardPayload = {
        brand: useRefWifi ? refWifi.brand : report.wifi.brand,
        product:
          report.wifi.product ?? (useRefWifi ? refWifi.product : null),
        model: useRefWifi ? refWifi.model : report.wifi.model,
        wifi_standard:
          report.wifi.wifiStandard ??
          (useRefWifi ? refWifi.wifi_standard : null),
        bluetooth_version: useRefWifi ? refWifi.bluetooth_version : null,
        form_factor:
          report.wifi.formFactor ?? (useRefWifi ? refWifi.form_factor : null),
        is_mobile: isLaptop || Boolean(useRefWifi && refWifi.is_mobile),
        spare_count: 0,
        spec_url: useRefWifi ? getSafeHttpUrl(refWifi.spec_url) : null,
        spec_links: [],
        notes: null,
      };
      wifiRes = {
        action: 'create',
        matchedId: null,
        confidence: useRefWifi ? 'reference' : 'raw',
        matchLabel: `+ Create ${[createPayload.brand, createPayload.model].filter(Boolean).join(' ')}`,
        referenceEnriched: Boolean(useRefWifi),
        createPayload,
      };
    }
  }

  // 7. Storage Drives resolution
  const driveItems: DriveResolutionItem[] = [];
  for (const drv of report.drives) {
    const existingDrv = matchDriveModelInCatalog(
      drv,
      catalog.storageDriveModels,
    );
    if (existingDrv) {
      driveItems.push({
        drive: drv,
        checked: !drv.isRemovableOrOptical,
        isPrimary: drv.isPrimary,
        resolution: {
          action: 'existing',
          matchedId: existingDrv.item.id,
          confidence: existingDrv.confidence,
          matchLabel: [existingDrv.item.brand, existingDrv.item.model]
            .filter(Boolean)
            .join(' '),
          referenceEnriched: false,
          createPayload: null,
        },
      });
      continue;
    }

    const refDrives = await searchReferenceCatalog(
      'storage_drive_model',
      `${drv.brand ?? ''} ${drv.model}`,
      { limit: 1 },
    ).catch(() => []);
    const refDrv = refDrives[0] ?? null;
    const useRefDrv =
      refDrv &&
      ((drv.modelNumber &&
        refDrv.model_number &&
        compactNorm(drv.modelNumber) === compactNorm(refDrv.model_number)) ||
        tokenOverlapScore(drv.model, refDrv.model) >= 0.72);

    const createPayload: NewStorageDriveModelPayload = {
      brand: drv.brand ?? (useRefDrv ? refDrv.brand : null),
      model: useRefDrv ? refDrv.model : drv.model,
      model_number:
        drv.modelNumber ?? (useRefDrv ? refDrv.model_number : null),
      capacity_gb:
        drv.capacityGb ?? (useRefDrv ? refDrv.capacity_gb : null),
      form_factor:
        drv.formFactor ?? (useRefDrv ? refDrv.form_factor : null),
      nand_type: useRefDrv ? refDrv.nand_type : null,
      read_mb_s: useRefDrv ? refDrv.read_mb_s : null,
      write_mb_s: useRefDrv ? refDrv.write_mb_s : null,
      spare_count: 0,
      spec_url: useRefDrv ? getSafeHttpUrl(refDrv.spec_url) : null,
      spec_links: [],
      notes: null,
    };

    driveItems.push({
      drive: drv,
      checked: !drv.isRemovableOrOptical,
      isPrimary: drv.isPrimary,
      resolution: {
        action: 'create',
        matchedId: null,
        confidence: useRefDrv ? 'reference' : 'raw',
        matchLabel: `+ Create ${[createPayload.brand, createPayload.model].filter(Boolean).join(' ')}`,
        referenceEnriched: Boolean(useRefDrv),
        createPayload,
      },
    });
  }

  return {
    deviceType,
    cpu: cpuRes,
    gpu: gpuRes,
    gpuCard: gpuCardRes,
    igpu: igpuRes,
    motherboard: moboRes,
    ramKit: ramRes,
    wifiCard: wifiRes,
    drives: driveItems,
  };
}

export function getSlotChangeKind(
  hasIncoming: boolean,
  isBlankOnTarget: boolean,
  matchesExisting: boolean,
): DiffChangeKind {
  if (!hasIncoming) return 'unchanged';
  if (isBlankOnTarget) return 'fill_blank';
  return matchesExisting ? 'unchanged' : 'changed';
}

export function computeHwinfoSwapAdjustments(
  targetRig: ComputerWithRelations | null,
  plan: ResolvedHwinfoPlan,
  selections: HwinfoReviewSelections,
  catalog: InventoryCatalogContext,
): PendingSwapItem[] {
  if (!targetRig || targetRig.device_type !== 'Desktop' || plan.deviceType !== 'Desktop') {
    return [];
  }

  const before = snapshotFromRig(targetRig);

  const nextCpuId = selections.applyCpu
    ? plan.cpu.action === 'existing'
      ? plan.cpu.matchedId
      : plan.cpu.action === 'create'
        ? -1 // sentinel so before.cpuId !== after.cpuId triggers +1 removed on old part without -1 on new
        : targetRig.cpu_id
    : targetRig.cpu_id;

  const nextGpuCardId = selections.applyGpuCard
    ? plan.gpuCard.action === 'existing'
      ? plan.gpuCard.matchedId
      : plan.gpuCard.action === 'create'
        ? -1
        : targetRig.gpu_card_id
    : targetRig.gpu_card_id;

  const nextMbId = selections.applyMotherboard
    ? plan.motherboard.action === 'existing'
      ? plan.motherboard.matchedId
      : plan.motherboard.action === 'create'
        ? -1
        : targetRig.motherboard_id
    : targetRig.motherboard_id;

  const nextRamId = selections.applyRam
    ? plan.ramKit.action === 'existing'
      ? plan.ramKit.matchedId
      : plan.ramKit.action === 'create'
        ? -1
        : targetRig.ram_kit_id
    : targetRig.ram_kit_id;

  const nextWifiId = selections.applyWifi
    ? plan.wifiCard.action === 'existing'
      ? plan.wifiCard.matchedId
      : plan.wifiCard.action === 'create'
        ? -1
        : targetRig.wifi_card_id
    : targetRig.wifi_card_id;

  let nextDriveModelIds = [...before.driveModelIds];
  if (selections.applyDrives) {
    const selectedIncomingIds = plan.drives
      .filter((d) => d.checked)
      .map((d) =>
        d.resolution.action === 'existing' && d.resolution.matchedId !== null
          ? d.resolution.matchedId
          : -1,
      );
    nextDriveModelIds =
      selections.driveMode === 'replace'
        ? selectedIncomingIds
        : [...before.driveModelIds, ...selectedIncomingIds];
  }

  const after = {
    ...before,
    cpuId: nextCpuId,
    gpuCardId: nextGpuCardId,
    motherboardId: nextMbId,
    ramKitId: nextRamId,
    wifiCardId: nextWifiId,
    driveModelIds: nextDriveModelIds,
  };

  return computeDesktopSwapAdjustments(before, after, {
    cpus: catalog.cpus,
    gpuCards: catalog.gpuCards,
    motherboards: catalog.motherboards,
    ramKits: catalog.ramKits,
    storageDriveModels: catalog.storageDriveModels,
    psus: catalog.psus,
    cases: catalog.cases,
    coolers: catalog.coolers,
    wifiCards: catalog.wifiCards,
  });
}

async function findOrCreateCpu(
  supabase: SupabaseClient,
  payload: NewCpuPayload,
  existingCpus: Cpu[],
): Promise<{ cpu: Cpu; created: boolean }> {
  const existingLocal = existingCpus.find(
    (c) =>
      c.brand.toLowerCase() === payload.brand.toLowerCase() &&
      c.name.toLowerCase() === payload.name.toLowerCase(),
  );
  if (existingLocal) return { cpu: existingLocal, created: false };

  const { data: dbRows } = await supabase
    .from('cpus')
    .select('*')
    .ilike('brand', payload.brand)
    .ilike('name', payload.name)
    .limit(1);
  if (dbRows && dbRows.length > 0) {
    return { cpu: dbRows[0] as Cpu, created: false };
  }

  const { data, error } = await supabase
    .from('cpus')
    .insert({
      ...payload,
      spec_url: getSafeHttpUrl(payload.spec_url),
    })
    .select('*')
    .single();
  if (error) throw error;
  return { cpu: data as Cpu, created: true };
}

async function findOrCreateGpu(
  supabase: SupabaseClient,
  payload: NewGpuPayload,
  existingGpus: Gpu[],
): Promise<{ gpu: Gpu; created: boolean }> {
  const existingLocal = existingGpus.find(
    (g) =>
      g.brand.toLowerCase() === payload.brand.toLowerCase() &&
      g.name.toLowerCase() === payload.name.toLowerCase() &&
      g.is_mobile === payload.is_mobile,
  );
  if (existingLocal) return { gpu: existingLocal, created: false };

  const { data: dbRows } = await supabase
    .from('gpus')
    .select('*')
    .ilike('brand', payload.brand)
    .ilike('name', payload.name)
    .eq('is_mobile', payload.is_mobile)
    .limit(1);
  if (dbRows && dbRows.length > 0) {
    return { gpu: dbRows[0] as Gpu, created: false };
  }

  const { data, error } = await supabase
    .from('gpus')
    .insert({
      ...payload,
      spec_url: getSafeHttpUrl(payload.spec_url),
    })
    .select('*')
    .single();
  if (error) throw error;
  return { gpu: data as Gpu, created: true };
}

async function findOrCreateGpuCard(
  supabase: SupabaseClient,
  payload: NewGpuCardPayload,
  existingCards: GpuCard[],
): Promise<{ card: GpuCard; created: boolean }> {
  const existingLocal = existingCards.find(
    (c) =>
      c.gpu_id === payload.gpu_id &&
      c.brand.toLowerCase() === payload.brand.toLowerCase() &&
      c.model.toLowerCase() === payload.model.toLowerCase(),
  );
  if (existingLocal) return { card: existingLocal, created: false };

  const { data: dbRows } = await supabase
    .from('gpu_cards')
    .select('*')
    .eq('gpu_id', payload.gpu_id)
    .ilike('brand', payload.brand)
    .ilike('model', payload.model)
    .limit(1);
  if (dbRows && dbRows.length > 0) {
    return { card: dbRows[0] as GpuCard, created: false };
  }

  const { data, error } = await supabase
    .from('gpu_cards')
    .insert({
      ...payload,
      spec_url: getSafeHttpUrl(payload.spec_url),
    })
    .select('*')
    .single();
  if (error) throw error;
  return { card: data as GpuCard, created: true };
}

async function findOrCreateMotherboard(
  supabase: SupabaseClient,
  payload: NewMotherboardPayload,
  existingMbs: Motherboard[],
): Promise<{ motherboard: Motherboard; created: boolean }> {
  const existingLocal = existingMbs.find(
    (m) =>
      m.brand.toLowerCase() === payload.brand.toLowerCase() &&
      m.model.toLowerCase() === payload.model.toLowerCase(),
  );
  if (existingLocal) return { motherboard: existingLocal, created: false };

  const { data: dbRows } = await supabase
    .from('motherboards')
    .select('*')
    .ilike('brand', payload.brand)
    .ilike('model', payload.model)
    .limit(1);
  if (dbRows && dbRows.length > 0) {
    return { motherboard: dbRows[0] as Motherboard, created: false };
  }

  const { data, error } = await supabase
    .from('motherboards')
    .insert({
      ...payload,
      spec_url: getSafeHttpUrl(payload.spec_url),
    })
    .select('*')
    .single();
  if (error) throw error;
  return { motherboard: data as Motherboard, created: true };
}

async function findOrCreateRamKit(
  supabase: SupabaseClient,
  payload: NewRamKitPayload,
  existingKits: RamKit[],
): Promise<{ kit: RamKit; created: boolean }> {
  const existingLocal = existingKits.find(
    (k) =>
      (k.brand ?? '').toLowerCase() === (payload.brand ?? '').toLowerCase() &&
      k.model.toLowerCase() === payload.model.toLowerCase() &&
      (k.capacity_gb ?? 0) === (payload.capacity_gb ?? 0) &&
      (k.ram_type ?? '').toLowerCase() === (payload.ram_type ?? '').toLowerCase() &&
      (k.speed_mhz ?? 0) === (payload.speed_mhz ?? 0) &&
      k.is_mobile === payload.is_mobile,
  );
  if (existingLocal) return { kit: existingLocal, created: false };

  const { data: allKits } = await supabase.from('ram_kits').select('*');
  const dbMatch = ((allKits ?? []) as RamKit[]).find(
    (k) =>
      (k.brand ?? '').toLowerCase() === (payload.brand ?? '').toLowerCase() &&
      k.model.toLowerCase() === payload.model.toLowerCase() &&
      (k.capacity_gb ?? 0) === (payload.capacity_gb ?? 0) &&
      (k.ram_type ?? '').toLowerCase() === (payload.ram_type ?? '').toLowerCase() &&
      (k.speed_mhz ?? 0) === (payload.speed_mhz ?? 0) &&
      k.is_mobile === payload.is_mobile,
  );
  if (dbMatch) return { kit: dbMatch, created: false };

  const { data, error } = await supabase
    .from('ram_kits')
    .insert({
      ...payload,
      spec_url: getSafeHttpUrl(payload.spec_url),
    })
    .select('*')
    .single();
  if (error) throw error;
  return { kit: data as RamKit, created: true };
}

async function findOrCreateStorageDriveModel(
  supabase: SupabaseClient,
  payload: NewStorageDriveModelPayload,
  existingModels: StorageDriveModel[],
): Promise<{ model: StorageDriveModel; created: boolean }> {
  const matchesKey = (m: StorageDriveModel) =>
    (m.brand ?? '').toLowerCase() === (payload.brand ?? '').toLowerCase() &&
    m.model.toLowerCase() === payload.model.toLowerCase() &&
    (m.capacity_gb ?? 0) === (payload.capacity_gb ?? 0) &&
    (m.form_factor ?? '').toLowerCase() === (payload.form_factor ?? '').toLowerCase();

  const existingLocal = existingModels.find(matchesKey);
  if (existingLocal) return { model: existingLocal, created: false };

  const { data: allRows } = await supabase
    .from('storage_drive_models')
    .select('*');
  const dbMatch = ((allRows ?? []) as StorageDriveModel[]).find(matchesKey);
  if (dbMatch) return { model: dbMatch, created: false };

  const { data, error } = await supabase
    .from('storage_drive_models')
    .insert({
      ...payload,
      spec_url: getSafeHttpUrl(payload.spec_url),
    })
    .select('*')
    .single();
  if (error) throw error;
  return { model: data as StorageDriveModel, created: true };
}

async function findOrCreateWifiCard(
  supabase: SupabaseClient,
  payload: NewWifiCardPayload,
  existingWifi: WifiCard[],
): Promise<{ wifi: WifiCard; created: boolean }> {
  const matchesKey = (w: WifiCard) =>
    w.brand.toLowerCase() === payload.brand.toLowerCase() &&
    (w.product ?? '').toLowerCase() === (payload.product ?? '').toLowerCase() &&
    w.model.toLowerCase() === payload.model.toLowerCase() &&
    w.is_mobile === payload.is_mobile;

  const existingLocal = existingWifi.find(matchesKey);
  if (existingLocal) return { wifi: existingLocal, created: false };

  const { data: allRows } = await supabase.from('wifi_cards').select('*');
  const dbMatch = ((allRows ?? []) as WifiCard[]).find(matchesKey);
  if (dbMatch) return { wifi: dbMatch, created: false };

  const { data, error } = await supabase
    .from('wifi_cards')
    .insert({
      ...payload,
      spec_url: getSafeHttpUrl(payload.spec_url),
    })
    .select('*')
    .single();
  if (error) throw error;
  return { wifi: data as WifiCard, created: true };
}

/**
 * Create any staged new catalog entries, build the merged ComputerUpsertPayload + DriveDrafts,
 * and persist via saveComputer (preserving manual fields & applying Swap-to-Spare adjustments).
 */
export async function applyHwinfoImport(params: {
  supabase: SupabaseClient;
  saveComputer: (
    payload: ComputerUpsertPayload,
    drives: DriveDraft[],
    existingId?: number,
    spareAdjustments?: SpareAdjustment[],
  ) => Promise<number>;
  catalog: InventoryCatalogContext;
  report: ParsedHwinfoReport;
  plan: ResolvedHwinfoPlan;
  selections: HwinfoReviewSelections;
  targetRig: ComputerWithRelations | null;
  newRigMeta: { name: string; deviceType: DeviceType; status: BuildStatus };
  spareAdjustments: SpareAdjustment[];
}): Promise<HwinfoApplyResult> {
  const {
    supabase,
    saveComputer,
    catalog,
    report,
    plan,
    selections,
    targetRig,
    newRigMeta,
    spareAdjustments,
  } = params;

  const deviceType = targetRig ? targetRig.device_type : newRigMeta.deviceType;
  const rigName = (targetRig ? targetRig.name : newRigMeta.name).trim();

  if (!rigName) {
    throw new Error('Rig name is required.');
  }

  if (!targetRig) {
    const duplicate = catalog.computers.find(
      (c) =>
        c.name.toLowerCase() === rigName.toLowerCase() &&
        c.device_type === deviceType,
    );
    if (duplicate) {
      throw new Error(
        `A ${deviceType} named "${duplicate.name}" already exists. Select it as the target rig to update it instead.`,
      );
    }
  }

  const createdParts: HwinfoApplyResult['createdParts'] = [];

  // Base payload preserving manual/undetectable fields when updating an existing rig
  const payload: ComputerUpsertPayload = targetRig
    ? {
        name: targetRig.name,
        device_type: targetRig.device_type,
        brand: targetRig.brand,
        model: targetRig.model,
        build_date: targetRig.build_date,
        overall_rank: targetRig.overall_rank,
        status: targetRig.status,
        notes: targetRig.notes,
        cpu_id: targetRig.cpu_id,
        cpu_count: targetRig.cpu_count,
        gpu_id: targetRig.gpu_id,
        gpu_card_id: targetRig.gpu_card_id,
        gpu_aib_manufacturer: targetRig.gpu_aib_manufacturer,
        gpu_aib_model: targetRig.gpu_aib_model,
        igpu_id: targetRig.igpu_id,
        motherboard_id: targetRig.motherboard_id,
        motherboard_name: targetRig.motherboard_name,
        motherboard_brand: targetRig.motherboard_brand,
        motherboard_launch: targetRig.motherboard_launch,
        ram_kit_id: targetRig.ram_kit_id,
        ram_gb: targetRig.ram_gb,
        ram_speed_mhz: targetRig.ram_speed_mhz,
        ram_type: targetRig.ram_type,
        ram_pc_rating: targetRig.ram_pc_rating,
        psu_id: targetRig.psu_id,
        psu_wattage: targetRig.psu_wattage,
        psu_brand: targetRig.psu_brand,
        psu_has_8pin_cpu: targetRig.psu_has_8pin_cpu,
        psu_has_6pin_pcie: targetRig.psu_has_6pin_pcie,
        power_adapter_notes: targetRig.power_adapter_notes,
        case_id: targetRig.case_id,
        cooler_id: targetRig.cooler_id,
        screen_size_inches: targetRig.screen_size_inches,
        screen_resolution: targetRig.screen_resolution,
        weight_lbs: targetRig.weight_lbs,
        wifi_card_id: targetRig.wifi_card_id,
        wifi_brand: targetRig.wifi_brand,
        wifi_product: targetRig.wifi_product,
        wifi_model: targetRig.wifi_model,
        wifi_codename: targetRig.wifi_codename,
        wifi_launch_date: targetRig.wifi_launch_date,
        wifi_antenna: targetRig.wifi_antenna,
        wifi_bands: targetRig.wifi_bands,
        wifi_max_speed: targetRig.wifi_max_speed,
        wifi_standard: targetRig.wifi_standard,
        bluetooth_version: targetRig.bluetooth_version,
        wifi_form_factor: targetRig.wifi_form_factor,
        part_spec_links: targetRig.part_spec_links ?? {},
      }
    : {
        name: rigName,
        device_type: deviceType,
        brand: null,
        model: null,
        build_date: null,
        overall_rank: null,
        status: newRigMeta.status,
        notes: null,
        cpu_id: null,
        cpu_count: 1,
        gpu_id: null,
        gpu_card_id: null,
        gpu_aib_manufacturer: null,
        gpu_aib_model: null,
        igpu_id: null,
        motherboard_id: null,
        motherboard_name: null,
        motherboard_brand: null,
        motherboard_launch: null,
        ram_kit_id: null,
        ram_gb: null,
        ram_speed_mhz: null,
        ram_type: null,
        ram_pc_rating: null,
        psu_id: null,
        psu_wattage: null,
        psu_brand: null,
        psu_has_8pin_cpu: null,
        psu_has_6pin_pcie: null,
        power_adapter_notes: null,
        case_id: null,
        cooler_id: null,
        screen_size_inches: null,
        screen_resolution: null,
        weight_lbs: null,
        wifi_card_id: null,
        wifi_brand: null,
        wifi_product: null,
        wifi_model: null,
        wifi_codename: null,
        wifi_launch_date: null,
        wifi_antenna: null,
        wifi_bands: null,
        wifi_max_speed: null,
        wifi_standard: null,
        bluetooth_version: null,
        wifi_form_factor: null,
        part_spec_links: {},
      };

  // Laptop system brand/model
  if (
    selections.applyIdentity &&
    deviceType === 'Laptop' &&
    (report.systemManufacturer || report.systemModel)
  ) {
    if (report.systemManufacturer) payload.brand = report.systemManufacturer;
    if (report.systemModel) payload.model = report.systemModel;
  }

  // CPU
  if (selections.applyCpu && report.cpu) {
    if (plan.cpu.action === 'existing' && plan.cpu.matchedId !== null) {
      payload.cpu_id = plan.cpu.matchedId;
      payload.cpu_count = Math.max(1, report.cpuCount || 1);
    } else if (plan.cpu.action === 'create' && plan.cpu.createPayload) {
      const { cpu, created } = await findOrCreateCpu(
        supabase,
        plan.cpu.createPayload,
        catalog.cpus,
      );
      payload.cpu_id = cpu.id;
      payload.cpu_count = Math.max(1, report.cpuCount || 1);
      if (created) {
        createdParts.push({
          category: 'CPU',
          label: `${cpu.brand} ${cpu.name}`,
          id: cpu.id,
          needsPassMark: cpu.passmark_score === null,
        });
      }
    }
  }

  // Discrete GPU silicon
  if (selections.applyGpu && report.discreteGpu) {
    if (plan.gpu.action === 'existing' && plan.gpu.matchedId !== null) {
      payload.gpu_id = plan.gpu.matchedId;
    } else if (plan.gpu.action === 'create' && plan.gpu.createPayload) {
      const { gpu, created } = await findOrCreateGpu(
        supabase,
        plan.gpu.createPayload,
        catalog.gpus,
      );
      payload.gpu_id = gpu.id;
      if (created) {
        createdParts.push({
          category: 'GPU',
          label: `${gpu.brand} ${gpu.name}`,
          id: gpu.id,
          needsPassMark: gpu.passmark_score === null,
        });
      }
    }
  }

  // GPU AIB Card (Desktop)
  if (selections.applyGpuCard && deviceType === 'Desktop' && report.discreteGpu) {
    if (plan.gpuCard.action === 'existing' && plan.gpuCard.matchedId !== null) {
      const card = catalog.gpuCards.find((c) => c.id === plan.gpuCard.matchedId);
      if (card) {
        payload.gpu_card_id = card.id;
        payload.gpu_id = card.gpu_id;
        payload.gpu_aib_manufacturer = card.brand;
        payload.gpu_aib_model = card.model;
      }
    } else if (
      plan.gpuCard.action === 'create' &&
      plan.gpuCard.createPayload &&
      payload.gpu_id !== null
    ) {
      const { card, created } = await findOrCreateGpuCard(
        supabase,
        {
          ...plan.gpuCard.createPayload,
          gpu_id: payload.gpu_id,
        },
        catalog.gpuCards,
      );
      payload.gpu_card_id = card.id;
      payload.gpu_aib_manufacturer = card.brand;
      payload.gpu_aib_model = card.model;
      if (created) {
        createdParts.push({
          category: 'GPU Card',
          label: `${card.brand} ${card.model}`,
          id: card.id,
        });
      }
    } else if (report.discreteGpu.aibManufacturer || report.discreteGpu.aibModel) {
      payload.gpu_aib_manufacturer = report.discreteGpu.aibManufacturer;
      payload.gpu_aib_model = report.discreteGpu.aibModel;
    }
  }

  // Integrated GPU
  if (selections.applyIgpu && report.integratedGpu) {
    if (plan.igpu.action === 'existing' && plan.igpu.matchedId !== null) {
      payload.igpu_id = plan.igpu.matchedId;
    } else if (plan.igpu.action === 'create' && plan.igpu.createPayload) {
      const { gpu, created } = await findOrCreateGpu(
        supabase,
        plan.igpu.createPayload,
        catalog.gpus,
      );
      payload.igpu_id = gpu.id;
      if (created) {
        createdParts.push({
          category: 'iGPU',
          label: `${gpu.brand} ${gpu.name}`,
          id: gpu.id,
          needsPassMark: gpu.passmark_score === null,
        });
      }
    }
  }

  // Motherboard (Desktop)
  if (selections.applyMotherboard && deviceType === 'Desktop' && report.motherboard) {
    if (
      plan.motherboard.action === 'existing' &&
      plan.motherboard.matchedId !== null
    ) {
      const mb = catalog.motherboards.find(
        (m) => m.id === plan.motherboard.matchedId,
      );
      if (mb) {
        payload.motherboard_id = mb.id;
        payload.motherboard_brand = mb.brand;
        payload.motherboard_name = mb.model;
        if (mb.launch_date) payload.motherboard_launch = mb.launch_date;
      }
    } else if (
      plan.motherboard.action === 'create' &&
      plan.motherboard.createPayload
    ) {
      const { motherboard, created } = await findOrCreateMotherboard(
        supabase,
        plan.motherboard.createPayload,
        catalog.motherboards,
      );
      payload.motherboard_id = motherboard.id;
      payload.motherboard_brand = motherboard.brand;
      payload.motherboard_name = motherboard.model;
      if (motherboard.launch_date) {
        payload.motherboard_launch = motherboard.launch_date;
      }
      if (created) {
        createdParts.push({
          category: 'Motherboard',
          label: `${motherboard.brand} ${motherboard.model}`,
          id: motherboard.id,
        });
      }
    }
  }

  // RAM
  if (selections.applyRam && report.ram) {
    if (
      deviceType === 'Desktop' &&
      plan.ramKit.action === 'existing' &&
      plan.ramKit.matchedId !== null
    ) {
      const kit = catalog.ramKits.find((k) => k.id === plan.ramKit.matchedId);
      if (kit) {
        payload.ram_kit_id = kit.id;
        payload.ram_gb = kit.capacity_gb ?? report.ram.totalGb;
        payload.ram_type = kit.ram_type ?? report.ram.ramType;
        payload.ram_speed_mhz = kit.speed_mhz ?? report.ram.speedMhz;
        payload.ram_pc_rating = kit.pc_rating ?? report.ram.pcRating;
      }
    } else if (
      deviceType === 'Desktop' &&
      plan.ramKit.action === 'create' &&
      plan.ramKit.createPayload
    ) {
      const { kit, created } = await findOrCreateRamKit(
        supabase,
        plan.ramKit.createPayload,
        catalog.ramKits,
      );
      payload.ram_kit_id = kit.id;
      payload.ram_gb = kit.capacity_gb ?? report.ram.totalGb;
      payload.ram_type = kit.ram_type ?? report.ram.ramType;
      payload.ram_speed_mhz = kit.speed_mhz ?? report.ram.speedMhz;
      payload.ram_pc_rating = kit.pc_rating ?? report.ram.pcRating;
      if (created) {
        createdParts.push({
          category: 'RAM Kit',
          label: [kit.brand, kit.model].filter(Boolean).join(' '),
          id: kit.id,
        });
      }
    } else {
      payload.ram_gb = report.ram.totalGb ?? payload.ram_gb;
      payload.ram_type = report.ram.ramType ?? payload.ram_type;
      payload.ram_speed_mhz = report.ram.speedMhz ?? payload.ram_speed_mhz;
      payload.ram_pc_rating = report.ram.pcRating ?? payload.ram_pc_rating;
    }
  }

  // Wi-Fi
  if (selections.applyWifi && report.wifi) {
    if (
      plan.wifiCard.action === 'existing' &&
      plan.wifiCard.matchedId !== null
    ) {
      const wifi = catalog.wifiCards.find(
        (w) => w.id === plan.wifiCard.matchedId,
      );
      if (wifi) {
        payload.wifi_card_id = wifi.id;
        payload.wifi_brand = wifi.brand;
        payload.wifi_product = wifi.product;
        payload.wifi_model = wifi.model;
        payload.wifi_standard = wifi.wifi_standard ?? report.wifi.wifiStandard;
        payload.bluetooth_version = wifi.bluetooth_version ?? payload.bluetooth_version;
        payload.wifi_form_factor = wifi.form_factor ?? report.wifi.formFactor;
      }
    } else if (
      plan.wifiCard.action === 'create' &&
      plan.wifiCard.createPayload
    ) {
      const { wifi, created } = await findOrCreateWifiCard(
        supabase,
        plan.wifiCard.createPayload,
        catalog.wifiCards,
      );
      payload.wifi_card_id = wifi.id;
      payload.wifi_brand = wifi.brand;
      payload.wifi_product = wifi.product;
      payload.wifi_model = wifi.model;
      payload.wifi_standard = wifi.wifi_standard;
      payload.bluetooth_version = wifi.bluetooth_version ?? payload.bluetooth_version;
      payload.wifi_form_factor = wifi.form_factor ?? payload.wifi_form_factor;
      if (created) {
        createdParts.push({
          category: 'Wi-Fi Card',
          label: `${wifi.brand} ${wifi.model}`,
          id: wifi.id,
        });
      }
    }
  }

  // Display (Laptop)
  if (selections.applyDisplay && deviceType === 'Laptop' && report.display) {
    if (report.display.screenSizeInches !== null) {
      payload.screen_size_inches = report.display.screenSizeInches;
    }
    if (report.display.screenResolution) {
      payload.screen_resolution = report.display.screenResolution;
    }
  }

  // Storage Drives (preserve existing if unchecked!)
  const existingDriveDrafts: DriveDraft[] = (targetRig?.storage_drives ?? []).map(
    (d) => ({
      id: d.id,
      storage_drive_model_id: d.storage_drive_model_id ?? null,
      capacity_gb: d.capacity_gb,
      form_factor: d.form_factor,
      brand: d.brand,
      model: d.model,
      model_number: d.model_number,
      nand_type: d.nand_type,
      read_mb_s: d.read_mb_s,
      write_mb_s: d.write_mb_s,
      is_primary: d.is_primary,
      spec_url: d.spec_url ?? null,
      spec_links: (d.spec_links ?? []).map((l) => ({ ...l })),
    }),
  );

  let finalDrives: DriveDraft[] = existingDriveDrafts;
  if (selections.applyDrives) {
    const incomingDrafts: DriveDraft[] = [];
    for (const item of plan.drives) {
      if (!item.checked) continue;
      let resolvedModel: StorageDriveModel | null = null;
      if (
        item.resolution.action === 'existing' &&
        item.resolution.matchedId !== null
      ) {
        resolvedModel =
          catalog.storageDriveModels.find(
            (m) => m.id === item.resolution.matchedId,
          ) ?? null;
      } else if (
        item.resolution.action === 'create' &&
        item.resolution.createPayload
      ) {
        const { model, created } = await findOrCreateStorageDriveModel(
          supabase,
          item.resolution.createPayload,
          catalog.storageDriveModels,
        );
        resolvedModel = model;
        if (created) {
          catalog.storageDriveModels.push(model);
          createdParts.push({
            category: 'Storage Drive',
            label: [model.brand, model.model].filter(Boolean).join(' '),
            id: model.id,
          });
        }
      }

      if (resolvedModel) {
        incomingDrafts.push({
          storage_drive_model_id: resolvedModel.id,
          capacity_gb: resolvedModel.capacity_gb ?? item.drive.capacityGb,
          form_factor: resolvedModel.form_factor ?? item.drive.formFactor,
          brand: resolvedModel.brand ?? item.drive.brand,
          model: resolvedModel.model,
          model_number: resolvedModel.model_number ?? item.drive.modelNumber,
          nand_type: resolvedModel.nand_type,
          read_mb_s: resolvedModel.read_mb_s,
          write_mb_s: resolvedModel.write_mb_s,
          is_primary: item.isPrimary,
          spec_url: resolvedModel.spec_url,
          spec_links: (resolvedModel.spec_links ?? []).map((l) => ({ ...l })),
        });
      } else {
        incomingDrafts.push({
          storage_drive_model_id: null,
          capacity_gb: item.drive.capacityGb,
          form_factor: item.drive.formFactor,
          brand: item.drive.brand,
          model: item.drive.model,
          model_number: item.drive.modelNumber,
          nand_type: null,
          read_mb_s: null,
          write_mb_s: null,
          is_primary: item.isPrimary,
          spec_url: null,
          spec_links: [],
        });
      }
    }

    if (selections.driveMode === 'replace' || !targetRig) {
      finalDrives = incomingDrafts;
    } else {
      const existingKeys = new Set(
        existingDriveDrafts.map((d) =>
          compactNorm(`${d.brand ?? ''} ${d.model ?? ''} ${d.capacity_gb ?? ''}`),
        ),
      );
      const merged = [...existingDriveDrafts];
      for (const inc of incomingDrafts) {
        const key = compactNorm(
          `${inc.brand ?? ''} ${inc.model ?? ''} ${inc.capacity_gb ?? ''}`,
        );
        if (!existingKeys.has(key)) {
          merged.push({
            ...inc,
            is_primary: existingDriveDrafts.length === 0 ? inc.is_primary : false,
          });
        }
      }
      finalDrives = merged;
    }

    if (finalDrives.length > 0 && !finalDrives.some((d) => d.is_primary)) {
      finalDrives[0] = { ...finalDrives[0], is_primary: true };
    }
  }

  const computerId = await saveComputer(
    payload,
    finalDrives,
    targetRig?.id,
    spareAdjustments,
  );

  return {
    computerId,
    rigName,
    deviceType,
    isNew: !targetRig,
    createdParts,
    swapAdjustmentsApplied: spareAdjustments.filter((a) => a.delta !== 0).length,
  };
}
