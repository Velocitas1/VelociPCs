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

export interface HardwareLookupResult {
  partType: "cpu" | "gpu";
  name: string;
  brand: string;
  spec_url: string;
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
  summary?: string | null;
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
    spec_url:
      "https://www.intel.com/content/www/us/en/products/sku/186605/intel-core-i99900k-processor-16m-cache-up-to-5-00-ghz/specifications.html",
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
    spec_url:
      "https://www.intel.com/content/www/us/en/products/sku/97185/intel-core-i77700hq-processor-6m-cache-up-to-3-80-ghz/specifications.html",
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
    spec_url:
      "https://www.intel.com/content/www/us/en/products/sku/80810/intel-core-i54690-processor-6m-cache-up-to-3-90-ghz/specifications.html",
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
    spec_url:
      "https://www.intel.com/content/www/us/en/products/sku/68316/intel-core-i53470-processor-6m-cache-up-to-3-60-ghz/specifications.html",
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
    spec_url:
      "https://www.intel.com/content/www/us/en/products/sku/29765/intel-core2-quad-processor-q6600-8m-cache-2-40-ghz-1066-mhz-fsb/specifications.html",
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
    spec_url:
      "https://www.amd.com/en/products/processors/desktops/ryzen/5000-series/amd-ryzen-5-5600x.html",
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
    spec_url:
      "https://www.amd.com/en/products/processors/desktops/ryzen/3000-series/amd-ryzen-5-3600.html",
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
    spec_url:
      "https://www.amd.com/en/products/processors/laptop/ryzen/8000-series/amd-ryzen-9-8945hs.html",
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
    spec_url:
      "https://www.amd.com/en/products/processors/laptop/ryzen/7000-series/amd-ryzen-9-7940hs.html",
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
    spec_url:
      "https://www.amd.com/en/search/site-search.html#q=FX-8350",
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
    spec_url:
      "https://www.amd.com/en/search/site-search.html#q=Phenom%20II%20X4%20965",
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
    spec_url:
      "https://www.nvidia.com/en-us/geforce/graphics-cards/40-series/rtx-4090/",
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
    spec_url:
      "https://www.nvidia.com/en-us/geforce/graphics-cards/40-series/rtx-4070-family/",
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
    spec_url:
      "https://www.nvidia.com/en-us/geforce/laptops/40-series/",
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
    spec_url:
      "https://www.nvidia.com/en-us/geforce/graphics-cards/30-series/rtx-3060-3060ti/",
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
    spec_url:
      "https://www.techpowerup.com/gpu-specs/geforce-rtx-2080-ti.c3305",
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
    spec_url:
      "https://www.techpowerup.com/gpu-specs/geforce-gtx-1080-ti.c2877",
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
    spec_url:
      "https://www.techpowerup.com/gpu-specs/geforce-gtx-970.c2620",
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
    spec_url:
      "https://www.amd.com/en/products/graphics/desktops/radeon/7000-series/amd-radeon-rx-7800-xt.html",
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
    spec_url:
      "https://www.amd.com/en/products/graphics/desktops/radeon/6000-series/amd-radeon-rx-6600.html",
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
    spec_url:
      "https://www.amd.com/en/products/graphics/desktops/radeon/6000-series/amd-radeon-rx-6400.html",
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
    spec_url:
      "https://www.techpowerup.com/gpu-specs/radeon-rx-580.c2938",
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
    spec_url:
      "https://www.intel.com/content/www/us/en/products/sku/241598/intel-arc-b580-graphics/specifications.html",
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
    spec_url:
      "https://www.intel.com/content/www/us/en/products/sku/229151/intel-arc-a770-graphics-16gb/specifications.html",
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
    /\brx\s*\d+/i.test(q)
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
  return `https://www.google.com/search?q=${encoded}+specifications`;
}

function scoreCatalogMatch(item: HardwareLookupResult, queryTokens: string[]): number {
  const hay = normalizeTokens(`${item.brand} ${item.name} ${item.codename ?? ""}`);
  let score = 0;
  for (const qt of queryTokens) {
    if (hay.includes(qt)) score += 3;
    else if (hay.some((h) => h.includes(qt) || qt.includes(h))) score += 1;
  }
  return score;
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
    const clockMatches = [...text.matchAll(/(\d(?:\.\d{1,2})?)\s*GHz/gi)].map((m) =>
      Number(m[1])
    );
    if (clockMatches.length >= 1) {
      out.base_clock_ghz = Math.min(...clockMatches);
      if (clockMatches.length >= 2) out.turbo_clock_ghz = Math.max(...clockMatches);
    }
    const tdpMatch = text.match(/(\d{2,3})\s*W(?:att)?\s*(?:TDP|thermal)/i) ??
      text.match(/TDP\s*(?:of\s*)?(\d{2,3})\s*W/i);
    if (tdpMatch) out.tdp_w = Number(tdpMatch[1]);
    const nmMatch = text.match(/(\d{1,2})\s*nm\b/i);
    if (nmMatch) out.process_nm = Number(nmMatch[1]);
    const socketMatch = text.match(/\b(LGA\s*\d{3,4}|AM[345]|FM2\+?|SP[35]|sTRX\d)\b/i);
    if (socketMatch) out.socket = socketMatch[1].replace(/\s+/g, "").toUpperCase();
  } else {
    const vramMatch = text.match(/(\d{1,2})\s*GB\s*(?:of\s*)?(GDDR\dX?|HBM\d?e?|DDR\d)/i);
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

async function queryWikipediaSummary(
  query: string,
  brand: string,
  partType: "cpu" | "gpu",
): Promise<HardwareLookupResult | null> {
  try {
    const searchQ = `${brand} ${query} ${partType === "cpu" ? "processor" : "graphics"}`;
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${
      encodeURIComponent(searchQ)
    }&srlimit=1&utf8=&format=json`;
    const searchRes = await fetch(searchUrl, {
      signal: AbortSignal.timeout(3500),
      headers: { "User-Agent": "VelociPCs-Inventory/1.0 (hardware lookup)" },
    });
    if (!searchRes.ok) return null;
    const searchJson = await searchRes.json();
    const topTitle = searchJson?.query?.search?.[0]?.title as string | undefined;
    if (!topTitle) return null;

    const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=${
      encodeURIComponent(topTitle)
    }&format=json`;
    const extractRes = await fetch(extractUrl, {
      signal: AbortSignal.timeout(3500),
      headers: { "User-Agent": "VelociPCs-Inventory/1.0 (hardware lookup)" },
    });
    if (!extractRes.ok) return null;
    const extractJson = await extractRes.json();
    const pages = extractJson?.query?.pages ?? {};
    const firstPage = Object.values(pages)[0] as { extract?: string } | undefined;
    const summary = firstPage?.extract?.slice(0, 500) ?? "";
    if (!summary) return null;

    const extracted = extractSpecsFromText(summary, partType);
    const isMobile = /\b(mobile|laptop|max-q|hq|mq|hs|hx|u-series)\b/i.test(query);

    return {
      partType,
      name: query.trim(),
      brand,
      is_mobile: isMobile,
      spec_url: buildOfficialSearchUrl(query, brand, partType),
      source: "live",
      confidence: Object.keys(extracted).length > 0 ? "medium" : "medium",
      summary,
      ...extracted,
    };
  } catch {
    return null;
  }
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
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
      .map((entry) => entry.item);

    // If we have a strong catalog match, return it right away along with any partial live enrichment
    if (rankedCatalog.length > 0 && rankedCatalog[0].name.toLowerCase() === rawQuery.toLowerCase()) {
      return new Response(
        JSON.stringify({
          results: rankedCatalog,
          source: "catalog",
          note: "Matched official verified specification entry. Review and adjust any fields before saving.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Otherwise query live Wikipedia spec summary + attach canonical official search URL
    const liveMatch = await queryWikipediaSummary(rawQuery, brand, partType);
    const combined: HardwareLookupResult[] = [...rankedCatalog];

    if (liveMatch) {
      combined.unshift(liveMatch);
    } else if (combined.length === 0) {
      const isMobile = /\b(mobile|laptop|max-q|hq|mq|hs|hx|m)\b/i.test(rawQuery);
      combined.push({
        partType,
        name: rawQuery,
        brand,
        is_mobile: isMobile,
        spec_url: buildOfficialSearchUrl(rawQuery, brand, partType),
        source: "hybrid",
        confidence: "medium",
        summary: `Prepared official ${brand} spec search link for "${rawQuery}". Fill or verify specs in the modal before saving.`,
      });
    }

    return new Response(
      JSON.stringify({
        results: combined.slice(0, 6),
        source: liveMatch ? "hybrid" : "catalog",
        note: liveMatch
          ? "Live web spec summary fetched and paired with official vendor spec URL. Please review before saving."
          : "Returned closest catalog matches and official spec search URL. Please review before saving.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown lookup error";
    return new Response(
      JSON.stringify({ error: message, results: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
