import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface LookupRequest {
  query?: string;
  partType?: "cpu" | "gpu";
  vendor?: "Intel" | "AMD" | "NVIDIA" | "Auto";
}

export interface SpecLinkItem {
  label: string;
  url: string;
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

function inferBrand(query: string, vendor?: string): string {
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
  return "Intel";
}

function buildOfficialSearchUrl(
  query: string,
  brand: string,
  partType: "cpu" | "gpu",
): string {
  const encoded = encodeURIComponent(query.trim());
  if (brand === "Intel") {
    return `https://www.intel.com/content/www/us/en/ark/search.html?_charset_=UTF-8&q=${encoded}`;
  }
  if (brand === "AMD") {
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
      const mobileFlag = /\b(mobile|laptop|max-q|m)\b/i.test(name) ||
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
      signal: AbortSignal.timeout(4000),
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

function findBestPassMarkMatch(
  entries: PassMarkEntry[],
  queryTokens: string[],
): PassMarkEntry | null {
  if (entries.length === 0 || queryTokens.length === 0) return null;
  let best: PassMarkEntry | null = null;
  let bestScore = 0;

  for (const entry of entries) {
    const score = scoreTokenOverlap(entry.tokens, queryTokens);
    const minNeeded = queryTokens.length * 2;
    if (score >= minNeeded && score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return best;
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
      const m = sockRaw.match(/\b(LGA\s*\d{3,4}|AM[2345]\+?|FM2\+?|SP[356]|sTRX\d|FP[678]|FCBGA\d+|FCPGA\d+|PGA\d+|Socket\s+[A-Z0-9]+)\b/i);
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

function classifyCanonicalExtLinks(
  urls: string[],
  queryTokens: string[],
): Array<{ label: string; url: string; priority: number }> {
  const found: Array<{ label: string; url: string; priority: number }> = [];

  for (const raw of urls) {
    const safe = sanitizeHttpUrl(raw);
    if (!safe) continue;
    const lower = safe.toLowerCase();

    if (
      (lower.includes("intel.com/content/www/us/en/products/sku/") ||
        lower.includes("ark.intel.com/content/www/")) &&
      !lower.includes("search.html")
    ) {
      found.push({ label: "Intel ARK", url: safe, priority: 100 });
    } else if (
      lower.includes("amd.com/en/products/") &&
      !lower.includes("site-search")
    ) {
      found.push({ label: "AMD Official", url: safe, priority: 100 });
    } else if (lower.includes("techpowerup.com/gpu-specs/") && lower.includes(".c")) {
      found.push({ label: "TechPowerUp GPU DB", url: safe, priority: 95 });
    } else if (lower.includes("techpowerup.com/cpu-specs/") && lower.includes(".c")) {
      found.push({ label: "TechPowerUp CPU DB", url: safe, priority: 90 });
    } else if (lower.includes("nvidia.com/en-us/geforce/")) {
      found.push({ label: "NVIDIA Official", url: safe, priority: 85 });
    } else if (lower.includes("cpubenchmark.net/cpu.php")) {
      found.push({ label: "PassMark CPU Mark", url: safe, priority: 70 });
    } else if (lower.includes("videocardbenchmark.net/gpu.php")) {
      found.push({ label: "PassMark G3D Mark", url: safe, priority: 70 });
    }
  }

  return found.sort((a, b) => {
    const aMatch = scoreTokenOverlap(normalizeTokens(a.url), queryTokens);
    const bMatch = scoreTokenOverlap(normalizeTokens(b.url), queryTokens);
    if (bMatch !== aMatch) return bMatch - aMatch;
    return b.priority - a.priority;
  });
}

async function queryWikipediaRich(
  query: string,
  brand: string,
  partType: "cpu" | "gpu",
): Promise<{
  specs: Partial<HardwareLookupResult>;
  summary: string;
  canonicalLinks: Array<{ label: string; url: string; priority: number }>;
} | null> {
  try {
    const searchQ = `${brand} ${query} ${partType === "cpu" ? "processor" : "graphics"}`;
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchQ)}&srlimit=2&utf8=&format=json`;
    const searchRes = await fetch(searchUrl, {
      signal: AbortSignal.timeout(3500),
      headers: { "User-Agent": "VelociPCs-Inventory/1.0 (hardware lookup)" },
    });
    if (!searchRes.ok) return null;
    const searchJson = await searchRes.json();
    const topTitle = searchJson?.query?.search?.[0]?.title as string | undefined;
    if (!topTitle) return null;

    const detailUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts|revisions|extlinks&exintro=1&explaintext=1&rvprop=content&rvslots=main&ellimit=100&titles=${encodeURIComponent(topTitle)}&format=json`;
    const detailRes = await fetch(detailUrl, {
      signal: AbortSignal.timeout(3500),
      headers: { "User-Agent": "VelociPCs-Inventory/1.0 (hardware lookup)" },
    });
    if (!detailRes.ok) return null;
    const detailJson = await detailRes.json();
    const pages = detailJson?.query?.pages ?? {};
    const firstPage = Object.values(pages)[0] as
      | {
          extract?: string;
          revisions?: Array<{ slots?: { main?: { "*"?: string } } }>;
          extlinks?: Array<{ "*"?: string }>;
        }
      | undefined;

    const summary = firstPage?.extract?.slice(0, 500) ?? "";
    const wikitext =
      firstPage?.revisions?.[0]?.slots?.main?.["*"] ?? "";
    const extUrls = (firstPage?.extlinks ?? [])
      .map((e) => e["*"] ?? "")
      .filter(Boolean);

    const textSpecs = summary ? extractSpecsFromText(summary, partType) : {};
    const infoboxSpecs = wikitext
      ? extractSpecsFromInfobox(parseWikipediaInfobox(wikitext), partType)
      : {};

    const specs: Partial<HardwareLookupResult> = {
      ...textSpecs,
      ...infoboxSpecs,
    };

    const canonicalLinks = classifyCanonicalExtLinks(
      extUrls,
      normalizeTokens(query),
    );

    return { specs, summary, canonicalLinks };
  } catch {
    return null;
  }
}

async function queryDbGpuLive(
  query: string,
  brand: string,
): Promise<HardwareLookupResult | null> {
  const items = await getDbGpuCatalog();
  if (items.length === 0) return null;
  const queryTokens = normalizeTokens(query);
  if (queryTokens.length === 0) return null;

  let best: SlimDbGpu | null = null;
  let bestScore = 0;

  for (const item of items) {
    let score = scoreTokenOverlap(item.tokens, queryTokens);
    if (brand && item.brand.toLowerCase() === brand.toLowerCase()) {
      score += 2;
    }
    if (
      score >= Math.max(3, queryTokens.length * 2) &&
      score > bestScore
    ) {
      bestScore = score;
      best = item;
    }
  }

  if (!best) return null;
  const specUrl =
    best.tpu_url ?? buildOfficialSearchUrl(best.name, best.brand, "gpu");

  return {
    partType: "gpu",
    name: best.name,
    brand: best.brand,
    architecture: best.architecture,
    vram_gb: best.vram_gb,
    vram_type: best.vram_type,
    bus_interface: best.bus_interface,
    process_nm: best.process_nm,
    tdp_w: best.tdp_w,
    directx_version: best.directx_version,
    is_mobile: best.is_mobile,
    spec_url: specUrl,
    source: "live",
    confidence: best.tpu_url ? "high" : "medium",
    summary: `Matched ${best.brand} ${best.name} from dbgpu open specification database.`,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as LookupRequest;
    const rawQuery = (body.query ?? "").trim();
    const partType: "cpu" | "gpu" = body.partType === "gpu" ? "gpu" : "cpu";

    if (!rawQuery) {
      return new Response(
        JSON.stringify({
          results: [],
          source: "catalog",
          note: "Enter a CPU or GPU model name (e.g., Ryzen 7 7800X3D, Core i5-12400F, RTX 4070).",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const brand = inferBrand(rawQuery, body.vendor);
    const queryTokens = normalizeTokens(rawQuery);
    const pool = partType === "cpu" ? CPU_CATALOG : GPU_CATALOG;

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

    if (
      rankedCatalog.length > 0 &&
      rankedCatalog[0].name.toLowerCase() === rawQuery.toLowerCase()
    ) {
      return new Response(
        JSON.stringify({
          results: rankedCatalog,
          source: "catalog",
          note: "Matched official verified specification entry with canonical datasheet and research links.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const [wikiRes, pmList, dbGpuMatch] = await Promise.all([
      queryWikipediaRich(rawQuery, brand, partType),
      getPassMarkList(partType),
      partType === "gpu" ? queryDbGpuLive(rawQuery, brand) : Promise.resolve(null),
    ]);

    const pmMatch = findBestPassMarkMatch(pmList, queryTokens);
    const combined: HardwareLookupResult[] = [...rankedCatalog];

    if (partType === "gpu" && dbGpuMatch) {
      const wikiLinks = wikiRes?.canonicalLinks ?? [];
      const extraLinks: SpecLinkItem[] = dedupeSpecLinks(dbGpuMatch.spec_url, [
        ...wikiLinks,
        ...(pmMatch
          ? [
              {
                label: "PassMark G3D Mark",
                url: pmMatch.url,
              },
            ]
          : []),
      ]);
      combined.unshift({
        ...dbGpuMatch,
        passmark_score: pmMatch?.score ?? dbGpuMatch.passmark_score ?? null,
        spec_links: extraLinks,
      });
    } else if (wikiRes) {
      const isMobile = /\b(mobile|laptop|max-q|hq|mq|hs|hx|u-series)\b/i.test(
        rawQuery,
      );
      const canonical = wikiRes.canonicalLinks;
      const primaryUrl =
        canonical[0]?.url ??
        pmMatch?.url ??
        buildOfficialSearchUrl(rawQuery, brand, partType);
      const extraLinks = dedupeSpecLinks(primaryUrl, [
        ...canonical.slice(1),
        ...(pmMatch
          ? [
              {
                label:
                  partType === "cpu" ? "PassMark CPU Mark" : "PassMark G3D Mark",
                url: pmMatch.url,
              },
            ]
          : []),
      ]);

      combined.unshift({
        partType,
        name: rawQuery,
        brand,
        is_mobile: isMobile,
        passmark_score: pmMatch?.score ?? null,
        spec_url: primaryUrl,
        spec_links: extraLinks,
        source: "live",
        confidence:
          canonical.length > 0 || Object.keys(wikiRes.specs).length >= 2
            ? "high"
            : "medium",
        summary: wikiRes.summary || undefined,
        ...wikiRes.specs,
      });
    } else if (pmMatch || combined.length === 0) {
      const isMobile = /\b(mobile|laptop|max-q|hq|mq|hs|hx|m)\b/i.test(
        rawQuery,
      );
      const primaryUrl =
        pmMatch?.url ?? buildOfficialSearchUrl(rawQuery, brand, partType);
      combined.unshift({
        partType,
        name: rawQuery,
        brand,
        is_mobile: isMobile,
        passmark_score: pmMatch?.score ?? null,
        spec_url: primaryUrl,
        spec_links: [],
        source: pmMatch ? "live" : "hybrid",
        confidence: "medium",
        summary: pmMatch
          ? `Matched PassMark entry "${pmMatch.name}". Review specifications before saving.`
          : `Prepared official ${brand} spec search link for "${rawQuery}". Fill or verify specs in the modal before saving.`,
      });
    }

    return new Response(
      JSON.stringify({
        results: combined.slice(0, 6),
        source: wikiRes || dbGpuMatch || pmMatch ? "hybrid" : "catalog",
        note:
          dbGpuMatch || wikiRes || pmMatch
            ? "Resolved live specifications and direct research links. Please review before saving."
            : "Returned closest catalog matches and official spec search URL. Please review before saving.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown lookup error";
    return new Response(
      JSON.stringify({ error: message, results: [] }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
