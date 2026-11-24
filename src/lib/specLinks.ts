import type {
  ComputerPartLinkSlot,
  Cpu,
  Gpu,
  PartSpecLinkEntry,
  PartSpecLinksMap,
  SpecLinkItem,
  StorageDrive,
} from '../types/database';
import { buildPassMarkSearchUrl } from './scoring';

export interface ParsedHttpUrl {
  valid: boolean;
  normalizedUrl: string | null;
  error: string | null;
}

export interface ResolvedResearchLink {
  label: string;
  url: string;
  isFallback: boolean;
  host: string;
}

const VALID_SLOTS: readonly ComputerPartLinkSlot[] = [
  'gpu_aib',
  'motherboard',
  'laptop',
  'wifi',
  'psu',
  'ram',
] as const;

const INVALID_HTTP_URL_ERROR =
  'URL must start with http:// or https:// and contain no spaces.';

export function parseHttpUrl(raw: string): ParsedHttpUrl {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: true, normalizedUrl: null, error: null };
  }
  if (/\s/.test(trimmed)) {
    return { valid: false, normalizedUrl: null, error: INVALID_HTTP_URL_ERROR };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, normalizedUrl: null, error: INVALID_HTTP_URL_ERROR };
  }

  if (
    (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
    parsed.username !== '' ||
    parsed.password !== ''
  ) {
    return { valid: false, normalizedUrl: null, error: INVALID_HTTP_URL_ERROR };
  }

  return { valid: true, normalizedUrl: parsed.toString(), error: null };
}

export function getSafeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const parsed = parseHttpUrl(url);
  return parsed.valid ? parsed.normalizedUrl : null;
}

export function sanitizeSpecLinks(raw: unknown): SpecLinkItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: SpecLinkItem[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const rawLabel = typeof rec.label === 'string' ? rec.label.trim() : '';
    const rawUrl = typeof rec.url === 'string' ? rec.url : '';
    const safeUrl = getSafeHttpUrl(rawUrl);
    if (!rawLabel || !safeUrl || seen.has(safeUrl)) continue;
    seen.add(safeUrl);
    out.push({ label: rawLabel, url: safeUrl });
  }

  return out;
}

export function sanitizePartSpecLinks(raw: unknown): PartSpecLinksMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const record = raw as Record<string, unknown>;
  const out: PartSpecLinksMap = {};

  for (const slot of VALID_SLOTS) {
    const val = record[slot];
    if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
    const entry = val as Record<string, unknown>;
    const specUrl =
      typeof entry.spec_url === 'string' ? getSafeHttpUrl(entry.spec_url) : null;
    const links = sanitizeSpecLinks(entry.links);
    if (specUrl || links.length > 0) {
      out[slot] = {
        ...(specUrl ? { spec_url: specUrl } : {}),
        ...(links.length > 0 ? { links } : {}),
      };
    }
  }

  return out;
}

export function formatUrlHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

export function isSearchFallbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const path = parsed.pathname.toLowerCase();
    const search = parsed.search.toLowerCase();

    if (host.endsWith('google.com') && path.includes('/search')) return true;
    if (host.endsWith('bing.com') && path.includes('/search')) return true;
    if (host === 'duckduckgo.com') return true;
    if (host.endsWith('intel.com') && path.includes('/ark/search.html')) return true;
    if (host.endsWith('amd.com') && (path.includes('site-search.html') || path.includes('/search'))) {
      return true;
    }
    if (
      host.endsWith('techpowerup.com') &&
      (parsed.searchParams.has('q') || parsed.searchParams.has('ajaxsrch'))
    ) {
      return true;
    }
    if (
      host.endsWith('theretroweb.com') &&
      (parsed.searchParams.has('name') || parsed.searchParams.has('q'))
    ) {
      return true;
    }
    if (
      host.endsWith('notebookcheck.net') &&
      (parsed.searchParams.has('s') || search.includes('search='))
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function inferSourceLabel(
  url: string,
  fallback = 'Specifications',
): string {
  const host = formatUrlHost(url);
  const isSearch = isSearchFallbackUrl(url);

  if (host.endsWith('intel.com')) {
    return isSearch ? 'Intel ARK Search' : 'Intel ARK';
  }
  if (host.endsWith('amd.com')) {
    return isSearch ? 'AMD Official Search' : 'AMD Official';
  }
  if (host.endsWith('nvidia.com')) {
    return 'NVIDIA Official';
  }
  if (host.endsWith('techpowerup.com')) {
    const lower = url.toLowerCase();
    if (lower.includes('/gpu-specs')) {
      return isSearch ? 'TechPowerUp GPU Search' : 'TechPowerUp GPU DB';
    }
    if (lower.includes('/cpu-specs')) {
      return isSearch ? 'TechPowerUp CPU Search' : 'TechPowerUp CPU DB';
    }
    if (lower.includes('/ssd-specs')) {
      return isSearch ? 'TechPowerUp SSD Search' : 'TechPowerUp SSD DB';
    }
    return 'TechPowerUp';
  }
  if (host.endsWith('cpubenchmark.net')) return 'PassMark CPU Mark';
  if (host.endsWith('videocardbenchmark.net')) return 'PassMark G3D Mark';
  if (host.endsWith('theretroweb.com')) {
    return isSearch ? 'The Retro Web Search' : 'The Retro Web';
  }
  if (host.endsWith('notebookcheck.net')) {
    return isSearch ? 'Notebookcheck Search' : 'Notebookcheck';
  }
  if (host.endsWith('asus.com')) return 'ASUS Datasheet';
  if (host.endsWith('gigabyte.com')) return 'GIGABYTE Datasheet';
  if (host.endsWith('evga.com')) return 'EVGA Datasheet';
  if (host.endsWith('msi.com')) return 'MSI Datasheet';
  if (host.endsWith('sapphiretech.com')) return 'Sapphire Datasheet';
  if (host.endsWith('powercolor.com')) return 'PowerColor Datasheet';
  if (host.endsWith('dell.com')) return 'Dell Support';
  if (host.endsWith('hp.com')) return 'HP Support';
  if (host.endsWith('lenovo.com')) return 'Lenovo Support';
  if (host.endsWith('adata.com')) return 'ADATA Datasheet';
  if (host.endsWith('samsung.com')) return 'Samsung Datasheet';

  if (host.endsWith('google.com')) {
    try {
      const q = (new URL(url).searchParams.get('q') ?? '').toLowerCase();
      if (q.includes('site:cpubenchmark.net')) return 'PassMark CPU Search';
      if (q.includes('site:videocardbenchmark.net')) return 'PassMark G3D Search';
      if (q.includes('site:techpowerup.com')) return 'TechPowerUp Search';
      if (q.includes('site:theretroweb.com')) return 'The Retro Web Search';
      if (q.includes('site:notebookcheck.net')) return 'Notebookcheck Search';
      return 'Web Search';
    } catch {
      return 'Web Search';
    }
  }

  return fallback || host || 'Specifications';
}

class LinksAccumulator {
  private readonly items: ResolvedResearchLink[] = [];
  private readonly seenUrls = new Set<string>();

  push(rawUrl: string | null | undefined, label?: string): void {
    const safeUrl = getSafeHttpUrl(rawUrl);
    if (!safeUrl || this.seenUrls.has(safeUrl)) return;
    this.seenUrls.add(safeUrl);
    const isFallback = isSearchFallbackUrl(safeUrl);
    const host = formatUrlHost(safeUrl);
    this.items.push({
      label: label?.trim() || inferSourceLabel(safeUrl),
      url: safeUrl,
      isFallback,
      host,
    });
  }

  pushEntry(
    specUrl: string | null | undefined,
    extraLinks: SpecLinkItem[] | undefined,
    primaryFallbackLabel?: string,
  ): void {
    if (specUrl) {
      const safe = getSafeHttpUrl(specUrl);
      if (safe) {
        this.push(safe, inferSourceLabel(safe, primaryFallbackLabel));
      }
    }
    if (extraLinks) {
      for (const link of extraLinks) {
        this.push(link.url, link.label);
      }
    }
  }

  hasDirectDomain(domainSuffix: string): boolean {
    const target = domainSuffix.toLowerCase();
    return this.items.some(
      (item) =>
        !item.isFallback &&
        (item.host === target || item.host.endsWith(`.${target}`)),
    );
  }

  hasAnyDirectLink(): boolean {
    return this.items.some((item) => !item.isFallback);
  }

  get result(): ResolvedResearchLink[] {
    return this.items;
  }
}

export function buildGoogleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query.trim())}`;
}

export function buildCpuResearchLinks(
  cpu: Pick<Cpu, 'brand' | 'name' | 'spec_url' | 'spec_links'>,
): ResolvedResearchLink[] {
  const acc = new LinksAccumulator();
  acc.pushEntry(cpu.spec_url, cpu.spec_links, `${cpu.brand} Official`);

  const fullName = `${cpu.brand} ${cpu.name}`.trim();
  const brandLower = cpu.brand.toLowerCase();

  if (brandLower.includes('intel') && !acc.hasDirectDomain('intel.com')) {
    acc.push(
      `https://www.intel.com/content/www/us/en/ark/search.html?_charset_=UTF-8&q=${encodeURIComponent(cpu.name.trim())}`,
      'Intel ARK Search',
    );
  } else if (brandLower.includes('amd') && !acc.hasDirectDomain('amd.com')) {
    acc.push(
      `https://www.amd.com/en/search/site-search.html#q=${encodeURIComponent(cpu.name.trim())}`,
      'AMD Official Search',
    );
  }

  if (!acc.hasDirectDomain('techpowerup.com')) {
    acc.push(
      `https://www.techpowerup.com/cpu-specs/?q=${encodeURIComponent(fullName)}`,
      'TechPowerUp CPU DB',
    );
  }

  if (!acc.hasDirectDomain('cpubenchmark.net')) {
    acc.push(
      buildPassMarkSearchUrl('cpu', cpu.brand, cpu.name),
      'PassMark CPU Page',
    );
  }

  return acc.result;
}

export interface GpuAibContext {
  manufacturer?: string | null;
  model?: string | null;
  savedEntry?: PartSpecLinkEntry | null;
}

export function buildGpuResearchLinks(
  gpu: Pick<Gpu, 'brand' | 'name' | 'is_mobile' | 'spec_url' | 'spec_links'>,
  aib?: GpuAibContext,
): ResolvedResearchLink[] {
  const acc = new LinksAccumulator();
  acc.pushEntry(gpu.spec_url, gpu.spec_links, 'TechPowerUp GPU DB');

  const aibLabelText = [aib?.manufacturer, aib?.model].filter(Boolean).join(' ').trim();
  if (aib?.savedEntry) {
    const savedAibUrl = getSafeHttpUrl(aib.savedEntry.spec_url);
    if (savedAibUrl) {
      acc.push(
        savedAibUrl,
        aibLabelText
          ? `${aibLabelText} (${inferSourceLabel(savedAibUrl, 'Datasheet')})`
          : inferSourceLabel(savedAibUrl, 'AIB Board Datasheet'),
      );
    }
    for (const extra of aib.savedEntry.links ?? []) {
      acc.push(extra.url, extra.label);
    }
  } else if (aibLabelText) {
    acc.push(
      buildGoogleSearchUrl(`${aibLabelText} ${gpu.name} specifications`),
      `${aibLabelText} Datasheet`,
    );
  }

  const fullName = `${gpu.brand} ${gpu.name}${gpu.is_mobile ? ' Mobile' : ''}`.trim();
  if (!acc.hasDirectDomain('techpowerup.com')) {
    acc.push(
      `https://www.techpowerup.com/gpu-specs/?q=${encodeURIComponent(fullName)}`,
      'TechPowerUp GPU DB',
    );
  }

  if (!acc.hasDirectDomain('videocardbenchmark.net')) {
    acc.push(
      buildPassMarkSearchUrl('gpu', gpu.brand, gpu.name),
      'PassMark G3D Page',
    );
  }

  return acc.result;
}

export function buildAibGpuResearchLinks(
  gpu: Pick<Gpu, 'brand' | 'name' | 'spec_url'> | null | undefined,
  aibManufacturer: string | null | undefined,
  aibModel: string | null | undefined,
  savedEntry?: PartSpecLinkEntry | null,
): ResolvedResearchLink[] {
  const aibName = [aibManufacturer, aibModel].filter(Boolean).join(' ').trim();
  const hasSaved = Boolean(savedEntry?.spec_url || (savedEntry?.links?.length ?? 0) > 0);
  if (!aibName && !hasSaved) return [];

  const acc = new LinksAccumulator();
  if (savedEntry) {
    acc.pushEntry(
      savedEntry.spec_url,
      savedEntry.links,
      aibName ? `${aibName} Datasheet` : 'Board Partner Datasheet',
    );
  }

  if (aibName && !acc.hasAnyDirectLink()) {
    const query = [aibName, gpu ? `${gpu.brand} ${gpu.name}` : null, 'specifications']
      .filter(Boolean)
      .join(' ');
    acc.push(buildGoogleSearchUrl(query), `${aibName} Datasheet`);
  }

  if (gpu?.spec_url) {
    acc.push(gpu.spec_url, `${gpu.brand} ${gpu.name} Chip Spec`);
  }

  return acc.result;
}

export function buildMotherboardResearchLinks(
  brand: string | null | undefined,
  name: string | null | undefined,
  launch?: string | null,
  savedEntry?: PartSpecLinkEntry | null,
): ResolvedResearchLink[] {
  const fullName = [brand, name].filter(Boolean).join(' ').trim();
  const hasSaved = Boolean(savedEntry?.spec_url || (savedEntry?.links?.length ?? 0) > 0);
  if (!fullName && !hasSaved) return [];

  const acc = new LinksAccumulator();
  if (savedEntry) {
    acc.pushEntry(savedEntry.spec_url, savedEntry.links, 'Motherboard Specs');
  }

  if (fullName && !acc.hasAnyDirectLink()) {
    acc.push(
      buildGoogleSearchUrl(`${fullName} motherboard specifications`),
      `${brand?.trim() || 'Manufacturer'} Product Page`,
    );
  }

  const retroQuery = (name || brand || '').trim();
  if (retroQuery && !acc.hasDirectDomain('theretroweb.com')) {
    const yearHint = launch ? launch.slice(0, 4) : '';
    const isLikelyLegacy = !yearHint || Number(yearHint) <= 2016;
    if (isLikelyLegacy || !acc.hasAnyDirectLink()) {
      acc.push(
        `https://theretroweb.com/motherboards/?name=${encodeURIComponent(retroQuery)}`,
        'The Retro Web',
      );
    } else {
      acc.push(
        `https://theretroweb.com/motherboards/?name=${encodeURIComponent(retroQuery)}`,
        'The Retro Web',
      );
    }
  }

  return acc.result;
}

export function buildStorageDriveResearchLinks(
  drive: Pick<
    StorageDrive,
    | 'brand'
    | 'model'
    | 'model_number'
    | 'capacity_gb'
    | 'form_factor'
    | 'spec_url'
    | 'spec_links'
  >,
): ResolvedResearchLink[] {
  const identity = [drive.brand, drive.model_number || drive.model]
    .filter(Boolean)
    .join(' ')
    .trim();
  const hasSaved = Boolean(drive.spec_url || (drive.spec_links?.length ?? 0) > 0);
  if (!identity && !hasSaved) return [];

  const acc = new LinksAccumulator();
  acc.pushEntry(drive.spec_url, drive.spec_links, 'Manufacturer Datasheet');

  if (identity && !acc.hasAnyDirectLink()) {
    const query = [
      drive.brand,
      drive.model,
      drive.model_number,
      drive.capacity_gb ? `${drive.capacity_gb}GB` : null,
      'datasheet specifications',
    ]
      .filter(Boolean)
      .join(' ');
    acc.push(buildGoogleSearchUrl(query), `${drive.brand?.trim() || 'Manufacturer'} Datasheet`);
  }

  const tpuQuery = [drive.brand, drive.model].filter(Boolean).join(' ').trim();
  if (tpuQuery && !acc.hasDirectDomain('techpowerup.com')) {
    acc.push(
      `https://www.techpowerup.com/ssd-specs/?q=${encodeURIComponent(tpuQuery)}`,
      'TechPowerUp SSD DB',
    );
  }

  return acc.result;
}

export function buildLaptopResearchLinks(
  brand: string | null | undefined,
  model: string | null | undefined,
  savedEntry?: PartSpecLinkEntry | null,
): ResolvedResearchLink[] {
  const fullName = [brand, model].filter(Boolean).join(' ').trim();
  const hasSaved = Boolean(savedEntry?.spec_url || (savedEntry?.links?.length ?? 0) > 0);
  if (!fullName && !hasSaved) return [];

  const acc = new LinksAccumulator();
  if (savedEntry) {
    acc.pushEntry(savedEntry.spec_url, savedEntry.links, 'Laptop Specs / Review');
  }

  if (fullName && !acc.hasDirectDomain('notebookcheck.net')) {
    acc.push(
      buildGoogleSearchUrl(`site:notebookcheck.net ${fullName}`),
      'Notebookcheck Review',
    );
  }

  if (fullName && !acc.hasAnyDirectLink()) {
    acc.push(
      buildGoogleSearchUrl(`${fullName} specifications support`),
      `${brand?.trim() || 'Manufacturer'} Support`,
    );
  }

  return acc.result;
}

export function buildWifiResearchLinks(
  brand: string | null | undefined,
  product: string | null | undefined,
  model: string | null | undefined,
  savedEntry?: PartSpecLinkEntry | null,
): ResolvedResearchLink[] {
  const fullName = [brand, product, model].filter(Boolean).join(' ').trim();
  const hasSaved = Boolean(savedEntry?.spec_url || (savedEntry?.links?.length ?? 0) > 0);
  if (!fullName && !hasSaved) return [];

  const acc = new LinksAccumulator();
  if (savedEntry) {
    acc.pushEntry(savedEntry.spec_url, savedEntry.links, 'Wireless Adapter Specs');
  }

  const isIntel = (brand ?? '').toLowerCase().includes('intel');
  if (isIntel && !acc.hasDirectDomain('intel.com')) {
    const q = [product, model].filter(Boolean).join(' ').trim() || fullName;
    acc.push(
      `https://www.intel.com/content/www/us/en/ark/search.html?_charset_=UTF-8&q=${encodeURIComponent(q)}`,
      'Intel ARK Search',
    );
  }

  if (fullName && !acc.hasAnyDirectLink()) {
    acc.push(
      buildGoogleSearchUrl(`${fullName} Wi-Fi specifications`),
      `${brand?.trim() || 'Manufacturer'} Datasheet`,
    );
  }

  return acc.result;
}

export function buildPsuResearchLinks(
  brand: string | null | undefined,
  wattage: number | null | undefined,
  savedEntry?: PartSpecLinkEntry | null,
): ResolvedResearchLink[] {
  const fullName = [brand, wattage ? `${wattage}W` : null]
    .filter(Boolean)
    .join(' ')
    .trim();
  const hasSaved = Boolean(savedEntry?.spec_url || (savedEntry?.links?.length ?? 0) > 0);
  if (!fullName && !hasSaved) return [];

  const acc = new LinksAccumulator();
  if (savedEntry) {
    acc.pushEntry(savedEntry.spec_url, savedEntry.links, 'PSU Datasheet');
  }

  if (fullName && !acc.hasAnyDirectLink()) {
    acc.push(
      buildGoogleSearchUrl(`${fullName} PSU power supply specifications`),
      `${brand?.trim() || 'Manufacturer'} Datasheet`,
    );
  }

  return acc.result;
}

export function buildRamResearchLinks(
  savedEntry?: PartSpecLinkEntry | null,
): ResolvedResearchLink[] {
  if (!savedEntry) return [];
  const acc = new LinksAccumulator();
  acc.pushEntry(savedEntry.spec_url, savedEntry.links, 'RAM Kit Specs');
  return acc.result;
}

export type PartLinkPresetKind =
  | 'cpu'
  | 'gpu'
  | 'storage_drive'
  | ComputerPartLinkSlot;

export interface PartLinkPresetConfig {
  title: string;
  labelPresets: string[];
  helperLinks: (query: string) => Array<{ label: string; url: string }>;
}

export const PART_LINK_PRESETS: Record<PartLinkPresetKind, PartLinkPresetConfig> = {
  cpu: {
    title: 'CPU Spec & Research Links',
    labelPresets: ['Intel ARK', 'AMD Official', 'TechPowerUp CPU DB', 'PassMark CPU Mark'],
    helperLinks: (q) => [
      {
        label: 'Intel ARK',
        url: `https://www.intel.com/content/www/us/en/ark/search.html?_charset_=UTF-8&q=${encodeURIComponent(q)}`,
      },
      {
        label: 'TechPowerUp CPU DB',
        url: `https://www.techpowerup.com/cpu-specs/?q=${encodeURIComponent(q)}`,
      },
      {
        label: 'PassMark CPU',
        url: buildGoogleSearchUrl(`site:cpubenchmark.net ${q}`),
      },
    ],
  },
  gpu: {
    title: 'GPU Spec & Research Links',
    labelPresets: ['TechPowerUp GPU DB', 'NVIDIA Official', 'AMD Official', 'PassMark G3D Mark'],
    helperLinks: (q) => [
      {
        label: 'TechPowerUp GPU DB',
        url: `https://www.techpowerup.com/gpu-specs/?q=${encodeURIComponent(q)}`,
      },
      {
        label: 'PassMark G3D',
        url: buildGoogleSearchUrl(`site:videocardbenchmark.net ${q}`),
      },
    ],
  },
  storage_drive: {
    title: 'Storage Drive Links',
    labelPresets: ['Manufacturer Datasheet', 'TechPowerUp SSD DB', 'Support Page'],
    helperLinks: (q) => [
      {
        label: 'TechPowerUp SSD DB',
        url: `https://www.techpowerup.com/ssd-specs/?q=${encodeURIComponent(q)}`,
      },
      {
        label: 'Search Datasheet',
        url: buildGoogleSearchUrl(`${q} SSD datasheet specifications`),
      },
    ],
  },
  gpu_aib: {
    title: 'GPU Board Partner (AIB) Links',
    labelPresets: ['Board Partner Datasheet', 'TechPowerUp AIB', 'Support / BIOS'],
    helperLinks: (q) => [
      {
        label: 'Search AIB Specs',
        url: buildGoogleSearchUrl(`${q} graphics card specifications`),
      },
    ],
  },
  motherboard: {
    title: 'Motherboard Links',
    labelPresets: ['Manufacturer Page', 'The Retro Web', 'Manual / Support'],
    helperLinks: (q) => [
      {
        label: 'The Retro Web',
        url: `https://theretroweb.com/motherboards/?name=${encodeURIComponent(q)}`,
      },
      {
        label: 'Search Product Page',
        url: buildGoogleSearchUrl(`${q} motherboard specifications`),
      },
    ],
  },
  laptop: {
    title: 'Laptop Links',
    labelPresets: ['Notebookcheck Review', 'Manufacturer Specs', 'Support / Drivers'],
    helperLinks: (q) => [
      {
        label: 'Notebookcheck',
        url: buildGoogleSearchUrl(`site:notebookcheck.net ${q}`),
      },
      {
        label: 'Search Official Specs',
        url: buildGoogleSearchUrl(`${q} specifications support`),
      },
    ],
  },
  wifi: {
    title: 'Wi-Fi Adapter Links',
    labelPresets: ['Intel ARK', 'Manufacturer Datasheet', 'Drivers'],
    helperLinks: (q) => [
      {
        label: 'Intel ARK',
        url: `https://www.intel.com/content/www/us/en/ark/search.html?_charset_=UTF-8&q=${encodeURIComponent(q)}`,
      },
      {
        label: 'Search Wi-Fi Specs',
        url: buildGoogleSearchUrl(`${q} wireless adapter specifications`),
      },
    ],
  },
  psu: {
    title: 'Power Supply (PSU) Links',
    labelPresets: ['Manufacturer Datasheet', 'Cybenetics / 80 PLUS', 'Review'],
    helperLinks: (q) => [
      {
        label: 'Search PSU Specs',
        url: buildGoogleSearchUrl(`${q} power supply specifications`),
      },
    ],
  },
  ram: {
    title: 'RAM Kit Links',
    labelPresets: ['Manufacturer Datasheet', 'QVL / Specs', 'Product Page'],
    helperLinks: (q) => [
      {
        label: 'Search RAM Specs',
        url: buildGoogleSearchUrl(`${q} RAM memory specifications`),
      },
    ],
  },
};

export const COMPUTER_SLOT_META: Record<
  ComputerPartLinkSlot,
  { label: string; placeholder: string }
> = {
  gpu_aib: {
    label: 'GPU Board Partner (AIB)',
    placeholder: 'https://www.asus.com/... or https://www.gigabyte.com/...',
  },
  motherboard: {
    label: 'Motherboard',
    placeholder: 'https://rog.asus.com/... or https://theretroweb.com/motherboards/...',
  },
  laptop: {
    label: 'Laptop Model / Review',
    placeholder: 'https://www.notebookcheck.net/... or OEM product page',
  },
  wifi: {
    label: 'Wi-Fi Adapter',
    placeholder: 'https://www.intel.com/content/www/us/en/products/sku/...',
  },
  psu: {
    label: 'Power Supply (PSU)',
    placeholder: 'https://www.evga.com/... or manufacturer datasheet URL',
  },
  ram: {
    label: 'Memory (RAM Kit)',
    placeholder: 'https://... (optional RAM kit datasheet URL)',
  },
};
