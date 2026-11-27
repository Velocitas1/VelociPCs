import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type LookupPartType =
  | "cpu"
  | "gpu"
  | "gpu_aib"
  | "motherboard"
  | "ram"
  | "storage_drive"
  | "psu"
  | "case"
  | "cooler"
  | "wifi"
  | "laptop";

interface LookupRequest {
  query?: string;
  partType?: LookupPartType;
  brand?: string;
  vendor?: "Intel" | "AMD" | "NVIDIA" | "Auto";
  slots?: string[];
}

export interface SpecLinkItem {
  label: string;
  url: string;
}

export interface LinkCandidate {
  url: string;
  title: string;
  source: string;
  confidence: "high" | "medium";
  passmark_score?: number | null;
}

export interface SlotLookupResult {
  slotId: string;
  label: string;
  status: "found" | "ambiguous" | "not_found";
  bestUrl: string | null;
  bestTitle?: string | null;
  confidence?: "high" | "medium";
  source?: string | null;
  candidates: LinkCandidate[];
}

export interface HardwareLookupResult {
  partType: "cpu" | "gpu";
  name: string;
  brand: string;
  spec_url: string;
  spec_links?: SpecLinkItem[];
  source: "catalog" | "live" | "hybrid";
  confidence: "high" | "medium";
  // CPU fields
  codename?: string | null;
  socket?: string | null;
  base_clock_ghz?: number | null;
  turbo_clock_ghz?: number | null;
  cache_mb?: number | null;
  cores?: number | null;
  threads?: number | null;
  tdp_w?: number | null;
  process_nm?: number | null;
  max_memory_gb?: number | null;
  memory_type?: string | null;
  memory_speed_mhz?: number | null;
  launch_date?: string | null;
  is_mobile?: boolean;
  // GPU fields
  architecture?: string | null;
  vram_gb?: number | null;
  vram_type?: string | null;
  bus_interface?: string | null;
  directx_version?: string | null;
  directx_feature_level?: string | null;
  category?: string | null;
  passmark_score?: number | null;
  summary?: string | null;
}

const CACHE_TTL_MS = 60 * 60 * 1000;

interface SlimDbGpu {
  brand: string;
  name: string;
  tokens: string[];
  architecture: string | null;
  vram_gb: number | null;
  vram_type: string | null;
  bus_interface: string | null;
  process_nm: number | null;
  tdp_w: number | null;
  directx_version: string | null;
  is_mobile: boolean;
  tpu_url: string | null;
}

interface PassMarkEntry {
  name: string;
  tokens: string[];
  url: string;
  score: number | null;
}

let dbgpuCache: { expiresAt: number; items: SlimDbGpu[] } | null = null;
let passmarkCpuCache: { expiresAt: number; items: PassMarkEntry[] } | null = null;
let passmarkGpuCache: { expiresAt: number; items: PassMarkEntry[] } | null = null;

function sanitizeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.username !== "" ||
      parsed.password !== ""
    ) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function dedupeSpecLinks(
  primaryUrl: string,
  links: Array<{ label: string; url: string | null | undefined }>,
): SpecLinkItem[] {
  const seen = new Set<string>();
  const primarySafe = sanitizeHttpUrl(primaryUrl);
  if (primarySafe) seen.add(primarySafe);

  const out: SpecLinkItem[] = [];
  for (const link of links) {
    const label = link.label.trim();
    const safeUrl = sanitizeHttpUrl(link.url);
    if (!label || !safeUrl || seen.has(safeUrl)) continue;
    seen.add(safeUrl);
    out.push({ label, url: safeUrl });
  }
  return out;
}

const CPU_CATALOG: HardwareLookupResult[] = [
  {
    partType: "cpu",
    name: "Core i9-14900K",
    brand: "Intel",
    codename: "Raptor Lake Refresh",
    socket: "LGA1700",
    base_clock_ghz: 3.2,
    turbo_clock_ghz: 6.0,
    cache_mb: 36,
    cores: 24,
    threads: 32,
    tdp_w: 125,
    process_nm: 10,
    max_memory_gb: 192,
    memory_type: "DDR5 / DDR4",
    memory_speed_mhz: 5600,
    launch_date: "2023.Q4",
    is_mobile: false,
    passmark_score: 58141,
    spec_url:
      "https://www.intel.com/content/www/us/en/products/sku/236773/intel-core-i9-processor-14900k-36m-cache-up-to-6-00-ghz/specifications.html",
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "cpu",
    name: "Core i7-14700K",
    brand: "Intel",
    codename: "Raptor Lake Refresh",
    socket: "LGA1700",
    base_clock_ghz: 3.4,
    turbo_clock_ghz: 5.6,
    cache_mb: 33,
    cores: 20,
    threads: 28,
    tdp_w: 125,
    process_nm: 10,
    max_memory_gb: 192,
    memory_type: "DDR5 / DDR4",
    memory_speed_mhz: 5600,
    launch_date: "2023.Q4",
    is_mobile: false,
    passmark_score: 51884,
    spec_url:
      "https://www.intel.com/content/www/us/en/products/sku/236783/intel-core-i7-processor-14700k-33m-cache-up-to-5-60-ghz/specifications.html",
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "cpu",
    name: "Core i5-13600K",
    brand: "Intel",
    codename: "Raptor Lake",
    socket: "LGA1700",
    base_clock_ghz: 3.5,
    turbo_clock_ghz: 5.1,
    cache_mb: 24,
    cores: 14,
    threads: 20,
    tdp_w: 125,
    process_nm: 10,
    max_memory_gb: 128,
    memory_type: "DDR5 / DDR4",
    memory_speed_mhz: 5600,
    launch_date: "2022.Q4",
    is_mobile: false,
    passmark_score: 37426,
    spec_url:
      "https://www.intel.com/content/www/us/en/products/sku/230493/intel-core-i513600k-processor-24m-cache-up-to-5-10-ghz/specifications.html",
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "cpu",
    name: "Core i5-12400F",
    brand: "Intel",
    codename: "Alder Lake",
    socket: "LGA1700",
    base_clock_ghz: 2.5,
    turbo_clock_ghz: 4.4,
    cache_mb: 18,
    cores: 6,
    threads: 12,
    tdp_w: 65,
    process_nm: 10,
    max_memory_gb: 128,
    memory_type: "DDR5 / DDR4",
    memory_speed_mhz: 4800,
    launch_date: "2022.Q1",
    is_mobile: false,
    passmark_score: 19516,
    spec_url:
      "https://www.intel.com/content/www/us/en/products/sku/134587/intel-core-i512400f-processor-18m-cache-up-to-4-40-ghz/specifications.html",
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "cpu",
    name: "Core i9-9900K",
    brand: "Intel",
    codename: "Coffee Lake",
    socket: "LGA1151",
    base_clock_ghz: 3.6,
    turbo_clock_ghz: 5.0,
    cache_mb: 16,
    cores: 8,
    threads: 16,
    tdp_w: 95,
    process_nm: 14,
    max_memory_gb: 128,
    memory_type: "DDR4",
    memory_speed_mhz: 2666,
    launch_date: "2018.Q4",
    is_mobile: false,
    passmark_score: 18015,
    spec_url:
      "https://www.intel.com/content/www/us/en/products/sku/186605/intel-core-i99900k-processor-16m-cache-up-to-5-00-ghz/specifications.html",
    spec_links: [
      {
        label: "PassMark CPU Mark",
        url: "https://www.cpubenchmark.net/cpu.php?cpu=Intel+Core+i9-9900K+%40+3.60GHz&id=3334",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "cpu",
    name: "Core i7-7700HQ",
    brand: "Intel",
    codename: "Kaby Lake",
    socket: "FCBGA1440",
    base_clock_ghz: 2.8,
    turbo_clock_ghz: 3.8,
    cache_mb: 6,
    cores: 4,
    threads: 8,
    tdp_w: 45,
    process_nm: 14,
    max_memory_gb: 64,
    memory_type: "DDR4",
    memory_speed_mhz: 2400,
    launch_date: "2017.Q1",
    is_mobile: true,
    passmark_score: 6892,
    spec_url:
      "https://www.intel.com/content/www/us/en/products/sku/97185/intel-core-i77700hq-processor-6m-cache-up-to-3-80-ghz/specifications.html",
    spec_links: [
      {
        label: "PassMark CPU Mark",
        url: "https://www.cpubenchmark.net/cpu.php?cpu=Intel+Core+i7-7700HQ+%40+2.80GHz&id=2906",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "cpu",
    name: "Core i7-6700HQ",
    brand: "Intel",
    codename: "Skylake",
    socket: "FCBGA1440",
    base_clock_ghz: 2.6,
    turbo_clock_ghz: 3.5,
    cache_mb: 6,
    cores: 4,
    threads: 8,
    tdp_w: 45,
    process_nm: 14,
    max_memory_gb: 64,
    memory_type: "DDR4",
    memory_speed_mhz: 2133,
    launch_date: "2015.Q3",
    is_mobile: true,
    spec_url:
      "https://www.intel.com/content/www/us/en/products/sku/88967/intel-core-i76700hq-processor-6m-cache-up-to-3-50-ghz/specifications.html",
    spec_links: [
      {
        label: "PassMark CPU Mark",
        url: "https://www.cpubenchmark.net/cpu.php?cpu=Intel+Core+i7-6700HQ+%40+2.60GHz&id=2586",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "cpu",
    name: "Core i7-4800MQ",
    brand: "Intel",
    codename: "Haswell",
    socket: "FCPGA946",
    base_clock_ghz: 2.7,
    turbo_clock_ghz: 3.7,
    cache_mb: 6,
    cores: 4,
    threads: 8,
    tdp_w: 47,
    process_nm: 22,
    max_memory_gb: 32,
    memory_type: "DDR3L",
    memory_speed_mhz: 1600,
    launch_date: "2013.Q2",
    is_mobile: true,
    spec_url:
      "https://www.intel.com/content/www/us/en/products/sku/75128/intel-core-i74800mq-processor-6m-cache-up-to-3-70-ghz/specifications.html",
    spec_links: [
      {
        label: "PassMark CPU Mark",
        url: "https://www.cpubenchmark.net/cpu.php?cpu=Intel+Core+i7-4800MQ+%40+2.70GHz&id=1927",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "cpu",
    name: "Core i7-4700MQ",
    brand: "Intel",
    codename: "Haswell",
    socket: "FCPGA946",
    base_clock_ghz: 2.4,
    turbo_clock_ghz: 3.4,
    cache_mb: 6,
    cores: 4,
    threads: 8,
    tdp_w: 47,
    process_nm: 22,
    max_memory_gb: 32,
    memory_type: "DDR3L",
    memory_speed_mhz: 1600,
    launch_date: "2013.Q2",
    is_mobile: true,
    spec_url:
      "https://www.intel.com/content/www/us/en/products/sku/75117/intel-core-i74700mq-processor-6m-cache-up-to-3-40-ghz/specifications.html",
    spec_links: [
      {
        label: "PassMark CPU Mark",
        url: "https://www.cpubenchmark.net/cpu.php?cpu=Intel+Core+i7-4700MQ+%40+2.40GHz&id=1923",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "cpu",
    name: "Core i5-4690",
    brand: "Intel",
    codename: "Haswell",
    socket: "LGA1150",
    base_clock_ghz: 3.5,
    turbo_clock_ghz: 3.9,
    cache_mb: 6,
    cores: 4,
    threads: 4,
    tdp_w: 84,
    process_nm: 22,
    max_memory_gb: 32,
    memory_type: "DDR3",
    memory_speed_mhz: 1600,
    launch_date: "2014.Q2",
    is_mobile: false,
    passmark_score: 5594,
    spec_url:
      "https://www.intel.com/content/www/us/en/products/sku/80810/intel-core-i54690-processor-6m-cache-up-to-3-90-ghz/specifications.html",
    spec_links: [
      {
        label: "PassMark CPU Mark",
        url: "https://www.cpubenchmark.net/cpu.php?cpu=Intel+Core+i5-4690+%40+3.50GHz&id=2236",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "cpu",
    name: "Core i5-3470",
    brand: "Intel",
    codename: "Ivy Bridge",
    socket: "LGA1155",
    base_clock_ghz: 3.2,
    turbo_clock_ghz: 3.6,
    cache_mb: 6,
    cores: 4,
    threads: 4,
    tdp_w: 77,
    process_nm: 22,
    max_memory_gb: 32,
    memory_type: "DDR3",
    memory_speed_mhz: 1600,
    launch_date: "2012.Q2",
    is_mobile: false,
    passmark_score: 4653,
    spec_url:
      "https://www.intel.com/content/www/us/en/products/sku/68316/intel-core-i53470-processor-6m-cache-up-to-3-60-ghz/specifications.html",
    spec_links: [
      {
        label: "PassMark CPU Mark",
        url: "https://www.cpubenchmark.net/cpu.php?cpu=Intel+Core+i5-3470+%40+3.20GHz&id=822",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "cpu",
    name: "Core i5-3230M",
    brand: "Intel",
    codename: "Ivy Bridge",
    socket: "FCPGA988",
    base_clock_ghz: 2.6,
    turbo_clock_ghz: 3.2,
    cache_mb: 3,
    cores: 2,
    threads: 4,
    tdp_w: 35,
    process_nm: 22,
    max_memory_gb: 32,
    memory_type: "DDR3L",
    memory_speed_mhz: 1600,
    launch_date: "2013.Q1",
    is_mobile: true,
    spec_url:
      "https://www.intel.com/content/www/us/en/products/sku/72164/intel-core-i53230m-processor-3m-cache-up-to-3-20-ghz-rpga/specifications.html",
    spec_links: [
      {
        label: "PassMark CPU Mark",
        url: "https://www.cpubenchmark.net/cpu.php?cpu=Intel+Core+i5-3230M+%40+2.60GHz&id=1849",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "cpu",
    name: "Core i7-720QM",
    brand: "Intel",
    codename: "Clarksfield",
    socket: "PGA988",
    base_clock_ghz: 1.6,
    turbo_clock_ghz: 2.8,
    cache_mb: 6,
    cores: 4,
    threads: 8,
    tdp_w: 45,
    process_nm: 45,
    max_memory_gb: 8,
    memory_type: "DDR3",
    memory_speed_mhz: 1333,
    launch_date: "2009.Q3",
    is_mobile: true,
    spec_url:
      "https://www.cpubenchmark.net/cpu.php?cpu=Intel+Core+i7-720QM+%40+1.60GHz&id=851",
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "cpu",
    name: "Core 2 Duo T9550",
    brand: "Intel",
    codename: "Penryn",
    socket: "Socket P",
    base_clock_ghz: 2.66,
    turbo_clock_ghz: 2.66,
    cache_mb: 6,
    cores: 2,
    threads: 2,
    tdp_w: 35,
    process_nm: 45,
    max_memory_gb: 8,
    memory_type: "DDR2 / DDR3",
    memory_speed_mhz: 1066,
    launch_date: "2008.Q4",
    is_mobile: true,
    spec_url:
      "https://www.cpubenchmark.net/cpu.php?cpu=Intel+Core2+Duo+T9550+%40+2.66GHz&id=1011",
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "cpu",
    name: "Core 2 Quad Q8200",
    brand: "Intel",
    codename: "Yorkfield",
    socket: "LGA775",
    base_clock_ghz: 2.33,
    turbo_clock_ghz: 2.33,
    cache_mb: 4,
    cores: 4,
    threads: 4,
    tdp_w: 95,
    process_nm: 45,
    max_memory_gb: 8,
    memory_type: "DDR2",
    memory_speed_mhz: 800,
    launch_date: "2008.Q3",
    is_mobile: false,
    spec_url:
      "https://www.cpubenchmark.net/cpu.php?cpu=Intel+Core2+Quad+Q8200+%40+2.33GHz&id=1040",
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "cpu",
    name: "Core 2 Quad Q6600",
    brand: "Intel",
    codename: "Kentsfield",
    socket: "LGA775",
    base_clock_ghz: 2.4,
    turbo_clock_ghz: null,
    cache_mb: 8,
    cores: 4,
    threads: 4,
    tdp_w: 105,
    process_nm: 65,
    max_memory_gb: 8,
    memory_type: "DDR2",
    memory_speed_mhz: 1066,
    launch_date: "2007.Q1",
    is_mobile: false,
    passmark_score: 1850,
    spec_url:
      "https://www.intel.com/content/www/us/en/products/sku/29765/intel-core2-quad-processor-q6600-8m-cache-2-40-ghz-1066-mhz-fsb/specifications.html",
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "cpu",
    name: "Xeon X5260",
    brand: "Intel",
    codename: "Wolfdale",
    socket: "LGA771",
    base_clock_ghz: 3.33,
    turbo_clock_ghz: null,
    cache_mb: 6,
    cores: 2,
    threads: 2,
    tdp_w: 80,
    process_nm: 45,
    max_memory_gb: 128,
    memory_type: "DDR2",
    memory_speed_mhz: 667,
    launch_date: "2007.Q4",
    is_mobile: false,
    spec_url:
      "https://www.cpubenchmark.net/cpu.php?cpu=Intel+Xeon+X5260+%40+3.33GHz&id=1292",
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "cpu",
    name: "Ryzen 7 9800X3D",
    brand: "AMD",
    codename: "Granite Ridge (Zen 5)",
    socket: "AM5",
    base_clock_ghz: 4.7,
    turbo_clock_ghz: 5.2,
    cache_mb: 96,
    cores: 8,
    threads: 16,
    tdp_w: 120,
    process_nm: 4,
    max_memory_gb: 192,
    memory_type: "DDR5",
    memory_speed_mhz: 5600,
    launch_date: "2024.Q4",
    is_mobile: false,
    passmark_score: 39911,
    spec_url:
      "https://www.amd.com/en/products/processors/desktops/ryzen/9000-series/amd-ryzen-7-9800x3d.html",
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "cpu",
    name: "Ryzen 7 7800X3D",
    brand: "AMD",
    codename: "Raphael (Zen 4)",
    socket: "AM5",
    base_clock_ghz: 4.2,
    turbo_clock_ghz: 5.0,
    cache_mb: 96,
    cores: 8,
    threads: 16,
    tdp_w: 120,
    process_nm: 5,
    max_memory_gb: 128,
    memory_type: "DDR5",
    memory_speed_mhz: 5200,
    launch_date: "2023.Q2",
    is_mobile: false,
    passmark_score: 34279,
    spec_url:
      "https://www.amd.com/en/products/processors/desktops/ryzen/7000-series/amd-ryzen-7-7800x3d.html",
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "cpu",
    name: "Ryzen 7 5800X3D",
    brand: "AMD",
    codename: "Vermeer (Zen 3)",
    socket: "AM4",
    base_clock_ghz: 3.4,
    turbo_clock_ghz: 4.5,
    cache_mb: 96,
    cores: 8,
    threads: 16,
    tdp_w: 105,
    process_nm: 7,
    max_memory_gb: 128,
    memory_type: "DDR4",
    memory_speed_mhz: 3200,
    launch_date: "2022.Q2",
    is_mobile: false,
    passmark_score: 28290,
    spec_url:
      "https://www.amd.com/en/products/processors/desktops/ryzen/5000-series/amd-ryzen-7-5800x3d.html",
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "cpu",
    name: "Ryzen 5 5600X",
    brand: "AMD",
    codename: "Vermeer (Zen 3)",
    socket: "AM4",
    base_clock_ghz: 3.7,
    turbo_clock_ghz: 4.6,
    cache_mb: 32,
    cores: 6,
    threads: 12,
    tdp_w: 65,
    process_nm: 7,
    max_memory_gb: 128,
    memory_type: "DDR4",
    memory_speed_mhz: 3200,
    launch_date: "2020.Q4",
    is_mobile: false,
    passmark_score: 21820,
    spec_url:
      "https://www.amd.com/en/products/processors/desktops/ryzen/5000-series/amd-ryzen-5-5600x.html",
    spec_links: [
      {
        label: "PassMark CPU Mark",
        url: "https://www.cpubenchmark.net/cpu.php?cpu=AMD+Ryzen+5+5600X&id=3859",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "cpu",
    name: "Ryzen 5 3600",
    brand: "AMD",
    codename: "Matisse (Zen 2)",
    socket: "AM4",
    base_clock_ghz: 3.6,
    turbo_clock_ghz: 4.2,
    cache_mb: 32,
    cores: 6,
    threads: 12,
    tdp_w: 65,
    process_nm: 7,
    max_memory_gb: 128,
    memory_type: "DDR4",
    memory_speed_mhz: 3200,
    launch_date: "2019.Q3",
    is_mobile: false,
    passmark_score: 17643,
    spec_url:
      "https://www.amd.com/en/products/processors/desktops/ryzen/3000-series/amd-ryzen-5-3600.html",
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "cpu",
    name: "Ryzen 3 2200G",
    brand: "AMD",
    codename: "Raven Ridge",
    socket: "AM4",
    base_clock_ghz: 3.5,
    turbo_clock_ghz: 3.7,
    cache_mb: 6,
    cores: 4,
    threads: 4,
    tdp_w: 65,
    process_nm: 14,
    max_memory_gb: 64,
    memory_type: "DDR4",
    memory_speed_mhz: 2933,
    launch_date: "2018.Q1",
    is_mobile: false,
    passmark_score: 6698,
    spec_url:
      "https://www.amd.com/en/support/downloads/drivers.html/processors/ryzen/ryzen-2000-series/amd-ryzen-3-2200g.html",
    spec_links: [
      {
        label: "PassMark CPU Mark",
        url: "https://www.cpubenchmark.net/cpu.php?cpu=AMD+Ryzen+3+2200G&id=3186",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "cpu",
    name: "Ryzen 9 8945HS",
    brand: "AMD",
    codename: "Hawk Point (Zen 4)",
    socket: "FP8",
    base_clock_ghz: 4.0,
    turbo_clock_ghz: 5.2,
    cache_mb: 24,
    cores: 8,
    threads: 16,
    tdp_w: 45,
    process_nm: 4,
    max_memory_gb: 256,
    memory_type: "DDR5 / LPDDR5X",
    memory_speed_mhz: 7500,
    launch_date: "2024.Q1",
    is_mobile: true,
    passmark_score: 29114,
    spec_url:
      "https://www.amd.com/en/products/processors/laptop/ryzen/8000-series/amd-ryzen-9-8945hs.html",
    spec_links: [
      {
        label: "PassMark CPU Mark",
        url: "https://www.cpubenchmark.net/cpu.php?cpu=AMD+Ryzen+9+8945HS&id=5926",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "cpu",
    name: "Ryzen 9 7940HS",
    brand: "AMD",
    codename: "Phoenix (Zen 4)",
    socket: "FP8",
    base_clock_ghz: 4.0,
    turbo_clock_ghz: 5.2,
    cache_mb: 16,
    cores: 8,
    threads: 16,
    tdp_w: 45,
    process_nm: 4,
    max_memory_gb: 256,
    memory_type: "DDR5 / LPDDR5X",
    memory_speed_mhz: 7500,
    launch_date: "2023.Q2",
    is_mobile: true,
    passmark_score: 29698,
    spec_url:
      "https://www.amd.com/en/products/processors/laptop/ryzen/7000-series/amd-ryzen-9-7940hs.html",
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "cpu",
    name: "Ryzen 9 4900HS",
    brand: "AMD",
    codename: "Renoir (Zen 2)",
    socket: "FP6",
    base_clock_ghz: 3.0,
    turbo_clock_ghz: 4.3,
    cache_mb: 12,
    cores: 8,
    threads: 16,
    tdp_w: 35,
    process_nm: 7,
    max_memory_gb: 24,
    memory_type: "DDR4",
    memory_speed_mhz: 3200,
    launch_date: "2020.Q1",
    is_mobile: true,
    passmark_score: 18708,
    spec_url:
      "https://www.amd.com/en/support/downloads/drivers.html/processors/ryzen/ryzen-4000-series/amd-ryzen-9-4900hs.html",
    spec_links: [
      {
        label: "PassMark CPU Mark",
        url: "https://www.cpubenchmark.net/cpu.php?cpu=AMD+Ryzen+9+4900HS&id=3694",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "cpu",
    name: "FX-8350 Black Edition",
    brand: "AMD",
    codename: "Vishera (Piledriver)",
    socket: "AM3+",
    base_clock_ghz: 4.0,
    turbo_clock_ghz: 4.2,
    cache_mb: 16,
    cores: 8,
    threads: 8,
    tdp_w: 125,
    process_nm: 32,
    max_memory_gb: 32,
    memory_type: "DDR3",
    memory_speed_mhz: 1866,
    launch_date: "2012.Q4",
    is_mobile: false,
    passmark_score: 6096,
    spec_url:
      "https://www.cpubenchmark.net/cpu.php?cpu=AMD+FX-8350+Eight-Core&id=1780",
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "cpu",
    name: "Phenom II X4 965",
    brand: "AMD",
    codename: "Deneb",
    socket: "AM3",
    base_clock_ghz: 3.4,
    turbo_clock_ghz: 3.4,
    cache_mb: 6,
    cores: 4,
    threads: 4,
    tdp_w: 125,
    process_nm: 45,
    max_memory_gb: 16,
    memory_type: "DDR3",
    memory_speed_mhz: 1333,
    launch_date: "2009.Q4",
    is_mobile: false,
    passmark_score: 2679,
    spec_url:
      "https://www.cpubenchmark.net/cpu.php?cpu=AMD+Phenom+II+X4+965&id=370",
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "cpu",
    name: "Phenom II X4 830",
    brand: "AMD",
    codename: "Deneb",
    socket: "AM3",
    base_clock_ghz: 2.8,
    turbo_clock_ghz: 2.8,
    cache_mb: 6,
    cores: 4,
    threads: 4,
    tdp_w: 95,
    process_nm: 45,
    max_memory_gb: 16,
    memory_type: "DDR3",
    memory_speed_mhz: 1066,
    launch_date: "2010.Q2",
    is_mobile: false,
    passmark_score: 2104,
    spec_url:
      "https://www.cpubenchmark.net/cpu.php?cpu=AMD+Phenom+II+X4+830&id=356",
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "cpu",
    name: "Athlon II X4 620",
    brand: "AMD",
    codename: "Propus",
    socket: "AM3",
    base_clock_ghz: 2.6,
    turbo_clock_ghz: 2.6,
    cache_mb: 2,
    cores: 4,
    threads: 4,
    tdp_w: 95,
    process_nm: 45,
    max_memory_gb: 8,
    memory_type: "DDR2 / DDR3",
    memory_speed_mhz: 800,
    launch_date: "2009.Q3",
    is_mobile: false,
    passmark_score: 2008,
    spec_url:
      "https://www.cpubenchmark.net/cpu.php?cpu=AMD+Athlon+II+X4+620&id=166",
    source: "catalog",
    confidence: "high",
  },
];

const GPU_CATALOG: HardwareLookupResult[] = [
  {
    partType: "gpu",
    name: "GeForce RTX 4090",
    brand: "NVIDIA",
    architecture: "Ada Lovelace",
    vram_gb: 24,
    vram_type: "GDDR6X",
    bus_interface: "PCIe 4.0 x16",
    process_nm: 5,
    tdp_w: 450,
    directx_version: "12",
    directx_feature_level: "12_2",
    category: "High-End",
    is_mobile: false,
    passmark_score: 38012,
    spec_url: "https://www.techpowerup.com/gpu-specs/geforce-rtx-4090.c3889",
    spec_links: [
      {
        label: "NVIDIA Official",
        url: "https://www.nvidia.com/en-us/geforce/graphics-cards/40-series/rtx-4090/",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "gpu",
    name: "GeForce RTX 4070 Super",
    brand: "NVIDIA",
    architecture: "Ada Lovelace",
    vram_gb: 12,
    vram_type: "GDDR6X",
    bus_interface: "PCIe 4.0 x16",
    process_nm: 5,
    tdp_w: 220,
    directx_version: "12",
    directx_feature_level: "12_2",
    category: "Upper-Mid",
    is_mobile: false,
    passmark_score: 29939,
    spec_url:
      "https://www.techpowerup.com/gpu-specs/geforce-rtx-4070-super.c4186",
    spec_links: [
      {
        label: "NVIDIA Official",
        url: "https://www.nvidia.com/en-us/geforce/graphics-cards/40-series/rtx-4070-family/",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "gpu",
    name: "GeForce RTX 4070 Laptop GPU",
    brand: "NVIDIA",
    architecture: "Ada Lovelace",
    vram_gb: 8,
    vram_type: "GDDR6",
    bus_interface: "PCIe 4.0 x8",
    process_nm: 5,
    tdp_w: 115,
    directx_version: "12",
    directx_feature_level: "12_2",
    category: "High-End Mobile",
    is_mobile: true,
    passmark_score: 19462,
    spec_url:
      "https://www.techpowerup.com/gpu-specs/geforce-rtx-4070-mobile.c3944",
    spec_links: [
      {
        label: "PassMark G3D Mark",
        url: "https://www.videocardbenchmark.net/gpu.php?gpu=GeForce+RTX+4070+Laptop+GPU&id=4756",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "gpu",
    name: "GeForce RTX 3060 Ti",
    brand: "NVIDIA",
    architecture: "Ampere",
    vram_gb: 8,
    vram_type: "GDDR6",
    bus_interface: "PCIe 4.0 x16",
    process_nm: 8,
    tdp_w: 200,
    directx_version: "12",
    directx_feature_level: "12_2",
    category: "Mid-Range",
    is_mobile: false,
    passmark_score: 20206,
    spec_url: "https://www.techpowerup.com/gpu-specs/geforce-rtx-3060-ti.c3681",
    spec_links: [
      {
        label: "NVIDIA Official",
        url: "https://www.nvidia.com/en-us/geforce/graphics-cards/30-series/rtx-3060-3060ti/",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "gpu",
    name: "GeForce RTX 2080 Ti",
    brand: "NVIDIA",
    architecture: "Turing",
    vram_gb: 11,
    vram_type: "GDDR6",
    bus_interface: "PCIe 3.0 x16",
    process_nm: 12,
    tdp_w: 250,
    directx_version: "12",
    directx_feature_level: "12_2",
    category: "High-End",
    is_mobile: false,
    passmark_score: 21396,
    spec_url: "https://www.techpowerup.com/gpu-specs/geforce-rtx-2080-ti.c3305",
    spec_links: [
      {
        label: "PassMark G3D Mark",
        url: "https://www.videocardbenchmark.net/gpu.php?gpu=GeForce+RTX+2080+Ti&id=3991",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "gpu",
    name: "GeForce RTX 2060 Max-Q",
    brand: "NVIDIA",
    architecture: "Turing",
    vram_gb: 6,
    vram_type: "GDDR6",
    bus_interface: "PCIe 3.0 x16",
    process_nm: 12,
    tdp_w: 65,
    directx_version: "12",
    directx_feature_level: "12_2",
    category: "Upper-Mid Mobile",
    is_mobile: true,
    spec_url: "https://www.techpowerup.com/gpu-specs/geforce-rtx-2060-max-q.c3533",
    spec_links: [
      {
        label: "PassMark G3D Mark",
        url: "https://www.videocardbenchmark.net/gpu.php?gpu=GeForce+RTX+2060+with+Max-Q+Design&id=4199",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "gpu",
    name: "GeForce GTX 1080 Ti",
    brand: "NVIDIA",
    architecture: "Pascal",
    vram_gb: 11,
    vram_type: "GDDR5X",
    bus_interface: "PCIe 3.0 x16",
    process_nm: 16,
    tdp_w: 250,
    directx_version: "12",
    directx_feature_level: "12_1",
    category: "High-End",
    is_mobile: false,
    passmark_score: 18597,
    spec_url: "https://www.techpowerup.com/gpu-specs/geforce-gtx-1080-ti.c2877",
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "gpu",
    name: "GeForce GTX 1050 Mobile",
    brand: "NVIDIA",
    architecture: "Pascal",
    vram_gb: 4,
    vram_type: "GDDR5",
    bus_interface: "PCIe 3.0 x16",
    process_nm: 14,
    tdp_w: 75,
    directx_version: "12",
    directx_feature_level: "12_1",
    category: "Mid-Range Mobile",
    is_mobile: true,
    spec_url:
      "https://www.techpowerup.com/gpu-specs/geforce-gtx-1050-mobile.c2917",
    spec_links: [
      {
        label: "PassMark G3D Mark",
        url: "https://www.videocardbenchmark.net/gpu.php?gpu=GeForce+GTX+1050+%28Mobile%29&id=4088",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "gpu",
    name: "GeForce GTX 970",
    brand: "NVIDIA",
    architecture: "Maxwell 2.0",
    vram_gb: 4,
    vram_type: "GDDR5",
    bus_interface: "PCIe 3.0 x16",
    process_nm: 28,
    tdp_w: 145,
    directx_version: "12",
    directx_feature_level: "12_1",
    category: "Mid-Range",
    is_mobile: false,
    passmark_score: 9635,
    spec_url: "https://www.techpowerup.com/gpu-specs/geforce-gtx-970.c2620",
    spec_links: [
      {
        label: "PassMark G3D Mark",
        url: "https://www.videocardbenchmark.net/gpu.php?gpu=GeForce+GTX+970&id=2954",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "gpu",
    name: "GeForce GTX 960M",
    brand: "NVIDIA",
    architecture: "Maxwell",
    vram_gb: 4,
    vram_type: "GDDR5",
    bus_interface: "PCIe 3.0 x16",
    process_nm: 28,
    tdp_w: 60,
    directx_version: "12",
    directx_feature_level: "11_0",
    category: "Mid-Range Mobile",
    is_mobile: true,
    spec_url: "https://www.techpowerup.com/gpu-specs/geforce-gtx-960m.c2635",
    spec_links: [
      {
        label: "PassMark G3D Mark",
        url: "https://www.videocardbenchmark.net/gpu.php?gpu=GeForce+GTX+960M&id=3176",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "gpu",
    name: "GeForce GT 755M",
    brand: "NVIDIA",
    architecture: "Kepler",
    vram_gb: 2,
    vram_type: "GDDR5",
    bus_interface: "PCIe 3.0 x16",
    process_nm: 28,
    tdp_w: 50,
    directx_version: "12",
    directx_feature_level: "11_0",
    category: "Mid-Range Mobile",
    is_mobile: true,
    spec_url: "https://www.techpowerup.com/gpu-specs/geforce-gt-755m.c2420",
    spec_links: [
      {
        label: "PassMark G3D Mark",
        url: "https://www.videocardbenchmark.net/gpu.php?gpu=GeForce+GT+755M&id=2646",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "gpu",
    name: "GeForce GTX 660",
    brand: "NVIDIA",
    architecture: "Kepler (GK106)",
    vram_gb: 2,
    vram_type: "GDDR5",
    bus_interface: "PCIe 3.0 x16",
    process_nm: 28,
    tdp_w: 140,
    directx_version: "12",
    directx_feature_level: "11_0",
    category: "Low-Mid-Range",
    is_mobile: false,
    spec_url: "https://www.techpowerup.com/gpu-specs/geforce-gtx-660.c895",
    spec_links: [
      {
        label: "PassMark G3D Mark",
        url: "https://www.videocardbenchmark.net/gpu.php?gpu=GeForce+GTX+660&id=2152",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "gpu",
    name: "GeForce GTX 660M",
    brand: "NVIDIA",
    architecture: "Kepler",
    vram_gb: 2,
    vram_type: "GDDR5",
    bus_interface: "PCIe 3.0 x16",
    process_nm: 28,
    tdp_w: 50,
    directx_version: "12",
    directx_feature_level: "11_0",
    category: "Mid-Range Mobile",
    is_mobile: true,
    spec_url: "https://www.techpowerup.com/gpu-specs/geforce-gtx-660m.c345",
    spec_links: [
      {
        label: "PassMark G3D Mark",
        url: "https://www.videocardbenchmark.net/gpu.php?gpu=GeForce+GTX+660M&id=1458",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "gpu",
    name: "GeForce GTX 465",
    brand: "NVIDIA",
    architecture: "Fermi (GF100)",
    vram_gb: 1,
    vram_type: "GDDR5",
    bus_interface: "PCIe 2.0 x16",
    process_nm: 40,
    tdp_w: 200,
    directx_version: "12",
    directx_feature_level: "11_0",
    category: "Mid-Range",
    is_mobile: false,
    spec_url: "https://www.techpowerup.com/gpu-specs/geforce-gtx-465.c266",
    spec_links: [
      {
        label: "PassMark G3D Mark",
        url: "https://www.videocardbenchmark.net/gpu.php?gpu=GeForce+GTX+465&id=82",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "gpu",
    name: "GeForce GTX 260M",
    brand: "NVIDIA",
    architecture: "Tesla 2.0 (G92B)",
    vram_gb: 1,
    vram_type: "DDR3",
    bus_interface: "MXM-III (PCIe 2.0 x16)",
    process_nm: 55,
    tdp_w: 75,
    directx_version: "10.0",
    directx_feature_level: "10_0",
    category: "Low-Mid-Range Mobile",
    is_mobile: true,
    spec_url: "https://www.techpowerup.com/gpu-specs/geforce-gtx-260m.c1510",
    spec_links: [
      {
        label: "PassMark G3D Mark",
        url: "https://www.videocardbenchmark.net/gpu.php?gpu=GeForce+GTX+260M&id=83",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "gpu",
    name: "Quadro NVS 160M",
    brand: "NVIDIA",
    architecture: "Tesla (G98)",
    vram_gb: 0.25,
    vram_type: "GDDR3",
    bus_interface: "PCIe 2.0 x16",
    process_nm: 65,
    tdp_w: 12,
    directx_version: "10.0",
    directx_feature_level: "10_0",
    category: "Office-Class",
    is_mobile: true,
    spec_url:
      "https://www.videocardbenchmark.net/gpu.php?gpu=Quadro+NVS+160M&id=1626",
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "gpu",
    name: "Radeon RX 7800 XT",
    brand: "AMD",
    architecture: "RDNA 3",
    vram_gb: 16,
    vram_type: "GDDR6",
    bus_interface: "PCIe 4.0 x16",
    process_nm: 5,
    tdp_w: 263,
    directx_version: "12",
    directx_feature_level: "12_2",
    category: "Upper-Mid",
    is_mobile: false,
    passmark_score: 24482,
    spec_url: "https://www.techpowerup.com/gpu-specs/radeon-rx-7800-xt.c3839",
    spec_links: [
      {
        label: "AMD Official",
        url: "https://www.amd.com/en/products/graphics/desktops/radeon/7000-series/amd-radeon-rx-7800-xt.html",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "gpu",
    name: "Radeon RX 6600",
    brand: "AMD",
    architecture: "RDNA 2",
    vram_gb: 8,
    vram_type: "GDDR6",
    bus_interface: "PCIe 4.0 x8",
    process_nm: 7,
    tdp_w: 132,
    directx_version: "12",
    directx_feature_level: "12_2",
    category: "Mid-Range",
    is_mobile: false,
    passmark_score: 15031,
    spec_url: "https://www.techpowerup.com/gpu-specs/radeon-rx-6600.c3696",
    spec_links: [
      {
        label: "AMD Official",
        url: "https://www.amd.com/en/products/graphics/desktops/radeon/6000-series/amd-radeon-rx-6600.html",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "gpu",
    name: "Radeon RX 6400",
    brand: "AMD",
    architecture: "RDNA 2",
    vram_gb: 4,
    vram_type: "GDDR6",
    bus_interface: "PCIe 4.0 x4",
    process_nm: 6,
    tdp_w: 53,
    directx_version: "12",
    directx_feature_level: "12_2",
    category: "Entry / Low-Profile",
    is_mobile: false,
    passmark_score: 7756,
    spec_url: "https://www.techpowerup.com/gpu-specs/radeon-rx-6400.c3813",
    spec_links: [
      {
        label: "AMD Official",
        url: "https://www.amd.com/en/products/graphics/desktops/radeon/6000-series/amd-radeon-rx-6400.html",
      },
      {
        label: "PassMark G3D Mark",
        url: "https://www.videocardbenchmark.net/gpu.php?gpu=Radeon+RX+6400&id=4536",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "gpu",
    name: "Radeon RX 580",
    brand: "AMD",
    architecture: "Polaris 20",
    vram_gb: 8,
    vram_type: "GDDR5",
    bus_interface: "PCIe 3.0 x16",
    process_nm: 14,
    tdp_w: 185,
    directx_version: "12",
    directx_feature_level: "12_0",
    category: "Mid-Range",
    is_mobile: false,
    passmark_score: 8781,
    spec_url: "https://www.techpowerup.com/gpu-specs/radeon-rx-580.c2938",
    spec_links: [
      {
        label: "PassMark G3D Mark",
        url: "https://www.videocardbenchmark.net/gpu.php?gpu=Radeon+RX+580&id=3736",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "gpu",
    name: "Radeon HD 7770 Vapor-X OC",
    brand: "AMD",
    architecture: "GCN 1.0 (Cape Verde)",
    vram_gb: 1,
    vram_type: "GDDR5",
    bus_interface: "PCIe 3.0 x16",
    process_nm: 28,
    tdp_w: 80,
    directx_version: "12",
    directx_feature_level: "11_1",
    category: "Low-Mid-Range",
    is_mobile: false,
    spec_url:
      "https://www.techpowerup.com/gpu-specs/radeon-hd-7770-ghz-edition.c308",
    spec_links: [
      {
        label: "PassMark G3D Mark",
        url: "https://www.videocardbenchmark.net/gpu.php?gpu=Radeon+HD+7770&id=322",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "gpu",
    name: "Radeon HD 6670",
    brand: "AMD",
    architecture: "TeraScale 2 (Turks)",
    vram_gb: 1,
    vram_type: "GDDR5",
    bus_interface: "PCI Express 2.1 x16",
    process_nm: 40,
    tdp_w: 66,
    directx_version: "11.2",
    directx_feature_level: "11_0",
    category: "Low-Mid-Range",
    is_mobile: false,
    spec_url: "https://www.techpowerup.com/gpu-specs/radeon-hd-6670.c406",
    spec_links: [
      {
        label: "PassMark G3D Mark",
        url: "https://www.videocardbenchmark.net/gpu.php?gpu=Radeon+HD+6670&id=96",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "gpu",
    name: "Radeon HD 8790M",
    brand: "AMD",
    architecture: "GCN 1.0 (Mars)",
    vram_gb: 2,
    vram_type: "GDDR5",
    bus_interface: "PCIe 3.0 x8",
    process_nm: 28,
    tdp_w: 50,
    directx_version: "12",
    directx_feature_level: "11_1",
    category: "Mid-Range Mobile",
    is_mobile: true,
    spec_url: "https://www.techpowerup.com/gpu-specs/radeon-hd-8790m.c1798",
    spec_links: [
      {
        label: "PassMark G3D Mark",
        url: "https://www.videocardbenchmark.net/gpu.php?gpu=Radeon+HD+8790M&id=2993",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "gpu",
    name: "Arc B580",
    brand: "Intel",
    architecture: "Battlemage (Xe2)",
    vram_gb: 12,
    vram_type: "GDDR6",
    bus_interface: "PCIe 4.0 x8",
    process_nm: 5,
    tdp_w: 190,
    directx_version: "12",
    directx_feature_level: "12_2",
    category: "Mid-Range",
    is_mobile: false,
    passmark_score: 16097,
    spec_url: "https://www.techpowerup.com/gpu-specs/arc-b580.c4244",
    spec_links: [
      {
        label: "Intel ARK",
        url: "https://www.intel.com/content/www/us/en/products/sku/241598/intel-arc-b580-graphics/specifications.html",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
  {
    partType: "gpu",
    name: "Arc A770",
    brand: "Intel",
    architecture: "Alchemist (Xe-HPG)",
    vram_gb: 16,
    vram_type: "GDDR6",
    bus_interface: "PCIe 4.0 x16",
    process_nm: 6,
    tdp_w: 225,
    directx_version: "12",
    directx_feature_level: "12_2",
    category: "Mid-Range",
    is_mobile: false,
    passmark_score: 13382,
    spec_url: "https://www.techpowerup.com/gpu-specs/arc-a770.c3914",
    spec_links: [
      {
        label: "Intel ARK",
        url: "https://www.intel.com/content/www/us/en/products/sku/229151/intel-arc-a770-graphics-16gb/specifications.html",
      },
    ],
    source: "catalog",
    confidence: "high",
  },
];

function normalizeTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

const VENDOR_NOISE_TOKENS = new Set([
  "amd",
  "nvidia",
  "intel",
  "ati",
  "processor",
  "processors",
  "graphics",
  "cpu",
  "gpu",
  "series",
  "edition",
  "card",
  "video",
  "with",
]);

const MODIFIER_TOKENS = new Set([
  "ti",
  "super",
  "xt",
  "xtx",
  "gre",
  "se",
  "le",
  "pro",
  "max",
  "ultra",
  "mobile",
  "laptop",
  "maxq",
  "x3d",
  "ks",
  "kf",
  "k",
  "f",
  "x",
  "g",
  "hs",
  "hx",
  "hq",
  "mq",
  "u",
  "m",
  "oc",
]);

interface ModelSignature {
  allTokens: string[];
  meaningfulTokens: string[];
  coreTokens: string[];
  modifiers: Set<string>;
  vramGb: number | null;
  isMobile: boolean;
}

function parseModelSignature(raw: string): ModelSignature {
  let vramGb: number | null = null;
  const vramMatch = raw.match(/\b(\d{1,2})\s*gb\b/i);
  if (vramMatch) {
    vramGb = Number.parseInt(vramMatch[1], 10);
  }

  // Strip PassMark clock suffix like "@ 3.60GHz" and explicit VRAM capacity like "16 GB"
  const stripped = raw
    .replace(/@\s*\d+(?:\.\d+)?\s*ghz/gi, " ")
    .replace(/\b\d{1,2}\s*gb\b/gi, " ")
    .replace(/\bmax-q\b/gi, "maxq");

  const allTokens = normalizeTokens(stripped);
  const meaningfulTokens = allTokens.filter(
    (t) => !VENDOR_NOISE_TOKENS.has(t),
  );
  const coreTokens = meaningfulTokens.filter((t) => /\d/.test(t));
  const modifiers = new Set(
    meaningfulTokens.filter((t) => MODIFIER_TOKENS.has(t)),
  );
  const isMobile =
    /\b(mobile|laptop|max-q|maxq|hq|mq|hs|hx)\b/i.test(raw) ||
    /\b\d{3,4}m\b/i.test(raw);

  return {
    allTokens,
    meaningfulTokens,
    coreTokens,
    modifiers,
    vramGb,
    isMobile,
  };
}

function scoreModelMatch(
  candidateSig: ModelSignature,
  querySig: ModelSignature,
): number {
  const qTokens =
    querySig.meaningfulTokens.length > 0
      ? querySig.meaningfulTokens
      : querySig.allTokens;
  if (qTokens.length === 0) return 0;

  // Core model number tokens (e.g. "9060", "4070", "12400f", "7800x3d")
  if (querySig.coreTokens.length > 0) {
    for (const core of querySig.coreTokens) {
      const exactCore = candidateSig.coreTokens.includes(core);
      if (!exactCore) {
        // Allow "12400f" vs "12400" only? No — exact model identifier should match,
        // or prefix when query is "i5" vs "i5"
        const partial = candidateSig.coreTokens.some(
          (c) => c === core || (core.length >= 4 && c.startsWith(core) && c.length <= core.length + 1),
        );
        if (!partial) return -1;
      }
    }
  }

  let score = 0;
  for (const qt of qTokens) {
    if (candidateSig.meaningfulTokens.includes(qt)) {
      score += /\d/.test(qt) ? 8 : 4;
    } else if (candidateSig.allTokens.includes(qt)) {
      score += 2;
    } else if (
      candidateSig.meaningfulTokens.some((c) => c.includes(qt) || qt.includes(c))
    ) {
      score += 1;
    }
  }

  // Modifier alignment (Ti, Super, XT, XTX, GRE, Mobile, etc.)
  for (const mod of querySig.modifiers) {
    if (candidateSig.modifiers.has(mod)) score += 6;
    else score -= 7;
  }
  for (const cMod of candidateSig.modifiers) {
    if (!querySig.modifiers.has(cMod)) {
      // Extra modifier on candidate (e.g. XT when query has no XT, or Ti when query has no Ti)
      score -= 6;
    }
  }

  // Mobile vs desktop alignment
  if (querySig.isMobile !== candidateSig.isMobile) {
    score -= 8;
  }

  // VRAM capacity tie-breaker bonus (doesn't disqualify PassMark names that omit VRAM)
  if (querySig.vramGb !== null && candidateSig.vramGb !== null) {
    if (querySig.vramGb === candidateSig.vramGb) score += 10;
    else score -= 8;
  }

  // Prefer tighter candidate names without extra unrelated tokens
  const extraTokens = Math.max(
    0,
    candidateSig.meaningfulTokens.length - qTokens.length,
  );
  score -= Math.min(5, extraTokens);

  return score;
}

function isSearchOrListingUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    const path = parsed.pathname.toLowerCase();
    const search = parsed.search.toLowerCase();
    if (host.endsWith("google.com") || host.endsWith("bing.com") || host === "duckduckgo.com") {
      return true;
    }
    if (path.includes("search.html") || path.includes("site-search") || path === "/search") {
      return true;
    }
    if (
      parsed.searchParams.has("q") ||
      parsed.searchParams.has("s") ||
      parsed.searchParams.has("ajaxsrch") ||
      search.includes("search=")
    ) {
      return true;
    }
    if (host.endsWith("theretroweb.com") && !path.includes("/motherboards/s/")) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

function inferBrand(query: string, explicitBrand?: string, vendor?: string): string {
  if (explicitBrand && explicitBrand.trim()) return explicitBrand.trim();
  if (vendor && vendor !== "Auto") return vendor;
  const q = query.toLowerCase();
  if (
    q.includes("intel") ||
    q.includes("core ") ||
    q.includes("xeon") ||
    q.includes("pentium") ||
    q.includes("celeron") ||
    q.includes("arc ") ||
    q.includes("uhd") ||
    q.includes("iris")
  ) {
    return "Intel";
  }
  if (
    q.includes("amd") ||
    q.includes("ryzen") ||
    q.includes("radeon") ||
    q.includes("phenom") ||
    q.includes("athlon") ||
    q.includes("epyc") ||
    q.includes("threadripper") ||
    /\bfx[- ]?\d+/i.test(q) ||
    /\brx\s*\d+/i.test(q) ||
    /\bhd\s*\d{4}/i.test(q)
  ) {
    return "AMD";
  }
  if (
    q.includes("nvidia") ||
    q.includes("geforce") ||
    q.includes("rtx") ||
    q.includes("gtx") ||
    q.includes("quadro") ||
    q.includes("gt ")
  ) {
    return "NVIDIA";
  }
  return "";
}

function buildOfficialSearchUrl(
  query: string,
  brand: string,
  partType: "cpu" | "gpu",
): string {
  const encoded = encodeURIComponent(query.trim());
  if (brand.toLowerCase() === "intel") {
    return `https://www.intel.com/content/www/us/en/ark/search.html?_charset_=UTF-8&q=${encoded}`;
  }
  if (brand.toLowerCase() === "amd") {
    return `https://www.amd.com/en/search/site-search.html#q=${encoded}`;
  }
  if (partType === "gpu") {
    return `https://www.techpowerup.com/gpu-specs/?q=${encoded}`;
  }
  return `https://www.techpowerup.com/cpu-specs/?q=${encoded}`;
}

function scoreTokenOverlap(hayTokens: string[], queryTokens: string[]): number {
  let score = 0;
  for (const qt of queryTokens) {
    if (hayTokens.includes(qt)) score += 3;
    else if (hayTokens.some((h) => h.includes(qt) || qt.includes(h))) score += 1;
  }
  return score;
}

function scoreCatalogMatch(
  item: HardwareLookupResult,
  queryTokens: string[],
): number {
  const hay = normalizeTokens(`${item.brand} ${item.name} ${item.codename ?? ""}`);
  return scoreTokenOverlap(hay, queryTokens);
}

async function getDbGpuCatalog(): Promise<SlimDbGpu[]> {
  if (dbgpuCache && dbgpuCache.expiresAt > Date.now()) {
    return dbgpuCache.items;
  }
  try {
    const res = await fetch(
      "https://github.com/painebenjamin/dbgpu/releases/download/2025.12/2025-12.json",
      {
        signal: AbortSignal.timeout(4000),
        headers: { "User-Agent": "VelociPCs-Inventory/1.0" },
      },
    );
    if (!res.ok) return dbgpuCache?.items ?? [];
    const raw = (await res.json()) as Array<Record<string, unknown>>;
    const slim: SlimDbGpu[] = raw.map((g) => {
      const manufacturer = String(g.manufacturer ?? "").trim();
      const name = String(g.name ?? "").trim();
      const dxMajor = g.directx_major_version;
      const dxMinor = g.directx_minor_version;
      const dxVer =
        typeof dxMajor === "number"
          ? typeof dxMinor === "number" && dxMinor > 0
            ? `${dxMajor}.${dxMinor}`
            : String(dxMajor)
          : null;
      const mobileFlag =
        /\b(mobile|laptop|max-q|m)\b/i.test(name) ||
        /\d{3,4}m\b/i.test(name);
      return {
        brand: manufacturer || inferBrand(name),
        name,
        tokens: normalizeTokens(`${manufacturer} ${name}`),
        architecture:
          typeof g.architecture === "string" ? g.architecture : null,
        vram_gb:
          typeof g.memory_size_gb === "number" ? g.memory_size_gb : null,
        vram_type: typeof g.memory_type === "string" ? g.memory_type : null,
        bus_interface:
          typeof g.bus_interface === "string" ? g.bus_interface : null,
        process_nm:
          typeof g.process_size_nm === "number" ? g.process_size_nm : null,
        tdp_w:
          typeof g.thermal_design_power_w === "number"
            ? g.thermal_design_power_w
            : null,
        directx_version: dxVer,
        is_mobile: mobileFlag,
        tpu_url: sanitizeHttpUrl(
          typeof g.tpu_url === "string" ? g.tpu_url : null,
        ),
      };
    });
    dbgpuCache = { expiresAt: Date.now() + CACHE_TTL_MS, items: slim };
    return slim;
  } catch {
    return dbgpuCache?.items ?? [];
  }
}

async function getPassMarkList(
  partType: "cpu" | "gpu",
): Promise<PassMarkEntry[]> {
  const existing = partType === "cpu" ? passmarkCpuCache : passmarkGpuCache;
  if (existing && existing.expiresAt > Date.now()) {
    return existing.items;
  }

  const listUrl =
    partType === "cpu"
      ? "https://www.cpubenchmark.net/cpu_list.php"
      : "https://www.videocardbenchmark.net/gpu_list.php";

  try {
    const res = await fetch(listUrl, {
      signal: AbortSignal.timeout(4500),
      headers: { "User-Agent": "VelociPCs-Inventory/1.0" },
    });
    if (!res.ok) return existing?.items ?? [];
    const html = await res.text();
    const items: PassMarkEntry[] = [];

    if (partType === "cpu") {
      const re =
        /href="\/?cpu_lookup\.php\?([^"]+)"[^>]*>([^<]+)<\/a><\/td><td>([\d,]+)/gi;
      for (const m of html.matchAll(re)) {
        const qs = m[1].replace(/&amp;/g, "&");
        const name = m[2].trim();
        const scoreNum = Number.parseInt(m[3].replace(/,/g, ""), 10);
        items.push({
          name,
          tokens: normalizeTokens(name),
          url: `https://www.cpubenchmark.net/cpu.php?${qs}`,
          score: Number.isFinite(scoreNum) && scoreNum > 0 ? scoreNum : null,
        });
      }
      passmarkCpuCache = { expiresAt: Date.now() + CACHE_TTL_MS, items };
    } else {
      const re =
        /href="\/?video_lookup\.php\?([^"]+)"[^>]*>([^<]+)<\/a><\/td><td>([\d,]+)/gi;
      for (const m of html.matchAll(re)) {
        const qs = m[1].replace(/&amp;/g, "&");
        const name = m[2].trim();
        const scoreNum = Number.parseInt(m[3].replace(/,/g, ""), 10);
        items.push({
          name,
          tokens: normalizeTokens(name),
          url: `https://www.videocardbenchmark.net/gpu.php?${qs}`,
          score: Number.isFinite(scoreNum) && scoreNum > 0 ? scoreNum : null,
        });
      }
      passmarkGpuCache = { expiresAt: Date.now() + CACHE_TTL_MS, items };
    }

    return items;
  } catch {
    return existing?.items ?? [];
  }
}

function findPassMarkCandidates(
  entries: PassMarkEntry[],
  rawQuery: string,
): {
  best: PassMarkEntry | null;
  status: "found" | "ambiguous" | "not_found";
  candidates: LinkCandidate[];
} {
  if (entries.length === 0 || !rawQuery.trim()) {
    return { best: null, status: "not_found", candidates: [] };
  }

  const querySig = parseModelSignature(rawQuery);
  const scored: Array<{ entry: PassMarkEntry; score: number }> = [];
  const minScore = querySig.coreTokens.length > 0 ? 6 : 8;

  for (const entry of entries) {
    const sig = parseModelSignature(entry.name);
    const score = scoreModelMatch(sig, querySig);
    if (score >= minScore) {
      scored.push({ entry, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 3);
  if (top.length === 0) {
    return { best: null, status: "not_found", candidates: [] };
  }

  const bestScore = top[0].score;
  const secondScore = top[1]?.score ?? -999;
  const isAmbiguous = top.length >= 2 && bestScore - secondScore <= 2;

  const candidates: LinkCandidate[] = top.map((item, idx) => ({
    url: item.entry.url,
    title: item.entry.name,
    source: "PassMark",
    confidence: idx === 0 && !isAmbiguous ? "high" : "medium",
    passmark_score: item.entry.score,
  }));

  return {
    best: isAmbiguous ? null : top[0].entry,
    status: isAmbiguous ? "ambiguous" : "found",
    candidates,
  };
}

function cleanWikitextValue(raw: string): string {
  return raw
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, " ")
    .replace(/<ref[^>]*\/>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, "$1")
    .replace(/\{\{nowrap\|([^}]+)\}\}/gi, "$1")
    .replace(/\{\{cvt\|([^|}]+)\|([^|}]+)[^}]*\}\}/gi, "$1 $2")
    .replace(/\{\{ubl\|([^}]+)\}\}/gi, "$1")
    .replace(/\{\{[^}]+\}\}/g, " ")
    .replace(/<br\s*\/?>/gi, ", ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseWikipediaInfobox(wikitext: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const lines = wikitext.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\|\s*([a-z0-9_ -]+?)\s*=\s*(.+)$/i);
    if (!m) continue;
    const key = m[1].trim().toLowerCase().replace(/\s+/g, "_");
    const val = cleanWikitextValue(m[2]);
    if (val) fields[key] = val;
  }
  return fields;
}

function parseClockToGhz(val: string | undefined): number | null {
  if (!val) return null;
  const ghzMatches = [...val.matchAll(/(\d(?:\.\d{1,2})?)\s*GHz/gi)].map((m) =>
    Number(m[1]),
  );
  if (ghzMatches.length > 0) return ghzMatches[0];
  const mhzMatches = [...val.matchAll(/(\d{3,4})\s*MHz/gi)].map(
    (m) => Math.round((Number(m[1]) / 1000) * 100) / 100,
  );
  if (mhzMatches.length > 0) return mhzMatches[0];
  const plain = val.match(/\b(\d(?:\.\d{1,2})?)\b/);
  return plain ? Number(plain[1]) : null;
}

function extractSpecsFromInfobox(
  box: Record<string, string>,
  partType: "cpu" | "gpu",
): Partial<HardwareLookupResult> {
  const out: Partial<HardwareLookupResult> = {};

  if (partType === "cpu") {
    const coresRaw = box.cores ?? box.numcores ?? box.no_of_cores;
    if (coresRaw) {
      const m = coresRaw.match(/\d{1,3}/);
      if (m) out.cores = Number(m[0]);
    }
    const threadsRaw = box.threads ?? box.numthreads ?? box.no_of_threads;
    if (threadsRaw) {
      const m = threadsRaw.match(/\d{1,3}/);
      if (m) out.threads = Number(m[0]);
    }

    const baseClock = parseClockToGhz(
      box.slowest ?? box.base ?? box.clock ?? box.frequency,
    );
    const turboClock = parseClockToGhz(
      box.fastest ?? box.boost ?? box.turbo ?? box.max_clock,
    );
    if (baseClock !== null) out.base_clock_ghz = baseClock;
    if (turboClock !== null) out.turbo_clock_ghz = turboClock;

    const cacheRaw = box.l3cache ?? box.l2cache ?? box.cache;
    if (cacheRaw) {
      const mbMatch = cacheRaw.match(/(\d{1,3}(?:\.\d)?)\s*MB/i);
      if (mbMatch) out.cache_mb = Number(mbMatch[1]);
    }

    const sockRaw = box.sock ?? box.socket ?? box.sockets;
    if (sockRaw) {
      const m = sockRaw.match(
        /\b(LGA\s*\d{3,4}|AM[2345]\+?|FM2\+?|SP[356]|sTRX\d|FP[678]|FCBGA\d+|FCPGA\d+|PGA\d+|Socket\s+[A-Z0-9]+)\b/i,
      );
      if (m) out.socket = m[1].replace(/\s+/g, "").toUpperCase();
    }

    const archRaw = box.microarch ?? box.arch ?? box.codename ?? box.core;
    if (archRaw) {
      out.codename = archRaw.split(",")[0].trim().slice(0, 60);
    }

    const nmRaw = box.size ?? box.process ?? box.lithography;
    if (nmRaw) {
      const m = nmRaw.match(/(\d{1,3})\s*nm/i);
      if (m) out.process_nm = Number(m[1]);
    }

    const tdpRaw = box.tdp ?? box.power;
    if (tdpRaw) {
      const m = tdpRaw.match(/(\d{2,3})\s*W/i);
      if (m) out.tdp_w = Number(m[1]);
    }

    const memRaw = box.memory ?? box.mem ?? box.ram;
    if (memRaw) {
      const typeM = memRaw.match(/\b(L?P?DDR\dX?L?)\b/i);
      if (typeM) out.memory_type = typeM[1].toUpperCase();
      const speedM = memRaw.match(/(\d{3,4})\s*(?:MHz|MT\/s)/i);
      if (speedM) out.memory_speed_mhz = Number(speedM[1]);
    }

    const releaseRaw = box.produced ?? box.released ?? box.launch;
    if (releaseRaw) {
      const ym = releaseRaw.match(/\b(19\d{2}|20\d{2})\b/);
      if (ym) out.launch_date = ym[1];
    }
  } else {
    const archRaw = box.architecture ?? box.microarch ?? box.codename;
    if (archRaw) out.architecture = archRaw.split(",")[0].trim().slice(0, 60);
    const vramRaw = box.memory ?? box.vram;
    if (vramRaw) {
      const gm = vramRaw.match(/(\d{1,2})\s*GB/i);
      if (gm) out.vram_gb = Number(gm[1]);
      const tm = vramRaw.match(/\b(GDDR\dX?|HBM\d?e?|DDR\d)\b/i);
      if (tm) out.vram_type = tm[1].toUpperCase();
    }
    const tdpRaw = box.tdp ?? box.power;
    if (tdpRaw) {
      const m = tdpRaw.match(/(\d{2,3})\s*W/i);
      if (m) out.tdp_w = Number(m[1]);
    }
    const nmRaw = box.process ?? box.size;
    if (nmRaw) {
      const m = nmRaw.match(/(\d{1,3})\s*nm/i);
      if (m) out.process_nm = Number(m[1]);
    }
  }

  return out;
}

function extractSpecsFromText(
  text: string,
  partType: "cpu" | "gpu",
): Partial<HardwareLookupResult> {
  const out: Partial<HardwareLookupResult> = {};
  if (partType === "cpu") {
    const coresMatch = text.match(/(\d{1,3})\s*(?:CPU\s*)?cores?\b/i);
    if (coresMatch) out.cores = Number(coresMatch[1]);
    const threadsMatch = text.match(/(\d{1,3})\s*threads?\b/i);
    if (threadsMatch) out.threads = Number(threadsMatch[1]);
    const clockMatches = [...text.matchAll(/(\d(?:\.\d{1,2})?)\s*GHz/gi)].map(
      (m) => Number(m[1]),
    );
    if (clockMatches.length >= 1) {
      out.base_clock_ghz = Math.min(...clockMatches);
      if (clockMatches.length >= 2) out.turbo_clock_ghz = Math.max(...clockMatches);
    }
    const tdpMatch =
      text.match(/(\d{2,3})\s*W(?:att)?\s*(?:TDP|thermal)/i) ??
      text.match(/TDP\s*(?:of\s*)?(\d{2,3})\s*W/i);
    if (tdpMatch) out.tdp_w = Number(tdpMatch[1]);
    const nmMatch = text.match(/(\d{1,2})\s*nm\b/i);
    if (nmMatch) out.process_nm = Number(nmMatch[1]);
    const socketMatch = text.match(
      /\b(LGA\s*\d{3,4}|AM[345]\+?|FM2\+?|SP[35]|sTRX\d)\b/i,
    );
    if (socketMatch) out.socket = socketMatch[1].replace(/\s+/g, "").toUpperCase();
  } else {
    const vramMatch = text.match(
      /(\d{1,2})\s*GB\s*(?:of\s*)?(GDDR\dX?|HBM\d?e?|DDR\d)/i,
    );
    if (vramMatch) {
      out.vram_gb = Number(vramMatch[1]);
      out.vram_type = vramMatch[2].toUpperCase();
    }
    const dxMatch = text.match(/DirectX\s*(\d{1,2}(?:\.\d)?)/i);
    if (dxMatch) out.directx_version = dxMatch[1];
    const tdpMatch = text.match(/(\d{2,3})\s*W\b/);
    if (tdpMatch) out.tdp_w = Number(tdpMatch[1]);
  }
  return out;
}

interface ClassifiedCanonicalLink {
  slotId: string;
  label: string;
  url: string;
  priority: number;
  score: number;
}

function classifyCanonicalExtLinks(
  urls: string[],
  rawQuery: string,
): ClassifiedCanonicalLink[] {
  const querySig = parseModelSignature(rawQuery);
  const found: ClassifiedCanonicalLink[] = [];
  const seen = new Set<string>();

  for (const raw of urls) {
    const safe = sanitizeHttpUrl(raw);
    if (!safe || isSearchOrListingUrl(safe) || seen.has(safe)) continue;
    seen.add(safe);
    const lower = safe.toLowerCase();

    let slotId = "";
    let label = "";
    let priority = 0;

    if (
      lower.includes("intel.com/content/www/us/en/products/sku/") ||
      lower.includes("ark.intel.com/content/www/")
    ) {
      slotId = "intel_ark";
      label = "Intel ARK";
      priority = 100;
    } else if (lower.includes("amd.com/en/products/")) {
      slotId = "amd_official";
      label = "AMD Official";
      priority = 100;
    } else if (lower.includes("nvidia.com/en-us/geforce/") || lower.includes("nvidia.com/en-us/drivers")) {
      slotId = "nvidia_official";
      label = "NVIDIA Official";
      priority = 85;
    } else if (lower.includes("techpowerup.com/gpu-specs/") && lower.includes(".c")) {
      slotId = "tpu_gpu";
      label = "TechPowerUp GPU DB";
      priority = 95;
    } else if (lower.includes("techpowerup.com/cpu-specs/") && lower.includes(".c")) {
      slotId = "tpu_cpu";
      label = "TechPowerUp CPU DB";
      priority = 90;
    } else if (lower.includes("techpowerup.com/ssd-specs/") && lower.includes(".c")) {
      slotId = "tpu_ssd";
      label = "TechPowerUp SSD DB";
      priority = 90;
    } else if (lower.includes("cpubenchmark.net/cpu.php")) {
      slotId = "passmark_cpu";
      label = "PassMark CPU Mark";
      priority = 70;
    } else if (lower.includes("videocardbenchmark.net/gpu.php")) {
      slotId = "passmark_gpu";
      label = "PassMark G3D Mark";
      priority = 70;
    } else if (lower.includes("notebookcheck.net/")) {
      slotId = "notebookcheck";
      label = "Notebookcheck Review";
      priority = 80;
    }

    if (!slotId) continue;

    // Verify URL tokens against query core tokens so we don't pick a sibling SKU from an architecture Wikipedia page
    const urlSig = parseModelSignature(safe.replace(/[/-_+.]/g, " "));
    if (querySig.coreTokens.length > 0) {
      const hasCoreMatch = querySig.coreTokens.some((core) =>
        urlSig.allTokens.some((t) => t === core || t.includes(core)),
      );
      if (!hasCoreMatch && slotId !== "intel_ark") {
        continue;
      }
    }

    const overlap = scoreTokenOverlap(
      urlSig.allTokens,
      querySig.meaningfulTokens,
    );
    found.push({ slotId, label, url: safe, priority, score: overlap });
  }

  return found.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.priority - a.priority;
  });
}

async function queryWikipediaRich(
  query: string,
  brand: string,
  partType: LookupPartType,
): Promise<{
  specs: Partial<HardwareLookupResult>;
  summary: string;
  canonicalLinks: ClassifiedCanonicalLink[];
} | null> {
  if (partType !== "cpu" && partType !== "gpu" && partType !== "laptop") {
    return null;
  }
  try {
    const noun =
      partType === "cpu"
        ? "processor"
        : partType === "gpu"
          ? "graphics"
          : "laptop";
    const searchQ = `${brand} ${query} ${noun}`.trim();
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchQ)}&srlimit=3&utf8=&format=json`;
    const searchRes = await fetch(searchUrl, {
      signal: AbortSignal.timeout(3500),
      headers: { "User-Agent": "VelociPCs-Inventory/1.0 (hardware lookup)" },
    });
    if (!searchRes.ok) return null;
    const searchJson = await searchRes.json();
    const titles: string[] = (searchJson?.query?.search ?? [])
      .map((s: { title?: string }) => s.title)
      .filter((t: unknown): t is string => typeof t === "string" && t.length > 0);
    if (titles.length === 0) return null;

    const detailUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts|revisions|extlinks&exintro=1&explaintext=1&rvprop=content&rvslots=main&ellimit=150&titles=${encodeURIComponent(titles.join("|"))}&format=json`;
    const detailRes = await fetch(detailUrl, {
      signal: AbortSignal.timeout(4000),
      headers: { "User-Agent": "VelociPCs-Inventory/1.0 (hardware lookup)" },
    });
    if (!detailRes.ok) return null;
    const detailJson = await detailRes.json();
    const pages = Object.values(detailJson?.query?.pages ?? {}) as Array<{
      title?: string;
      extract?: string;
      revisions?: Array<{ slots?: { main?: { "*"?: string } } }>;
      extlinks?: Array<{ "*"?: string }>;
    }>;

    const primaryPage =
      pages.find((p) => p.title === titles[0]) ?? pages[0];
    const summary = primaryPage?.extract?.slice(0, 500) ?? "";
    const wikitext =
      primaryPage?.revisions?.[0]?.slots?.main?.["*"] ?? "";

    const allExtUrls: string[] = [];
    for (const p of pages) {
      for (const e of p.extlinks ?? []) {
        if (e["*"]) allExtUrls.push(e["*"]);
      }
    }

    const specPartType: "cpu" | "gpu" = partType === "gpu" ? "gpu" : "cpu";
    const textSpecs = summary ? extractSpecsFromText(summary, specPartType) : {};
    const infoboxSpecs = wikitext
      ? extractSpecsFromInfobox(parseWikipediaInfobox(wikitext), specPartType)
      : {};

    const specs: Partial<HardwareLookupResult> =
      partType === "laptop" ? {} : { ...textSpecs, ...infoboxSpecs };

    const canonicalLinks = classifyCanonicalExtLinks(allExtUrls, query);

    return { specs, summary, canonicalLinks };
  } catch {
    return null;
  }
}

async function queryDbGpuCandidates(
  query: string,
  brand: string,
): Promise<{
  best: HardwareLookupResult | null;
  candidates: LinkCandidate[];
  status: "found" | "ambiguous" | "not_found";
}> {
  const items = await getDbGpuCatalog();
  if (items.length === 0) {
    return { best: null, candidates: [], status: "not_found" };
  }

  const querySig = parseModelSignature(query);
  if (querySig.allTokens.length === 0) {
    return { best: null, candidates: [], status: "not_found" };
  }

  const scored: Array<{ item: SlimDbGpu; score: number }> = [];
  const minScore = querySig.coreTokens.length > 0 ? 6 : 8;

  for (const item of items) {
    const sig = parseModelSignature(`${item.brand} ${item.name}`);
    let score = scoreModelMatch(sig, querySig);
    if (score < 0) continue;
    if (brand && item.brand.toLowerCase() === brand.toLowerCase()) {
      score += 2;
    }
    if (score >= minScore) {
      scored.push({ item, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 3);
  if (top.length === 0) {
    return { best: null, candidates: [], status: "not_found" };
  }

  const bestScore = top[0].score;
  const secondScore = top[1]?.score ?? -999;
  const isAmbiguous = top.length >= 2 && bestScore - secondScore <= 2;

  const candidates: LinkCandidate[] = [];
  for (let i = 0; i < top.length; i += 1) {
    const entry = top[i].item;
    if (!entry.tpu_url) continue;
    candidates.push({
      url: entry.tpu_url,
      title: `${entry.brand} ${entry.name}`.trim(),
      source: "dbgpu",
      confidence: i === 0 && !isAmbiguous ? "high" : "medium",
    });
  }

  const topItem = top[0].item;
  const specUrl =
    topItem.tpu_url ?? buildOfficialSearchUrl(topItem.name, topItem.brand, "gpu");

  const best: HardwareLookupResult = {
    partType: "gpu",
    name: topItem.name,
    brand: topItem.brand,
    architecture: topItem.architecture,
    vram_gb: topItem.vram_gb,
    vram_type: topItem.vram_type,
    bus_interface: topItem.bus_interface,
    process_nm: topItem.process_nm,
    tdp_w: topItem.tdp_w,
    directx_version: topItem.directx_version,
    is_mobile: topItem.is_mobile,
    spec_url: specUrl,
    source: "live",
    confidence: topItem.tpu_url && !isAmbiguous ? "high" : "medium",
    summary: `Matched ${topItem.brand} ${topItem.name} from dbgpu open specification database.`,
  };

  return {
    best,
    candidates,
    status:
      candidates.length === 0
        ? "not_found"
        : isAmbiguous && candidates.length >= 2
          ? "ambiguous"
          : "found",
  };
}

async function queryRetroWebMotherboards(
  query: string,
  brand: string,
): Promise<LinkCandidate[]> {
  const candidates: LinkCandidate[] = [];
  const attempts = [query.trim()];
  if (brand.trim()) {
    const stripped = query
      .replace(new RegExp(`^${brand.trim()}\\s+`, "i"), "")
      .trim();
    if (stripped && stripped !== query.trim()) attempts.push(stripped);
  }

  const querySig = parseModelSignature(query);

  for (const term of attempts) {
    try {
      const res = await fetch(
        `https://theretroweb.com/motherboards/?name=${encodeURIComponent(term)}`,
        {
          signal: AbortSignal.timeout(3500),
          headers: { "User-Agent": "VelociPCs-Inventory/1.0" },
        },
      );
      if (!res.ok) continue;
      const html = await res.text();
      const seen = new Set<string>();
      const scored: Array<{ candidate: LinkCandidate; score: number }> = [];

      const linkRe =
        /href="(\/motherboards\/s\/[a-z0-9-]+)"[^>]*>([^<]{2,100})<\/a>/gi;
      for (const m of html.matchAll(linkRe)) {
        const path = m[1];
        const title = m[2].replace(/\s+/g, " ").trim();
        const url = `https://theretroweb.com${path}`;
        if (seen.has(url) || !title) continue;
        seen.add(url);
        const sig = parseModelSignature(title);
        const score = scoreModelMatch(sig, querySig);
        if (score >= 0) {
          scored.push({
            candidate: {
              url,
              title,
              source: "The Retro Web",
              confidence: score >= 8 ? "high" : "medium",
            },
            score,
          });
        }
      }

      scored.sort((a, b) => b.score - a.score);
      for (const s of scored.slice(0, 3)) {
        candidates.push(s.candidate);
      }
      if (candidates.length > 0) break;
    } catch {
      // ignore timeout/network failure
    }
  }

  return candidates;
}

const BLOCKED_RETAILER_DOMAINS = [
  "google.com",
  "bing.com",
  "duckduckgo.com",
  "amazon.",
  "newegg.",
  "ebay.",
  "walmart.",
  "bestbuy.",
  "bhphotovideo.",
  "microcenter.",
  "pcpartpicker.com",
  "reddit.com",
  "youtube.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "wikipedia.org",
  "userbenchmark.com",
  "versus.com",
  "nanoreview.net",
];

function getPartNoun(partType: LookupPartType): string {
  switch (partType) {
    case "cpu":
      return "processor";
    case "gpu":
      return "graphics";
    case "gpu_aib":
      return "graphics card";
    case "motherboard":
      return "motherboard";
    case "ram":
      return "memory RAM";
    case "storage_drive":
      return "SSD drive";
    case "psu":
      return "power supply";
    case "case":
      return "PC case";
    case "cooler":
      return "CPU cooler";
    case "wifi":
      return "wireless adapter";
    case "laptop":
      return "laptop";
  }
}

function buildSearchApiQuery(
  slotId: string,
  query: string,
  brand: string,
  partType: LookupPartType,
): string {
  const full = query.trim();
  const noun = getPartNoun(partType);
  switch (slotId) {
    case "intel_ark":
      return `site:intel.com/content/www/us/en/products/sku OR site:ark.intel.com ${full}`;
    case "amd_official":
      return `site:amd.com/en/products ${full}`;
    case "nvidia_official":
      return `site:nvidia.com ${full} specifications`;
    case "tpu_cpu":
      return `site:techpowerup.com/cpu-specs ${full}`;
    case "tpu_gpu":
    case "tpu_aib":
      return `site:techpowerup.com/gpu-specs ${full}`;
    case "tpu_ssd":
      return `site:techpowerup.com/ssd-specs ${full}`;
    case "passmark_cpu":
      return `site:cpubenchmark.net/cpu.php ${full}`;
    case "passmark_gpu":
      return `site:videocardbenchmark.net/gpu.php ${full}`;
    case "retro_web":
      return `site:theretroweb.com/motherboards/s ${full}`;
    case "notebookcheck":
      return `site:notebookcheck.net ${full}`;
    case "cybenetics":
      return `(site:cybenetics.com OR site:clearesult.com) ${full}`;
    case "manual_support":
      return `${brand ? `${brand} ` : ""}${full} ${noun} manual support`;
    case "drivers":
      return `${brand ? `${brand} ` : ""}${full} drivers support`;
    default:
      return `${brand ? `${brand} ` : ""}${full} ${noun} specifications`;
  }
}

function urlMatchesSlotExpectation(slotId: string, url: string): boolean {
  const lower = url.toLowerCase();
  if (isSearchOrListingUrl(url)) return false;
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return false;
  }

  for (const blocked of BLOCKED_RETAILER_DOMAINS) {
    if (host.includes(blocked)) return false;
  }

  switch (slotId) {
    case "intel_ark":
      return (
        host.endsWith("intel.com") &&
        (lower.includes("/products/sku/") || lower.includes("ark.intel.com"))
      );
    case "amd_official":
      return host.endsWith("amd.com") && lower.includes("/products/");
    case "nvidia_official":
      return host.endsWith("nvidia.com");
    case "tpu_cpu":
      return host.endsWith("techpowerup.com") && lower.includes("/cpu-specs/");
    case "tpu_gpu":
    case "tpu_aib":
      return host.endsWith("techpowerup.com") && lower.includes("/gpu-specs/");
    case "tpu_ssd":
      return host.endsWith("techpowerup.com") && lower.includes("/ssd-specs/");
    case "passmark_cpu":
      return host.endsWith("cpubenchmark.net") && lower.includes("cpu.php");
    case "passmark_gpu":
      return host.endsWith("videocardbenchmark.net") && lower.includes("gpu.php");
    case "retro_web":
      return (
        host.endsWith("theretroweb.com") &&
        lower.includes("/motherboards/s/")
      );
    case "notebookcheck":
      return host.endsWith("notebookcheck.net");
    case "cybenetics":
      return host.endsWith("cybenetics.com") || host.endsWith("clearesult.com");
    default:
      return true;
  }
}

async function runSerperOrBraveSearch(
  searchQuery: string,
  serperKey: string | undefined,
  braveKey: string | undefined,
): Promise<Array<{ url: string; title: string; provider: string }>> {
  if (serperKey) {
    try {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        signal: AbortSignal.timeout(4000),
        headers: {
          "X-API-KEY": serperKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: searchQuery, num: 5 }),
      });
      if (res.ok) {
        const data = await res.json();
        const organic = (data?.organic ?? []) as Array<{
          link?: string;
          title?: string;
        }>;
        return organic
          .filter((r) => r.link)
          .map((r) => ({
            url: r.link!,
            title: r.title ?? r.link!,
            provider: "Serper",
          }));
      }
    } catch {
      // fall through
    }
  }

  if (braveKey) {
    try {
      const res = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(searchQuery)}&count=5`,
        {
          signal: AbortSignal.timeout(4000),
          headers: {
            "X-Subscription-Token": braveKey,
            Accept: "application/json",
          },
        },
      );
      if (res.ok) {
        const data = await res.json();
        const results = (data?.web?.results ?? []) as Array<{
          url?: string;
          title?: string;
        }>;
        return results
          .filter((r) => r.url)
          .map((r) => ({
            url: r.url!,
            title: r.title ?? r.url!,
            provider: "Brave Search",
          }));
      }
    } catch {
      // fall through
    }
  }

  return [];
}

async function searchWebForSlot(
  slotId: string,
  slotLabel: string,
  query: string,
  brand: string,
  partType: LookupPartType,
  serperKey: string | undefined,
  braveKey: string | undefined,
): Promise<SlotLookupResult> {
  const searchQ = buildSearchApiQuery(slotId, query, brand, partType);
  const rawResults = await runSerperOrBraveSearch(searchQ, serperKey, braveKey);
  const querySig = parseModelSignature(query);
  const brandLower = brand.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

  const scored: Array<{ candidate: LinkCandidate; score: number }> = [];
  const seen = new Set<string>();

  for (const r of rawResults) {
    const safe = sanitizeHttpUrl(r.url);
    if (!safe || seen.has(safe)) continue;
    if (!urlMatchesSlotExpectation(slotId, safe)) continue;
    seen.add(safe);

    const titleSig = parseModelSignature(`${r.title} ${safe.replace(/[/-_+.]/g, " ")}`);
    let score = scoreTokenOverlap(titleSig.allTokens, querySig.meaningfulTokens);
    if (querySig.coreTokens.length > 0) {
      const matchedCore = querySig.coreTokens.filter((c) =>
        titleSig.allTokens.some((t) => t === c || t.includes(c)),
      );
      if (matchedCore.length === 0) continue;
      score += matchedCore.length * 6;
    }

    if (brandLower) {
      try {
        const host = new URL(safe).hostname.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (host.includes(brandLower)) score += 8;
      } catch {
        // ignore
      }
    }

    scored.push({
      candidate: {
        url: safe,
        title: r.title.slice(0, 90),
        source: r.provider,
        confidence: score >= 10 ? "high" : "medium",
      },
      score,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 3);
  if (top.length === 0) {
    return {
      slotId,
      label: slotLabel,
      status: "not_found",
      bestUrl: null,
      candidates: [],
    };
  }

  const bestScore = top[0].score;
  const secondScore = top[1]?.score ?? -999;
  const isAmbiguous = top.length >= 2 && bestScore - secondScore <= 2 && bestScore < 14;

  return {
    slotId,
    label: slotLabel,
    status: isAmbiguous ? "ambiguous" : "found",
    bestUrl: isAmbiguous ? null : top[0].candidate.url,
    bestTitle: isAmbiguous ? null : top[0].candidate.title,
    confidence: top[0].candidate.confidence,
    source: top[0].candidate.source,
    candidates: top.map((t) => t.candidate),
  };
}

const SLOT_LABELS: Record<string, string> = {
  intel_ark: "Intel ARK",
  amd_official: "AMD Official",
  nvidia_official: "NVIDIA Official",
  tpu_cpu: "TechPowerUp CPU DB",
  tpu_gpu: "TechPowerUp GPU DB",
  tpu_ssd: "TechPowerUp SSD DB",
  tpu_aib: "TechPowerUp AIB",
  passmark_cpu: "PassMark CPU Mark",
  passmark_gpu: "PassMark G3D Mark",
  manufacturer: "Manufacturer Page",
  retro_web: "The Retro Web",
  manual_support: "Manual / Support",
  notebookcheck: "Notebookcheck Review",
  cybenetics: "Cybenetics / 80 PLUS",
  drivers: "Drivers / Support",
};

function classifyUrlSlotId(url: string): string | null {
  const lower = url.toLowerCase();
  if (isSearchOrListingUrl(url)) return null;
  if (lower.includes("intel.com") && (lower.includes("/products/sku/") || lower.includes("ark.intel.com"))) {
    return "intel_ark";
  }
  if (lower.includes("amd.com/en/products/")) return "amd_official";
  if (lower.includes("nvidia.com")) return "nvidia_official";
  if (lower.includes("techpowerup.com/cpu-specs/")) return "tpu_cpu";
  if (lower.includes("techpowerup.com/gpu-specs/")) return "tpu_gpu";
  if (lower.includes("techpowerup.com/ssd-specs/")) return "tpu_ssd";
  if (lower.includes("cpubenchmark.net/cpu.php")) return "passmark_cpu";
  if (lower.includes("videocardbenchmark.net/gpu.php")) return "passmark_gpu";
  if (lower.includes("theretroweb.com/motherboards/s/")) return "retro_web";
  if (lower.includes("notebookcheck.net/")) return "notebookcheck";
  if (lower.includes("cybenetics.com") || lower.includes("clearesult.com")) {
    return "cybenetics";
  }
  return null;
}

function getDefaultSlotsForPart(
  partType: LookupPartType,
  brand: string,
): string[] {
  const b = brand.toLowerCase();
  switch (partType) {
    case "cpu":
      return [
        b.includes("intel")
          ? "intel_ark"
          : b.includes("amd")
            ? "amd_official"
            : "manufacturer",
        "tpu_cpu",
        "passmark_cpu",
      ];
    case "gpu":
      return [
        "tpu_gpu",
        b.includes("nvidia")
          ? "nvidia_official"
          : b.includes("amd") || b.includes("ati")
            ? "amd_official"
            : b.includes("intel")
              ? "intel_ark"
              : "manufacturer",
        "passmark_gpu",
      ];
    case "gpu_aib":
      return ["manufacturer", "tpu_aib", "manual_support"];
    case "motherboard":
      return ["manufacturer", "retro_web", "manual_support"];
    case "storage_drive":
      return ["manufacturer", "tpu_ssd"];
    case "psu":
      return ["manufacturer", "cybenetics"];
    case "ram":
      return ["manufacturer"];
    case "case":
    case "cooler":
      return ["manufacturer", "manual_support"];
    case "wifi":
      return [b.includes("intel") ? "intel_ark" : "manufacturer", "drivers"];
    case "laptop":
      return ["manufacturer", "notebookcheck", "manual_support"];
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as LookupRequest;
    const rawQuery = (body.query ?? "").trim();
    const partType: LookupPartType = body.partType ?? "cpu";

    if (!rawQuery) {
      return new Response(
        JSON.stringify({
          results: [],
          slotResults: {},
          searchProvider: "free",
          source: "catalog",
          note: "Enter a brand and model name to search for specs and direct links.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const serperKey = Deno.env.get("SERPER_API_KEY") || undefined;
    const braveKey = Deno.env.get("BRAVE_SEARCH_API_KEY") || undefined;
    const searchProvider: "serper" | "brave" | "free" = serperKey
      ? "serper"
      : braveKey
        ? "brave"
        : "free";

    const brand = inferBrand(rawQuery, body.brand, body.vendor);
    const requestedSlots =
      Array.isArray(body.slots) && body.slots.length > 0
        ? body.slots
        : getDefaultSlotsForPart(partType, brand);

    const slotResults: Record<string, SlotLookupResult> = {};
    for (const slotId of requestedSlots) {
      slotResults[slotId] = {
        slotId,
        label: SLOT_LABELS[slotId] ?? slotId,
        status: "not_found",
        bestUrl: null,
        candidates: [],
      };
    }

    const setSlotFound = (
      slotId: string,
      candidate: LinkCandidate,
      extraCandidates?: LinkCandidate[],
    ) => {
      if (!slotResults[slotId]) return;
      const existing = slotResults[slotId];
      if (existing.status === "found" && existing.bestUrl) return;
      slotResults[slotId] = {
        slotId,
        label: existing.label,
        status: "found",
        bestUrl: candidate.url,
        bestTitle: candidate.title,
        confidence: candidate.confidence,
        source: candidate.source,
        candidates:
          extraCandidates && extraCandidates.length > 0
            ? extraCandidates
            : [candidate],
      };
    };

    const queryTokens = normalizeTokens(rawQuery);
    const isChipLookup = partType === "cpu" || partType === "gpu";
    const pool =
      partType === "cpu"
        ? CPU_CATALOG
        : partType === "gpu"
          ? GPU_CATALOG
          : [];

    const rankedCatalog = pool
      .map((item) => ({ item, score: scoreCatalogMatch(item, queryTokens) }))
      .filter((entry) => entry.score >= Math.max(2, queryTokens.length))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((entry) => ({
        ...entry.item,
        spec_links: dedupeSpecLinks(
          entry.item.spec_url,
          entry.item.spec_links ?? [],
        ),
      }));

    // Seed slotResults from exact catalog entry if available
    const exactCatalogHit =
      rankedCatalog.length > 0 &&
      (rankedCatalog[0].name.toLowerCase() === rawQuery.toLowerCase() ||
        `${rankedCatalog[0].brand} ${rankedCatalog[0].name}`.toLowerCase() ===
          rawQuery.toLowerCase())
        ? rankedCatalog[0]
        : null;

    if (exactCatalogHit) {
      const catalogLinks: Array<{ url: string; label: string }> = [
        { url: exactCatalogHit.spec_url, label: exactCatalogHit.name },
        ...(exactCatalogHit.spec_links ?? []),
      ];
      for (const link of catalogLinks) {
        const sid = classifyUrlSlotId(link.url);
        if (sid && slotResults[sid]) {
          setSlotFound(sid, {
            url: link.url,
            title: `${exactCatalogHit.brand} ${exactCatalogHit.name}`.trim(),
            source: "Catalog",
            confidence: "high",
            passmark_score:
              sid === "passmark_cpu" || sid === "passmark_gpu"
                ? exactCatalogHit.passmark_score ?? null
                : undefined,
          });
        }
      }
    }

    // Run free structured lookups in parallel for any unresolved slots
    const needWiki =
      partType === "cpu" || partType === "gpu" || partType === "laptop";
    const needPassMark =
      (partType === "cpu" &&
        slotResults.passmark_cpu?.status !== "found") ||
      (partType === "gpu" &&
        slotResults.passmark_gpu?.status !== "found");
    const needDbGpu =
      partType === "gpu" && slotResults.tpu_gpu?.status !== "found";
    const needRetroWeb =
      partType === "motherboard" && slotResults.retro_web?.status !== "found";

    const [wikiRes, pmList, dbGpuRes, retroCandidates] = await Promise.all([
      needWiki ? queryWikipediaRich(rawQuery, brand, partType) : Promise.resolve(null),
      needPassMark
        ? getPassMarkList(partType === "gpu" ? "gpu" : "cpu")
        : Promise.resolve([]),
      needDbGpu
        ? queryDbGpuCandidates(rawQuery, brand)
        : Promise.resolve({
            best: null,
            candidates: [] as LinkCandidate[],
            status: "not_found" as const,
          }),
      needRetroWeb
        ? queryRetroWebMotherboards(rawQuery, brand)
        : Promise.resolve([] as LinkCandidate[]),
    ]);

    // Populate PassMark slot
    const pmMatch = needPassMark
      ? findPassMarkCandidates(pmList, rawQuery)
      : { best: null, status: "not_found" as const, candidates: [] as LinkCandidate[] };

    if (needPassMark) {
      const pmSlotId = partType === "gpu" ? "passmark_gpu" : "passmark_cpu";
      if (slotResults[pmSlotId]) {
        slotResults[pmSlotId] = {
          slotId: pmSlotId,
          label: slotResults[pmSlotId].label,
          status: pmMatch.status,
          bestUrl: pmMatch.best?.url ?? null,
          bestTitle: pmMatch.best?.name ?? null,
          confidence: pmMatch.best ? "high" : pmMatch.candidates.length > 0 ? "medium" : undefined,
          source: pmMatch.candidates.length > 0 ? "PassMark" : null,
          candidates: pmMatch.candidates,
        };
      }
    }

    // Populate TechPowerUp GPU DB slot from dbgpu
    if (needDbGpu && slotResults.tpu_gpu && dbGpuRes.candidates.length > 0) {
      slotResults.tpu_gpu = {
        slotId: "tpu_gpu",
        label: slotResults.tpu_gpu.label,
        status: dbGpuRes.status,
        bestUrl:
          dbGpuRes.status === "found" ? dbGpuRes.candidates[0].url : null,
        bestTitle:
          dbGpuRes.status === "found" ? dbGpuRes.candidates[0].title : null,
        confidence: dbGpuRes.candidates[0].confidence,
        source: "dbgpu",
        candidates: dbGpuRes.candidates,
      };
    }

    // Populate The Retro Web motherboard slot
    if (needRetroWeb && slotResults.retro_web && retroCandidates.length > 0) {
      const isAmbiguous =
        retroCandidates.length >= 2 &&
        retroCandidates[0].confidence !== "high";
      slotResults.retro_web = {
        slotId: "retro_web",
        label: slotResults.retro_web.label,
        status: isAmbiguous ? "ambiguous" : "found",
        bestUrl: isAmbiguous ? null : retroCandidates[0].url,
        bestTitle: isAmbiguous ? null : retroCandidates[0].title,
        confidence: retroCandidates[0].confidence,
        source: "The Retro Web",
        candidates: retroCandidates,
      };
    }

    // Populate remaining slots from Wikipedia external links
    if (wikiRes && wikiRes.canonicalLinks.length > 0) {
      for (const link of wikiRes.canonicalLinks) {
        if (slotResults[link.slotId]) {
          setSlotFound(link.slotId, {
            url: link.url,
            title: link.label,
            source: "Wikipedia",
            confidence: "high",
          });
        }
      }
    }

    // Optional Hybrid Search API enrichment for any still-unresolved slots (max 3 calls)
    if (serperKey || braveKey) {
      const unresolvedIds = requestedSlots
        .filter((id) => slotResults[id]?.status === "not_found")
        .slice(0, 3);

      if (unresolvedIds.length > 0) {
        const searchResults = await Promise.all(
          unresolvedIds.map((id) =>
            searchWebForSlot(
              id,
              slotResults[id].label,
              rawQuery,
              brand,
              partType,
              serperKey,
              braveKey,
            ),
          ),
        );
        for (const sr of searchResults) {
          if (sr.candidates.length > 0) {
            slotResults[sr.slotId] = sr;
          }
        }
      }
    }

    // Build legacy `results` array for CPU/GPU spec auto-fill
    const combined: HardwareLookupResult[] = [...rankedCatalog];
    if (isChipLookup && !exactCatalogHit) {
      const pmBest = pmMatch.best;
      if (partType === "gpu" && dbGpuRes.best) {
        const dbBest = dbGpuRes.best;
        const tpuUrl = slotResults.tpu_gpu?.bestUrl ?? dbBest.spec_url;
        const extraFromSlots: SpecLinkItem[] = Object.values(slotResults)
          .filter((s) => s.status === "found" && s.bestUrl && s.bestUrl !== tpuUrl)
          .map((s) => ({ label: s.label, url: s.bestUrl! }));

        combined.unshift({
          ...dbBest,
          spec_url: tpuUrl,
          passmark_score: pmBest?.score ?? dbBest.passmark_score ?? null,
          spec_links: dedupeSpecLinks(tpuUrl, extraFromSlots),
        });
      } else if (wikiRes) {
        const isMobile = /\b(mobile|laptop|max-q|hq|mq|hs|hx|u-series)\b/i.test(
          rawQuery,
        );
        const foundSlots = Object.values(slotResults).filter(
          (s) => s.status === "found" && s.bestUrl,
        );
        const primaryUrl =
          foundSlots[0]?.bestUrl ??
          buildOfficialSearchUrl(rawQuery, brand || "Intel", partType);
        const extraLinks = dedupeSpecLinks(
          primaryUrl,
          foundSlots.slice(1).map((s) => ({ label: s.label, url: s.bestUrl! })),
        );

        combined.unshift({
          partType,
          name: rawQuery,
          brand: brand || "Intel",
          is_mobile: isMobile,
          passmark_score: pmBest?.score ?? null,
          spec_url: primaryUrl,
          spec_links: extraLinks,
          source: "live",
          confidence:
            foundSlots.length > 0 || Object.keys(wikiRes.specs).length >= 2
              ? "high"
              : "medium",
          summary: wikiRes.summary || undefined,
          ...wikiRes.specs,
        });
      } else if (pmBest || combined.length === 0) {
        const isMobile = /\b(mobile|laptop|max-q|hq|mq|hs|hx|m)\b/i.test(
          rawQuery,
        );
        const foundSlots = Object.values(slotResults).filter(
          (s) => s.status === "found" && s.bestUrl,
        );
        const primaryUrl =
          foundSlots[0]?.bestUrl ??
          pmBest?.url ??
          buildOfficialSearchUrl(rawQuery, brand || "Intel", partType);
        const extraLinks = dedupeSpecLinks(
          primaryUrl,
          foundSlots.slice(1).map((s) => ({ label: s.label, url: s.bestUrl! })),
        );
        combined.unshift({
          partType,
          name: rawQuery,
          brand: brand || "Intel",
          is_mobile: isMobile,
          passmark_score: pmBest?.score ?? null,
          spec_url: primaryUrl,
          spec_links: extraLinks,
          source: pmBest || foundSlots.length > 0 ? "live" : "hybrid",
          confidence: foundSlots.length > 0 ? "high" : "medium",
          summary: pmBest
            ? `Matched PassMark entry "${pmBest.name}". Review specifications before saving.`
            : undefined,
        });
      }
    }

    const foundCount = Object.values(slotResults).filter(
      (s) => s.status === "found",
    ).length;
    const ambiguousCount = Object.values(slotResults).filter(
      (s) => s.status === "ambiguous",
    ).length;
    const totalCount = requestedSlots.length;

    let note = "";
    if (foundCount === totalCount && totalCount > 0) {
      note = `Found all ${totalCount} direct links automatically.`;
    } else if (foundCount > 0 || ambiguousCount > 0) {
      note = `Found ${foundCount} of ${totalCount} links${
        ambiguousCount > 0 ? ` (${ambiguousCount} need disambiguation)` : ""
      }. Review or use Search on any remaining slots.`;
    } else {
      note =
        searchProvider === "free"
          ? "No direct URLs found in free sources — use the Search buttons below to grab and paste them."
          : "No direct matches found — use the Search buttons below to grab and paste them.";
    }

    return new Response(
      JSON.stringify({
        results: combined.slice(0, 6),
        slotResults,
        searchProvider,
        source:
          exactCatalogHit
            ? "catalog"
            : wikiRes || dbGpuRes.best || pmMatch.best || foundCount > 0
              ? "hybrid"
              : "catalog",
        note,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown lookup error";
    return new Response(
      JSON.stringify({
        error: message,
        results: [],
        slotResults: {},
        searchProvider: "free",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
