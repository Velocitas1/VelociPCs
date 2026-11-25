import type { CatalogPartCategory, Gpu } from '../types/database';

export type ReferenceCategory = 'cpu' | 'gpu' | CatalogPartCategory;

export interface RefCpu {
  brand: string;
  name: string;
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
  is_mobile: boolean;
  spec_url: string | null;
  src: string | null;
}

export interface RefGpu {
  brand: string;
  name: string;
  architecture: string | null;
  vram_gb: number | null;
  vram_type: string | null;
  bus_interface: string | null;
  process_nm: number | null;
  tdp_w: number | null;
  directx_version: string | null;
  directx_feature_level: string | null;
  category: string | null;
  is_mobile: boolean;
  spec_url: string | null;
  src: string | null;
}

export interface RefGpuCard {
  brand: string;
  model: string;
  chipset: string | null;
  part_number: string | null;
  cooling_type: string | null;
  length_mm: number | null;
  spec_url: string | null;
  src: string | null;
}

export interface RefMotherboard {
  brand: string;
  model: string;
  socket: string | null;
  chipset: string | null;
  form_factor: string | null;
  memory_type: string | null;
  launch_date: string | null;
  spec_url: string | null;
  src: string | null;
}

export interface RefRamKit {
  brand: string | null;
  model: string;
  capacity_gb: number | null;
  modules_count: number | null;
  ram_type: string | null;
  speed_mhz: number | null;
  pc_rating: string | null;
  is_mobile: boolean;
  spec_url: string | null;
  src: string | null;
}

export interface RefStorageDriveModel {
  brand: string | null;
  model: string;
  model_number: string | null;
  capacity_gb: number | null;
  form_factor: string | null;
  nand_type: string | null;
  read_mb_s: number | null;
  write_mb_s: number | null;
  spec_url: string | null;
  src: string | null;
}

export interface RefPsu {
  brand: string;
  model: string;
  wattage: number | null;
  efficiency_rating: string | null;
  modular: string | null;
  has_8pin_cpu: boolean | null;
  has_6pin_pcie: boolean | null;
  spec_url: string | null;
  src: string | null;
}

export interface RefPcCase {
  brand: string;
  model: string;
  form_factor: string | null;
  color: string | null;
  max_gpu_length_mm: number | null;
  spec_url: string | null;
  src: string | null;
}

export interface RefCooler {
  brand: string;
  model: string;
  cooler_type: string | null;
  fan_size_mm: number | null;
  socket_support: string | null;
  tdp_rating_w: number | null;
  spec_url: string | null;
  src: string | null;
}

export interface RefWifiCard {
  brand: string;
  product: string | null;
  model: string;
  wifi_standard: string | null;
  bluetooth_version: string | null;
  form_factor: string | null;
  is_mobile: boolean;
  spec_url: string | null;
  src: string | null;
}

export interface ReferenceItemMap {
  cpu: RefCpu;
  gpu: RefGpu;
  gpu_card: RefGpuCard;
  motherboard: RefMotherboard;
  ram_kit: RefRamKit;
  storage_drive_model: RefStorageDriveModel;
  psu: RefPsu;
  case: RefPcCase;
  cooler: RefCooler;
  wifi_card: RefWifiCard;
}

export type ReferenceItem = ReferenceItemMap[ReferenceCategory];

interface CompactCatalogFile {
  v: number;
  fields: string[];
  rows: unknown[][];
}

interface IndexedEntry<T> {
  item: T;
  titleNorm: string;
  titleCompact: string;
  searchNorm: string;
  searchCompact: string;
  richness: number;
}

const CATEGORY_FILES: Record<ReferenceCategory, string> = {
  cpu: 'cpus.json',
  gpu: 'gpus.json',
  gpu_card: 'gpu_cards.json',
  motherboard: 'motherboards.json',
  ram_kit: 'ram_kits.json',
  storage_drive_model: 'storage_drive_models.json',
  psu: 'psus.json',
  case: 'cases.json',
  cooler: 'coolers.json',
  wifi_card: 'wifi_cards.json',
};

const catalogCache = new Map<
  ReferenceCategory,
  Promise<IndexedEntry<ReferenceItem>[]>
>();

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9.+]+/g, ' ').trim();
}

function compactText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function formatReferenceItemTitle<K extends ReferenceCategory>(
  category: K,
  item: ReferenceItemMap[K],
): string {
  switch (category as ReferenceCategory) {
    case 'cpu': {
      const c = item as RefCpu;
      return `${c.brand} ${c.name}`.trim();
    }
    case 'gpu': {
      const g = item as RefGpu;
      return `${g.brand} ${g.name}`.trim();
    }
    case 'gpu_card': {
      const gc = item as RefGpuCard;
      return `${gc.brand} ${gc.model}`.trim();
    }
    case 'motherboard': {
      const m = item as RefMotherboard;
      return `${m.brand} ${m.model}`.trim();
    }
    case 'ram_kit': {
      const r = item as RefRamKit;
      return [r.brand, r.model].filter(Boolean).join(' ').trim();
    }
    case 'storage_drive_model': {
      const s = item as RefStorageDriveModel;
      return [s.brand, s.model].filter(Boolean).join(' ').trim();
    }
    case 'psu': {
      const p = item as RefPsu;
      return `${p.brand} ${p.model}`.trim();
    }
    case 'case': {
      const c = item as RefPcCase;
      return `${c.brand} ${c.model}`.trim();
    }
    case 'cooler': {
      const c = item as RefCooler;
      return `${c.brand} ${c.model}`.trim();
    }
    case 'wifi_card': {
      const w = item as RefWifiCard;
      return `${w.brand} ${w.model}`.trim();
    }
  }
}

export function formatReferenceItemSubtitle<K extends ReferenceCategory>(
  category: K,
  item: ReferenceItemMap[K],
): string {
  switch (category as ReferenceCategory) {
    case 'cpu': {
      const c = item as RefCpu;
      return [
        c.cores ? `${c.cores}C/${c.threads ?? c.cores}T` : null,
        c.base_clock_ghz ? `${c.base_clock_ghz} GHz` : null,
        c.socket,
        c.codename,
        c.tdp_w ? `${c.tdp_w}W` : null,
      ]
        .filter(Boolean)
        .join(' · ');
    }
    case 'gpu': {
      const g = item as RefGpu;
      return [
        g.vram_gb !== null ? `${g.vram_gb} GB ${g.vram_type ?? ''}`.trim() : null,
        g.architecture,
        g.directx_version
          ? `DX ${g.directx_version}${g.directx_feature_level ? ` (${g.directx_feature_level})` : ''}`
          : null,
        g.tdp_w ? `${g.tdp_w}W` : null,
      ]
        .filter(Boolean)
        .join(' · ');
    }
    case 'gpu_card': {
      const gc = item as RefGpuCard;
      return [
        gc.chipset,
        gc.cooling_type,
        gc.length_mm ? `${gc.length_mm} mm` : null,
        gc.part_number,
      ]
        .filter(Boolean)
        .join(' · ');
    }
    case 'motherboard': {
      const m = item as RefMotherboard;
      return [m.socket, m.chipset, m.form_factor, m.memory_type]
        .filter(Boolean)
        .join(' · ');
    }
    case 'ram_kit': {
      const r = item as RefRamKit;
      return [
        r.capacity_gb ? `${r.capacity_gb} GB` : null,
        r.modules_count && r.capacity_gb
          ? `${r.modules_count}x${Math.round(r.capacity_gb / r.modules_count)}GB`
          : r.modules_count
            ? `${r.modules_count}x`
            : null,
        r.ram_type,
        r.speed_mhz ? `${r.speed_mhz} MHz` : null,
        r.is_mobile ? 'SO-DIMM' : null,
      ]
        .filter(Boolean)
        .join(' · ');
    }
    case 'storage_drive_model': {
      const s = item as RefStorageDriveModel;
      return [
        s.capacity_gb
          ? s.capacity_gb >= 1000 && s.capacity_gb % 1000 === 0
            ? `${s.capacity_gb / 1000} TB`
            : `${s.capacity_gb} GB`
          : null,
        s.form_factor,
        s.nand_type,
        s.read_mb_s ? `${s.read_mb_s} MB/s` : null,
      ]
        .filter(Boolean)
        .join(' · ');
    }
    case 'psu': {
      const p = item as RefPsu;
      return [
        p.wattage ? `${p.wattage}W` : null,
        p.efficiency_rating,
        p.modular,
      ]
        .filter(Boolean)
        .join(' · ');
    }
    case 'case': {
      const c = item as RefPcCase;
      return [
        c.form_factor,
        c.color,
        c.max_gpu_length_mm ? `Max GPU ${c.max_gpu_length_mm} mm` : null,
      ]
        .filter(Boolean)
        .join(' · ');
    }
    case 'cooler': {
      const c = item as RefCooler;
      return [
        c.cooler_type,
        c.fan_size_mm ? `${c.fan_size_mm} mm` : null,
      ]
        .filter(Boolean)
        .join(' · ');
    }
    case 'wifi_card': {
      const w = item as RefWifiCard;
      return [
        w.wifi_standard,
        w.bluetooth_version ? `BT ${w.bluetooth_version}` : null,
        w.form_factor,
      ]
        .filter(Boolean)
        .join(' · ');
    }
  }
}

export function formatReferenceSourceBadge(src?: string | null): string {
  if (!src) return 'Catalog';
  const tags = src.split('+');
  if (tags.length > 1) return 'Merged';
  switch (tags[0]) {
    case 'dbgpu':
      return 'dbgpu';
    case 'rn':
      return 'RightNow';
    case 'bc':
      return 'BuildCores';
    case 'dx':
      return 'PC Part DB';
    default:
      return tags[0];
  }
}

function buildSearchExtra<K extends ReferenceCategory>(
  category: K,
  item: ReferenceItemMap[K],
): string {
  switch (category as ReferenceCategory) {
    case 'cpu': {
      const c = item as RefCpu;
      return [c.socket, c.codename].filter(Boolean).join(' ');
    }
    case 'gpu': {
      const g = item as RefGpu;
      return [g.architecture, g.vram_gb ? `${g.vram_gb}gb` : null]
        .filter(Boolean)
        .join(' ');
    }
    case 'gpu_card': {
      const gc = item as RefGpuCard;
      return [gc.chipset, gc.part_number].filter(Boolean).join(' ');
    }
    case 'motherboard': {
      const m = item as RefMotherboard;
      return [m.socket, m.chipset, m.form_factor].filter(Boolean).join(' ');
    }
    case 'ram_kit': {
      const r = item as RefRamKit;
      return [
        r.capacity_gb ? `${r.capacity_gb}gb` : null,
        r.ram_type,
        r.speed_mhz ? `${r.speed_mhz}` : null,
      ]
        .filter(Boolean)
        .join(' ');
    }
    case 'storage_drive_model': {
      const s = item as RefStorageDriveModel;
      return [
        s.model_number,
        s.capacity_gb ? `${s.capacity_gb}gb` : null,
        s.form_factor,
      ]
        .filter(Boolean)
        .join(' ');
    }
    case 'psu': {
      const p = item as RefPsu;
      return [p.wattage ? `${p.wattage}w` : null, p.efficiency_rating]
        .filter(Boolean)
        .join(' ');
    }
    case 'case': {
      const c = item as RefPcCase;
      return [c.form_factor, c.color].filter(Boolean).join(' ');
    }
    case 'cooler': {
      const c = item as RefCooler;
      return [c.cooler_type, c.socket_support].filter(Boolean).join(' ');
    }
    case 'wifi_card': {
      const w = item as RefWifiCard;
      return [w.wifi_standard, w.form_factor].filter(Boolean).join(' ');
    }
  }
}

function decodeCatalogFile<K extends ReferenceCategory>(
  category: K,
  data: CompactCatalogFile,
): IndexedEntry<ReferenceItemMap[K]>[] {
  const { fields, rows } = data;
  const entries: IndexedEntry<ReferenceItemMap[K]>[] = [];

  for (const row of rows) {
    const obj: Record<string, unknown> = {};
    let richness = 0;
    for (let i = 0; i < fields.length; i += 1) {
      const val = i < row.length ? row[i] : null;
      const normalizedVal =
        val === undefined
          ? fields[i] === 'is_mobile'
            ? false
            : null
          : val;
      obj[fields[i]] = normalizedVal;
      if (
        normalizedVal !== null &&
        normalizedVal !== undefined &&
        normalizedVal !== '' &&
        fields[i] !== 'src'
      ) {
        richness += 1;
      }
    }

    const typed = obj as unknown as ReferenceItemMap[K];
    const title = formatReferenceItemTitle(category, typed);
    const extra = buildSearchExtra(category, typed);
    const titleNorm = normalizeText(title);
    const titleCompact = compactText(title);
    const searchNorm = normalizeText(`${title} ${extra}`);
    const searchCompact = compactText(`${title} ${extra}`);

    entries.push({
      item: typed,
      titleNorm,
      titleCompact,
      searchNorm,
      searchCompact,
      richness,
    });
  }

  return entries;
}

async function loadIndexedCatalog<K extends ReferenceCategory>(
  category: K,
): Promise<IndexedEntry<ReferenceItemMap[K]>[]> {
  let promise = catalogCache.get(category);
  if (!promise) {
    const file = CATEGORY_FILES[category];
    const base = import.meta.env.BASE_URL || './';
    const url = `${base.endsWith('/') ? base : `${base}/`}catalog/${file}`;
    promise = fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to load ${file} (HTTP ${res.status})`);
        }
        const json = (await res.json()) as CompactCatalogFile;
        return decodeCatalogFile(category, json);
      })
      .catch((err) => {
        catalogCache.delete(category);
        throw err;
      });
    catalogCache.set(
      category,
      promise as Promise<IndexedEntry<ReferenceItem>[]>,
    );
  }
  return promise as Promise<IndexedEntry<ReferenceItemMap[K]>[]>;
}

export async function loadReferenceCatalog<K extends ReferenceCategory>(
  category: K,
): Promise<ReferenceItemMap[K][]> {
  const entries = await loadIndexedCatalog(category);
  return entries.map((e) => e.item);
}

export async function searchReferenceCatalog<K extends ReferenceCategory>(
  category: K,
  query: string,
  options?: {
    limit?: number;
    vendor?: string;
    hideMobile?: boolean;
  },
): Promise<ReferenceItemMap[K][]> {
  const entries = await loadIndexedCatalog(category);
  const limit = options?.limit ?? 12;
  const vendor = options?.vendor && options.vendor !== 'Auto'
    ? options.vendor.toLowerCase()
    : null;
  const hideMobile = Boolean(options?.hideMobile);

  const normQ = normalizeText(query);
  const compactQ = compactText(query);
  const tokens = normQ ? normQ.split(/\s+/).filter(Boolean) : [];

  const scored: Array<{ entry: IndexedEntry<ReferenceItemMap[K]>; score: number }> =
    [];

  for (const entry of entries) {
    const item = entry.item as unknown as Record<string, unknown>;
    if (vendor) {
      const b = String(item.brand ?? '').toLowerCase();
      if (b !== vendor) continue;
    }
    if (hideMobile && item.is_mobile === true) continue;

    if (tokens.length === 0) {
      scored.push({ entry, score: entry.richness * 3 });
      continue;
    }

    let matchedAll = true;
    for (const tok of tokens) {
      const tokCompact = compactText(tok);
      if (
        !entry.searchNorm.includes(tok) &&
        (!tokCompact || !entry.searchCompact.includes(tokCompact))
      ) {
        matchedAll = false;
        break;
      }
    }
    if (!matchedAll) continue;

    let score = entry.richness * 3;
    if (entry.titleNorm === normQ || entry.titleCompact === compactQ) {
      score += 1000;
    } else if (entry.titleNorm.startsWith(normQ)) {
      score += 500;
    } else if (compactQ && entry.titleCompact.startsWith(compactQ)) {
      score += 400;
    } else if (entry.titleNorm.includes(normQ)) {
      score += 200;
    }

    const titleWords = new Set(entry.titleNorm.split(' '));
    for (const tok of tokens) {
      if (titleWords.has(tok)) score += 60;
      else if (entry.titleNorm.includes(tok)) score += 25;
    }

    score -= Math.min(40, Math.floor(entry.titleNorm.length / 4));
    scored.push({ entry, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.entry.titleNorm.localeCompare(b.entry.titleNorm);
  });

  return scored.slice(0, limit).map((s) => s.entry.item);
}

function normalizeGpuSiliconName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b(nvidia|amd|ati|intel)\b/g, ' ')
    .replace(/\b(\d+)\s*gb\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '');
}

export function matchCanonicalGpuChip(
  chipsetName: string | null | undefined,
  gpus: Gpu[],
): Gpu | null {
  if (!chipsetName || !chipsetName.trim()) return null;
  const target = normalizeGpuSiliconName(chipsetName);
  if (!target) return null;

  const exact = gpus.find(
    (g) =>
      normalizeGpuSiliconName(`${g.brand} ${g.name}`) === target ||
      normalizeGpuSiliconName(g.name) === target,
  );
  if (exact) return exact;

  // Allow prefix/contains match if one has "ti" / "super" / "xt" alignment
  return (
    gpus.find((g) => {
      const gn = normalizeGpuSiliconName(g.name);
      return gn === target || (target.length >= 6 && gn.includes(target));
    }) ?? null
  );
}

export async function findReferenceGpuForChipset(
  chipsetName: string,
): Promise<RefGpu | null> {
  if (!chipsetName.trim()) return null;
  const entries = await loadIndexedCatalog('gpu');
  const target = normalizeGpuSiliconName(chipsetName);
  if (!target) return null;

  for (const entry of entries) {
    const g = entry.item;
    if (
      normalizeGpuSiliconName(g.name) === target ||
      normalizeGpuSiliconName(`${g.brand} ${g.name}`) === target
    ) {
      return g;
    }
  }

  const results = await searchReferenceCatalog('gpu', chipsetName, { limit: 1 });
  return results[0] ?? null;
}
